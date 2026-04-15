// src/pages/FinesPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { finesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

const UPI_ID = process.env.REACT_APP_COLLEGE_UPI_ID || 'college@upi';
const UPI_NAME = process.env.REACT_APP_COLLEGE_UPI_NAME || 'College';

const FinesPage = () => {
  const { currentUser } = useAuth();
  const role      = currentUser?.role || '';
  const roleLower = role.toLowerCase();

  const [fines,        setFines]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [payingId,     setPayingId]     = useState(null);

  // ── Fetch fines ───────────────────────────────────────────
  const fetchFines = async () => {
    setLoading(true);
    setError('');
    try {
      const res = roleLower === 'student'
        ? await finesAPI.getMyFines()
        : await finesAPI.getAll();

      // Safe extraction
      const raw = res?.data?.data || res?.data || [];
      setFines(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('FinesPage fetch error:', err);
      setError('Failed to load fines. Please try again.');
      setFines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role) fetchFines();
  }, [role]); // eslint-disable-line

  // ── Enrich & filter ───────────────────────────────────────
  const { filtered, totalFine, unpaidFine, paidFine } = useMemo(() => {
    const today = new Date();

    const enriched = fines.map(f => {
      const dueDate    = f.dueDate    ? new Date(f.dueDate)    : null;
      const returnDate = f.returnDate ? new Date(f.returnDate) : null;
      const status     = (f.status || 'pending').toLowerCase();

      // Calculate overdue days
      let overdueDays    = f.overdueDays || 0;
      let calculatedFine = f.amount || 0;

      if (dueDate && !returnDate && status === 'pending') {
        overdueDays    = Math.max(0, Math.ceil((today - dueDate) / 86400000));
        calculatedFine = overdueDays * 5; // ₹5 per day
      }

      // Days left text
      let daysText = '';
      if (dueDate && !returnDate) {
        const diff = Math.ceil((dueDate - today) / 86400000);
        if (diff > 0)       daysText = `${diff} day${diff > 1 ? 's' : ''} left`;
        else if (diff === 0) daysText = 'Due today';
        else                 daysText = 'Overdue';
      }

      return { ...f, overdueDays, calculatedFine, status, daysText };
    });

    // Apply filters
    const list = enriched.filter(f => {
      if (statusFilter !== 'All') {
        if (statusFilter === 'Unpaid' && f.status !== 'pending' && f.status !== 'partial') return false;
        if (statusFilter !== 'Unpaid' && f.status !== statusFilter.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name  = (f.student?.name || f.studentName || '').toLowerCase();
        const title = (f.book?.title   || f.bookTitle   || '').toLowerCase();
        if (!name.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });

    const totalFine  = list.reduce((s, f) => s + (f.calculatedFine || 0), 0);
    const unpaidFine = list.filter(f => f.status === 'pending' || f.status === 'partial')
                          .reduce((s, f) => s + (f.calculatedFine || 0), 0);
    const paidFine   = list.filter(f => f.status === 'paid')
                          .reduce((s, f) => s + (f.calculatedFine || 0), 0);

    return { filtered: list, totalFine, unpaidFine, paidFine };
  }, [fines, statusFilter, searchQuery]);

  // ── Mark paid ─────────────────────────────────────────────
  const handleMarkPaid = async (id) => {
    setPayingId(id);
    const fine = fines.find(f => f._id === id);
    try {
      await finesAPI.markPaid(id, fine?.calculatedFine || fine?.amount || 0);
      setFines(prev => prev.map(f => f._id === id ? { ...f, status: 'paid' } : f));
    } catch (err) {
      alert(err?.message || 'Could not mark fine as paid.');
    } finally {
      setPayingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <p className="mt-2 text-muted">Loading fines…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-5">
      <p className="text-danger">{error}</p>
      <button className="btn btn-lib-primary mt-2" onClick={fetchFines}>Retry</button>
    </div>
  );

  const buildUpiLink = (amount) =>
    `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${encodeURIComponent(amount || 0)}`;

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Header */}
        <div className="mb-4">
          <h2 className="section-title">
            <i className="bi bi-currency-rupee me-2"></i>
            {roleLower === 'student' ? 'My Fines' : 'All Student Fines'}
          </h2>
          <p className="text-muted" style={{ fontSize: '.9rem' }}>
            Fine rate: ₹5 per overdue day
          </p>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          {[
            { label: 'Total Records',    value: `${filtered.length}`,  color: 'blue',  icon: 'bi-list-ul' },
            { label: 'Total Fine',       value: `₹${totalFine}`,       color: 'red',   icon: 'bi-currency-rupee' },
            { label: 'Remaining (Unpaid)', value: `₹${unpaidFine}`,   color: 'gold',  icon: 'bi-exclamation-circle' },
            { label: 'Paid',             value: `₹${paidFine}`,        color: 'green', icon: 'bi-check-circle' },
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
              <input type="text" className="form-control"
                placeholder="Search student or book…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" style={{ fontSize: '.85rem' }}>Status</label>
              <select className="form-select" value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}>
                {['All', 'Unpaid', 'Paid', 'Waived'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <button className="btn btn-lib-secondary w-100"
                onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}>
                <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="lib-card">
          <div className="lib-card-header">
            <h5>
              <i className="bi bi-table me-2"></i>Fine Records
              <span className="text-muted ms-2" style={{ fontSize: '.8rem', fontWeight: 400 }}>
                ({filtered.length} record{filtered.length !== 1 ? 's' : ''})
              </span>
            </h5>
          </div>
          <div className="table-responsive">
            <table className="lib-table">
              <thead>
                <tr>
                  <th>#</th>
                  {roleLower !== 'student' && <th>Student</th>}
                  <th>Book</th>
                  <th>Return Date</th>
                  <th>Due Date</th>
                  <th>Overdue Days</th>
                  <th>Per Book Fine (₹5/day)</th>
                  <th>Status</th>
                  {roleLower === 'student' && <th>Pay with UPI</th>}
                  {(roleLower === 'librarian' || roleLower === 'admin') && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={roleLower === 'student' ? 8 : 9}
                      className="text-center text-muted py-4">
                      No fine records found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((f, i) => (
                    <tr key={f._id || i}>
                      <td>{i + 1}</td>
                      {roleLower !== 'student' && (
                        <td>{f.student?.name || f.studentName || 'N/A'}</td>
                      )}
                      <td>{f.book?.title || f.bookTitle || 'N/A'}</td>
                      <td>
                        {f.returnDate
                          ? new Date(f.returnDate).toLocaleDateString()
                          : f.createdAt ? new Date(f.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        {f.dueDate ? new Date(f.dueDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${f.overdueDays > 0 ? 'bg-danger' : 'bg-secondary'}`}>
                          {f.overdueDays > 0 ? `${f.overdueDays} days` : f.daysText || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`fw-bold ${f.calculatedFine > 0 ? 'text-danger' : 'text-success'}`}>
                          ₹{f.calculatedFine || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-role badge-${
                          f.status === 'paid' ? 'approved' :
                          f.status === 'pending' ? 'pending' : 'rejected'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                      {roleLower === 'student' && (
                        <td>
                          {(f.status === 'pending' || f.status === 'partial') ? (
                            <div className="d-flex flex-column align-items-start gap-2">
                              <div className="small fw-semibold">
                                Amount: ₹{f.calculatedFine || f.amount || 0}
                              </div>
                              <QRCodeSVG value={buildUpiLink(f.calculatedFine || f.amount || 0)} size={90} />
                              <small className="text-muted">Scan to pay ({UPI_ID})</small>
                            </div>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                      )}
                      {(roleLower === 'librarian' || roleLower === 'admin') && (
                        <td>
                          {(f.status === 'pending' || f.status === 'partial') && (
                            <button className="btn btn-sm btn-lib-primary"
                              onClick={() => handleMarkPaid(f._id)}
                              disabled={payingId === f._id}>
                              {payingId === f._id
                                ? <span className="spinner-border spinner-border-sm"></span>
                                : 'Mark as Paid'}
                            </button>
                          )}
                          {f.status === 'paid' && (
                            <span className="text-success">
                              <i className="bi bi-check-circle-fill me-1"></i>Paid
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FinesPage;