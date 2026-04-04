const mongoose = require('mongoose');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing in backend/.env');
  }

  // Keep it simple + stable for MERN college submissions
  mongoose.set('strictQuery', true);

  const maxRetries = Math.max(1, parseInt(process.env.MONGO_CONNECT_RETRIES || '5', 10));
  const baseRetryDelayMs = Math.max(0, parseInt(process.env.MONGO_CONNECT_RETRY_DELAY_MS || '1500', 10));

  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      // Exponential backoff with jitter
      const retryDelayMs = Math.min(baseRetryDelayMs * Math.pow(2, attempt - 1), 30000);
      const jitter = Math.random() * 0.1 * retryDelayMs;
      
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
      });

      logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

      // Helpful connection logs
      mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
      mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
      mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err.message}`));

      return conn;
    } catch (err) {
      lastErr = err;
      logger.error(`MongoDB connect failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
      
      if (attempt < maxRetries) {
        const retryDelayMs = Math.min(baseRetryDelayMs * Math.pow(2, attempt - 1), 30000);
        const jitter = Math.random() * 0.1 * retryDelayMs;
        logger.info(`Retrying MongoDB connection in ${Math.round(retryDelayMs + jitter)}ms...`);
        await sleep(retryDelayMs + jitter);
      }
    }
  }

  // If we reached here, fail hard so server never starts without DB
  throw lastErr || new Error('MongoDB connection failed');
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB Disconnected');
  } catch (error) {
    logger.error(`Error disconnecting DB: ${error.message}`);
  }
};

module.exports = { connectDB, disconnectDB };