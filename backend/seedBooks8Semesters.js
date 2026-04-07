/**
 * Wipes all books and inserts 40 books (5 per semester, semesters 1–8).
 * Run from backend folder:  npm run seed:books8
 */
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Book = require('./models/Book');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}

const rows = [
  // Semester 1
  { title: 'Introduction to Programming', author: 'Yashavant Kanetkar', semester: 1, genre: 'Technical' },
  { title: 'Basic Mathematics', author: 'B.S. Grewal', semester: 1, genre: 'Mathematics' },
  { title: 'Physics I', author: 'H.C. Verma', semester: 1, genre: 'Physics' },
  { title: 'Chemistry Basics', author: 'O.P. Tandon', semester: 1, genre: 'Chemistry' },
  { title: 'Engineering Drawing', author: 'N.D. Bhatt', semester: 1, genre: 'Engineering' },
  // Semester 2
  { title: 'C Programming', author: 'Dennis Ritchie', semester: 2, genre: 'Technical' },
  { title: 'Mathematics II', author: 'B.S. Grewal', semester: 2, genre: 'Mathematics' },
  { title: 'Physics II', author: 'H.C. Verma', semester: 2, genre: 'Physics' },
  { title: 'Environmental Science', author: 'Erach Bharucha', semester: 2, genre: 'Science' },
  { title: 'Workshop Practice', author: 'K.K. Choudhary', semester: 2, genre: 'Workshop' },
  // Semester 3
  { title: 'C++ Programming', author: 'Bjarne Stroustrup', semester: 3, genre: 'Technical' },
  { title: 'Data Structures', author: 'Mark Allen Weiss', semester: 3, genre: 'Computer Science' },
  { title: 'Digital Logic Design', author: 'Morris Mano', semester: 3, genre: 'Electronics' },
  { title: 'Mathematics III', author: 'B.S. Grewal', semester: 3, genre: 'Mathematics' },
  { title: 'Computer Fundamentals', author: 'P.K. Sinha', semester: 3, genre: 'Computer Science' },
  // Semester 4
  { title: 'Java Programming', author: 'James Gosling', semester: 4, genre: 'Technical' },
  { title: 'Operating System', author: 'Galvin', semester: 4, genre: 'Computer Science' },
  { title: 'Database Management System', author: 'Korth', semester: 4, genre: 'Computer Science' },
  { title: 'Software Engineering', author: 'Ian Sommerville', semester: 4, genre: 'Computer Science' },
  { title: 'Discrete Mathematics', author: 'Kenneth Rosen', semester: 4, genre: 'Mathematics' },
  // Semester 5
  { title: 'Web Development', author: 'Jon Duckett', semester: 5, genre: 'Technical' },
  { title: 'Computer Networks', author: 'Andrew Tanenbaum', semester: 5, genre: 'Computer Science' },
  { title: 'Artificial Intelligence', author: 'Stuart Russell', semester: 5, genre: 'Computer Science' },
  { title: 'Compiler Design', author: 'Aho Ullman', semester: 5, genre: 'Computer Science' },
  { title: 'Python Programming', author: 'Guido van Rossum', semester: 5, genre: 'Computer Science' },
  // Semester 6
  { title: 'Machine Learning', author: 'Tom Mitchell', semester: 6, genre: 'Technical' },
  { title: 'Cloud Computing', author: 'Rajkumar Buyya', semester: 6, genre: 'Computer Science' },
  { title: 'Cyber Security', author: 'William Stallings', semester: 6, genre: 'Security' },
  { title: 'Big Data', author: 'Viktor Mayer', semester: 6, genre: 'Data Science' },
  { title: 'Project Management', author: 'Kathy Schwalbe', semester: 6, genre: 'Management' },
  // Semester 7
  { title: 'Advanced Java', author: 'Herbert Schildt', semester: 7, genre: 'Technical' },
  { title: 'Data Mining', author: 'Jiawei Han', semester: 7, genre: 'Data Science' },
  { title: 'Internet of Things', author: 'Arshdeep Bahga', semester: 7, genre: 'Computer Science' },
  { title: 'Mobile App Development', author: 'Charlie Collins', semester: 7, genre: 'Computer Science' },
  { title: 'Software Testing', author: 'Ron Patton', semester: 7, genre: 'Computer Science' },
  // Semester 8
  { title: 'Deep Learning', author: 'Ian Goodfellow', semester: 8, genre: 'Technical' },
  { title: 'Blockchain Technology', author: 'Satoshi Nakamoto', semester: 8, genre: 'Computer Science' },
  { title: 'Cloud Security', author: 'Tim Mather', semester: 8, genre: 'Security' },
  { title: 'DevOps', author: 'Gene Kim', semester: 8, genre: 'Computer Science' },
  { title: 'Final Year Project Guide', author: 'Unknown', semester: 8, genre: 'General' },
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  const del = await Book.deleteMany({});
  console.log(`Removed ${del.deletedCount} existing book(s).`);

  const docs = rows.map((r, i) => ({
    ...r,
    // Unique placeholder so MongoDB unique index on isbn never sees duplicate null
    isbn: `SEED-${String(r.semester).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
    totalCopies: 5,
    availableCopies: 5,
    isActive: true,
  }));

  const inserted = await Book.insertMany(docs);
  console.log(`Inserted ${inserted.length} books (5 × 8 semesters).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
