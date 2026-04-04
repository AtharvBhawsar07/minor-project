const express = require('express');
const router = express.Router();
const Fine = require('../models/Fine');
const User = require('../models/User');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler, getPagination } = require('../utils/apiResponse');

// GET /api/fines/my-fines
router.get('/my-fines', protect, asyncHandler(async (req, res) => {
  // Students see own fines; staff can also call this for themselves
  const filter = { student: req.user._id };

  const fines = await Fine.find(filter)
    .populate('book', 'title author')
    .sort({ createdAt: -1 })
    .lean();

  // Fine model already stores dueDate, returnDate, overdueDays, amount
  // Just normalise field names for the frontend
  const enrichedFines = fines.map(fine => ({
    ...fine,
    // calculatedFine = stored amount (calculated at time of return)
    calculatedFine: fine.amount || 0,
    calculatedAmount: fine.amount || 0,
    overdueDays: fine.overdueDays || 0,
    remainingAmount: (fine.amount || 0) - (fine.paidAmount || 0),
  }));

  return ApiResponse.success(res, { data: enrichedFines });
}));

// GET /api/fines/stats
router.get('/stats', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const stats = await Fine.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
  ]);
  return ApiResponse.success(res, { data: stats });
}));

// GET /api/fines
router.get('/', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status } = req.query;
  const filter = status ? { status } : {};
  const [fines, total] = await Promise.all([
    Fine.find(filter).populate('student', 'name email studentId').populate('book', 'title').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Fine.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, { data: fines, page, limit, total });
}));

// GET /api/fines/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const fine = await Fine.findById(req.params.id).populate('student', 'name email').populate('book', 'title');
  if (!fine) return ApiResponse.notFound(res, 'Fine not found');
  if (req.user.role === 'student' && fine.student._id.toString() !== req.user._id.toString()) {
    return ApiResponse.forbidden(res);
  }
  return ApiResponse.success(res, { data: fine });
}));

// PATCH /api/fines/:id/pay
router.patch('/:id/pay', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { amount, paymentMethod, paymentReference } = req.body;
  const fine = await Fine.findById(req.params.id);
  if (!fine) return ApiResponse.notFound(res, 'Fine not found');
  if (fine.status === 'paid' || fine.status === 'waived') return ApiResponse.badRequest(res, `Fine already ${fine.status}`);

  fine.paidAmount = (fine.paidAmount || 0) + parseFloat(amount);

  // Backend enum is lowercase: cash/online/upi/card
  const normalizedPaymentMethod =
    typeof paymentMethod === 'string' ? paymentMethod.toLowerCase().trim() : paymentMethod;
  const allowedMethods = ['cash', 'online', 'upi', 'card'];
  if (normalizedPaymentMethod && !allowedMethods.includes(normalizedPaymentMethod)) {
    return ApiResponse.badRequest(res, `Invalid payment method. Allowed: ${allowedMethods.join(', ')}`);
  }
  fine.paymentMethod = normalizedPaymentMethod;
  fine.paymentReference = paymentReference;
  fine.collectedBy = req.user._id;
  fine.status = fine.paidAmount >= fine.amount ? 'paid' : 'partial';
  if (fine.status === 'paid') fine.paidAt = new Date();
  await fine.save();

  return ApiResponse.success(res, { message: 'Payment recorded', data: fine });
}));

// PATCH /api/fines/:id/waive
router.patch('/:id/waive', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const fine = await Fine.findByIdAndUpdate(
    req.params.id,
    { status: 'waived', waivedBy: req.user._id, waivedAt: new Date(), waiveReason: req.body.reason },
    { new: true }
  );
  if (!fine) return ApiResponse.notFound(res, 'Fine not found');
  return ApiResponse.success(res, { message: 'Fine waived', data: fine });
}));

// POST /api/fines/send-reminders
router.post('/send-reminders', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const pendingFines = await Fine.find({ status: 'pending' }).populate('student', 'name email');
  let sent = 0;
  for (const fine of pendingFines) {
    await emailService.sendFineReminder(fine.student, fine).catch((e) => logger.error(e.message));
    sent++;
  }
  return ApiResponse.success(res, { message: `Reminders sent to ${sent} students` });
}));

module.exports = router;
