// src/pages/IssuesPage.js
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { issuesAPI } from '../services/api';

const IssuesPage = () => {
  const { currentUser } = useAuth();
  const roleLower = (currentUser?.role || '').toLowerCase();

  const [issues,  setIssues]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // ── Fetch all issues (filtered by role on the backend) ────
  const fetchIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await issuesAPI.getAll();
      // Safe extraction
      const raw = res?.data?.data || res?.data || [];
      setIssues(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('IssuesPage error:', err);
      setError(err?.message || 'Failed to load issues.');
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role) fetchIssues();
  }, [currentUser?.role]); // eslint-disable-line

  // ── Only show active (not returned) issues ────────────────
  const activeIssues = issues.filter(r => r.status === 'issued' && !r.returnDate);

  // ── Return book handler ───────────────────────────────────
  const handleReturn = async (issueId) => {
    const condition = (window.prompt('Book condition (good / fair / poor / damaged):', 'good') || 'good').trim().toLowerCase();
    if (!['good', 'fair', 'poor', 'damaged'].includes(condition)) {
      alert('Invalid condition value.');
      return;
    }
    try {
      await issuesAPI.returnBook({ issueRecordId: issueId, condition });
      // refresh
      await fetchIssues();
    } catch (err) {
      alert(err?.message || 'Return failed.');
    }
  };

  // ── Loading / Error screens ───────────────────────────────
  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <p className="mt-2 text-muted">Loading issues…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-5">
      <div className="alert alert-danger">{error}</div>
      <button className="btn btn-lib-primary mt-2" onClick={fetchIssues}>Retry</button>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">

        {/* Header */}
        <div className="mb-4">
          <h2 className="section-title">
            <i className="bi bi-list-check me-2"></i>Issues & Returns
          </h2>
          <p className="text-muted" style={{ fontSize: '.9rem' }}>
            {roleLower === 'student'
              ? 'Track your issued books and return them here.'
              : 'Manage all book issue records.'}
          </p>
        </div>

        {/* Active Issues Table */}
        <div className="lib-card">
          <div className="lib-card-header">
            <h5>
              <i className="bi bi-table me-2"></i>Active Issues
              <span className="text-muted ms-2" style={{ fontSize: '.8rem', fontWeight: 400 }}>
                ({activeIssues.length} item{activeIssues.length !== 1 ? 's' : ''})
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
                  <th>Type</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeIssues.length === 0 ? (
                  <tr>
                    <td colSpan={roleLower !== 'student' ? 8 : 7}
                      className="text-center text-muted py-5">
                      <i className="bi bi-journal-x" style={{ fontSize: '2rem' }}></i>
                      <p className="mb-0 mt-2">No active issues found.</p>
                    </td>
                  </tr>
                ) : (
                  activeIssues.map((r, idx) => {
                    const overdue = !!r.isOverdue;
                    return (
                      <tr key={r._id || idx}>
                        <td>{idx + 1}</td>
                        {roleLower !== 'student' && (
                          <td>{r.student?.name || 'N/A'}</td>
                        )}
                        <td>{r.book?.title || 'N/A'}</td>
                        <td className="text-capitalize">{r.issueType || 'N/A'}</td>
                        <td>
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>
                          {r.dueDate
                            ? new Date(r.dueDate).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>
                          <span className={`badge-role badge-${overdue ? 'rejected' : 'approved'}`}>
                            {overdue ? 'Overdue' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-lib-secondary"
                            onClick={() => handleReturn(r._id)}>
                            Return
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* All issues summary for staff */}
        {roleLower !== 'student' && issues.length > activeIssues.length && (
          <div className="lib-card mt-4">
            <div className="lib-card-header">
              <h5><i className="bi bi-archive me-2"></i>Returned Books</h5>
            </div>
            <div className="table-responsive">
              <table className="lib-table">
                <thead>
                  <tr>
                    <th>#</th><th>Student</th><th>Book</th>
                    <th>Issue Date</th><th>Return Date</th><th>Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {issues
                    .filter(r => r.status === 'returned' || r.returnDate)
                    .map((r, idx) => (
                      <tr key={r._id || idx}>
                        <td>{idx + 1}</td>
                        <td>{r.student?.name || 'N/A'}</td>
                        <td>{r.book?.title || 'N/A'}</td>
                        <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td>{r.returnDate ? new Date(r.returnDate).toLocaleDateString() : '—'}</td>
                        <td>
                          {r.fineAmount > 0
                            ? <span className="text-danger fw-bold">₹{r.fineAmount}</span>
                            : <span className="text-success">None</span>}
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

export default IssuesPage;
