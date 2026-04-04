// src/pages/FinesPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { finesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  normalizeAPIResponse,
  ensureArray,
  safeNumber,
  getFineAmount,
  normalizeStatus,
} from '../utils/apiHelpers';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['All', 'Unpaid', 'Paid', 'Waived'];

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

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const FinesPage = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const roleLower = (role || '').toString().trim().toLowerCase();

  const [fines,         setFines]         = useState([]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [payingId,      setPayingId]      = useState(null);

  // ── Fetch ─────────────────────────────────────────────────
  const fetchFines = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = role === 'Student'
        ? await finesAPI.getMyFines()
        : await finesAPI.getAll();

      setFines(normalizeToArray(res));
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
  }, [role]);

  // ── Derived / filtered data (memoised) ────────────────────
  const { filtered, totalFine, unpaidFine, paidFine } = useMemo(() => {
    const baseFines = ensureArray(fines);

    // Calculate overdue days and fine for each fine
    const enrichedFines = baseFines.map(fine => {
      const today = new Date();
      const dueDate = fine.dueDate ? new Date(fine.dueDate) : null;
      const returnDate = fine.returnDate ? new Date(fine.returnDate) : null;
      
      let overdueDays = 0;
      let calculatedFine = fine.amount || 0;
      let statusText = normalizeStatus(fine.status);
      
      if (dueDate && !returnDate && statusText === 'pending') {
        overdueDays = Math.max(0, Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)));
        calculatedFine = overdueDays * 5; // ₹5 per day
      }
      
      // Calculate days left for due date
      let daysLeft = null;
      let daysLeftText = '';
      if (dueDate && statusText === 'pending') {
        daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
          daysLeftText = daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;
        } else if (daysLeft === 0) {
          daysLeftText = 'Due today';
        } else {
          daysLeftText = 'Overdue';
        }
      }
      
      return {
        ...fine,
        overdueDays,
        calculatedFine,
        statusText,
        daysLeft,
        daysLeftText
      };
    });

    const filtered = enrichedFines.filter((f) => {
      if (!f) return false;

      // Status filter
      if (statusFilter !== 'All') {
        const s = f.statusText;
        if (statusFilter === 'Unpaid') {
          if (!(s === 'pending' || s === 'partial')) return false;
        } else {
          if (s !== normalizeStatus(statusFilter)) return false;
        }
      }

      // Search filter — check student name or book title
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const studentName = (f.student?.name ?? f.studentName ?? '').toLowerCase();
        const bookTitle   = (f.book?.title   ?? f.bookTitle   ?? '').toLowerCase();
        if (!studentName.includes(q) && !bookTitle.includes(q)) return false;
      }

      return true;
    });

    const safeFiltered = ensureArray(filtered);

    const totalFine = safeFiltered.reduce(
      (sum, f) => sum + (f.calculatedFine || 0),
      0
    );

    const unpaidFine = safeFiltered
      .filter((f) => f && (f.statusText === 'pending' || f.statusText === 'partial'))
      .reduce((sum, f) => sum + (f.calculatedFine || 0), 0);

    const paidFine = safeFiltered
      .filter((f) => f && f.statusText === 'paid')
      .reduce((sum, f) => sum + (f.calculatedFine || 0), 0);

    return { filtered: safeFiltered, totalFine, unpaidFine, paidFine };
  }, [fines, statusFilter, searchQuery]);

  // ── Mark as paid ──────────────────────────────────────────
  const handleMarkPaid = async (id) => {
    setPayingId(id);
    const fine = ensureArray(fines).find(f => f?._id === id);
    const amount = getFineAmount(fine);
    
    try {
      const res = await finesAPI.pay(id, { amount, paymentMethod: 'cash' });
      const updated = res?.data?.data ?? res?.data;
      setFines((prev) =>
        ensureArray(prev).map((f) =>
          f._id === id ? { ...f, status: updated?.status ?? f.status } : f
        )
      );
    } catch (err) {
      alert(err?.message ?? 'Could not mark fine as paid.');
    } finally {
      setPayingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary"></div>
        <p className="mt-2 text-muted">Loading fines…</p>
      </div>
    );

  if (error)
    return (
      <div className="text-center py-5">
        <p className="text-danger">{error}</p>
        <button className="btn btn-lib-primary mt-2" onClick={fetchFines}>
          Retry
        </button>
      </div>
    );

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Header */}
        <div className="mb-4">
          <h2 className="section-title">
            <i className="bi bi-currency-rupee me-2"></i>
            {role === 'Student' ? 'My Fines' : 'All Fines'}
          </h2>
          <p className="text-muted" style={{ fontSize: '.9rem' }}>
            {role === 'Student'
              ? 'Track and pay your library fines here.'
              : 'Manage fines for all students.'}
          </p>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          <StatCard
            icon="bi-list-ul"
            color="blue"
            value={filtered.length}
            label="Total Records"
          />
          <StatCard
            icon="bi-currency-rupee"
            color="red"
            value={`₹${safeNumber(totalFine)}`}
            label="Total Amount"
          />
          <StatCard
            icon="bi-exclamation-circle"
            color="gold"
            value={`₹${safeNumber(unpaidFine)}`}
            label="Unpaid"
          />
          <StatCard
            icon="bi-check-circle"
            color="green"
            value={`₹${safeNumber(paidFine)}`}
            label="Paid"
          />
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
                  placeholder="Search by student or book…"
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
                Status
              </label>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <button
                className="btn btn-lib-secondary w-100"
                onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="lib-card">
          <div className="lib-card-header">
            <h5>
              <i className="bi bi-table me-2"></i>
              Fine Records
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
                  <th>Amount</th>
                  <th>Overdue Days</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  {roleLower !== 'student' && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={roleLower !== 'student' ? 9 : 7}
                      className="text-center text-muted py-4"
                    >
                      No fine records found
                      {statusFilter !== 'All' && ` for status "${statusFilter}"`}.
                    </td>
                  </tr>
                ) : (
                  filtered.map((f, i) => (
                    <tr key={f._id ?? i}>
                      <td>{i + 1}</td>
                      {roleLower !== 'student' && (
                        <td>{f.student?.name ?? f.studentName ?? 'N/A'}</td>
                      )}
                      <td>{f.book?.title ?? f.bookTitle ?? 'N/A'}</td>
                      <td>
                        <span className={`fw-bold ${f.overdueDays > 0 ? 'text-danger' : 'text-success'}`}>
                          ₹{safeNumber(f.calculatedFine || 0)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${f.overdueDays > 0 ? 'bg-danger' : f.daysLeft > 0 ? 'bg-warning' : 'bg-secondary'}`}>
                          {f.overdueDays > 0 ? `${f.overdueDays} days` : f.daysLeftText || '-'}
                        </span>
                      </td>
                      <td>
                        {f.issueDate
                          ? new Date(f.issueDate).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td>
                        {f.dueDate
                          ? new Date(f.dueDate).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge-role badge-${f.statusText === 'paid' ? 'approved' : f.statusText === 'pending' ? 'pending' : 'rejected'}`}>
                          {f.statusText}
                        </span>
                      </td>
                      {roleLower !== 'student' && (
                        <td>
                          {f.statusText === 'pending' && (
                            <button
                              className="btn btn-sm btn-lib-primary"
                              onClick={() => handleMarkPaid(f._id)}
                              disabled={payingId === f._id}
                            >
                              {payingId === f._id ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1"></span>
                                  Processing...
                                </>
                              ) : (
                                'Mark Paid'
                              )}
                            </button>
                          )}
                          {f.statusText === 'paid' && (
                            <span className="text-success">
                              <i className="bi bi-check-circle-fill"></i> Paid
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