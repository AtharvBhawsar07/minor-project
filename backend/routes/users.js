const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler, getPagination } = require('../utils/apiResponse');

// GET /api/users
router.get('/', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { role, search } = req.query;
  const filter = { isActive: true };
  if (role) filter.role = role;
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
    { studentId: { $regex: search, $options: 'i' } },
  ];
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, { data: users, page, limit, total });
}));

// GET /api/users/students
router.get('/students', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search } = req.query;
  const filter = { role: 'student', isActive: true };
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
    { studentId: { $regex: search, $options: 'i' } },
  ];
  const [users, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, { data: users, page, limit, total });
}));

// GET /api/users/:id
router.get('/:id', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return ApiResponse.notFound(res, 'User not found');
  return ApiResponse.success(res, { data: user });
}));

// PUT /api/users/:id
router.put('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { password, refreshToken, ...updateData } = req.body; // prevent password update here
  const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!user) return ApiResponse.notFound(res, 'User not found');
  return ApiResponse.success(res, { message: 'User updated', data: user });
}));

// PUT /api/auth/me  (self-update — mounted here for convenience)
router.put('/me', protect, asyncHandler(async (req, res) => {
  const { password, role, refreshToken, ...updateData } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
  return ApiResponse.success(res, { message: 'Profile updated', data: user });
}));

// DELETE /api/users/:id  (soft delete)
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) return ApiResponse.notFound(res, 'User not found');
  return ApiResponse.success(res, { message: 'User deactivated' });
}));

module.exports = router;
