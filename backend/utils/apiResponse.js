// ─── Async Handler ────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ─── Pagination Helper ────────────────────────────────────────────────────────
const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(
    parseInt(query.limit) || parseInt(process.env.DEFAULT_PAGE_SIZE) || 10,
    parseInt(process.env.MAX_PAGE_SIZE) || 100
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ─── ApiResponse ─────────────────────────────────────────────────────────────
class ApiResponse {
  static success(res, { message = 'Success', data = null, statusCode = 200 } = {}) {
    return res.status(statusCode).json({ success: true, message, data });
  }

  static created(res, { message = 'Created', data = null } = {}) {
    return res.status(201).json({ success: true, message, data });
  }

  static paginated(res, { data, page, limit, total }) {
    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  }

  static badRequest(res, message = 'Bad Request', errors = null) {
    return res.status(400).json({ success: false, message, errors });
  }

  static unauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({ success: false, message });
  }

  static forbidden(res, message = 'Forbidden. You do not have permission.') {
    return res.status(403).json({ success: false, message });
  }

  static notFound(res, message = 'Resource not found') {
    return res.status(404).json({ success: false, message });
  }

  static conflict(res, message = 'Conflict') {
    return res.status(409).json({ success: false, message });
  }

  static serverError(res, message = 'Internal Server Error') {
    return res.status(500).json({ success: false, message });
  }
}

module.exports = { ApiResponse, asyncHandler, getPagination };
