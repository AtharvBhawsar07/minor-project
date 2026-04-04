const express = require('express');
const router = express.Router();
const LibraryCard = require('../models/LibraryCard');
const Book = require('../models/Book');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler, getPagination } = require('../utils/apiResponse');

// POST /api/library-cards/apply
router.post('/apply', protect, authorize('student'), asyncHandler(async (req, res) => {
  const { notes, course, branch, year, type, bookId } = req.body;
  
  if (!bookId) return ApiResponse.badRequest(res, 'Please select a book');
  const book = await Book.findById(bookId);
  if (!book || book.availableCopies === 0) {
    return ApiResponse.badRequest(res, 'Book not available');
  }

  // Check card limit (max 5 cards per student)
  const existingCards = await LibraryCard.find({ student: req.user._id });
  const approvedCards = existingCards.filter(card => card.status === 'approved');
  const pendingCards = existingCards.filter(card => card.status === 'pending');
  
  if (approvedCards.length >= 5) {
    return ApiResponse.badRequest(res, `You have reached the maximum limit of 5 library cards`);
  }
  
  if (pendingCards.length >= 2) {
    return ApiResponse.badRequest(res, `You have too many pending applications. Please wait for approval.`);
  }
  
  // Count card types
  const tempCards = approvedCards.filter(card => card.type === 'temporary').length;
  const permCards = approvedCards.filter(card => card.type === 'permanent').length;
  
  if (type === 'temporary' && tempCards >= 3) {
    return ApiResponse.badRequest(res, `You have reached the maximum limit of 3 temporary cards`);
  }
  
  if (type === 'permanent' && permCards >= 2) {
    return ApiResponse.badRequest(res, `You have reached the maximum limit of 2 permanent cards`);
  }
  
  const card = await LibraryCard.create({ 
    student: req.user._id, 
    book: bookId,
    applicationNotes: notes,
    course,
    branch,
    year,
    type: type || 'temporary',
    status: 'pending'
  });
  
  return ApiResponse.created(res, { 
    message: 'Application submitted successfully', 
    data: card,
    cardsUsed: approvedCards.length,
    cardsRemaining: 5 - approvedCards.length
  });
}));

// PATCH /api/library-cards/:id/approve
router.patch('/:id/approve', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findById(req.params.id);
  if (!card) return ApiResponse.notFound(res, 'Library card not found');

  if (card.status !== 'pending') {
    return ApiResponse.badRequest(res, `Only pending applications can be approved (current: ${card.status})`);
  }

  // Both librarian and admin can approve directly
  card.status = 'approved';
  card.approvedByLibrarian = req.user._id;
  card.approvedByAdmin = req.user._id;
  card.validFrom = new Date();
  card.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
  card.bookLimit = 5;
  card.reviewedBy = req.user._id;
  card.reviewedAt = new Date();

  if (card.book) {
    const book = await Book.findById(card.book);
    if (book) {
      book.assignedTo = card.student;
      await book.save();
    }
  }

  await card.save();
  return ApiResponse.success(res, { message: `Card approved by ${req.user.role}`, data: card });
}));

// PUT /api/library-cards/:id/approve (alias for PATCH, for simpler clients)
router.put('/:id/approve', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  // reuse same logic by calling the PATCH handler behavior
  const card = await LibraryCard.findById(req.params.id);
  if (!card) return ApiResponse.notFound(res, 'Library card not found');

  if (req.user.role.toLowerCase() === 'librarian') {
    if (card.status !== 'pending') {
      return ApiResponse.badRequest(res, `Only pending applications can be approved by librarian (current: ${card.status})`);
    }
    card.status = 'approved_by_librarian';
    card.approvedByLibrarian = req.user._id;
    card.reviewedBy = req.user._id;
    card.reviewedAt = new Date();
  } else if (req.user.role.toLowerCase() === 'admin') {
    if (card.status !== 'approved_by_librarian') {
      return ApiResponse.badRequest(res, `Admin can only finalize cards after librarian approval (current: ${card.status})`);
    }
    card.status = 'approved';
    card.approvedByAdmin = req.user._id;
    card.validFrom = new Date();
    card.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    card.bookLimit = 5;
    card.reviewedBy = req.user._id;
    card.reviewedAt = new Date();
    
    if (card.book) {
      const book = await Book.findById(card.book);
      if (book) {
        book.assignedTo = card.student;
        await book.save();
      }
    }
  }

  await card.save();
  return ApiResponse.success(res, { message: `Card status updated to: ${card.status}`, data: card });
}));

// PATCH /api/library-cards/:id/reject
router.patch('/:id/reject', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const card = await LibraryCard.findById(req.params.id);
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  
  if (card.status !== 'pending' && card.status !== 'approved_by_librarian') {
    return ApiResponse.badRequest(res, `Only pending or librarian-approved applications can be rejected (current: ${card.status})`);
  }
  
  // Validate rejection reason
  if (!reason || reason.trim().length === 0) {
    return ApiResponse.badRequest(res, 'Rejection reason is required');
  }
  
  // Common rejection reasons
  const validReasons = [
    'Book not available',
    'Already assigned', 
    'Incomplete documentation',
    'Eligibility criteria not met',
    'Duplicate application',
    'Other'
  ];
  
  const isValidReason = validReasons.includes(reason.trim()) || reason.trim().startsWith('Other:');
  if (!isValidReason) {
    return ApiResponse.badRequest(res, 'Invalid rejection reason. Please choose from: ' + validReasons.join(', '));
  }
  
  card.status = 'rejected';
  card.rejectionReason = reason.trim();
  card.reviewedBy = req.user._id;
  card.reviewedAt = new Date();
  
  await card.save();
  return ApiResponse.success(res, { message: 'Application rejected', data: card });
}));

// PUT /api/library-cards/:id/reject (alias for PATCH)
router.put('/:id/reject', protect, authorize('librarian'), asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const card = await LibraryCard.findById(req.params.id);
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  if (card.status !== 'pending') {
    return ApiResponse.badRequest(res, `Only pending applications can be rejected by librarian (current: ${card.status})`);
  }

  card.status = 'rejected';
  card.rejectionReason = reason;
  card.reviewedBy = req.user._id;
  card.reviewedAt = new Date();
  await card.save();

  return ApiResponse.success(res, { message: 'Card rejected successfully', data: card });
}));

// GET /api/library-cards/my-card
router.get('/my-card', protect, authorize('student'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findOne({ student: req.user._id }).populate('reviewedBy', 'name').populate('book', 'title');
  if (!card) return ApiResponse.notFound(res, 'No library card found');
  return ApiResponse.success(res, { data: card });
}));

// GET /api/library-cards/stats
router.get('/stats', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const stats = await LibraryCard.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  return ApiResponse.success(res, { data: stats });
}));

// GET /api/library-cards
router.get('/', protect, asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, type, student } = req.query;
  
  const filter = {};
  if (req.user.role === 'student') {
    filter.student = req.user._id;
  } else {
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (student) filter.student = student;
  }

  const [cards, total] = await Promise.all([
    LibraryCard.find(filter)
      .populate('student', 'name email studentId')
      .populate('reviewedBy', 'name')
      .populate('book', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LibraryCard.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, { data: cards, page, limit, total });
}));

// GET /api/library-cards/:id
router.get('/:id', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findById(req.params.id).populate('student', 'name email studentId').populate('reviewedBy', 'name').populate('book', 'title');
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  return ApiResponse.success(res, { data: card });
}));

// PATCH /api/library-cards/:id/review
router.patch('/:id/review', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { status, rejectionReason, bookLimit } = req.body;
  if (!['approved', 'rejected'].includes(status)) return ApiResponse.badRequest(res, 'Status must be approved or rejected');

  const update = { status, reviewedBy: req.user._id, reviewedAt: new Date() };
  if (status === 'approved') {
    update.validFrom = new Date();
    update.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    if (bookLimit) update.bookLimit = bookLimit;
  }
  if (status === 'rejected' && rejectionReason) update.rejectionReason = rejectionReason;

  const card = await LibraryCard.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  return ApiResponse.success(res, { message: `Card ${status}`, data: card });
}));

// PATCH /api/library-cards/:id/suspend
router.patch('/:id/suspend', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findByIdAndUpdate(req.params.id, { status: 'suspended', suspensionReason: req.body.reason }, { new: true });
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  return ApiResponse.success(res, { message: 'Card suspended', data: card });
}));

// PATCH /api/library-cards/:id/reactivate
router.patch('/:id/reactivate', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const card = await LibraryCard.findByIdAndUpdate(req.params.id, { status: 'approved', suspensionReason: undefined }, { new: true });
  if (!card) return ApiResponse.notFound(res, 'Library card not found');
  return ApiResponse.success(res, { message: 'Card reactivated', data: card });
}));

module.exports = router;
