// src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { booksAPI, finesAPI, libraryCardsAPI, issuesAPI } from '../services/api';

// ── Safe array from API response ─────────────────────────────
const safeList = (res) => {
  const raw = res?.data?.data || res?.data || [];
  return Array.isArray(raw) ? raw : [];
};

// ── Human-readable status label ───────────────────────────────
const statusLabel = (status = '') => {
  const map = {
    pending:                  'Pending Review',
    approved_pending_pickup:  'Ready for Pickup 📦',
    issued:                   'Issued ✅',
    return_requested:         'Return requested ⏳',
    returned:                 '↩ Returned',   // slot is now free
    rejected:                 'Rejected',
    expired:                  'Expired',
    suspended:                'Suspended',
  };
  return map[status] || status.replace(/_/g, ' ');
};

// ── Badge CSS class from status ───────────────────────────────
const badgeClass = (status = '') =>
  `badge-role badge-${status.replace(/_/g, '-')}`;

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const role      = currentUser?.role || '';
  const roleLower = role.toLowerCase();

  const [loading,   setLoading]   = useState(true);
  const [books,     setBooks]     = useState([]);
  const [fines,     setFines]     = useState([]);
  const [requests,  setRequests]  = useState([]);
  const [issues,    setIssues]    = useState([]);
  const [actionMsg, setActionMsg] = useState('');

  // ── Load all data ─────────────────────────────────────────
  useEffect(() => {
    if (!role) return;

    const load = async () => {
      setLoading(true);
      try {
        const [booksRes, finesRes, cardsRes, issuesRes] = await Promise.allSettled([
          booksAPI.getAll(),
          roleLower === 'student' ? finesAPI.getMyFines() : finesAPI.getAll(),
          libraryCardsAPI.getAll(),
          issuesAPI.getAll(),
        ]);

        setBooks(    booksRes.status   === 'fulfilled' ? safeList(booksRes.value)  : []);
        setFines(    finesRes.status   === 'fulfilled' ? safeList(finesRes.value)  : []);
        setRequests( cardsRes.status   === 'fulfilled' ? safeList(cardsRes.value)  : []);
        setIssues(   issuesRes.status  === 'fulfilled' ? safeList(issuesRes.value) : []);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [role]); // eslint-disable-line

  // ── Derived stats ─────────────────────────────────────────
  const availableBooks = books.filter(b => (b.availableCopies || 0) > 0).length;
  const activeIssues   = issues.filter(i => i.status === 'issued' && !i.returnDate);
  const unpaidFines    = fines.filter(f => ['pending', 'partial'].includes((f.status || '').toLowerCase()));
  const totalUnpaid    = unpaidFines.reduce((s, f) => s + (f.amount || f.calculatedAmount || 0), 0);
  const dueNotifications = roleLower === 'student'
    ? activeIssues
        .map((issue) => {
          if (!issue?.dueDate) return null;
          const today = new Date();
          const dueDate = new Date(issue.dueDate);
          const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          const daysLeft = Math.round((dueStart - todayStart) / 86400000);
          if (daysLeft === 2 || daysLeft === 1) {
            return {
              id: issue._id,
              title: issue?.book?.title || 'Book',
              message: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left before due date`,
              dueDate: dueDate.toLocaleDateString(),
            };
          }
          return null;
        })
        .filter(Boolean)
    : [];

  // Active card slots: pending + approved_pending_pickup + issued (NOT returned/rejected/expired)
  const ACTIVE_CARD_STATUSES = ['pending', 'approved_pending_pickup', 'issued', 'return_requested'];
  const activeCardCount = requests.filter(c => ACTIVE_CARD_STATUSES.includes(c?.status)).length;
  const cardUsage  = `${activeCardCount}/5`;

  // ── Staff action: Approve ─────────────────────────────────
  const handleApprove = async (id) => {
    try {
      await libraryCardsAPI.approve(id);
      setRequests(prev => prev.map(r =>
        r._id === id ? { ...r, status: 'approved_pending_pickup' } : r
      ));
      setActionMsg('✅ Card approved! Student can now come for pickup.');
      setTimeout(() => setActionMsg(''), 5000);
    } catch (err) {
      alert('❌ ' + (err.message || 'Approval failed'));
    }
  };

  // ── Staff action: Reject ──────────────────────────────────
  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection reason (or note for cancelling return request):');
    if (!reason) return;
    try {
      await libraryCardsAPI.reject(id, reason);
      const cardsRes = await libraryCardsAPI.getAll();
      setRequests(safeList(cardsRes));
      setActionMsg('Updated.');
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      alert('❌ ' + (err.message || 'Rejection failed'));
    }
  };

  // ── Staff action: Mark as Collected ──────────────────────
  // Called after librarian physically verifies student's ID card
  const handleCollect = async (id) => {
    const ok = window.confirm(
      'Confirm: Student ID verified. Mark this book as collected and issue it?'
    );
    if (!ok) return;
    try {
      const res = await libraryCardsAPI.collect(id);
      const updatedCard = res?.data?.data || {};
      setRequests(prev => prev.map(r =>
        r._id === id ? { ...r, status: 'issued', dueDate: updatedCard.dueDate } : r
      ));
      try {
        const issuesRes = await issuesAPI.getAll();
        setIssues(safeList(issuesRes));
      } catch (_) { /* ignore */ }
      setActionMsg(`✅ Book issued! Due: ${updatedCard.dueDate ? new Date(updatedCard.dueDate).toLocaleDateString() : 'N/A'}`);
      setTimeout(() => setActionMsg(''), 6000);
    } catch (err) {
      alert('❌ ' + (err.message || 'Could not mark as collected'));
    }
  };

  // ── Staff action: Run expiry check ────────────────────────
  const handleRunExpire = async () => {
    try {
      const res = await libraryCardsAPI.runExpire();
      const count = res?.data?.data?.expiredCount || 0;
      setActionMsg(`🕐 Expired ${count} overdue pickup request(s).`);
      // Refresh the list
      const cardsRes = await libraryCardsAPI.getAll();
      setRequests(safeList(cardsRes));
      setTimeout(() => setActionMsg(''), 5000);
    } catch (err) {
      alert('❌ ' + (err.message || 'Expiry check failed'));
    }
  };

  // Student: ask librarian to verify return
  const handleRequestReturn = async (id) => {
    try {
      await libraryCardsAPI.requestReturn(id);
      setRequests((prev) => prev.map((r) => (r._id === id ? { ...r, status: 'return_requested' } : r)));
      setActionMsg('Return requested. Librarian will confirm when the book is received.');
      setTimeout(() => setActionMsg(''), 6000);
    } catch (err) {
      alert('❌ ' + (err.message || 'Could not submit return request'));
    }
  };

  // Librarian/Admin: confirm physical return
  const handleConfirmReturn = async (id) => {
    const ok = window.confirm('Confirm the book was received at the library?');
    if (!ok) return;
    try {
      await libraryCardsAPI.returnBook(id);
      setRequests((prev) => prev.map((r) => (r._id === id ? { ...r, status: 'returned' } : r)));
      try {
        const issuesRes = await issuesAPI.getAll();
        setIssues(safeList(issuesRes));
      } catch (_) { /* ignore */ }
      setActionMsg('Marked as returned. Card slot unlocked.');
      setTimeout(() => setActionMsg(''), 5000);
    } catch (err) {
      alert('❌ ' + (err.message || 'Return failed'));
    }
  };

  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <p className="mt-2 text-muted">Loading dashboard…</p>
    </div>
  );

  // ── Staff: requests needing action ───────────────────────
  const pendingForReview  = requests.filter(r => r.status === 'pending');
  const awaitingPickup    = requests.filter(r => r.status === 'approved_pending_pickup');
  const returnRequests    = requests.filter(r => r.status === 'return_requested');

  return (
    <div className="container mt-4 pb-5">

      {/* Welcome */}
      <div className="d-flex align-items-center gap-3 mb-4">
        <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#1e3a5f',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="bi bi-person text-white" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h3 className="mb-0">Hello, {currentUser?.name}!</h3>
          <span className="badge bg-secondary text-capitalize">{role} Dashboard</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-icon blue"><i className="bi bi-book"></i></div>
            <div><div className="stat-value">{availableBooks}</div><div className="stat-label">Books Available</div></div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-icon red"><i className="bi bi-cash"></i></div>
            <div><div className="stat-value">₹{totalUnpaid}</div><div className="stat-label">Unpaid Fines</div></div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-icon green"><i className="bi bi-list-check"></i></div>
            <div><div className="stat-value">{activeIssues.length}</div><div className="stat-label">Active Issues</div></div>
          </div>
        </div>
        {roleLower === 'student' ? (
          <div className="col-sm-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon gold"><i className="bi bi-credit-card"></i></div>
              <div><div className="stat-value">{cardUsage}</div><div className="stat-label">Active cards</div></div>
            </div>
          </div>
        ) : (
          <div className="col-sm-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon gold"><i className="bi bi-card-checklist"></i></div>
              <div>
                <div className="stat-value">{pendingForReview.length + awaitingPickup.length + returnRequests.length}</div>
                <div className="stat-label">Needs Action</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        <Link to="/books" className="lib-card p-3 d-flex align-items-center gap-3 text-decoration-none" style={{ minWidth: 180 }}>
          <div className="stat-icon blue"><i className="bi bi-search"></i></div>
          <span>Browse Books</span>
        </Link>
        <Link to="/fines" className="lib-card p-3 d-flex align-items-center gap-3 text-decoration-none" style={{ minWidth: 180 }}>
          <div className="stat-icon red"><i className="bi bi-currency-rupee"></i></div>
          <span>View Fines</span>
        </Link>
        {roleLower === 'student' && (
          <Link to="/request-card" className="lib-card p-3 d-flex align-items-center gap-3 text-decoration-none" style={{ minWidth: 180 }}>
            <div className="stat-icon gold"><i className="bi bi-credit-card-2-front"></i></div>
            <span>Request Card</span>
          </Link>
        )}
        {(roleLower === 'librarian' || roleLower === 'admin') && (
          <Link to="/issues" className="lib-card p-3 d-flex align-items-center gap-3 text-decoration-none" style={{ minWidth: 180 }}>
            <div className="stat-icon green"><i className="bi bi-journal-check"></i></div>
            <span>Manage Issues</span>
          </Link>
        )}
      </div>

      {actionMsg && <div className="alert alert-success mb-3">{actionMsg}</div>}

      {roleLower === 'student' && dueNotifications.length > 0 && (
        <div className="lib-card p-4 mb-4">
          <h4 className="mb-3"><i className="bi bi-bell me-2"></i>Due Date Notifications</h4>
          <div className="d-flex flex-column gap-2">
            {dueNotifications.map((note) => (
              <div key={note.id} className="alert alert-warning mb-0">
                <strong>{note.title}:</strong> {note.message} (Due: {note.dueDate})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STUDENT VIEW ─────────────────────────────────────── */}
      {roleLower === 'student' && requests.length > 0 && (
        <div className="lib-card p-4 mb-4">
          <h4 className="mb-3"><i className="bi bi-card-list me-2"></i>My Card Requests</h4>
          <div className="table-responsive">
            <table className="lib-table">
              <thead>
                <tr>
                  <th>Book</th><th>Type</th><th>Date</th><th>Status</th><th>Due Date</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r._id}>
                    <td>{r.book?.title || 'N/A'}</td>
                    <td className="text-capitalize">{r.type}</td>
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <span className={badgeClass(r.status)}>
                        {statusLabel(r.status)}
                      </span>
                      {/* Show pickup deadline for approved-pending-pickup */}
                      {r.status === 'approved_pending_pickup' && r.pickupDeadline && (
                        <div className="text-warning small mt-1">
                          ⏰ Collect by {new Date(r.pickupDeadline).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>
                      {(r.status === 'issued' || r.status === 'return_requested') && r.dueDate
                        ? new Date(r.dueDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      {r.status === 'issued' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-lib-secondary"
                          onClick={() => handleRequestReturn(r._id)}
                        >
                          Request return
                        </button>
                      ) : r.status === 'return_requested' ? (
                        <span className="text-muted small">Waiting for librarian</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ── STAFF VIEW (Librarian / Admin) ─────────────────── */}
      {(roleLower === 'librarian' || roleLower === 'admin') && (
        <div className="lib-card p-4 mt-2">
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <h4 className="mb-0">
              <i className="bi bi-card-checklist me-2"></i>Card Request Management
            </h4>
            {/* Run expiry manually */}
            <button className="btn btn-sm btn-lib-secondary" onClick={handleRunExpire}>
              <i className="bi bi-clock-history me-1"></i>Run Expiry Check
            </button>
          </div>

          {/* ── 1. Pending Approval ── */}
          {pendingForReview.length > 0 && (
            <div className="mb-4">
              <h6 className="text-muted mb-2">
                <i className="bi bi-hourglass-split me-1"></i>
                Pending Approval ({pendingForReview.length})
              </h6>
              <div className="table-responsive">
                <table className="lib-table">
                  <thead>
                    <tr>
                      <th>Student</th><th>Book</th><th>Type</th>
                      <th>Date</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingForReview.map(r => (
                      <tr key={r._id}>
                        <td>{r.student?.name || 'N/A'}</td>
                        <td>{r.book?.title || 'N/A'}</td>
                        <td><span className="badge bg-light text-dark text-capitalize">{r.type}</span></td>
                        <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td><span className="badge-role badge-pending">Pending</span></td>
                        <td>
                          <button className="btn btn-sm btn-lib-primary me-2"
                            onClick={() => handleApprove(r._id)}>
                            <i className="bi bi-check2"></i> Approve
                          </button>
                          <button className="btn btn-sm btn-lib-secondary"
                            onClick={() => handleReject(r._id)}>
                            <i className="bi bi-x-lg"></i> Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 2. Awaiting Pickup ── */}
          {awaitingPickup.length > 0 && (
            <div className="mb-4">
              <h6 className="text-muted mb-2">
                <i className="bi bi-box-seam me-1"></i>
                Awaiting Pickup — Verify Student ID, then click "Mark as Collected" ({awaitingPickup.length})
              </h6>
              <div className="table-responsive">
                <table className="lib-table">
                  <thead>
                    <tr>
                      <th>Student</th><th>Book</th><th>Type</th>
                      <th>Pickup Deadline</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingPickup.map(r => {
                      const deadline  = r.pickupDeadline ? new Date(r.pickupDeadline) : null;
                      const isExpired = deadline && new Date() > deadline;
                      return (
                        <tr key={r._id}>
                          <td>{r.student?.name || 'N/A'}</td>
                          <td>{r.book?.title || 'N/A'}</td>
                          <td className="text-capitalize">{r.type}</td>
                          <td>
                            {deadline ? (
                              <span className={isExpired ? 'text-danger' : 'text-warning'}>
                                {deadline.toLocaleDateString()}
                                {isExpired ? ' ⚠️ Overdue!' : ''}
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            <span className="badge-role badge-approved-pending-pickup">
                              Ready for Pickup
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-lib-primary me-2"
                              onClick={() => handleCollect(r._id)}
                              disabled={isExpired}
                              title={isExpired ? 'Deadline passed — run expiry check' : 'Mark as collected after ID verification'}
                            >
                              <i className="bi bi-bag-check me-1"></i>
                              Mark as Collected
                            </button>
                            <button className="btn btn-sm btn-lib-secondary"
                              onClick={() => handleReject(r._id)}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 3. Return requests (student asked; librarian confirms) ── */}
          {returnRequests.length > 0 && (
            <div className="mb-4">
              <h6 className="text-muted mb-2">
                <i className="bi bi-arrow-return-left me-1"></i>
                Return requests ({returnRequests.length})
              </h6>
              <div className="table-responsive">
                <table className="lib-table">
                  <thead>
                    <tr>
                      <th>Student</th><th>Book</th><th>Type</th><th>Due</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnRequests.map((r) => (
                      <tr key={r._id}>
                        <td>{r.student?.name || 'N/A'}</td>
                        <td>{r.book?.title || 'N/A'}</td>
                        <td className="text-capitalize">{r.type}</td>
                        <td>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-lib-primary me-2"
                            onClick={() => handleConfirmReturn(r._id)}
                          >
                            Mark as returned
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-lib-secondary"
                            onClick={() => handleReject(r._id)}
                          >
                            Cancel request
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pendingForReview.length === 0 && awaitingPickup.length === 0 && returnRequests.length === 0 && (
            <p className="text-muted text-center py-3">
              <i className="bi bi-check-circle me-2"></i>No requests need action right now.
            </p>
          )}

          {/* ── All requests history ── */}
          {requests.length > 0 && (
            <div className="mt-4">
              <h5 className="mb-3">All Card Requests</h5>
              <div className="table-responsive">
                <table className="lib-table">
                  <thead>
                    <tr><th>Student</th><th>Book</th><th>Type</th><th>Status</th><th>Due Date</th><th>Date</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r._id}>
                        <td>{r.student?.name || 'N/A'}</td>
                        <td>{r.book?.title || 'N/A'}</td>
                        <td className="text-capitalize">{r.type}</td>
                        <td>
                          <span className={badgeClass(r.status)}>
                            {statusLabel(r.status)}
                          </span>
                        </td>
                        <td>
                          {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          {r.status === 'return_requested' ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-lib-primary"
                              onClick={() => handleConfirmReturn(r._id)}
                            >
                              Mark as returned
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default DashboardPage;