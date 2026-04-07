const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');
const { ApiResponse, asyncHandler } = require('../utils/apiResponse');
const { validate, schemas } = require('../utils/validation');
const logger = require('../utils/logger');

// POST /api/auth/register
router.post('/register', validate(schemas.user), asyncHandler(async (req, res) => {
  const { name, email, password, role, studentId, department, phone } = req.body;
  logger.info(`Registration attempt: ${email}`, { name, email, role, studentId });

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    logger.warn(`Email already exists: ${email}`);
    return ApiResponse.conflict(res, 'Email already registered');
  }

  if (studentId) {
    const existingId = await User.findOne({ studentId });
    if (existingId) {
      logger.warn(`StudentId already exists: ${studentId}`);
      return ApiResponse.conflict(res, 'Enrollment/Employee ID already registered');
    }
  }

  const r = role?.toLowerCase() || 'student';
  if (r === 'admin') {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) return ApiResponse.conflict(res, 'Admin already exists');
  }
  if (r === 'librarian') {
    const librarianExists = await User.findOne({ role: 'librarian' });
    if (librarianExists) return ApiResponse.conflict(res, 'Librarian already exists');
  }

  const payload = {
    name,
    email,
    password,
    role: r,
    studentId,
    department,
    phone,
  };
  if (r === 'student' && req.body.semester != null && req.body.semester !== '') {
    payload.semester = Number(req.body.semester);
  }

  const user = await User.create(payload);
  logger.info(`User created: ${user._id}`);
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

  return ApiResponse.created(res, { message: 'Registered successfully', data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role, studentId: user.studentId }, accessToken } });
}));

// POST /api/auth/login
router.post('/login', validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  logger.info(`Login attempt for: ${email}`, { role });

  const user = await User.findOne({ $or: [{ email }, { studentId: email }] }).select('+password');
  if (!user || !user.isActive) {
    logger.warn(`Login failed - user not found or inactive: ${email}`);
    return ApiResponse.unauthorized(res, 'Invalid credentials');
  }

  // Verify role if provided (optional but good for consistency)
  if (role && user.role.toLowerCase() !== role.toLowerCase()) {
    logger.warn(`Login failed - role mismatch. Expected: ${user.role}, Got: ${role}`);
    return ApiResponse.unauthorized(res, 'Invalid credentials for this role');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    logger.warn(`Login failed - password mismatch: ${email}`);
    return ApiResponse.unauthorized(res, 'Invalid credentials');
  }

  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '30d' });

  user.refreshToken = refreshToken;
  try {
    await user.save({ validateBeforeSave: false });
    logger.info(`Login successful: ${email}`);
  } catch (err) {
    logger.error(`Error saving user after login: ${err.message}`);
    return ApiResponse.internalError(res, 'Could not complete login. Please try again.');
  }

  return ApiResponse.success(res, { message: 'Login successful', data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role, studentId: user.studentId }, accessToken, refreshToken } });
}));

// POST /api/auth/logout
router.post('/logout', protect, asyncHandler(async (req, res) => {
  req.user.refreshToken = undefined;
  await req.user.save({ validateBeforeSave: false });
  return ApiResponse.success(res, { message: 'Logged out successfully' });
}));

// GET /api/auth/me
router.get('/me', protect, asyncHandler(async (req, res) => {
  return ApiResponse.success(res, { data: req.user });
}));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return ApiResponse.badRequest(res, 'Refresh token required');
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) return ApiResponse.unauthorized(res, 'Invalid refresh token');
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  return ApiResponse.success(res, { data: { accessToken } });
}));

// PUT /api/auth/change-password
router.put('/change-password', protect, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return ApiResponse.badRequest(res, 'Both fields required');
  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) return ApiResponse.badRequest(res, 'Current password is incorrect');
  user.password = newPassword;
  await user.save();
  return ApiResponse.success(res, { message: 'Password changed successfully' });
}));

module.exports = router;
