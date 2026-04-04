const express = require('express');
const router = express.Router();
const LibraryCard = require('../models/LibraryCard');
const Book = require('../models/Book');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler, getPagination } = require('../utils/apiResponse');

// ── Constants ─────────────────────────────────────────────────────────────────
const PICKUP_DEADLINE_DAYS = 2;   // Student has 2 days to collect after approval
const TEMP_ISSUE_DAYS      = 15;  // Temporary: 15 days issue period
const PERM_ISSUE_DAYS      = 180; // Permanent: ~semester (6 months)

// Active statuses that BLOCK a new request for the same book
const BLOCKING_STATUSES = ['pending', 'approved_pending_pickup', 'issued'];

// Helper: add N days to a date
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

// Helper: generate unique card number
const makeCardNumber = () =>
  `LIB-${Date.now().toString(36).toUpperCase()}` +
  `-${Math.random().toString(36).slice(2, 8).toUpperCase()}` +
  `-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/library-cards/apply   (Student only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/apply', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { notes, course, branch, year, type, bookId } = req.body;

  if (!bookId) return ApiResponse.badRequest(res, 'Please select a book');

  // ── Check book exists and has copies ──────────────────────────────────────
  const book = await Book.findById(bookId);
  if (!book || !book.isActive) {
    return ApiResponse.notFound(res, 'Book not found');
  }
  if (book.availableCopies <= 0) {
    return ApiResponse.badRequest(res, 'This book has no available copies right now');
  }

  // ── DUPLICATE CHECK (DB): same book + student only blocked for ACTIVE statuses ──
  // returned / rejected / expired → student may request again
  const blockingDuplicate = await LibraryCard.findOne({
    student: req.user._id,
    book: bookId,
    status: { $in: BLOCKING_STATUSES },
  });
  if (blockingDuplicate) {
    const readableStatus = blockingDuplicate.status.replace(/_/g, ' ');
    return ApiResponse.badRequest(
      res,
      `You already have a "${readableStatus}" request for this book. ` +
      `Wait for it to be resolved before re-applying.`
    );
  }

  // ── Max 5 ACTIVE cards (pending + approved_pending_pickup + issued only) ─────
  const activeCount = await LibraryCard.countDocuments({
    student: req.user._id,
    status: { $in: BLOCKING_STATUSES },
  });
  if (activeCount >= 5) {
    return ApiResponse.badRequest(res, 'Maximum 5 cards reached. Return a book to unlock a slot.');
  }

  const existingCards = await LibraryCard.find({ student: req.user._id });
  const pendingCards = existingCards.filter(c => c.status === 'pending');
  if (pendingCards.length >= 2) {
    return ApiResponse.badRequest(res, 'You already have 2 pending requests. Wait for approval first.');
  }

  // ── Enforce temporary (max 3) / permanent (max 2) sub-limits ─────────────
  const issuedCards = existingCards.filter(c => c.status === 'issued');
  const tempCount   = issuedCards.filter(c => c.type === 'temporary').length;
  const permCount   = issuedCards.filter(c => c.type === 'permanent').length;

  if (type === 'temporary' && tempCount >= 3) {
    return ApiResponse.badRequest(res, 'Maximum 3 temporary books allowed');
  }
  if (type === 'permanent' && permCount >= 2) {
    return ApiResponse.badRequest(res, 'Maximum 2 permanent books allowed');
  }

  // ── Create the card (with E11000 duplicate-key guard) ─────────────────────
  let card;
  try {
    card = await LibraryCard.create({
      cardNumber: makeCardNumber(),
      student: req.user._id,
      book: bookId,
      applicationNotes: notes,
      course,
      branch,
      year,
      type: type || 'temporary',
      status: 'pending',
    });
  } catch (dbErr) {
    if (dbErr.code === 11000) {
      if (dbErr.keyPattern && dbErr.keyPattern.cardNumber) {
        // Rare cardNumber collision – retry once with a new number
        card = await LibraryCard.create({
          cardNumber: makeCardNumber(),
          student: req.user._id,
          book: bookId,
          applicationNotes: notes,
          course,
          branch,
          year,
          type: type || 'temporary',
          status: 'pending',
        });
      } else {
        // Often an old MongoDB unique index on `student` (one card per user). Drop it if you see this.
        const keys = dbErr.keyPattern ? JSON.stringify(dbErr.keyPattern) : '';
        return ApiResponse.badRequest(
          res,
          keys.includes('student') && !keys.includes('book')
            ? 'Database conflict: remove the old unique index on student in librarycards collection, or contact admin.'
            : 'Request already exists.'
        );
      }
    } else {
      throw dbErr;
    }
  }

  const populated = await LibraryCard.findById(card._id)
    .populate('book', 'title author semester')
    .populate('student', 'name email studentId');

  return ApiResponse.created(res, {
    message: 'Application submitted! Waiting for librarian approval.',
    data: populated,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/library-cards/:id/approve   (Librarian OR Admin)
// Status: pending → approved_pending_pickup
// - Sets a 2-day pickup deadline
// - Does NOT decrement book copies yet (book reserved only after pickup)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/approve', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findById(req.params.id).populate('book');
  if (!card) return ApiResponse.notFound(res, 'Library card not found');

  if (!['pending', 'rejected'].includes(card.status)) {
    return ApiResponse.badRequest(res, `Cannot approve a card with status: ${card.status}`);
  }

  // Check book is still available
  if (card.book && card.book.availableCopies <= 0) {
    return ApiResponse.badRequest(res, 'Book is no longer available. No copies left.');
  }

  const now = new Date();
  card.status              = 'approved_pending_pickup';
  card.approvedByLibrarian = req.user._id;
  card.approvedByAdmin     = req.user._id;
  card.reviewedBy          = req.user._id;
  card.reviewedAt          = now;
  card.pickupDeadline      = addDays(now, PICKUP_DEADLINE_DAYS); // 2 days to collect

  await card.save();

  return ApiResponse.success(res, {
    message: `Card approved! Student must collect the book by ${card.pickupDeadline.toDateString()}.`,
    data: card,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/library-cards/:id/collect   (Librarian OR Admin)
// Librarian verifies student ID manually, then clicks "Mark as Collected"
// Status: approved_pending_pickup → issued
// - Sets issueDate = today, dueDate = today + 15 (temp) or +180 (perm)
// - Decrements book available copies ATOMICALLY
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/collect', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findById(req.params.id).populate('book');
  if (!card) return ApiResponse.notFound(res, 'Library card not found');

  if (card.status !== 'approved_pending_pickup') {
    return ApiResponse.badRequest(
      res,
      `Can only mark as collected when status is "approved pending pickup". Current: ${card.status}`
    );
  }

  // Check pickup deadline has not passed
  if (card.pickupDeadline && new Date() > card.pickupDeadline) {
    // Auto-expire this card
    card.status = 'expired';
    await card.save();
    return ApiResponse.badRequest(
      res,
      'Pickup deadline has passed. The request has been automatically expired. ' +
      'The student can submit a new request.'
    );
  }

  // Verify book still exists
  if (!card.book) {
    return ApiResponse.badRequest(res, 'No book linked to this card');
  }

  // Decrement book copies atomically
  const updatedBook = await Book.findOneAndUpdate(
    { _id: card.book._id, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );
  if (!updatedBook) {
    return ApiResponse.badRequest(res, 'Book is no longer available. Cannot issue.');
  }

  const now     = new Date();
  const issueDays = card.type === 'permanent' ? PERM_ISSUE_DAYS : TEMP_ISSUE_DAYS;

  card.status      = 'issued';
  card.issueDate   = now;
  card.dueDate     = addDays(now, issueDays);
  card.validFrom   = now;
  card.validUntil  = addDays(now, issueDays);
  card.collectedBy = req.user._id;
  card.collectedAt = now;
  await card.save();

  const populated = await LibraryCard.findById(card._id)
    .populate('book', 'title author')
    .populate('student', 'name email studentId')
    .populate('collectedBy', 'name');

  return ApiResponse.success(res, {
    message: `Book issued! Due date: ${card.dueDate.toDateString()}`,
    data: populated,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/library-cards/:id/reject   (Librarian OR Admin)
// Can reject pending OR approved_pending_pickup cards
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/reject', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const card = await LibraryCard.findById(req.params.id).populate('book');
  if (!card) return ApiResponse.notFound(res, 'Library card not found');

  const rejectableStatuses = ['pending', 'approved_pending_pickup', 'issued'];
  if (!rejectableStatuses.includes(card.status)) {
    return ApiResponse.badRequest(res, `Cannot reject a card with status: ${card.status}`);
  }

  // Capture BEFORE changing status — only 'issued' cards had copies decremented
  // ('approved_pending_pickup' did NOT decrement — that happens at collect time)
  const wasIssued = card.status === 'issued';

  card.status          = 'rejected';
  card.rejectionReason = reason || 'No reason provided';
  card.reviewedBy      = req.user._id;
  card.reviewedAt      = new Date();
  await card.save();

  // Restore book copy only if it was truly issued (copy was decremented at collect step)
  if (wasIssued && card.book) {
    await Book.findByIdAndUpdate(card.book._id, { $inc: { availableCopies: 1 } });
  }

  return ApiResponse.success(res, {
    message: 'Card rejected. Student can submit a new request.',
    data: card,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/library-cards/:id/return
// issued → returned (frees a card slot; copy was decremented at collect)
// Student (own card) OR librarian / admin
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/return', protect, authorize('student', 'librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findById(req.params.id).populate('book');
  if (!card) return ApiResponse.notFound(res, 'Library card not found');

  if (req.user.role === 'student' && card.student.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res, 'You can only return your own books');
  }

  if (card.status !== 'issued') {
    return ApiResponse.badRequest(res, `Only issued books can be returned. Current status: ${card.status}`);
  }

  card.status = 'returned';
  card.returnedAt = new Date();
  await card.save();

  if (card.book) {
    await Book.findByIdAndUpdate(card.book._id, { $inc: { availableCopies: 1 } });
  }

  return ApiResponse.success(res, {
    message: 'Book returned. Card slot is now free for a new request.',
    data: card,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/library-cards/run-expire   (Librarian / Admin)
// Expire all "approved_pending_pickup" cards past their pickup deadline.
// Call this manually or wire to a cron job.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/run-expire', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const now = new Date();

  // Find all cards past their pickup deadline
  const overdueCards = await LibraryCard.find({
    status: 'approved_pending_pickup',
    pickupDeadline: { $lt: now },
  });

  let expiredCount = 0;
  for (const card of overdueCards) {
    card.status = 'expired';
    await card.save();
    expiredCount++;
    // Note: book copies were NOT decremented on approval, so nothing to restore
  }

  return ApiResponse.success(res, {
    message: `${expiredCount} card(s) expired due to missed pickup deadline.`,
    data: { expiredCount },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/library-cards/my-card   (Student — their own cards)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-card', protect, authorize('student'), asyncHandler(async (req, res) => {
  const cards = await LibraryCard.find({ student: req.user._id })
    .populate('book', 'title author semester')
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 });
  return ApiResponse.success(res, { data: cards });
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/library-cards/stats   (Librarian / Admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const stats = await LibraryCard.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return ApiResponse.success(res, { data: stats });
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/library-cards   (Student → own; Librarian/Admin → all)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', protect, asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, type, student } = req.query;

  const filter = {};
  if (req.user.role === 'student') {
    filter.student = req.user._id;
  } else {
    if (status)  filter.status  = status;
    if (type)    filter.type    = type;
    if (student) filter.student = student;
  }

  const [cards, total] = await Promise.all([
    LibraryCard.find(filter)
      .populate('student', 'name email studentId')
      .populate('book', 'title author semester')
      .populate('reviewedBy', 'name')
      .populate('collectedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LibraryCard.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, { data: cards, page, limit, total });
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/library-cards/:id   (Librarian / Admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findById(req.params.id)
    .populate('student', 'name email studentId')
    .populate('book', 'title author')
    .populate('reviewedBy', 'name')
    .populate('collectedBy', 'name');
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  return ApiResponse.success(res, { data: card });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/library-cards/:id/suspend   (Librarian / Admin)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/suspend', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findByIdAndUpdate(
    req.params.id,
    { status: 'suspended', suspensionReason: req.body.reason },
    { new: true }
  );
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  return ApiResponse.success(res, { message: 'Card suspended', data: card });
}));

module.exports = router;
