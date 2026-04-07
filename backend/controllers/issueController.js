/**
 * issueController.js
 * Handles issuing and returning books.
 * Fine = overdueDays × ₹5 per day.
 */

const IssueRecord = require('../models/IssueRecord');
const Book        = require('../models/Book');
const LibraryCard = require('../models/LibraryCard');
const Fine        = require('../models/Fine');
const User        = require('../models/User');
const { ApiResponse, asyncHandler } = require('../utils/apiResponse');

const FINE_PER_DAY   = 5;   // ₹5 per overdue day
const TEMP_DAYS      = 1;  // Temporary issue duration
const PERM_DAYS      = 180; // Permanent issue duration (~semester)
const MAX_BOOKS      = 5;   // Max books per student
const MAX_TEMP       = 3;   // Max temporary books
const MAX_PERM       = 2;   // Max permanent books

// ─── Helpers ──────────────────────────────────────────────────────────────────
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const daysBetween = (a, b) =>
  Math.max(0, Math.ceil((new Date(b) - new Date(a)) / 86400000));

// After a book copy is returned, auto-promote the oldest rejected card to approved_pending_pickup
// so the student gets a chance to come pick it up within 2 days.
const autoApproveRejected = async (bookId) => {
  try {
    const book = await Book.findById(bookId);
    if (!book || book.availableCopies <= 0) return;

    // Find the oldest rejected card for this book
    const card = await LibraryCard.findOne({ book: bookId, status: 'rejected' }).sort({ createdAt: 1 });
    if (!card) return;

    // Promote to approved_pending_pickup — student has 2 days to collect
    card.status         = 'approved_pending_pickup';
    card.pickupDeadline = addDays(new Date(), 2); // 2-day window to collect
    card.reviewedAt     = new Date();
    // NOTE: Do NOT decrement availableCopies here.
    // Copies are only decremented when the student actually collects (PATCH /collect).
    await card.save();

    console.log(`[AutoApprove] Card ${card._id} promoted to approved_pending_pickup for book "${book.title}"`);
  } catch (err) {
    console.error('[AutoApprove] Error:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/issues/issue
// Issue a book to a student (Librarian / Admin action)
// ─────────────────────────────────────────────────────────────────────────────
exports.issueBook = asyncHandler(async (req, res) => {
  const { bookId, studentId: bodyStudentId, issueType = 'temporary' } = req.body;
  const isStudent = req.user?.role?.toLowerCase() === 'student';

  // Determine target student
  const targetStudentId = bodyStudentId || (isStudent ? req.user._id : null);
  if (!targetStudentId) {
    return ApiResponse.badRequest(res, 'studentId is required when issued by staff');
  }

  // Students can only issue for themselves
  if (isStudent && bodyStudentId && bodyStudentId.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res, 'You can only issue books for your own account');
  }

  // 1. Validate student exists
  const student = await User.findById(targetStudentId);
  if (!student || student.role !== 'student') {
    return ApiResponse.notFound(res, 'Student not found');
  }

  // 2. Find approved library card for student
  const card = await LibraryCard.findOne({ student: targetStudentId, status: 'approved' });
  if (!card) {
    return ApiResponse.badRequest(res, 'Student must have an approved library card before issuing books');
  }

  // 3. Check issue limits (max 5 total, 3 temp, 2 perm)
  const currentIssues = await IssueRecord.find({ student: targetStudentId, status: 'issued' });
  const tempCount = currentIssues.filter(i => i.issueType === 'temporary').length;
  const permCount = currentIssues.filter(i => i.issueType === 'permanent').length;

  if (currentIssues.length >= MAX_BOOKS) {
    return ApiResponse.badRequest(res, `Maximum ${MAX_BOOKS} books can be issued at once`);
  }
  if (issueType === 'temporary' && tempCount >= MAX_TEMP) {
    return ApiResponse.badRequest(res, `Maximum ${MAX_TEMP} temporary books allowed`);
  }
  if (issueType === 'permanent' && permCount >= MAX_PERM) {
    return ApiResponse.badRequest(res, `Maximum ${MAX_PERM} permanent books allowed`);
  }

  // 4. Check for unpaid fines
  const unpaidFines = await Fine.countDocuments({
    student: targetStudentId,
    status: { $in: ['pending', 'partial'] },
  });
  if (unpaidFines > 0) {
    return ApiResponse.badRequest(
      res,
      `Student has ${unpaidFines} unpaid fine(s). Clear fines before issuing books.`
    );
  }

  // 5. Validate and fetch book
  if (!bookId) return ApiResponse.badRequest(res, 'bookId is required');
  const book = await Book.findById(bookId);
  if (!book || !book.isActive) return ApiResponse.notFound(res, 'Book not found');
  if (book.availableCopies <= 0) return ApiResponse.badRequest(res, 'No copies available');

  // 6. Prevent duplicate issue of same book
  const alreadyIssued = await IssueRecord.findOne({ book: bookId, student: targetStudentId, status: 'issued' });
  if (alreadyIssued) return ApiResponse.conflict(res, 'Student already has this book issued');

  // 7. Calculate due date
  const dueDate = addDays(new Date(), issueType === 'permanent' ? PERM_DAYS : TEMP_DAYS);

  // 8. Create issue record
  const issue = await IssueRecord.create({
    book:        bookId,
    student:     targetStudentId,
    libraryCard: card._id,
    issuedBy:    req.user._id,
    issueType,
    dueDate,
    condition:   { atIssue: req.body.condition || 'good' },
    notes:       req.body.notes,
  });

  // 9. Decrement available copies
  await book.decrementAvailable();

  // 10. Return populated result
  const populated = await IssueRecord.findById(issue._id)
    .populate('book',    'title author semester')
    .populate('student', 'name email studentId');

  return ApiResponse.created(res, {
    message: `"${book.title}" issued as ${issueType}. Due: ${dueDate.toDateString()}`,
    data: populated,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/issues/return
// ─────────────────────────────────────────────────────────────────────────────
exports.returnBook = asyncHandler(async (req, res) => {
  const { issueRecordId, condition, notes } = req.body;
  if (!issueRecordId) return ApiResponse.badRequest(res, 'issueRecordId is required');

  const issue = await IssueRecord.findById(issueRecordId)
    .populate('book')
    .populate('student', 'name email studentId');

  if (!issue) return ApiResponse.notFound(res, 'Issue record not found');
  if (issue.status === 'returned') return ApiResponse.badRequest(res, 'Book already returned');

  // Students can only return their own books
  if (req.user?.role?.toLowerCase() === 'student' &&
      issue.student?._id?.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res, 'You can only return your own issued books');
  }

  const returnDate = new Date();

  // Calculate fine: overdueDays × ₹5
  const overdueDays  = daysBetween(issue.dueDate, returnDate);
  const isOverdue    = new Date() > new Date(issue.dueDate);
  const fineAmount   = isOverdue ? overdueDays * FINE_PER_DAY : 0;

  // Update issue record
  issue.status      = 'returned';
  issue.returnDate  = returnDate;
  issue.returnedTo  = req.user._id;
  issue.notes       = notes || issue.notes;
  if (condition) issue.condition.atReturn = condition;
  await issue.save();

  // ── Mark the linked LibraryCard as 'returned' ───────────────────
  // This frees the card slot so the student can request a new book.
  // BLOCKING_STATUSES = ['pending','approved_pending_pickup','issued']
  // 'returned' is NOT in that list, so the slot is immediately available.
  if (issue.libraryCard) {
    await LibraryCard.findByIdAndUpdate(
      issue.libraryCard,
      { status: 'returned' },
      { new: true }
    );
  } else {
    // Fallback: find the most recent issued card for this student+book pair
    await LibraryCard.findOneAndUpdate(
      { student: issue.student._id, book: issue.book._id, status: 'issued' },
      { status: 'returned' },
      { sort: { updatedAt: -1 } }
    );
  }

  // Restore book copy
  const updatedBook = await issue.book.incrementAvailable();

  // Auto-approve rejected cards for this book
  if (updatedBook && updatedBook.availableCopies > 0) {
    autoApproveRejected(updatedBook._id).catch(console.error);
  }

  // Create fine if overdue
  let fine = null;
  if (isOverdue && fineAmount > 0) {
    fine = await Fine.create({
      student:    issue.student._id,
      issueRecord: issue._id,
      book:        issue.book._id,
      amount:      fineAmount,
      overdueDays,
      finePerDay:  FINE_PER_DAY,
      dueDate:     issue.dueDate,
      returnDate,
    });
  }

  return ApiResponse.success(res, {
    message: 'Book returned successfully',
    data: {
      issue,
      fine: fine
        ? { id: fine._id, amount: fine.amount, overdueDays: fine.overdueDays }
        : null,
      returnedOnTime: !isOverdue,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/issues
// Student → own issues | Staff → all issues
// ─────────────────────────────────────────────────────────────────────────────
exports.getIssues = asyncHandler(async (req, res) => {
  const { status, studentId, bookId } = req.query;
  const filter = {};

  if (req.user.role === 'student') {
    filter.student = req.user._id;
  } else {
    if (studentId) filter.student = studentId;
    if (bookId)    filter.book    = bookId;
  }
  if (status) filter.status = status;

  const records = await IssueRecord.find(filter)
    .populate('book',       'title author semester')
    .populate('student',    'name email studentId')
    .populate('issuedBy',   'name')
    .populate('returnedTo', 'name')
    .sort({ createdAt: -1 })
    .lean();

  // Attach isOverdue computed flag
  const enriched = records.map(r => ({
    ...r,
    isOverdue: r.status === 'issued' && new Date() > new Date(r.dueDate),
  }));

  return res.json({ success: true, data: enriched });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/issues/overdue
// ─────────────────────────────────────────────────────────────────────────────
exports.getOverdueIssues = asyncHandler(async (req, res) => {
  const records = await IssueRecord.find({
    status: 'issued',
    dueDate: { $lt: new Date() },
  })
    .populate('book',    'title author')
    .populate('student', 'name email studentId')
    .sort({ dueDate: 1 })
    .lean();

  const enriched = records.map(r => ({
    ...r,
    overdueDays: daysBetween(r.dueDate, new Date()),
    estimatedFine: daysBetween(r.dueDate, new Date()) * FINE_PER_DAY,
    isOverdue: true,
  }));

  return res.json({ success: true, data: enriched });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/issues/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getIssueById = asyncHandler(async (req, res) => {
  const record = await IssueRecord.findById(req.params.id)
    .populate('book',        'title author isbn')
    .populate('student',     'name email studentId')
    .populate('libraryCard', 'cardNumber status')
    .populate('issuedBy',    'name email')
    .populate('returnedTo',  'name email');

  if (!record) return ApiResponse.notFound(res, 'Issue record not found');

  if (req.user.role === 'student' &&
      record.student._id.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res);
  }

  return ApiResponse.success(res, { data: record });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/issues/:id/renew
// ─────────────────────────────────────────────────────────────────────────────
exports.renewBook = asyncHandler(async (req, res) => {
  const record = await IssueRecord.findById(req.params.id).populate('book', 'title');
  if (!record) return ApiResponse.notFound(res, 'Issue record not found');

  if (record.status !== 'issued') {
    return ApiResponse.badRequest(res, 'Only active issues can be renewed');
  }
  if (record.renewals >= 2) {
    return ApiResponse.badRequest(res, 'Maximum 2 renewals reached');
  }
  const isOverdueNow = new Date() > new Date(record.dueDate);
  if (isOverdueNow) {
    return ApiResponse.badRequest(res, 'Overdue books cannot be renewed. Return and pay fine first.');
  }

  const previousDueDate = record.dueDate;
  const days = record.issueType === 'permanent' ? PERM_DAYS : TEMP_DAYS;
  const newDueDate = addDays(record.dueDate > new Date() ? record.dueDate : new Date(), days);

  record.renewalHistory.push({
    renewedAt:       new Date(),
    renewedBy:       req.user._id,
    previousDueDate,
    newDueDate,
  });
  record.renewals += 1;
  record.dueDate   = newDueDate;
  await record.save();

  return ApiResponse.success(res, {
    message: `Book renewed. New due date: ${newDueDate.toDateString()}`,
    data: record,
  });
});
