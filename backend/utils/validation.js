const Joi = require('joi');

// Common validation schemas
const schemas = {
  // User validation
  user: Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('student', 'librarian', 'admin').optional(),
    studentId: Joi.string().trim().optional(),
    department: Joi.string().trim().optional(),
    phone: Joi.string().trim().optional()
  }),

  // Login validation
  login: Joi.object({
    email: Joi.string().required(),
    password: Joi.string().required(),
    role: Joi.string().valid('Student', 'Librarian', 'Admin', 'student', 'librarian', 'admin').optional()
  }),

  // Book validation
  book: Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    author: Joi.string().trim().min(1).max(100).required(),
    isbn: Joi.string().trim().min(10).max(20).required(),
    genre: Joi.string().trim().optional(),
    description: Joi.string().trim().max(1000).optional(),
    publisher: Joi.string().trim().optional(),
    publishedYear: Joi.number().integer().min(1900).max(new Date().getFullYear()).optional(),
    totalCopies: Joi.number().integer().min(1).required(),
    coverImage: Joi.string().uri().optional()
  }),

  // Library Card validation
  libraryCard: Joi.object({
    course: Joi.string().trim().required(),
    branch: Joi.string().trim().required(),
    year: Joi.string().trim().required(),
    type: Joi.string().valid('temporary', 'permanent').optional(),
    applicationNotes: Joi.string().trim().max(500).optional()
  }),

  // Issue Record validation
  issueRecord: Joi.object({
    book: Joi.string().required(),
    dueDate: Joi.date().min('now').required(),
    issueType: Joi.string().valid('temporary', 'permanent').required(),
    notes: Joi.string().trim().max(500).optional()
  }),

  // Fine validation
  fine: Joi.object({
    paymentMethod: Joi.string().valid('cash', 'online', 'upi', 'card').optional(),
    paymentReference: Joi.string().trim().optional(),
    waiveReason: Joi.string().trim().max(500).optional()
  }),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace the original data with validated and cleaned data
    if (source === 'query') {
      req.query = value;
    } else if (source === 'params') {
      req.params = value;
    } else {
      req.body = value;
    }

    next();
  };
};

module.exports = {
  schemas,
  validate
};
