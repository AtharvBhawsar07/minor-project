// ============================================================
// src/pages/NotFoundPage.js
// 404 page for unmatched routes
// ============================================================
import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="page-wrapper d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
    <div className="text-center">
      <div style={{ fontFamily: 'Playfair Display,serif', fontSize: '7rem', fontWeight: 700, color: 'var(--border)', lineHeight: 1 }}>404</div>
      <h3 style={{ fontFamily: 'Playfair Display,serif', color: 'var(--primary)', marginTop: '.5rem' }}>Page Not Found</h3>
      <p style={{ color: 'var(--text-muted)', maxWidth: '320px', margin: '0 auto 1.5rem' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="btn btn-lib-primary">
        <i className="bi bi-house me-2"></i>Back to Home
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
