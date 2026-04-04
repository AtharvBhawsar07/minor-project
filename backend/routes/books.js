const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler } = require('../utils/apiResponse');
const LibraryCard = require('../models/LibraryCard');

// GET /api/books  — returns all active books (no pagination so frontend gets all)
router.get('/', protect, asyncHandler(async (req, res) => {
  const { search, semester, available } = req.query;

  const filter = { isActive: true };
  if (semester)          filter.semester = semester;
  if (available === 'true') filter.availableCopies = { $gt: 0 };
  if (search) {
    filter.$or = [
      { title:  { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } },
    ];
  }

  const books = await Book.find(filter).sort({ semester: 1, title: 1 }).lean();
  return res.json({ success: true, data: books });
}));

// GET /api/books/semesters  — distinct semester values
router.get('/semesters', protect, asyncHandler(async (req, res) => {
  const semesters = await Book.distinct('semester', { isActive: true });
  return ApiResponse.success(res, { data: semesters.sort() });
}));

// GET /api/books/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book || !book.isActive) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { data: book });
}));

// POST /api/books  — Librarian / Admin only
router.post('/', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const book = await Book.create({ ...req.body, addedBy: req.user._id });
  return ApiResponse.created(res, { message: 'Book added successfully', data: book });
}));

// PUT /api/books/:id  — Librarian / Admin only
router.put('/:id', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!book) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { message: 'Book updated', data: book });
}));

// DELETE /api/books/:id  — Admin only (soft delete)
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!book) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { message: 'Book removed' });
}));

// ── Auto-approve rejected cards when a returned book becomes available ─────────
// Called internally from issueController after book.incrementAvailable()
const autoApproveRejected = async (bookId) => {
  try {
    const book = await Book.findById(bookId);
    if (!book || book.availableCopies <= 0) return;

    // Find oldest rejected card for this book
    const card = await LibraryCard.findOne({ book: bookId, status: 'rejected' }).sort({ createdAt: 1 });
    if (!card) return;

    const days = card.type === 'permanent' ? 180 : 15;
    card.status     = 'approved';
    card.validFrom  = new Date();
    card.validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await card.save();

    // Reserve one copy for them
    await Book.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } }
    );
    console.log(`[AutoApprove] Card ${card._id} auto-approved for book ${book.title}`);
  } catch (err) {
    console.error('[AutoApprove] Error:', err.message);
  }
};

module.exports = router;
module.exports.autoApproveRejected = autoApproveRejected;
