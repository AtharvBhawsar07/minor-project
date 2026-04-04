const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const {
  issueBook,
  returnBook,
  getIssues,
  getOverdueIssues,
  getIssueById,
  renewBook,
} = require('../controllers/issueController');

// POST /api/issues/issue  — Student/Librarian/Admin (simplified college submission)
router.post('/issue', protect, authorize('student', 'librarian', 'admin'), issueBook);

// POST /api/issues/return — Student/Librarian/Admin
router.post('/return', protect, authorize('student', 'librarian', 'admin'), returnBook);

// GET /api/issues — All (filtered by role inside controller)
router.get('/', protect, authorize('student', 'librarian', 'admin'), getIssues);

// GET /api/issues/overdue  — Librarian/Admin only
router.get('/overdue', protect, authorize('librarian', 'admin'), getOverdueIssues);

// GET /api/issues/:id
router.get('/:id', protect, getIssueById);

// POST /api/issues/:id/renew
router.post('/:id/renew', protect, renewBook);

module.exports = router;
