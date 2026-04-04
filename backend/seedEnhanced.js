/**
 * Enhanced Seed Script - Creates complete test data
 * Usage: node seedEnhanced.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/digital_library';

// Schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  studentId: String,
  department: String,
  phone: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  isbn: { type: String, unique: true },
  genre: String,
  description: String,
  publisher: String,
  publishedYear: Number,
  totalCopies: Number,
  availableCopies: Number,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const libraryCardSchema = new mongoose.Schema({
  cardNumber: { type: String, unique: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved_by_librarian', 'approved', 'rejected', 'suspended', 'expired'], default: 'pending' },
  course: String,
  branch: String,
  year: String,
  type: { type: String, enum: ['temporary', 'permanent'], default: 'temporary' },
  bookLimit: { type: Number, default: 5 },
  validFrom: Date,
  validUntil: Date,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Book = mongoose.model('Book', bookSchema);
const LibraryCard = mongoose.model('LibraryCard', libraryCardSchema);

const seed = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('📦 Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Book.deleteMany({});
  await LibraryCard.deleteMany({});
  console.log('🧹 Cleared existing data');

  // Hash passwords
  const adminPass = await bcrypt.hash('Admin@123', 12);
  const libPass = await bcrypt.hash('Librarian@123', 12);
  const studentPass = await bcrypt.hash('Student@123', 12);

  // Create users
  const users = [
    { name: 'Admin User', email: 'admin@library.com', password: adminPass, role: 'admin' },
    { name: 'Librarian One', email: 'librarian@library.com', password: libPass, role: 'librarian' },
    { name: 'John Student', email: 'john@student.com', password: studentPass, role: 'student', studentId: 'STU001', department: 'Computer Science', phone: '9876543210' },
    { name: 'Jane Student', email: 'jane@student.com', password: studentPass, role: 'student', studentId: 'STU002', department: 'Mechanical', phone: '9876543211' },
    { name: 'Mike Student', email: 'mike@student.com', password: studentPass, role: 'student', studentId: 'STU003', department: 'Electrical', phone: '9876543212' },
  ];

  const createdUsers = [];
  for (const u of users) {
    const user = await User.create(u);
    createdUsers.push(user);
    console.log(`✅ Created ${u.role}: ${u.email}`);
  }

  // Create books
  const books = [
    { title: 'Introduction to Algorithms', author: 'Thomas Cormen', isbn: '9780262033848', genre: 'Computer Science', publisher: 'MIT Press', publishedYear: 2009, totalCopies: 5, availableCopies: 3 },
    { title: 'Data Structures and Algorithms', author: 'Robert Lafore', isbn: '9780672303390', genre: 'Computer Science', publisher: 'Sams', publishedYear: 2002, totalCopies: 3, availableCopies: 2 },
    { title: 'Clean Code', author: 'Robert Martin', isbn: '9780132350884', genre: 'Programming', publisher: 'Prentice Hall', publishedYear: 2008, totalCopies: 4, availableCopies: 1 },
    { title: 'Design Patterns', author: 'Gang of Four', isbn: '9780201633610', genre: 'Programming', publisher: 'Addison-Wesley', publishedYear: 1994, totalCopies: 2, availableCopies: 0 },
    { title: 'The Pragmatic Programmer', author: 'David Thomas', isbn: '9780201616224', genre: 'Programming', publisher: 'Addison-Wesley', publishedYear: 1999, totalCopies: 3, availableCopies: 3 },
    { title: 'Artificial Intelligence', author: 'Stuart Russell', isbn: '9780136042594', genre: 'AI', publisher: 'Prentice Hall', publishedYear: 2009, totalCopies: 2, availableCopies: 2 },
    { title: 'Machine Learning', author: 'Tom Mitchell', isbn: '9780070428072', genre: 'AI', publisher: 'McGraw-Hill', publishedYear: 1997, totalCopies: 3, availableCopies: 1 },
    { title: 'Database System Concepts', author: 'Abraham Silberschatz', isbn: '9780078022159', genre: 'Database', publisher: 'McGraw-Hill', publishedYear: 2010, totalCopies: 4, availableCopies: 2 },
  ];

  for (const book of books) {
    await Book.create(book);
    console.log(`📚 Created book: ${book.title}`);
  }

  // Create library cards for students
  const studentUsers = createdUsers.filter(u => u.role === 'student');
  for (const [index, student] of studentUsers.entries()) {
    const card = await LibraryCard.create({
      cardNumber: `LIB-${String(index + 1).padStart(4, '0')}`,
      student: student._id,
      status: index === 0 ? 'approved' : index === 1 ? 'approved_by_librarian' : 'pending',
      course: 'B.Tech',
      branch: student.department,
      year: '3rd',
      type: 'temporary',
      bookLimit: 5,
      validFrom: index < 2 ? new Date() : null,
      validUntil: index < 2 ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
    });
    console.log(`🎴 Created library card for: ${student.name} (${card.status})`);
  }

  console.log('\n🎉 === Enhanced Seed Complete ===');
  console.log('👤 Admin     → admin@library.com     / Admin@123');
  console.log('📚 Librarian → librarian@library.com  / Librarian@123');
  console.log('🎓 Students  → john/jane/mike@student.com / Student@123');
  console.log('📊 Total: 5 users, 8 books, 3 library cards');

  await mongoose.disconnect();
};

seed().catch((e) => { console.error('❌ Seed error:', e); process.exit(1); });
