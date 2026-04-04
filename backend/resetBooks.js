/**
 * resetBooks.js
 * Run: node resetBooks.js
 * Clears ALL books and inserts exactly 20 semester-specific books.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');

const BOOKS = [
  // ── Semester 3 ──────────────────────────────────────────
  { title: 'C++ Programming',       author: 'Bjarne Stroustrup',  semester: 'Semester 3', totalCopies: 5, availableCopies: 5 },
  { title: 'Data Structures',        author: 'Mark Allen Weiss',   semester: 'Semester 3', totalCopies: 5, availableCopies: 5 },
  { title: 'Digital Logic Design',   author: 'Morris Mano',        semester: 'Semester 3', totalCopies: 5, availableCopies: 5 },
  { title: 'Mathematics III',        author: 'B.S. Grewal',        semester: 'Semester 3', totalCopies: 5, availableCopies: 5 },
  { title: 'Computer Fundamentals',  author: 'P.K. Sinha',         semester: 'Semester 3', totalCopies: 5, availableCopies: 5 },

  // ── Semester 4 ──────────────────────────────────────────
  { title: 'Java Programming',                 author: 'James Gosling',    semester: 'Semester 4', totalCopies: 5, availableCopies: 5 },
  { title: 'Operating System',                 author: 'Galvin',           semester: 'Semester 4', totalCopies: 5, availableCopies: 5 },
  { title: 'Database Management System',       author: 'Korth',            semester: 'Semester 4', totalCopies: 5, availableCopies: 5 },
  { title: 'Software Engineering',             author: 'Ian Sommerville',  semester: 'Semester 4', totalCopies: 5, availableCopies: 5 },
  { title: 'Discrete Mathematics',             author: 'Kenneth Rosen',    semester: 'Semester 4', totalCopies: 5, availableCopies: 5 },

  // ── Semester 5 ──────────────────────────────────────────
  { title: 'Web Development',          author: 'Jon Duckett',          semester: 'Semester 5', totalCopies: 5, availableCopies: 5 },
  { title: 'Computer Networks',        author: 'Andrew Tanenbaum',     semester: 'Semester 5', totalCopies: 5, availableCopies: 5 },
  { title: 'Artificial Intelligence',  author: 'Stuart Russell',       semester: 'Semester 5', totalCopies: 5, availableCopies: 5 },
  { title: 'Compiler Design',          author: 'Aho Ullman',           semester: 'Semester 5', totalCopies: 5, availableCopies: 5 },
  { title: 'Python Programming',       author: 'Guido van Rossum',     semester: 'Semester 5', totalCopies: 5, availableCopies: 5 },

  // ── Semester 6 ──────────────────────────────────────────
  { title: 'Machine Learning',    author: 'Tom Mitchell',         semester: 'Semester 6', totalCopies: 5, availableCopies: 5 },
  { title: 'Cloud Computing',     author: 'Rajkumar Buyya',       semester: 'Semester 6', totalCopies: 5, availableCopies: 5 },
  { title: 'Cyber Security',      author: 'William Stallings',    semester: 'Semester 6', totalCopies: 5, availableCopies: 5 },
  { title: 'Big Data',            author: 'Viktor Mayer',         semester: 'Semester 6', totalCopies: 5, availableCopies: 5 },
  { title: 'Project Management',  author: 'Kathy Schwalbe',       semester: 'Semester 6', totalCopies: 5, availableCopies: 5 },
];

// Assign unique isbn values at runtime
const booksWithISBN = BOOKS.map((b, i) => ({
  ...b,
  isbn: `LIB-SEM-${Date.now()}-${i + 1}`,
}));

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI missing in .env'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');

  const deleted = await Book.deleteMany({});
  console.log(`🗑️  Deleted ${deleted.deletedCount} existing books`);

  const inserted = await Book.insertMany(booksWithISBN);
  console.log(`📚 Inserted ${inserted.length} books:`);
  inserted.forEach((b, i) => console.log(`   ${i + 1}. [${b.semester}] ${b.title} — ${b.author}`));

  await mongoose.disconnect();
  console.log('✅ Done!');
  process.exit(0);
}

run().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
