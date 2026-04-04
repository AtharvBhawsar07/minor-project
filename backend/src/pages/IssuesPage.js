import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { issuesAPI } from '../services/api';
import { ensureArray, normalizeAPIResponse, normalizeStatus } from '../utils/apiHelpers';

const IssuesPage = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role; // "Student" | "Librarian" | "Admin"
  const roleLower = (role || '').toString().trim().toLowerCase();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeIssues = useMemo(() => {
    const list = ensureArray(issues);
    return list.filter((r) => r && r.status === 'issued' && !r.returnDate);
  }, [issues]);

  const fetchIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await issuesAPI.getAll();
      setIssues(ensureArray(normalizeAPIResponse(res)));
    } catch (err) {
      console.error('IssuesPage fetch error:', err);
      setError(err?.message ?? 'Failed to load issues.');
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role) fetchIssues();
  }, [role]);

  const handleReturn = async (issueId) => {
    const conditionRaw = prompt(
      'Condition at return (good / fair / poor / damaged):',
      'good'
    );
    const condition = (conditionRaw || 'good').trim().toLowerCase();
    if (!['good', 'fair', 'poor', 'damaged'].includes(condition)) {
      alert('Invalid condition. Use: good, fair, poor, damaged.');
      return;
    }

    const notes = prompt('Notes (optional):', '') || undefined;

    try {
      await issuesAPI.returnBook({ issueRecordId: issueId, condition, notes });
      // Refresh list to reflect returned items
      await fetchIssues();
    } catch (err) {
      alert(err?.message ?? 'Return failed.');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary"></div>
        <p className="mt-2 text-muted">Loading issues...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-5">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
        <button className="btn btn-lib-primary mt-2" onClick={fetchIssues}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="mb-4">
          <h2 className="section-title">
            <i className="bi bi-list-check me-2" />
            Issues & Returns
          </h2>
          <p className="text-muted" style={{ fontSize: '.9rem' }}>
            {roleLower === 'student'
              ? 'Return your issued books and track fines.'
              : 'Return books from issued records.'}
          </p>
        </div>

        <div className="lib-card">
          <div className="lib-card-header">
            <h5>
              <i className="bi bi-table me-2" />
              Active Issues
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
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeIssues.length === 0 ? (
                  <tr>
                    <td colSpan={roleLower !== 'student' ? 7 : 6} className="text-center text-muted py-4">
                      <div>
                        <i className="bi bi-journal-x text-muted" style={{ fontSize: '1.5rem' }}></i>
                        <p className="mb-0 mt-2">No active issues found.</p>
                        <small className="text-muted">
                          {roleLower === 'student' ? 'Issue some books from the Books page to see them here.' : 'No books are currently issued.'}
                        </small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeIssues.map((r, idx) => {
                    const status = normalizeStatus(r.status);
                    const issueType = (r?.issueType || '').toString().toLowerCase();
                    const today = new Date();
                    const sem = r?.semesterEndDate ? new Date(r.semesterEndDate) : (r?.dueDate ? new Date(r.dueDate) : null);
                    const grace = r?.graceUntil ? new Date(r.graceUntil) : (sem ? new Date(new Date(sem).setDate(sem.getDate() + 5)) : null);
                    const inGrace = issueType === 'permanent' && sem && grace && today > sem && today <= grace;
                    const isOverdue = !!r?.isOverdue;

                    const label = isOverdue ? 'Overdue' : inGrace ? 'Grace Period' : 'Active';
                    const badge = isOverdue ? 'danger' : inGrace ? 'info' : 'approved';
                    return (
                      <tr key={r._id ?? idx}>
                        <td>{idx + 1}</td>
                        {roleLower !== 'student' && (
                          <td>{r.student?.name ?? 'N/A'}</td>
                        )}
                        <td>{r.book?.title ?? 'N/A'}</td>
                        <td>
                          {r.issueDate ? new Date(r.issueDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          <span className={`badge-role badge-${badge}`}>
                            {label}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-lib-secondary"
                            onClick={() => handleReturn(r._id)}
                          >
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
      </div>
    </div>
  );
};

export default IssuesPage;

