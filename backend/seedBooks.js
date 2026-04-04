const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Book = require('./models/Book');

dotenv.config({ path: './.env' });

const books = [
  {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    category: 'Programming',
    genre: 'Programming',
    totalCopies: 5,
    availableCopies: 5,
  },
  {
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt, David Thomas',
    isbn: '9780201616224',
    category: 'Programming',
    genre: 'Programming',
    totalCopies: 4,
    availableCopies: 4,
  },
  {
    title: 'Design Patterns',
    author: 'Erich Gamma',
    isbn: '9780201633610',
    category: 'Programming',
    genre: 'Software Engineering',
    totalCopies: 3,
    availableCopies: 3,
  },
  {
    title: 'Introduction to Algorithms',
    author: 'Thomas H. Cormen',
    isbn: '9780262033848',
    category: 'Computer Science',
    genre: 'Algorithms',
    totalCopies: 6,
    availableCopies: 6,
  },
  {
    title: 'You Don\'t Know JS',
    author: 'Kyle Simpson',
    isbn: '9781491904244',
    category: 'Programming',
    genre: 'JavaScript',
    totalCopies: 8,
    availableCopies: 8,
  },
  {
    title: 'Eloquent JavaScript',
    author: 'Marijn Haverbeke',
    isbn: '9781593279509',
    category: 'Programming',
    genre: 'JavaScript',
    totalCopies: 7,
    availableCopies: 7,
  },
  {
    title: 'Cracking the Coding Interview',
    author: 'Gayle Laakmann McDowell',
    isbn: '9780984782857',
    category: 'Career',
    genre: 'Interview',
    totalCopies: 10,
    availableCopies: 10,
  },
  {
    title: 'Refactoring',
    author: 'Martin Fowler',
    isbn: '9780134757599',
    category: 'Programming',
    genre: 'Software Engineering',
    totalCopies: 4,
    availableCopies: 4,
  },
  {
    title: 'Head First Design Patterns',
    author: 'Eric Freeman',
    isbn: '9780596007126',
    category: 'Programming',
    genre: 'Software Engineering',
    totalCopies: 5,
    availableCopies: 5,
  },
  {
    title: 'System Design Interview',
    author: 'Alex Xu',
    isbn: '9781736049112',
    category: 'Career',
    genre: 'Systems',
    totalCopies: 3,
    availableCopies: 3,
  }
];

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/library')
  .then(async () => {
    console.log('MongoDB Connected');
    await Book.deleteMany({});
    console.log('Cleared existing books');
    await Book.insertMany(books);
    console.log('Inserted 10 sample books');
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
