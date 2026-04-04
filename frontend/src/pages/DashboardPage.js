import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { booksAPI, finesAPI, libraryCardsAPI, issuesAPI } from '../services/api';

import { normalizeAPIResponse, ensureArray, safeNumber, getFineAmount } from '../utils/apiHelpers';

// ================= HELPERS (LOCAL OVERRIDES) =================

const calculateTotalFines = (fines) => {
  const safeArray = Array.isArray(fines) ? fines : [];
  return safeArray.reduce((sum, fine) => {
    return sum + getFineAmount(fine);
  }, 0);
};

// ================= COMPONENTS =================

const StatCard = ({ icon, color, value, label }) => (
  <div className="col-sm-6 col-lg-3">
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <div className="stat-value">{value ?? 0}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  </div>
);

const QuickAction = ({ to, icon, label, color }) => (
  <Link to={to} className="lib-card p-3 d-flex align-items-center gap-3 text-decoration-none">
    <div className={`stat-icon ${color}`}>
      <i className={`bi ${icon}`}></i>
    </div>
    <span>{label}</span>
  </Link>
);

// ================= MAIN =================

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const roleLower = (role || '').toString().trim().toLowerCase();
  const safeArray = (val) => (Array.isArray(val) ? val : []);

  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [data, setData] = useState({
    books: [],
    fines: [],
    requests: [],
    myCard: null,
    issues: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const booksRes = await booksAPI.getAll();
        const finesRes = roleLower === "student"
          ? await finesAPI.getMyFines()
          : await finesAPI.getAll();

        const cardsRes = roleLower === "student"
          ? await libraryCardsAPI.getAll().catch(() => ({ data: [] }))
          : await libraryCardsAPI.getAll();

        const issuesRes = await issuesAPI.getAll();

        // Safe API response handling: res.data.data OR res.data OR []
        const booksResult = normalizeAPIResponse(booksRes);
        const finesResult = normalizeAPIResponse(finesRes);
        const cardsResult = normalizeAPIResponse(cardsRes);
        const issuesResult = normalizeAPIResponse(issuesRes);

        setData({
          books: ensureArray(booksResult),
          fines: ensureArray(finesResult),
          requests: ensureArray(cardsResult),
          issues: ensureArray(issuesResult),
          myCard: cardsResult
        });

      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (role) fetchData();
  }, [role]); // Remove roleLower to prevent duplicate calls

  const { cardUsageText, notificationItems } = useMemo(() => {
    const maxCards = 5;
    const active = safeArray(data?.issues).filter((i) => i && i.status === 'issued' && !i.returnDate);
    const used = active.length;

    const today = new Date();
    const stripTime = (d) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const diffDays = (a, b) => Math.floor((stripTime(a) - stripTime(b)) / (1000 * 60 * 60 * 24));

    const notifications = [];
    for (const issue of active) {
      const title = issue?.book?.title || 'Book';
      const issueType = (issue?.issueType || '').toString().toLowerCase();
      const dueDate = issue?.dueDate ? new Date(issue.dueDate) : null;
      const semesterEnd = issue?.semesterEndDate ? new Date(issue.semesterEndDate) : null;
      const graceUntil = issue?.graceUntil ? new Date(issue.graceUntil) : null;

      if (!dueDate) continue;

      if (issueType === 'temporary') {
        const daysLeft = diffDays(dueDate, today);
        if (daysLeft === 2) notifications.push({ type: 'warning', text: `"${title}": 2 days left` });
        if (daysLeft === 1) notifications.push({ type: 'warning', text: `"${title}": 1 day left` });
        if (daysLeft <= 0) notifications.push({ type: 'danger', text: `"${title}": Overdue` });
      } else if (issueType === 'permanent') {
        const sem = semesterEnd || dueDate;
        const grace = graceUntil || (() => {
          const d = new Date(sem);
          d.setDate(d.getDate() + 5);
          return d;
        })();

        const daysToSemEnd = diffDays(sem, today);
        if (daysToSemEnd === 2) notifications.push({ type: 'warning', text: `"${title}": Semester ends in 2 days` });
        if (daysToSemEnd === 1) notifications.push({ type: 'warning', text: `"${title}": Semester ends tomorrow` });
        if (today > sem && today <= grace) notifications.push({ type: 'info', text: `"${title}": Grace period active` });
        if (today > grace) notifications.push({ type: 'danger', text: `"${title}": Fine started` });
      }
    }

    return {
      cardUsageText: `${used}/${maxCards} used`,
      notificationItems: notifications.slice(0, 6),
    };
  }, [data.issues]);

  if (loading) return <div className="text-center py-5">Loading...</div>;

  const books = safeArray(data?.books);
  const fines = safeArray(data?.fines);
  const issues = safeArray(data?.issues);
  const requests = safeArray(data?.requests);

  // Backend fine statuses are: pending, partial, paid, waived
  const unpaidFines = fines.filter((f) => {
    const s = (f?.status || '').toString().toLowerCase();
    return s === 'pending' || s === 'partial';
  });

  const availableBooks = books.filter(b => {
    const copies =
      b?.availableCopies ??
      b?.available ??
      b?.quantity ??
      0;
    return Number(copies) > 0;
  }).length;

  const activeIssues = issues.filter(i => !i?.returnDate);
  const totalFines = calculateTotalFines(unpaidFines);

  const handleApprove = async (id) => {
    try {
      await libraryCardsAPI.approve(id);
      alert('✅ Approved successfully!');
      window.location.reload();
    } catch (err) {
      alert('❌ ' + (err.message || 'Approval failed'));
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await libraryCardsAPI.reject(id, reason);
      alert('✅ Rejected successfully!');
      window.location.reload();
    } catch (err) {
      alert('❌ ' + (err.message || 'Rejection failed'));
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center gap-3 mb-4">
        <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="bi bi-person text-white" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h3 className="mb-0">Hello, {currentUser?.name}!</h3>
          <span className="badge bg-secondary text-capitalize">{role} Dashboard</span>
        </div>
      </div>

      <div className="row g-3">
        <StatCard icon="bi-book" color="red" value={availableBooks} label="Books Available" />
        <StatCard icon="bi-cash" color="green" value={`₹${totalFines}`} label="Unpaid Fines" />
        <StatCard icon="bi-list-check" color="blue" value={activeIssues.length} label="Active Issues" />
        {roleLower === "student" && (
          <StatCard icon="bi-credit-card" color="gold" value={cardUsageText} label="Card Usage" />
        )}
      </div>

      <div className="mt-4 d-flex flex-wrap gap-3">
        <QuickAction to="/books" icon="bi-search" label="Browse Books" color="red" />
        <QuickAction to="/fines" icon="bi-currency-rupee" label="View Fines" color="green" />
        {roleLower === "student" && !data.myCard && (
          <QuickAction to="/request-card" icon="bi-credit-card-2-front" label="Apply for Card" color="gold" />
        )}
      </div>

      {/* Notifications (simple) */}
      {roleLower === 'student' && (
        <div className="mt-4 lib-card p-4">
          <h4 className="mb-3">
            <i className="bi bi-bell me-2"></i>
            Notifications
          </h4>
          {notificationItems.length === 0 ? (
            <div className="text-muted">No notifications</div>
          ) : (
            <ul className="mb-0">
              {notificationItems.map((n, idx) => (
                <li key={idx} className="mb-2">
                  <span className={`badge-role badge-${n.type} me-2`}>{n.type}</span>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Issued books list (student) */}
      {roleLower === 'student' && (
        <div className="mt-4 lib-card p-4">
          <h4 className="mb-3">
            <i className="bi bi-journal-check me-2"></i>
            Issued Books
          </h4>
          {activeIssues.length === 0 ? (
            <div className="text-muted">No books issued</div>
          ) : (
            <div className="table-responsive">
              <table className="lib-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Book</th>
                    <th>Type</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeIssues.map((r, idx) => {
                    const isOverdue = !!r?.isOverdue;
                    const issueType = (r?.issueType || '').toString().toLowerCase();
                    const today = new Date();
                    const sem = r?.semesterEndDate ? new Date(r.semesterEndDate) : (r?.dueDate ? new Date(r.dueDate) : null);
                    const grace = r?.graceUntil ? new Date(r.graceUntil) : (sem ? new Date(new Date(sem).setDate(sem.getDate() + 5)) : null);
                    const inGrace = issueType === 'permanent' && sem && grace && today > sem && today <= grace;

                    const label = isOverdue ? 'Overdue' : inGrace ? 'Grace Period' : 'Active';
                    const badge = isOverdue ? 'danger' : inGrace ? 'info' : 'approved';

                    return (
                      <tr key={r._id ?? idx}>
                        <td>{idx + 1}</td>
                        <td>{r.book?.title ?? 'N/A'}</td>
                        <td className="text-capitalize">{issueType || 'N/A'}</td>
                        <td>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          <span className={`badge-role badge-${badge}`}>{label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Requests Table for Student */}
      {roleLower === "student" && requests.length > 0 && (
        <div className="mt-4 lib-card p-4">
          <h4 className="mb-3">
            <i className="bi bi-card-list me-2"></i>
            My Book Requests
          </h4>
          <div className="table-responsive">
            <table className="lib-table">
              <thead>
                <tr>
                  <th>Book Name</th>
                  <th>Type</th>
                  <th>Date Requested</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r._id}>
                    <td>{r.book?.title || 'No Book Selected'}</td>
                    <td className="text-capitalize">{r.type}</td>
                    <td>{r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <span className={`badge-role badge-${(r?.status || 'unknown').replace(/_/g, '-')}`}>
                        {(r?.status || 'unknown').replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requests Table for Librarian/Admin */}
      {(roleLower === "admin" || roleLower === "librarian") && (
        <div className="mt-5 lib-card p-4">
          <h4 className="mb-4">
            <i className="bi bi-card-checklist me-2"></i>
            {roleLower === "admin" ? "Final Card Approvals" : "Pending Applications"}
          </h4>
          {actionMsg && (
            <div className="alert alert-success mb-3">{actionMsg}</div>
          )}
          <div className="table-responsive">
            <table className="lib-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Book Name</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-muted py-4">No requests found</td></tr>
                ) : (
                  requests.filter(r => {
                    if (roleLower === "librarian") return r?.status === "pending";
                    if (roleLower === "admin") return r?.status === "approved_by_librarian";
                    return false;
                  }).map((r) => (
                    <tr key={r._id}>
                      <td>{r.student?.name || 'N/A'}</td>
                      <td>{r.book?.title || 'No Book Selected'}</td>
                      <td><span className="badge bg-light text-dark text-capitalize">{r.type}</span></td>
                      <td>{r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <span className={`badge-role badge-${(r?.status || 'unknown').replace(/_/g, '-')}`}>
                          {(r?.status || 'unknown').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-lib-primary me-2" onClick={() => handleApprove(r._id)}>
                          <i className="bi bi-check2"></i> Approve
                        </button>
                        {roleLower === "librarian" && (
                          <button className="btn btn-sm btn-lib-secondary" onClick={() => handleReject(r._id)}>
                            <i className="bi bi-x-lg"></i> Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;