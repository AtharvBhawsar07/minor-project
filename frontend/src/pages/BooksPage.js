// src/pages/BooksPage.js — real API, matches app styling (Bootstrap + lib-*)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { booksAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const safeBooks = (res) => {
  const raw = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(raw) ? raw : [];
};

const copies = (b) =>
  Number(b?.availableCopies ?? b?.available ?? b?.copiesAvailable ?? 0);

const BooksPage = () => {
  const { currentUser } = useAuth();
  const roleLower = (currentUser?.role || '').toLowerCase();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [semester, setSemester] = useState('All');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await booksAPI.getAll();
      setBooks(safeBooks(res));
    } catch (e) {
      setError(e?.message || 'Failed to load books.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const semesterOptions = useMemo(() => {
    const nums = [...new Set(books.map((b) => b?.semester).filter((s) => s != null && s !== ''))];
    return ['All', ...nums.sort((a, b) => Number(a) - Number(b))];
  }, [books]);

  const filtered = useMemo(() => {
    let list = Array.isArray(books) ? [...books] : [];
    if (semester !== 'All') list = list.filter((b) => String(b?.semester) === String(semester));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const t = (b?.title || '').toLowerCase();
        const a = (b?.author || '').toLowerCase();
        const g = (b?.genre || '').toLowerCase();
        return t.includes(q) || a.includes(q) || g.includes(q);
      });
    }
    return list;
  }, [books, semester, searchQuery]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this book?')) return;
    try {
      await booksAPI.delete(id);
      setBooks((prev) => prev.filter((b) => b._id !== id));
    } catch (e) {
      alert(e?.message || 'Delete failed');
    }
  };

  const handleUploadBooks = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage('');
    try {
      const res = await booksAPI.upload(file);
      const message = res?.data?.message || 'Books uploaded successfully';
      setUploadMessage(message);
      await load();
    } catch (e) {
      setUploadMessage(e?.message || 'Book upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" />
        <p className="mt-2 text-muted">Loading books…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-5">
        <p className="text-danger">{error}</p>
        <button type="button" className="btn btn-lib-primary mt-2" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container py-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
          <div>
            <h2 className="section-title mb-0">
              <i className="bi bi-journals me-2" />
              Book Catalog
            </h2>
            <p className="text-muted mb-0 small">{books.length} title(s) in library</p>
          </div>
          {(roleLower === 'librarian' || roleLower === 'admin') && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="d-none"
                onChange={handleUploadBooks}
              />
              <button
                type="button"
                className="btn btn-lib-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Books'}
              </button>
            </div>
          )}
        </div>

        {uploadMessage && (
          <div className={`alert ${uploadMessage.toLowerCase().includes('fail') || uploadMessage.toLowerCase().includes('error') ? 'alert-danger' : 'alert-success'}`}>
            {uploadMessage}
          </div>
        )}

        <div className="lib-card p-3 mb-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Search</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-search" /></span>
                <input
                  className="form-control"
                  placeholder="Title, author, genre…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Semester</label>
              <select className="form-select" value={semester} onChange={(e) => setSemester(e.target.value)}>
                {semesterOptions.map((s) => (
                  <option key={String(s)} value={s}>
                    {s === 'All' ? 'All semesters' : `Semester ${s}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-lib-secondary w-100"
                onClick={() => {
                  setSearchQuery('');
                  setSemester('All');
                }}
              >
                <i className="bi bi-arrow-counterclockwise me-1" />
                Reset
              </button>
            </div>
          </div>
        </div>

        <p className="text-muted small mb-3">
          Showing {filtered.length} of {books.length} book(s)
        </p>

        {filtered.length === 0 ? (
          <div className="lib-card text-center py-5 text-muted">No books match your filters.</div>
        ) : (
          <div className="row g-3">
            {filtered.map((book) => {
              const avail = copies(book);
              return (
                <div key={book._id} className="col-sm-6 col-lg-4">
                  <div className="lib-card h-100 d-flex flex-column">
                    <div className="lib-card-header">
                      <h6 className="mb-0" style={{ fontWeight: 600 }}>
                        {book.title || 'Untitled'}
                      </h6>
                    </div>
                    <div className="p-3 flex-grow-1">
                      <p className="text-muted mb-1 small">
                        <i className="bi bi-person me-1" />
                        {book.author || '—'}
                      </p>
                      {book.semester != null && (
                        <p className="text-muted mb-1 small">
                          <i className="bi bi-layers me-1" />
                          Semester {book.semester}
                        </p>
                      )}
                      {book.genre && (
                        <p className="text-muted mb-2 small">
                          <i className="bi bi-tag me-1" />
                          {book.genre}
                        </p>
                      )}
                      <span className={`badge-role ${avail > 0 ? 'badge-approved' : 'badge-rejected'}`}>
                        {avail > 0 ? `${avail} available` : 'Unavailable'}
                      </span>
                    </div>
                    <div className="p-3 pt-0">
                      {roleLower === 'student' && (
                        <Link
                          to={`/request-card?bookId=${book._id}`}
                          className={`btn btn-lib-primary w-100 btn-sm ${avail === 0 ? 'disabled' : ''}`}
                          onClick={(e) => {
                            if (avail === 0) e.preventDefault();
                          }}
                        >
                          {avail > 0 ? 'Request book' : 'Unavailable'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(roleLower === 'librarian' || roleLower === 'admin') && filtered.length > 0 && (
          <div className="lib-card mt-4">
            <div className="lib-card-header">
              <h5 className="mb-0">
                <i className="bi bi-table me-2" />
                Staff view
              </h5>
            </div>
            <div className="table-responsive">
              <table className="lib-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Sem</th>
                    <th>Avail</th>
                    {roleLower === 'admin' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => (
                    <tr key={b._id}>
                      <td>{i + 1}</td>
                      <td>{b.title}</td>
                      <td>{b.author}</td>
                      <td>{b.semester ?? '—'}</td>
                      <td>{copies(b)}</td>
                      {roleLower === 'admin' && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(b._id)}
                          >
                            <i className="bi bi-trash" />
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
