// src/pages/RequestCardPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { libraryCardsAPI, booksAPI } from '../services/api';

const RequestCardPage = () => {
  const { currentUser } = useAuth();

  const [form, setForm] = useState({
    course: '',
    branch: '',
    year:   '',
    type:   'temporary',
    notes:  '',
    bookId: '',
  });

  const [submitting,     setSubmitting]     = useState(false);
  const [successMsg,     setSuccessMsg]     = useState('');
  const [errorMsg,       setErrorMsg]       = useState('');
  const [existingCards,  setExistingCards]  = useState([]);
  const [books,          setBooks]          = useState([]);
  const [loadingBooks,   setLoadingBooks]   = useState(true);

  // ── Load existing cards + available books ─────────────────
  useEffect(() => {
    // Fetch student's own cards
    libraryCardsAPI.getAll()
      .then(res => {
        const data = res?.data?.data || res?.data || [];
        setExistingCards(Array.isArray(data) ? data : []);
      })
      .catch(() => setExistingCards([]));

    // Fetch all books (available only for dropdown)
    setLoadingBooks(true);
    booksAPI.getAll()
      .then(res => {
        const data = res?.data?.data || res?.data || [];
        const allBooks = Array.isArray(data) ? data : [];
        // Show all books with available copies
        setBooks(allBooks.filter(b => (b.availableCopies || 0) > 0));
      })
      .catch(() => setBooks([]))
      .finally(() => setLoadingBooks(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Frontend validation
    if (!form.bookId) { setErrorMsg('Please select a book.'); return; }
    if (!form.course)  { setErrorMsg('Please select a course.'); return; }
    if (!form.branch.trim()) { setErrorMsg('Please enter your branch.'); return; }
    if (!form.year.trim())   { setErrorMsg('Please enter your year.'); return; }

    // Enforce max 5 cards (blocking statuses only)
    const BLOCKING = ['pending', 'approved_pending_pickup', 'issued'];
    const activeCards = existingCards.filter(c => BLOCKING.includes(c.status));
    if (activeCards.length >= 5) {
      setErrorMsg('Maximum 5 library cards allowed per student.');
      return;
    }

    // Enforce type limits (count only issued cards)
    const issuedCards = existingCards.filter(c => c.status === 'issued');
    if (form.type === 'temporary' && issuedCards.filter(c => c.type === 'temporary').length >= 3) {
      setErrorMsg('Maximum 3 temporary cards reached.');
      return;
    }
    if (form.type === 'permanent' && issuedCards.filter(c => c.type === 'permanent').length >= 2) {
      setErrorMsg('Maximum 2 permanent cards reached.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await libraryCardsAPI.apply(form);
      const newCard = res?.data?.data || res?.data || {};

      // push() — do not overwrite existing cards
      setExistingCards(prev => [...prev, newCard]);
      setSuccessMsg('Application submitted! Waiting for librarian approval.');
      // reset form
      setForm({ course: '', branch: '', year: '', type: 'temporary', notes: '', bookId: '' });
    } catch (err) {
      // API interceptor returns { message, statusCode, errors } — use err.message
      const msg = err?.message
        || err?.response?.data?.message
        || 'Failed to submit application. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived counts ─────────────────────────────────────────
  // Active = blocking statuses (pending + approved_pending_pickup + issued)
  const BLOCKING = ['pending', 'approved_pending_pickup', 'issued'];
  const activeCards   = existingCards.filter(c => BLOCKING.includes(c.status));
  const pendingCards  = existingCards.filter(c => c.status === 'pending');
  const issuedCards   = existingCards.filter(c => c.status === 'issued');
  const tempCards     = issuedCards.filter(c => c.type === 'temporary');
  const permCards     = issuedCards.filter(c => c.type === 'permanent');

  const totalActive    = activeCards.length;
  const canRequestMore = totalActive < 5;
  const canRequestTemp = tempCards.length < 3;
  const canRequestPerm = permCards.length < 2;

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">

            {/* Header */}
            <div className="mb-4">
              <h2 className="section-title">
                <i className="bi bi-credit-card me-2" style={{ color: 'var(--accent)' }}></i>
                Request Library Card
              </h2>
              <p className="section-subtitle">Select a book and apply for a library card</p>
            </div>

            {/* Card Usage Summary */}
            <div className="lib-card mb-4 p-3">
              <h6 className="mb-3 fw-bold">Your Card Usage</h6>
              <div className="row text-center g-3">
                <div className="col-3">
                  <div className="fw-bold text-success fs-5">{issuedCards.length}</div>
                  <small className="text-muted">Issued</small>
                </div>
                <div className="col-3">
                  <div className="fw-bold text-warning fs-5">
                    {existingCards.filter(c => c.status === 'approved_pending_pickup').length}
                  </div>
                  <small className="text-muted">Pickup</small>
                </div>
                <div className="col-3">
                  <div className="fw-bold text-info fs-5">{tempCards.length}/3</div>
                  <small className="text-muted">Temporary</small>
                </div>
                <div className="col-3">
                  <div className="fw-bold text-primary fs-5">{permCards.length}/2</div>
                  <small className="text-muted">Permanent</small>
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className={`badge ${totalActive >= 5 ? 'bg-danger' : 'bg-success'}`}>
                  {totalActive}/5 cards active
                </span>
              </div>
            </div>

            {/* Existing Cards */}
            {existingCards.length > 0 && (
              <div className="lib-card mb-4 p-4">
                <h6 className="mb-3 fw-bold">My Library Cards</h6>
                <div className="row g-2">
                  {existingCards.map((card, idx) => (
                    <div key={card._id || idx} className="col-md-6">
                      <div className="border rounded p-3">
                        <div className="fw-semibold mb-1">
                          Card #{(card.cardNumber || '').slice(-8) || 'N/A'}
                        </div>
                        <span className={`badge-role badge-${(card.status || 'pending').replace(/_/g, '-')}`}>
                          {/* Human-readable status */}
                          {card.status === 'approved_pending_pickup' ? '📦 Ready for Pickup'
                            : card.status === 'issued'   ? '✅ Issued'
                            : card.status === 'returned' ? '↩ Returned — slot free'
                            : (card.status || 'pending').replace(/_/g, ' ')}
                        </span>
                        <div className="text-muted small mt-1">
                          {card.type} · {card.book?.title || 'No book'}
                        </div>
                        {/* Pickup deadline warning */}
                        {card.status === 'approved_pending_pickup' && card.pickupDeadline && (
                          <div className="text-warning small mt-1">
                            ⏰ Collect by {new Date(card.pickupDeadline).toLocaleDateString()}
                          </div>
                        )}
                        {/* Due date if issued */}
                        {card.status === 'issued' && card.dueDate && (
                          <div className="text-success small mt-1">
                            Due: {new Date(card.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        {card.status === 'rejected' && card.rejectionReason && (
                          <div className="text-danger small mt-1">
                            Reason: {card.rejectionReason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Form */}
            {canRequestMore ? (
              <div className="lib-card p-4">
                <h6 className="mb-3 fw-bold">New Card Application</h6>

                {successMsg && (
                  <div className="alert alert-success mb-3">
                    <i className="bi bi-check-circle-fill me-2"></i>{successMsg}
                  </div>
                )}
                {errorMsg && (
                  <div className="alert alert-danger mb-3">
                    <i className="bi bi-exclamation-triangle me-2"></i>{errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {/* Student info (read-only) */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="lib-label">Student Name</label>
                      <input type="text" className="form-control" value={currentUser?.name || ''} disabled />
                    </div>
                    <div className="col-md-6">
                      <label className="lib-label">Student ID</label>
                      <input type="text" className="form-control" value={currentUser?.studentId || currentUser?.email || ''} disabled />
                    </div>
                  </div>

                  {/* Book Selection */}
                  <div className="mb-3">
                    <label className="lib-label">Select Book <span className="text-danger">*</span></label>
                    {loadingBooks ? (
                      <div className="text-muted">Loading books…</div>
                    ) : books.length === 0 ? (
                      <div className="alert alert-warning py-2 mb-0">
                        No books currently available. Please check back later.
                      </div>
                    ) : (
                      <select name="bookId" className="form-select" value={form.bookId} onChange={handleChange} required>
                        <option value="">-- Choose an available book --</option>
                        {books.map(b => (
                          <option key={b._id} value={b._id}>
                            {b.title} — {b.author} [{b.semester}] (Avail: {b.availableCopies})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Card Type */}
                  <div className="mb-3">
                    <label className="lib-label">Card Type <span className="text-danger">*</span></label>
                    <select name="type" className="form-select" value={form.type} onChange={handleChange}>
                      <option value="temporary" disabled={!canRequestTemp}>
                        Temporary (15 Days){!canRequestTemp ? ' — Limit reached' : ''}
                      </option>
                      <option value="permanent" disabled={!canRequestPerm}>
                        Permanent (Semester End){!canRequestPerm ? ' — Limit reached' : ''}
                      </option>
                    </select>
                  </div>

                  {/* Course / Branch / Year */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="lib-label">Course <span className="text-danger">*</span></label>
                      <select name="course" className="form-select" value={form.course} onChange={handleChange} required>
                        <option value="">Select</option>
                        <option value="BTech">B.Tech</option>
                        <option value="Pharmacy">Pharmacy</option>
                        <option value="Law">Law</option>
                        <option value="MBA">MBA</option>
                        <option value="BCom">B.Com</option>
                        <option value="BCA">BCA</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="lib-label">Branch <span className="text-danger">*</span></label>
                      <input type="text" name="branch" className="form-control" value={form.branch}
                        onChange={handleChange} placeholder="e.g. CSE, IT" required />
                    </div>
                    <div className="col-md-4">
                      <label className="lib-label">Year <span className="text-danger">*</span></label>
                      <input type="text" name="year" className="form-control" value={form.year}
                        onChange={handleChange} placeholder="e.g. 2nd Year" required />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-4">
                    <label className="lib-label">Notes (Optional)</label>
                    <textarea name="notes" className="form-control" rows="2"
                      value={form.notes} onChange={handleChange}
                      placeholder="Any additional notes for the librarian…" />
                  </div>

                  <button type="submit" className="btn btn-lib-primary" disabled={submitting || books.length === 0}>
                    {submitting
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Submitting…</>
                      : <><i className="bi bi-send me-2"></i>Submit Application</>}
                  </button>
                </form>
              </div>
            ) : (
              <div className="lib-card p-4 text-center">
                <div className="alert alert-warning mb-0">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <strong>Card Limit Reached</strong>
                  <p className="mb-0 mt-2">
                    You have reached the maximum of 5 library cards (approved + pending).
                  </p>
                </div>
              </div>
            )}

            {/* Info note */}
            <div className="alert alert-info mt-3" style={{ fontSize: '.85rem' }}>
              <i className="bi bi-info-circle me-2"></i>
              <strong>How it works:</strong>
              &nbsp;① Submit request → ② Librarian approves (you get 2 days to collect) →
              ③ Visit library with ID → Librarian marks collected → Book issued.
              Max: 3 Temporary (15 days) + 2 Permanent (semester).
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestCardPage;
