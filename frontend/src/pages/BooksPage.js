// src/pages/BooksPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { booksAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BooksPage = () => {
  const { currentUser } = useAuth();
  const role = (currentUser?.role || '').toLowerCase();

  const [books,       setBooks]       = useState([]);
  const [search,      setSearch]      = useState('');
  const [semester,    setSemester]    = useState('All');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');

  // ── Fetch all books ───────────────────────────────────────
  const fetchBooks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await booksAPI.getAll();
      // Safe extraction: res.data.data OR res.data OR []
      const raw = res?.data?.data || res?.data || [];
      setBooks(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('BooksPage fetch error:', err);
      setError('Failed to load books. Please refresh the page.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBooks(); }, []);

  // ── Derived data ─────────────────────────────────────────
  const semesters = useMemo(() => {
    const uniq = [...new Set(books.map(b => b.semester).filter(Boolean))].sort();
    return ['All', ...uniq];
  }, [books]);

  const filtered = useMemo(() => {
    let list = books;
    if (semester !== 'All') list = list.filter(b => b.semester === semester);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        (b.title  || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [books, semester, search]);

  const totalBooks     = books.length;
  const availableBooks = books.filter(b => (b.availableCopies || 0) > 0).length;

  // ── Delete book (admin only) ──────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Remove this book?')) return;
    try {
      await booksAPI.delete(id);
      setBooks(prev => prev.filter(b => b._id !== id));
      setSuccessMsg('Book removed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err?.message || 'Could not delete book.');
    }
  };

  // ── Loading / Error states ────────────────────────────────
  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <p className="mt-2 text-muted">Loading books…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-5">
      <p className="text-danger">{error}</p>
      <button className="btn btn-lib-primary mt-2" onClick={fetchBooks}>Retry</button>
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
              {totalBooks} books · {availableBooks} available
            </p>
          </div>
        </div>

        {/* Success */}
        {successMsg && (
          <div className="alert alert-success mb-3">{successMsg}</div>
        )}

        {/* Stats row */}
        <div className="row g-3 mb-4">
          {[
            { label: 'Total Books', value: totalBooks,     color: 'blue', icon: 'bi-journals' },
            { label: 'Available',   value: availableBooks, color: 'green', icon: 'bi-check-circle' },
            { label: 'Checked Out', value: totalBooks - availableBooks, color: 'red', icon: 'bi-x-circle' },
            { label: 'Semesters',   value: semesters.length - 1, color: 'gold', icon: 'bi-grid' },
          ].map(s => (
            <div className="col-sm-6 col-lg-3" key={s.label}>
              <div className="stat-card">
                <div className={`stat-icon ${s.color}`}><i className={`bi ${s.icon}`}></i></div>
                <div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="lib-card mb-4 p-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Title or author…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>Semester</label>
              <select className="form-select" value={semester} onChange={e => setSemester(e.target.value)}>
                {semesters.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <button className="btn btn-lib-secondary w-100"
                onClick={() => { setSearch(''); setSemester('All'); }}>
                <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
              </button>
            </div>
          </div>
        </div>

        <p className="text-muted mb-3" style={{ fontSize: '.85rem' }}>
          Showing {filtered.length} of {totalBooks} books
        </p>

        {/* Book cards grid */}
        {filtered.length === 0 ? (
          <div className="lib-card text-center py-5">
            <i className="bi bi-book text-muted" style={{ fontSize: '2.5rem' }}></i>
            <p className="text-muted mt-3">No books found.</p>
          </div>
        ) : (
          <div className="row g-3">
            {filtered.map((book) => {
              const avail = book.availableCopies || 0;
              return (
                <div className="col-sm-6 col-lg-4" key={book._id}>
                  <div className="lib-card h-100 d-flex flex-column">
                    <div className="lib-card-header">
                      <h6 className="mb-0" style={{ fontWeight: 600, color: '#fff' }}>{book.title}</h6>
                    </div>
                    <div className="p-3 flex-grow-1">
                      <p className="text-muted mb-1" style={{ fontSize: '.85rem' }}>
                        <i className="bi bi-person me-1"></i>{book.author || 'Unknown'}
                      </p>
                      {book.semester && (
                        <p className="text-muted mb-1" style={{ fontSize: '.85rem' }}>
                          <i className="bi bi-layers me-1"></i>{book.semester}
                        </p>
                      )}
                      <span className={`badge-role badge-${avail > 0 ? 'approved' : 'rejected'}`}>
                        {avail > 0 ? `${avail} available` : 'Not available'}
                      </span>
                    </div>
                    {role === 'admin' && (
                      <div className="p-3 pt-0">
                        <button className="btn btn-sm btn-danger w-100"
                          onClick={() => handleDelete(book._id)}>
                          <i className="bi bi-trash me-1"></i>Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Staff table */}
        {(role === 'admin' || role === 'librarian') && filtered.length > 0 && (
          <div className="lib-card mt-4">
            <div className="lib-card-header">
              <h5><i className="bi bi-table me-2"></i>Staff View</h5>
            </div>
            <div className="table-responsive">
              <table className="lib-table">
                <thead>
                  <tr>
                    <th>#</th><th>Title</th><th>Author</th>
                    <th>Semester</th><th>Total</th><th>Available</th>
                    {role === 'admin' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => (
                    <tr key={b._id}>
                      <td>{i + 1}</td>
                      <td>{b.title  || 'N/A'}</td>
                      <td>{b.author || 'N/A'}</td>
                      <td>{b.semester || 'N/A'}</td>
                      <td>{b.totalCopies || 0}</td>
                      <td>
                        <span className={`badge-role badge-${(b.availableCopies || 0) > 0 ? 'approved' : 'rejected'}`}>
                          {b.availableCopies || 0}
                        </span>
                      </td>
                      {role === 'admin' && (
                        <td>
                          <button className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(b._id)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      )}
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