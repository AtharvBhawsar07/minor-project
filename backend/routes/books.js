const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const User = require('../models/User');
const multer = require('multer');
const XLSX = require('xlsx');
const { protect, authorize } = require('../middlewares/auth');
const { ApiResponse, asyncHandler } = require('../utils/apiResponse');
const LibraryCard = require('../models/LibraryCard');
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/books  — returns all active books (no pagination so frontend gets all)
router.get('/', protect, asyncHandler(async (req, res) => {
  const { search, semester, available } = req.query;

  const filter = { isActive: true };
  const andParts = [];

  if (req.user.role === 'student') {
    const u = await User.findById(req.user._id).select('semester').lean();
    if (u?.semester) {
      const sn = Number(u.semester);
      andParts.push({
        $or: [
          { semester: sn },
          { semester: null },
          { semester: { $exists: false } },
        ],
      });
    }
  } else if (semester != null && semester !== '') {
    andParts.push({ semester: Number(semester) });
  }

  if (available === 'true') filter.availableCopies = { $gt: 0 };
  if (search) {
    andParts.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
      ],
    });
  }
  if (andParts.length) filter.$and = andParts;

  const books = await Book.find(filter).sort({ semester: 1, title: 1 }).lean();
  return res.json({ success: true, data: books });
}));

// GET /api/books/semesters  — distinct semester values
router.get('/semesters', protect, asyncHandler(async (req, res) => {
  const semesters = await Book.distinct('semester', { isActive: true });
  return ApiResponse.success(res, { data: semesters.sort() });
}));

// GET /api/books/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book || !book.isActive) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { data: book });
}));

// POST /api/books  — Librarian / Admin only
router.post('/', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const sem = req.body.semester != null && req.body.semester !== '' ? Number(req.body.semester) : null;
  if (sem != null && !Number.isNaN(sem)) {
    const count = await Book.countDocuments({ semester: sem, isActive: true });
    if (count >= 5) {
      return ApiResponse.badRequest(res, 'Maximum 5 books allowed for this semester');
    }
  }
  const book = await Book.create({ ...req.body, addedBy: req.user._id });
  return ApiResponse.created(res, { message: 'Book added successfully', data: book });
}));

// POST /api/books/upload  — Librarian / Admin only (CSV/XLSX)
router.post('/upload', protect, authorize('librarian', 'admin'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return ApiResponse.badRequest(res, 'Please upload a CSV or Excel file');
  }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return ApiResponse.badRequest(res, 'Uploaded file is empty');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
  if (!rows.length) {
    return ApiResponse.badRequest(res, 'No rows found in uploaded file');
  }

  const FIELD_ALIASES = {
    title: ['title', 'bookName', 'name'],
    author: ['author', 'writer'],
    copies: ['copies', 'quantity', 'available'],
    semester: ['semester', 'sem'],
    isbn: ['isbn'],
  };

  const normalizeHeader = (value) =>
    String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const toTitleCase = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const getMappedValue = (row, aliases) => {
    const normalizedRow = {};
    Object.keys(row).forEach((key) => {
      normalizedRow[normalizeHeader(key)] = row[key];
    });
    for (const alias of aliases) {
      const value = normalizedRow[normalizeHeader(alias)];
      if (value !== undefined) return value;
    }
    return '';
  };

  const parseSemester = (semesterRaw) => {
    const cleaned = String(semesterRaw || '').trim().toLowerCase();
    if (!cleaned || cleaned === 'all') return null;
    const num = Number(cleaned);
    if (Number.isInteger(num) && num >= 1 && num <= 8) return num;
    return undefined;
  };

  const normalizeIsbn = (value) => String(value || '').trim().replace(/\s+/g, '');
  const generatedPrefix = `AUTO-${Date.now()}`;
  let generatedCounter = 0;
  const inRequestIsbnSet = new Set();

  const getUniqueIsbn = async (preferredIsbn = '') => {
    const preferred = normalizeIsbn(preferredIsbn);

    if (preferred) {
      const existsPreferred = await Book.exists({ isbn: preferred });
      if (!existsPreferred && !inRequestIsbnSet.has(preferred)) {
        inRequestIsbnSet.add(preferred);
        return preferred;
      }
    }

    while (true) {
      generatedCounter += 1;
      const candidate = `${generatedPrefix}-${generatedCounter}`;
      const existsCandidate = await Book.exists({ isbn: candidate });
      if (!existsCandidate && !inRequestIsbnSet.has(candidate)) {
        inRequestIsbnSet.add(candidate);
        return candidate;
      }
    }
  };

  let added = 0;
  let updated = 0;

  for (const row of rows) {
    const values = Object.values(row).map((v) => String(v || '').trim());
    const isEmptyRow = values.every((v) => !v);
    if (isEmptyRow) {
      continue;
    }

    const rawTitle = getMappedValue(row, FIELD_ALIASES.title);
    const rawAuthor = getMappedValue(row, FIELD_ALIASES.author);
    const rawCopies = getMappedValue(row, FIELD_ALIASES.copies);
    const rawSemester = getMappedValue(row, FIELD_ALIASES.semester);
    const rawIsbn = getMappedValue(row, FIELD_ALIASES.isbn);

    const title = toTitleCase(rawTitle);
    const author = toTitleCase(rawAuthor);
    const copies = Number(rawCopies);
    const semester = parseSemester(rawSemester);

    // Skip invalid rows to keep upload simple and resilient.
    if (!title || !author || !Number.isFinite(copies) || copies <= 0 || semester === undefined) {
      continue;
    }

    const existingBook = await Book.findOne({
      isActive: true,
      title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' },
      author: { $regex: `^${escapeRegex(author)}$`, $options: 'i' },
    });

    if (existingBook) {
      existingBook.totalCopies = Number(existingBook.totalCopies || 0) + copies;
      existingBook.availableCopies = Number(existingBook.availableCopies || 0) + copies;
      if (semester !== null) existingBook.semester = semester;
      if (!existingBook.isbn) {
        existingBook.isbn = await getUniqueIsbn(rawIsbn);
      }
      await existingBook.save();
      console.log('Book updated', { title: existingBook.title, author: existingBook.author, copiesAdded: copies });
      updated++;
    } else {
      const uniqueIsbn = await getUniqueIsbn(rawIsbn);
      await Book.create({
        title,
        author,
        isbn: uniqueIsbn,
        semester,
        totalCopies: copies,
        availableCopies: copies,
        addedBy: req.user._id,
      });
      console.log('Book created', { title, author, copies, isbn: uniqueIsbn });
      added++;
    }
  }

  return ApiResponse.success(res, {
    message: 'Bulk upload completed',
    data: { added, updated },
  });
}));

// PUT /api/books/:id  — Librarian / Admin only
router.put('/:id', protect, authorize('librarian', 'admin'), asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!book) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { message: 'Book updated', data: book });
}));

// DELETE /api/books/:id  — Admin only (soft delete)
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!book) return ApiResponse.notFound(res, 'Book not found');
  return ApiResponse.success(res, { message: 'Book removed' });
}));

// ── Auto-approve rejected cards when a returned book becomes available ─────────
// Called internally from issueController after book.incrementAvailable()
const autoApproveRejected = async (bookId) => {
  try {
    const book = await Book.findById(bookId);
    if (!book || book.availableCopies <= 0) return;

    // Find oldest rejected card for this book
    const card = await LibraryCard.findOne({ book: bookId, status: 'rejected' }).sort({ createdAt: 1 });
    if (!card) return;

    const days = card.type === 'permanent' ? 180 : 15;
    card.status     = 'approved';
    card.validFrom  = new Date();
    card.validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await card.save();

    // Reserve one copy for them
    await Book.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } }
    );
    console.log(`[AutoApprove] Card ${card._id} auto-approved for book ${book.title}`);
  } catch (err) {
    console.error('[AutoApprove] Error:', err.message);
  }
};

module.exports = router;
module.exports.autoApproveRejected = autoApproveRejected;
