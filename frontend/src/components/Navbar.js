// ============================================================
// src/components/Navbar.js
// Responsive navigation bar with role-aware links
// ============================================================
import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { currentUser, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);

  const handleLogout = () => {
    logout();
    setCollapsed(true);
    navigate('/login');
  };

  const close = () => setCollapsed(true);

  return (
    <nav className="navbar navbar-expand-lg lib-navbar sticky-top">
      <div className="container">
        {/* Brand */}
        <Link className="navbar-brand" to="/" onClick={close}>
          <i className="bi bi-book-half me-2"></i>
          Libra<span>Card</span>
        </Link>

        {/* Mobile toggle */}
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Links */}
        <div className={`collapse navbar-collapse ${collapsed ? '' : 'show'}`}>
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">

            {/* Always visible */}
            <li className="nav-item">
              <NavLink className="nav-link" to="/" end onClick={close}>
                <i className="bi bi-house-door me-1"></i>Home
              </NavLink>
            </li>

            {/* Authenticated links */}
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/dashboard" onClick={close}>
                    <i className="bi bi-speedometer2 me-1"></i>Dashboard
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/books" onClick={close}>
                    <i className="bi bi-journals me-1"></i>Books
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/issues" onClick={close}>
                    <i className="bi bi-list-check me-1"></i>Issues
                  </NavLink>
                </li>
                {/* Only Students can request a card */}
                {currentUser?.role?.toLowerCase() === 'student' && (
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/request-card" onClick={close}>
                      <i className="bi bi-credit-card me-1"></i>Request Card
                    </NavLink>
                  </li>
                )}
                <li className="nav-item">
                  <NavLink className="nav-link" to="/fines" onClick={close}>
                    <i className="bi bi-currency-rupee me-1"></i>Fines
                  </NavLink>
                </li>
                {/* Only Admin can view Users */}
                {currentUser?.role?.toLowerCase() === 'admin' && (
                  <li className="nav-item">
                    <NavLink className="nav-link" to="/admin/users" onClick={close}>
                      <i className="bi bi-people me-1"></i>Users
                    </NavLink>
                  </li>
                )}

                {/* User info + Logout */}
                <li className="nav-item ms-lg-2">
                  <span className="nav-link pe-none text-white-50" style={{ fontSize: '.8rem' }}>
                    <i className="bi bi-person-circle me-1"></i>
                    {currentUser?.name?.split(' ')[0]}
                    <span className={`badge-role ms-1 badge-${currentUser?.role?.toLowerCase()}`}>
                      {currentUser?.role}
                    </span>
                  </span>
                </li>
                <li className="nav-item">
                  <button
                    className="nav-link logout-link btn btn-link"
                    onClick={handleLogout}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className="bi bi-box-arrow-right me-1"></i>Logout
                  </button>
                </li>
              </>
            )}

            {/* Guest links */}
            {!isAuthenticated && (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/login" onClick={close}>
                    <i className="bi bi-box-arrow-in-right me-1"></i>Login
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/register" onClick={close}>
                    <i className="bi bi-person-plus me-1"></i>Register
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
