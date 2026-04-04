// src/pages/BooksPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { booksAPI, issuesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSkeleton from '../components/LoadingSkeleton';
import '../components/LoadingSkeleton.css';
import {
  normalizeAPIResponse,
  ensureArray,
  safeNumber,
  normalizeStatus,
} from '../utils/apiHelpers';

// ─────────────────────────────────────────────────────────────
// HELPERS (local to this file)
// ─────────────────────────────────────────────────────────────

/** Returns the available-copies count regardless of field name used. */
const getAvailableCopies = (book) =>
  safeNumber(
    book?.availableCopies ?? book?.available ?? book?.copiesAvailable ?? 0
  );

/** Returns a deduped list of genres from the books array. */
const extractGenres = (books) => {
  const genres = ensureArray(books)
    .map((b) => b?.genre)
    .filter(Boolean);
  return ['All', ...Array.from(new Set(genres)).sort()];
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────
const StatCard = ({ icon, color, value, label }) => (
  <div className="col-sm-6 col-lg-3">
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  </div>
);

const BookCard = ({ book, onIssue, issuing }) => {
  const available = getAvailableCopies(book);
  return (
    <div className="col-sm-6 col-lg-4">
      <div className="lib-card h-100 d-flex flex-column">
        <div className="lib-card-header">
          <h6 className="mb-0" style={{ fontWeight: 600 }}>
            {book.title ?? 'Untitled'}
          </h6>
        </div>
        <div className="p-3 flex-grow-1">
          <p className="text-muted mb-1" style={{ fontSize: '.85rem' }}>
            <i className="bi bi-person me-1"></i>
            {book.author ?? 'Unknown Author'}
          </p>
          <p className="text-muted mb-1" style={{ fontSize: '.85rem' }}>
            <i className="bi bi-tag me-1"></i>
            {book.genre ?? 'Uncategorised'}
          </p>
          <p className="text-muted mb-2" style={{ fontSize: '.85rem' }}>
            <i className="bi bi-upc me-1"></i>
            ISBN: {book.isbn ?? 'N/A'}
          </p>
          <span
            className={`badge-role badge-${available > 0 ? 'approved' : 'rejected'}`}
          >
            {available > 0 ? `${available} available` : 'Not available'}
          </span>
        </div>
        {onIssue && (
          <div className="p-3 pt-0">
            <button
              className="btn btn-lib-primary w-100 btn-sm"
              disabled={available === 0 || issuing === book._id}
              onClick={() => onIssue(book._id)}
            >
              {issuing === book._id
                ? <span className="spinner-border spinner-border-sm"></span>
                : available > 0 ? 'Request Issue' : 'Unavailable'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const BooksPage = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const roleLower = (role || '').toString().trim().toLowerCase();

  const [books,        setBooks]        = useState([]);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [category,     setCategory]     = useState('All');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [issuing,      setIssuing]      = useState(null);
  const [successMsg,   setSuccessMsg]   = useState('');

  // ── Fetch ─────────────────────────────────────────────────
  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await booksAPI.getAll();
      setBooks(ensureArray(normalizeAPIResponse(res)));
    } catch (err) {
      console.error('BooksPage fetch error:', err);
      setError('Failed to load books. Please try again.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  // ── Derived / filtered data (memoised) ────────────────────
  const genres = useMemo(() => extractGenres(books), [books]);

  const { filtered, totalBooks, availableBooks, unavailableBooks } = useMemo(() => {
    const safeBooks = ensureArray(books);

    let filtered = safeBooks;

    // Category filter
    if (category !== 'All') {
      filtered = filtered.filter((b) => b?.genre === category);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((b) => {
        if (!b) return false;
        return (
          (b.title  ?? '').toLowerCase().includes(q) ||
          (b.author ?? '').toLowerCase().includes(q) ||
          (b.isbn   ?? '').toLowerCase().includes(q) ||
          (b.genre  ?? '').toLowerCase().includes(q)
        );
      });
    }

    const totalBooks       = safeBooks.length;
    const availableBooks   = safeBooks.filter((b) => getAvailableCopies(b) > 0).length;
    const unavailableBooks = totalBooks - availableBooks;

    return { filtered, totalBooks, availableBooks, unavailableBooks };
  }, [books, category, searchQuery]);

  // ── Issue handler ─────────────────────────────────────────
  const handleIssue = async (bookId) => {
    setIssuing(bookId);
    setSuccessMsg('');
    try {
      await issuesAPI.issueBook({ bookId });
      setSuccessMsg('Book issue requested successfully!');
      // Optimistically reduce available count by 1
      setBooks((prev) =>
        ensureArray(prev).map((b) => {
          if (b._id !== bookId) return b;
          const current = getAvailableCopies(b);
          return { ...b, availableCopies: Math.max(0, current - 1) };
        })
      );
    } catch (err) {
      alert(err?.message ?? 'Could not request book issue.');
    } finally {
      setIssuing(null);
    }
  };

  // ── Add / edit book (staff only) ──────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this book?')) return;
    try {
      await booksAPI.delete(id);
      setBooks((prev) => ensureArray(prev).filter((b) => b._id !== id));
    } catch (err) {
      alert(err?.message ?? 'Could not delete book.');
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary"></div>
        <p className="mt-2 text-muted">Loading books…</p>
      </div>
    );

  if (error)
    return (
      <div className="text-center py-5">
        <p className="text-danger">{error}</p>
        <button className="btn btn-lib-primary mt-2" onClick={fetchBooks}>
          Retry
        </button>
      </div>
    );

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="section-title mb-0">
              <i className="bi bi-journals me-2"></i>Book Catalog
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '.9rem' }}>
              {totalBooks} book{totalBooks !== 1 ? 's' : ''} in the library
            </p>
          </div>
          {(roleLower === 'admin' || roleLower === 'librarian') && (
            <button className="btn btn-lib-primary">
              <i className="bi bi-plus-lg me-1"></i>Add Book
            </button>
          )}
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="alert alert-success alert-dismissible mb-3" role="alert">
            {successMsg}
            <button
              type="button"
              className="btn-close"
              onClick={() => setSuccessMsg('')}
            ></button>
          </div>
        )}

        {/* Stats */}
        <div className="row g-3 mb-4">
          <StatCard icon="bi-journals"    color="blue"  value={totalBooks}       label="Total Books" />
          <StatCard icon="bi-check-circle" color="green" value={availableBooks}   label="Available" />
          <StatCard icon="bi-x-circle"    color="red"   value={unavailableBooks} label="Unavailable" />
          <StatCard icon="bi-grid"        color="gold"  value={genres.length - 1} label="Categories" />
        </div>

        {/* Filters */}
        <div className="lib-card mb-4 p-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-6">
              <label className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                Search
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Title, author, ISBN…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setSearchQuery('')}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>
                Category
              </label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <button
                className="btn btn-lib-secondary w-100"
                onClick={() => { setSearchQuery(''); setCategory('All'); }}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-muted mb-3" style={{ fontSize: '.85rem' }}>
          Showing {filtered.length} of {totalBooks} book{totalBooks !== 1 ? 's' : ''}
          {category !== 'All' && ` in "${category}"`}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>

        {/* Books grid */}
        {filtered.length === 0 ? (
          <div className="lib-card text-center py-5">
            <i className="bi bi-book text-muted" style={{ fontSize: '2.5rem' }}></i>
            <p className="text-muted mt-3">No books found matching your search.</p>
            <button
              className="btn btn-lib-secondary btn-sm mt-1"
              onClick={() => { setSearchQuery(''); setCategory('All'); }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="row g-3">
            {filtered.map((book, i) => (
              <BookCard
                key={book._id ?? i}
                book={book}
                issuing={issuing}
                onIssue={roleLower === 'student' ? handleIssue : null}
              />
            ))}
          </div>
        )}

        {/* Staff delete view (table) */}
        {(roleLower === 'admin' || roleLower === 'librarian') && filtered.length > 0 && (
          <div className="lib-card mt-4">
            <div className="lib-card-header">
              <h5><i className="bi bi-table me-2"></i>Staff View</h5>
            </div>
            <div className="table-responsive">
              <table className="lib-table">
                <thead>
                  <tr>
                    <th>#</th><th>Title</th><th>Author</th>
                    <th>Genre</th><th>ISBN</th><th>Available</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => (
                    <tr key={b._id ?? i}>
                      <td>{i + 1}</td>
                      <td>{b.title  ?? 'N/A'}</td>
                      <td>{b.author ?? 'N/A'}</td>
                      <td>{b.genre  ?? 'N/A'}</td>
                      <td>{b.isbn   ?? 'N/A'}</td>
                      <td>
                        <span
                          className={`badge-role badge-${getAvailableCopies(b) > 0 ? 'approved' : 'rejected'}`}
                        >
                          {getAvailableCopies(b)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-lib-secondary me-1"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(b._id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BooksPage;