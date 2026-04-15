const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Book = require('../models/Book');
const IssueRecord = require('../models/IssueRecord');
const Fine = require('../models/Fine');
const LibraryCard = require('../models/LibraryCard');
const { processDueDateReminders } = require('../utils/dueDateReminderJob');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler, getPagination } = require('../utils/apiResponse');

// GET /api/admin/dashboard
router.get('/dashboard', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const [
    totalBooks,
    totalStudents,
    activeIssues,
    overdueIssues,
    pendingCards,
    pendingFines,
    totalFineAmount,
  ] = await Promise.all([
    Book.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'student', isActive: true }),
    IssueRecord.countDocuments({ status: 'issued' }),
    IssueRecord.countDocuments({ status: 'issued', dueDate: { $lt: new Date() } }),
    LibraryCard.countDocuments({ status: 'pending' }),
    Fine.countDocuments({ status: 'pending' }),
    Fine.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  return ApiResponse.success(res, {
    data: {
      totalBooks,
      totalStudents,
      activeIssues,
      overdueIssues,
      pendingCards,
      pendingFines,
      totalPendingFineAmount: totalFineAmount[0]?.total || 0,
    },
  });
}));

// GET /api/admin/reports/issues
router.get('/reports/issues', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, from, to } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const [records, total] = await Promise.all([
    IssueRecord.find(filter)
      .populate('book', 'title author isbn')
      .populate('student', 'name email studentId')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    IssueRecord.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, { data: records, page, limit, total });
}));

// GET /api/admin/activity
router.get('/activity', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const [recentIssues, recentReturns, recentFines] = await Promise.all([
    IssueRecord.find({ status: 'issued' })
      .populate('book', 'title')
      .populate('student', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    IssueRecord.find({ status: 'returned' })
      .populate('book', 'title')
      .populate('student', 'name email')
      .sort({ returnDate: -1 })
      .limit(5)
      .lean(),
    Fine.find({ status: 'pending' })
      .populate('student', 'name email')
      .populate('book', 'title')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);
  return ApiResponse.success(res, { data: { recentIssues, recentReturns, recentFines } });
}));

// POST /api/admin/run-due-reminders
router.post('/run-due-reminders', protect, authorize('librarian', 'admin'), asyncHandler(async (_req, res) => {
  const result = await processDueDateReminders();
  return ApiResponse.success(res, {
    message: 'Due-date reminders processed successfully',
    data: result,
  });
}));

module.exports = router;
