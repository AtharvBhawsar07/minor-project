// ============================================================
// src/App.js
// Root component — sets up Router, AuthProvider, and routes
// ============================================================
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Context
import { AuthProvider } from './context/AuthContext';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import Navbar        from './components/Navbar';
import Footer        from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import HomePage       from './pages/HomePage';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import DashboardPage  from './pages/DashboardPage';
import BooksPage      from './pages/BooksPage';
import RequestCardPage from './pages/RequestCardPage';
import IssuesPage     from './pages/IssuesPage';
import FinesPage      from './pages/FinesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import NotFoundPage   from './pages/NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          {/* Navbar is always shown (it renders relevant links by auth state) */}
          <Navbar />

          <Routes>
            {/* Public routes */}
            <Route path="/"         element={<HomePage />} />
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes — requires login */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/books" element={
              <ProtectedRoute>
                <BooksPage />
              </ProtectedRoute>
            } />
            <Route path="/request-card" element={
              <ProtectedRoute roles={['Student']}>
                <RequestCardPage />
              </ProtectedRoute>
            } />
            <Route path="/fines" element={
              <ProtectedRoute>
                <FinesPage />
              </ProtectedRoute>
            } />
            <Route path="/issues" element={
              <ProtectedRoute>
                <IssuesPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute roles={['Admin']}>
                <AdminUsersPage />
              </ProtectedRoute>
            } />

            {/* Catch-all → 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          {/* Footer is always shown */}
          <Footer />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
