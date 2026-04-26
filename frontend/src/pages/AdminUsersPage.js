import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AdminUsersPage = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users?limit=1000');
        const userData = res?.data?.data || res?.data || [];
        setUsers(Array.isArray(userData) ? userData : []);
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };
    if (currentUser?.role?.toLowerCase() === 'admin') {
      fetchUsers();
    } else {
      setError('Unauthorized access');
      setLoading(false);
    }
  }, [currentUser]);

  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <p className="mt-2 text-muted">Loading users…</p>
    </div>
  );

  if (error) return (
    <div className="text-center py-5">
      <div className="alert alert-danger">{error}</div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="container">
        <div className="mb-4">
          <h2 className="section-title">
            <i className="bi bi-people me-2"></i>User Management
          </h2>
          <p className="text-muted" style={{ fontSize: '.9rem' }}>
            View all registered students and librarians.
          </p>
        </div>

        <div className="lib-card">
          <div className="table-responsive">
            <table className="lib-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Gender</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-5">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user, idx) => (
                    <tr key={user._id}>
                      <td>{idx + 1}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.gender || 'N/A'}</td>
                      <td className="text-capitalize">{user.role}</td>
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

export default AdminUsersPage;
