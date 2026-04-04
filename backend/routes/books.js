const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const IssueRecord = require('../models/IssueRecord');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler, getPagination } = require('../utils/apiResponse');

// GET /api/books
router.get('/', protect, asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search, genre, available, sort } = req.query;
  const filter = { isActive: true };

  if (search) filter.$text = { $search: search };
  if (genre) filter.genre = genre;
  if (available === 'true') filter.availableCopies = { $gt: 0 };

  const sortObj = sort === 'title' ? { title: 1 } : sort === 'author' ? { author: 1 } : { createdAt: -1 };

  const [books, total] = await Promise.all([
    Book.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
    Book.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, { data: books, page, limit, total });
}));

// GET /api/books/genres
router.get('/genres', protect, asyncHandler(async (req, res) => {
  const genres = await Book.distinct('genre', { isActive: true, genre: { $ne: null } });
  return ApiResponse.success(res, { data: genres });
}));

// GET /api/books/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).populate('addedBy', 'name');
  if (!book || !book.isActive) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { data: book });
}));

// GET /api/books/:id/history
router.get('/:id/history', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [records, total] = await Promise.all([
    IssueRecord.find({ book: req.params.id })
      .populate('student', 'name email studentId')
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    IssueRecord.countDocuments({ book: req.params.id }),
  ]);
  return ApiResponse.paginated(res, { data: records, page, limit, total });
}));

// POST /api/books
router.post('/', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const book = await Book.create({ ...req.body, addedBy: req.user._id });
  return ApiResponse.created(res, { message: 'Book added successfully', data: book });
}));

// PUT /api/books/:id
router.put('/:id', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!book) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { message: 'Book updated', data: book });
}));

// DELETE /api/books/:id
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!book) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { message: 'Book deactivated' });
}));

module.exports = router;
