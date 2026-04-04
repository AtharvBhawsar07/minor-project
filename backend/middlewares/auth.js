const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiResponse } = require('../utils/apiResponse');

// Verify JWT and attach user to req
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'No token provided. Please log in.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return ApiResponse.unauthorized(res, 'User not found or deactivated.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// Role-based access control
const authorize = (...roles) => (req, res, next) => {
  const userRole = req.user.role.toLowerCase();
  const allowedRoles = roles.map(r => r.toLowerCase());
  
  if (!allowedRoles.includes(userRole)) {
    return ApiResponse.forbidden(res, `Role '${req.user.role}' is not allowed to access this route. Allowed roles: ${roles.join(', ')}`);
  }
  next();
};

module.exports = { protect, authorize };
