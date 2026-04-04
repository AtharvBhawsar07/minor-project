const Joi = require('joi');

// ─── Schemas ─────────────────────────────────────────────────────────────────

const schemas = {
  // User registration
  user: Joi.object({
    name:       Joi.string().trim().min(2).max(50).required(),
    email:      Joi.string().email().required(),
    password:   Joi.string().min(6).required(),
    role:       Joi.string().valid('student', 'librarian', 'admin').optional(),
    studentId:  Joi.string().trim().optional().allow(''),
    department: Joi.string().trim().optional().allow(''),
    phone:      Joi.string().trim().optional().allow(''),
  }),

  // Login — accepts role in any case (Student/student etc.)
  login: Joi.object({
    email:    Joi.string().required(),
    password: Joi.string().required(),
    role:     Joi.string()
      .valid('Student', 'Librarian', 'Admin', 'student', 'librarian', 'admin')
      .optional(),
  }),

  // Library Card application — MUST include bookId and notes
  libraryCard: Joi.object({
    bookId:           Joi.string().trim().required(),
    course:           Joi.string().trim().required(),
    branch:           Joi.string().trim().required(),
    year:             Joi.string().trim().required(),
    type:             Joi.string().valid('temporary', 'permanent').optional().default('temporary'),
    notes:            Joi.string().trim().max(500).optional().allow(''),
    applicationNotes: Joi.string().trim().max(500).optional().allow(''),
  }),
};

// ─── Validation middleware ────────────────────────────────────────────────────

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'query' ? req.query
               : source === 'params' ? req.params
               : req.body;

    const { error, value } = schema.validate(data, {
      abortEarly:   false,
      stripUnknown: false, // Keep unknown fields so bookId/notes are not stripped
      convert:      true,
      allowUnknown: false,
    });

    if (error) {
      const errors = error.details.map(d => ({
        field:   d.path.join('.'),
        message: d.message,
      }));
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    // Put validated value back
    if (source === 'query')       req.query  = value;
    else if (source === 'params') req.params = value;
    else                          req.body   = value;

    next();
  };
};

module.exports = { schemas, validate };
