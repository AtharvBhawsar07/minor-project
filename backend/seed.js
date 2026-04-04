/**
 * Seed script — run once to create default admin + librarian
 * Usage: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/digital_library';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  studentId: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const seed = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const adminPass = await bcrypt.hash('Admin@123', 12);
  const libPass = await bcrypt.hash('Librarian@123', 12);
  const studentPass = await bcrypt.hash('Student@123', 12);

  const users = [
    { name: 'Admin User', email: 'admin@library.com', password: adminPass, role: 'admin' },
    { name: 'Librarian One', email: 'librarian@library.com', password: libPass, role: 'librarian' },
    { name: 'Test Student', email: 'student@library.com', password: studentPass, role: 'student', studentId: 'STU001' },
  ];

  for (const u of users) {
    await User.updateOne({ email: u.email }, u, { upsert: true });
    console.log(`✓ ${u.role}: ${u.email}`);
  }

  console.log('\n=== Seed Complete ===');
  console.log('Admin    → admin@library.com     / Admin@123');
  console.log('Librarian→ librarian@library.com  / Librarian@123');
  console.log('Student  → student@library.com    / Student@123');

  await mongoose.disconnect();
};

seed().catch((e) => { console.error(e); process.exit(1); });
