// ============================================================
// src/components/ProtectedRoute.js
// Redirects unauthenticated users to /login
// Optionally restricts to specific roles
// ============================================================
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * @param {string[]} roles - Optional allowed roles (e.g. ['Admin', 'Librarian'])
 */
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, currentUser, authLoading } = useAuth();

  // Wait for session check to finish before deciding (prevents flash redirect)
  if (authLoading) {
    return <div className="text-center py-5">Loading...</div>;
  }

  // Not logged in → go to login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Role restriction → go to dashboard
  if (roles && !roles.some(r => r.toLowerCase() === currentUser?.role?.toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;

