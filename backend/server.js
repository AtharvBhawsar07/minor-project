/**
 * ============================================================
 * DIGITAL LIBRARY CARD MANAGEMENT SYSTEM — BACKEND
 * Production-Grade Node.js + Express + MongoDB API
 * ============================================================
 */


require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const { connectDB, disconnectDB } = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { processDueDateReminders } = require('./utils/dueDateReminderJob');

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const libraryCardRoutes = require('./routes/libraryCards');
const issueRoutes = require('./routes/issues');
const fineRoutes = require('./routes/fines');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// ─── App Initialization ───────────────────────────────────────────────────────
const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — open for local development
app.use(cors());

// Rate limiting — set very high in development so users never see 429 errors
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', // Completely skip in dev
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

app.use('/api/', limiter);

// ─── General Middleware ───────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks

// HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: require('./package.json').version,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/library-cards', libraryCardRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Server Startup ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Remove legacy unique index on `student` (old schema: one card per user).
    // New flow allows multiple library card documents per student (returned/rejected/expired free slots).
    try {
      const LibraryCard = require('./models/LibraryCard');
      await LibraryCard.syncIndexes();
      const coll = mongoose.connection.collection('librarycards');
      const indexes = await coll.indexes();
      for (const idx of indexes) {
        const key = idx.key || {};
        const keyNames = Object.keys(key);
        if (idx.unique && keyNames.length === 1 && keyNames[0] === 'student') {
          await coll.dropIndex(idx.name);
          logger.info(`Removed obsolete unique index on student: ${idx.name}`);
        }
      }
    } catch (idxErr) {
      logger.warn(`Library card index cleanup: ${idxErr?.message || idxErr}`);
    }
    // Run due reminders once on startup (no fixed cron time).
    try {
      await processDueDateReminders();
    } catch (reminderErr) {
      logger.warn(`Due-date reminder startup run failed: ${reminderErr?.message || reminderErr}`);
    }
  } catch (err) {
    logger.error(`Startup aborted: could not connect to MongoDB. ${err?.message || err}`);
    logger.error('Check Atlas IP whitelist (Network Access) and MONGODB_URI in backend/.env');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════════════════════╗
║          DIGITAL LIBRARY MANAGEMENT SYSTEM               ║
║                  Server Started                          ║
╠══════════════════════════════════════════════════════════╣
║  Environment : ${(process.env.NODE_ENV || 'development').padEnd(41)}║
║  Port        : ${String(PORT).padEnd(41)}║
║  API Base    : http://localhost:${PORT}/api${' '.repeat(Math.max(0, 26 - String(PORT).length))}║
║  Health      : http://localhost:${PORT}/api/health${' '.repeat(Math.max(0, 20 - String(PORT).length))}║
╚══════════════════════════════════════════════════════════╝
    `);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    server.close(async () => {
      await disconnectDB();
      logger.info('Server closed. Goodbye! 👋');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Promise Rejection: ${reason}`);
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
