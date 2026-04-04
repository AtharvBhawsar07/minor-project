// ============================================================
// src/components/Footer.js
// Simple footer shown on every page
// ============================================================
import React from 'react';

const Footer = () => (
  <footer className="lib-footer">
    © {new Date().getFullYear()} &nbsp;
    <span>LibraCard</span> — Digital Library Card Management System &nbsp;|&nbsp;
    Academic Project · Built with React &amp; Bootstrap
  </footer>
);

export default Footer;
