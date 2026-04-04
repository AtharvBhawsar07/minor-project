const IssueRecord = require('../models/IssueRecord');
const Book = require('../models/Book');
const LibraryCard = require('../models/LibraryCard');
const Fine = require('../models/Fine');
const User = require('../models/User');
const { ApiResponse, asyncHandler, getPagination } = require('../utils/apiResponse');
const { calculateFine, calculateDueDate } = require('../utils/fineCalculator');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * POST /api/issues/issue
 * Student/Librarian/Admin (college submission simplified)
 */
exports.issueBook = asyncHandler(async (req, res) => {
  const { bookId, studentId: bodyStudentId, issueType: bodyIssueType } = req.body;

  const isStudentUser = req.user?.role?.toLowerCase() === 'student';
  const targetStudentId = bodyStudentId || (isStudentUser ? req.user._id : null);
  if (!targetStudentId) {
    return ApiResponse.badRequest(res, 'studentId is required (staff issuing)'); 
  }
  if (
    isStudentUser &&
    bodyStudentId &&
    bodyStudentId.toString() !== req.user._id.toString()
  ) {
    return ApiResponse.forbidden(res, 'You can only issue books for your own account');
  }

  // 1. Fetch student
  const student = await User.findById(targetStudentId);
  if (!student || student.role !== 'student') {
    return ApiResponse.notFound(res, 'Student not found');
  }

  // 2. Fetch and validate library card
  const card = await LibraryCard.findOne({ student: targetStudentId });
  if (!card) {
    return ApiResponse.badRequest(res, 'Student does not have a library card');
  }
  if (card.status !== 'approved') {
    return ApiResponse.badRequest(res, `Student's library card is ${card.status}. Cannot issue books.`);
  }
  if (card.isExpired) {
    return ApiResponse.badRequest(res, 'Student\'s library card has expired');
  }

  // If student didn't specify, pick issue type based on card type.
  let issueType = bodyIssueType;
  if (!issueType) {
    issueType = card.type === 'permanent' ? 'permanent' : 'temporary';
  }

  // 3. ENFORCE LIMITS: 3 Temp + 2 Perm (Max 5 total)
  const currentIssues = await IssueRecord.find({ student: targetStudentId, status: 'issued' });
  const tempCount = currentIssues.filter(i => i.issueType === 'temporary').length;
  const permCount = currentIssues.filter(i => i.issueType === 'permanent').length;

  if (issueType === 'temporary' && tempCount >= 3) {
    return ApiResponse.badRequest(res, 'Limit reached: Maximum 3 temporary books allowed (15 days)');
  }
  if (issueType === 'permanent' && permCount >= 2) {
    return ApiResponse.badRequest(res, 'Limit reached: Maximum 2 permanent books allowed (semester)');
  }
  const maxTotal = 5;
  if (currentIssues.length >= maxTotal) {
    return ApiResponse.badRequest(res, 'Limit reached: Maximum exactly 5 books can be issued');
  }

  // 4. Check student has no unpaid fines
  const unpaidFines = await Fine.countDocuments({
    student: targetStudentId,
    status: { $in: ['pending', 'partial'] },
  });
  if (unpaidFines > 0) {
    return ApiResponse.badRequest(
      res,
      `Student has ${unpaidFines} unpaid fine(s). Please clear fines before issuing books.`
    );
  }

  // 5. Fetch and validate book
  const book = await Book.findById(bookId);
  if (!book || !book.isActive) {
    return ApiResponse.notFound(res, 'Book not found');
  }
  if (book.availableCopies <= 0) {
    return ApiResponse.badRequest(res, 'No copies of this book are currently available');
  }

  // 6. Check duplicate issue (student already has this book)
  const alreadyIssued = await IssueRecord.findOne({
    book: bookId,
    student: targetStudentId,
    status: 'issued',
  });
  if (alreadyIssued) {
    return ApiResponse.conflict(res, 'Student already has this book issued');
  }

  // 7. Calculate due date based on type
  const dueDate = calculateDueDate(issueType, new Date());
  const semesterEndDate = issueType === 'permanent' ? new Date(dueDate) : undefined;
  const graceUntil = (() => {
    if (issueType !== 'permanent') return undefined;
    const d = new Date(dueDate);
    d.setDate(d.getDate() + 5);
    return d;
  })();

  // 8. Create issue record
  const issueRecord = await IssueRecord.create({
    book: bookId,
    student: targetStudentId,
    libraryCard: card._id,
    issuedBy: req.user._id,
    dueDate,
    semesterEndDate,
    graceUntil,
    issueType,
    condition: { atIssue: req.body.condition || 'good' },
    notes: req.body.notes,
  });

  // 9. Decrement book availability
  await book.decrementAvailable();

  // 10. Increment card counter
  card.currentBooksIssued += 1;
  await card.save();

  // 11. Populate and send response
  const populated = await IssueRecord.findById(issueRecord._id)
    .populate('book', 'title author isbn')
    .populate('student', 'name email studentId')
    .populate('issuedBy', 'name email');

  // 12. Send email notification
  emailService.sendBookIssued(student, issueRecord, book).catch((err) =>
    logger.error(`Failed to send issue email: ${err.message}`)
  );

  logger.info(`Book issued: "${book.title}" (${issueType}) → ${student.email} by ${req.user.email}`);

  return ApiResponse.created(res, {
    message: `"${book.title}" issued as ${issueType}. Due date: ${dueDate.toDateString()}`,
    data: populated,
  });
});

/**
 * POST /api/issues/return
 * Student/Librarian/Admin
 */
exports.returnBook = asyncHandler(async (req, res) => {
  const { issueRecordId, condition, notes } = req.body;

  // 1. Find issue record
  const issueRecord = await IssueRecord.findById(issueRecordId)
    .populate('book')
    .populate('student', 'name email studentId');

  if (!issueRecord) {
    return ApiResponse.notFound(res, 'Issue record not found');
  }

  // Students can only return their own issued books
  if (
    req.user?.role?.toLowerCase() === 'student' &&
    issueRecord.student?._id?.toString() !== req.user._id.toString()
  ) {
    return ApiResponse.forbidden(res, 'You can only return your own issued books');
  }

  if (issueRecord.status === 'returned') {
    return ApiResponse.badRequest(res, 'This book has already been returned');
  }

  const returnDate = new Date();

  // 2. Calculate fine
  const { overdueDays, fineAmount, isOverdue } = calculateFine(issueRecord.dueDate, returnDate, {
    issueType: issueRecord.issueType,
    semesterEndDate: issueRecord.semesterEndDate,
    graceUntil: issueRecord.graceUntil,
  });

  // 3. Update issue record
  issueRecord.status = 'returned';
  issueRecord.returnDate = returnDate;
  issueRecord.returnedTo = req.user._id;
  issueRecord.notes = notes || issueRecord.notes;
  if (condition) issueRecord.condition.atReturn = condition;
  await issueRecord.save();

  // 4. Increment book availability
  await issueRecord.book.incrementAvailable();

  // 5. Decrement library card counter
  const card = await LibraryCard.findById(issueRecord.libraryCard);
  if (card && card.currentBooksIssued > 0) {
    card.currentBooksIssued -= 1;
    await card.save();
  }

  // 6. Create fine if overdue
  let fine = null;
  if (isOverdue && fineAmount > 0) {
    fine = await Fine.create({
      student: issueRecord.student._id,
      issueRecord: issueRecord._id,
      book: issueRecord.book._id,
      amount: fineAmount,
      overdueDays,
      finePerDay: parseFloat(process.env.FINE_PER_DAY) || 5,
      dueDate: issueRecord.dueDate,
      returnDate,
    });

    logger.info(
      `Fine created: ₹${fineAmount} for ${issueRecord.student.email} (${overdueDays} days overdue)`
    );
  }

  // 7. Send email
  emailService
    .sendBookReturned(issueRecord.student, issueRecord.book, fine)
    .catch((err) => logger.error(`Failed to send return email: ${err.message}`));

  logger.info(`Book returned: "${issueRecord.book.title}" by ${issueRecord.student.email}`);

  return ApiResponse.success(res, {
    message: 'Book returned successfully',
    data: {
      issueRecord,
      fine: fine
        ? {
            id: fine._id,
            amount: fine.amount,
            overdueDays: fine.overdueDays,
            status: fine.status,
          }
        : null,
      returnedOnTime: !isOverdue,
    },
  });
});

/**
 * GET /api/issues
 * Librarian/Admin — all issues; Student — own issues
 */
exports.getIssues = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, studentId, bookId } = req.query;

  const filter = {};

  // Students can only see their own
  if (req.user.role === 'student') {
    filter.student = req.user._id;
  } else {
    if (studentId) filter.student = studentId;
    if (bookId) filter.book = bookId;
  }
  if (status) filter.status = status;

  const [records, total] = await Promise.all([
    IssueRecord.find(filter)
      .populate('book', 'title author isbn coverImage')
      .populate('student', 'name email studentId')
      .populate('issuedBy', 'name')
      .populate('returnedTo', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    IssueRecord.countDocuments(filter),
  ]);

  // Re-attach isOverdue virtual manually on lean results
  const enriched = records.map((r) => {
    const { isOverdue } = calculateFine(r.dueDate, new Date(), {
      issueType: r.issueType,
      semesterEndDate: r.semesterEndDate,
      graceUntil: r.graceUntil,
    });
    return { ...r, isOverdue: r.status === 'issued' ? isOverdue : false };
  });

  return ApiResponse.paginated(res, { data: enriched, page, limit, total });
});

/**
 * GET /api/issues/overdue
 * Librarian/Admin only
 */
exports.getOverdueIssues = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  // Temporary: overdue after dueDate.
  // Permanent: dueDate is semester end; fine starts after grace period.
  // We fetch issued records and compute overdue via calculateFine (simple and safe).
  const filter = { status: 'issued' };

  const [records, total] = await Promise.all([
    IssueRecord.find(filter)
      .populate('book', 'title author isbn')
      .populate('student', 'name email studentId phone')
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    IssueRecord.countDocuments(filter),
  ]);

  // Attach calculated fine for each
  const enriched = records.map((r) => {
    const { overdueDays, fineAmount, isOverdue } = calculateFine(r.dueDate, new Date(), {
      issueType: r.issueType,
      semesterEndDate: r.semesterEndDate,
      graceUntil: r.graceUntil,
    });
    if (!isOverdue) return null;
    return { ...r, overdueDays, estimatedFine: fineAmount };
  }).filter(Boolean);

  return ApiResponse.paginated(res, { data: enriched, page, limit, total });
});

/**
 * GET /api/issues/:id
 */
exports.getIssueById = asyncHandler(async (req, res) => {
  const record = await IssueRecord.findById(req.params.id)
    .populate('book', 'title author isbn genre coverImage')
    .populate('student', 'name email studentId department')
    .populate('libraryCard', 'cardNumber status')
    .populate('issuedBy', 'name email')
    .populate('returnedTo', 'name email');

  if (!record) return ApiResponse.notFound(res, 'Issue record not found');

  // Students can only see their own records
  if (
    req.user.role === 'student' &&
    record.student._id.toString() !== req.user._id.toString()
  ) {
    return ApiResponse.forbidden(res);
  }

  return ApiResponse.success(res, { data: record });
});

/**
 * POST /api/issues/:id/renew
 * Librarian/Student (with card)
 */
exports.renewBook = asyncHandler(async (req, res) => {
  const record = await IssueRecord.findById(req.params.id).populate('book', 'title');
  if (!record) return ApiResponse.notFound(res, 'Issue record not found');

  if (record.status !== 'issued') {
    return ApiResponse.badRequest(res, 'Only active issue records can be renewed');
  }
  if (record.renewals >= 2) {
    return ApiResponse.badRequest(res, 'Maximum renewals (2) reached for this book');
  }
  if (record.isOverdue) {
    return ApiResponse.badRequest(res, 'Overdue books cannot be renewed. Please return and pay fine.');
  }

  const previousDueDate = record.dueDate;
  // Fix: extend from current due date, not from today
  const baseDate = record.dueDate > new Date() ? record.dueDate : new Date();
  const newDueDate = calculateDueDate(record.issueType, baseDate);

  record.renewalHistory.push({
    renewedAt: new Date(),
    renewedBy: req.user._id,
    previousDueDate,
    newDueDate,
  });
  record.renewals += 1;
  record.dueDate = newDueDate;
  await record.save();

  logger.info(`Book renewed: "${record.book.title}" by ${req.user.email}`);

  return ApiResponse.success(res, {
    message: `Book renewed. New due date: ${newDueDate.toDateString()}`,
    data: record,
  });
});
