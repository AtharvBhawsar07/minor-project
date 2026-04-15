// src/pages/RequestCardPage.js — submit library card request to backend
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { booksAPI, libraryCardsAPI } from '../services/api';

const safeBooks = (res) => {
  const raw = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(raw) ? raw : [];
};

const RequestCardPage = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const preBookId = searchParams.get('bookId') || '';

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    bookId: preBookId,
    course: '',
    branch: '',
    year: '',
    type: 'temporary',
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await booksAPI.getAll();
        setBooks(safeBooks(res));
      } catch {
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (preBookId) setForm((f) => ({ ...f, bookId: preBookId }));
  }, [preBookId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (!form.bookId) {
      setMsg({ type: 'danger', text: 'Please choose a book.' });
      return;
    }
    if (!form.course.trim() || !form.branch.trim() || !form.year.trim()) {
      setMsg({ type: 'danger', text: 'Course, branch, and year are required.' });
      return;
    }
    setSubmitting(true);
    try {
      await libraryCardsAPI.apply({
        bookId: form.bookId,
        course: form.course.trim(),
        branch: form.branch.trim(),
        year: form.year.trim(),
        type: form.type,
        notes: form.notes.trim(),
      });
      setMsg({ type: 'success', text: 'Request submitted! Check your dashboard for status.' });
      setForm((f) => ({
        ...f,
        notes: '',
      }));
    } catch (err) {
      setMsg({ type: 'danger', text: err?.message || 'Request failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" />
        <p className="mt-2 text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container py-4" style={{ maxWidth: 720 }}>
        <div className="mb-4">
          <h2 className="section-title">
            <i className="bi bi-credit-card me-2" style={{ color: 'var(--accent)' }} />
            Request a book
          </h2>
          <p className="text-muted small mb-0">
            Select a book and submit. Librarian will approve before pickup.
          </p>
        </div>

        <div className="lib-card p-4">
          {msg.text && (
            <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'} mb-3`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="lib-label">Book *</label>
              <select
                name="bookId"
                className="form-select"
                value={form.bookId}
                onChange={handleChange}
                required
              >
                <option value="">— Select book —</option>
                {books.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.title} — {b.author}
                    {b.semester != null ? ` [Sem ${b.semester}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="row g-3">
              <div className="col-md-4">
                <label className="lib-label">Course *</label>
                <input name="course" className="form-control" value={form.course} onChange={handleChange} required />
              </div>
              <div className="col-md-4">
                <label className="lib-label">Branch *</label>
                <input name="branch" className="form-control" value={form.branch} onChange={handleChange} required />
              </div>
              <div className="col-md-4">
                <label className="lib-label">Year *</label>
                <input name="year" className="form-control" value={form.year} onChange={handleChange} required placeholder="e.g. 2nd" />
              </div>
            </div>

            <div className="mb-3 mt-2">
              <label className="lib-label">Card type</label>
              <select name="type" className="form-select" value={form.type} onChange={handleChange}>
                <option value="temporary">Temporary (15 days)</option>
                <option value="permanent">Permanent (semester-based)</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="lib-label">Notes (optional)</label>
              <textarea name="notes" className="form-control" rows={3} value={form.notes} onChange={handleChange} />
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button type="submit" className="btn btn-lib-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
              <Link to="/books" className="btn btn-lib-secondary">
                Back to catalog
              </Link>
              <Link to="/dashboard" className="btn btn-outline-secondary">
                Dashboard
              </Link>
            </div>

            <div className="mt-3">
              <p className="text-muted small mb-1 fw-semibold">Before you request:</p>
              <ol className="text-muted small ps-3 mb-0">
                <li>First, submit a book request.</li>
                <li>Your request will be reviewed and approved by the librarian.</li>
                <li>After approval, you need to collect the book within 2 days.</li>
                <li>While collecting, bring your college ID card.</li>
                <li>The librarian will verify and give you the book.</li>
              </ol>
            </div>
          </form>
        </div>

        <p className="text-muted small mt-3 mb-0">
          Logged in as <strong>{currentUser?.name}</strong>
          {currentUser?.studentId ? ` (${currentUser.studentId})` : ''}.
        </p>
      </div>
    </div>
  );
};

export default RequestCardPage;
