// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

// ── Safely pull the user object out of any API shape ─────────────────────────
const extractUser = (res) => {
  if (!res) return null;
  // res.data.data.user  (nested paginated)
  if (res?.data?.data?.user)  return res.data.data.user;
  // res.data.data        (single object)
  if (res?.data?.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)) {
    return res.data.data;
  }
  // res.data.user
  if (res?.data?.user)   return res.data.user;
  // res.data itself
  if (res?.data && typeof res.data === 'object') return res.data;
  return null;
};

const extractToken = (res) => {
  return (
    res?.data?.data?.accessToken ||
    res?.data?.accessToken ||
    null
  );
};

// Normalise role so comparisons are consistent
const normalizeRole = (role) => {
  const r = (role || '').toString().trim().toLowerCase();
  if (r === 'student')   return 'Student';
  if (r === 'librarian') return 'Librarian';
  if (r === 'admin')     return 'Admin';
  return 'Student';
};

const buildUser = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const user = raw.user ?? raw; // some responses nest under "user"
  if (!user?._id && !user?.id) return null;
  return {
    _id:       user._id   ?? user.id,
    name:      user.name  ?? user.fullName ?? 'User',
    email:     user.email ?? null,
    role:      normalizeRole(user.role),
    studentId: user.studentId ?? null,
    ...user,
    // override role with normalized version
    role: normalizeRole(user.role),
  };
};

// ─────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError,   setAuthError]   = useState(null);

  // ── Restore session on mount ─────────────────────────────
  const checkSession = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    setAuthLoading(true);
    try {
      const res  = await authAPI.me();
      const raw  = extractUser(res);
      const user = buildUser(raw);
      setCurrentUser(user);
    } catch (err) {
      // 401 = token expired — clear silently
      if (err?.response?.status === 401 || err?.statusCode === 401) {
        localStorage.removeItem('accessToken');
        setCurrentUser(null);
      } else {
        console.error('Session check error:', err);
        setCurrentUser(null);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();

    const handleLogout = () => {
      localStorage.removeItem('accessToken');
      setCurrentUser(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [checkSession]);

  // ── Login ─────────────────────────────────────────────────
  const login = async (payload) => {
    setAuthError(null);
    try {
      const res   = await authAPI.login(payload);
      const token = extractToken(res);
      const raw   = extractUser(res);
      const user  = buildUser(raw);

      if (!user) throw new Error('Invalid response from server.');

      if (token) localStorage.setItem('accessToken', token);
      setCurrentUser(user);
      return { success: true, user };
    } catch (err) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Login failed. Please try again.';
      setAuthError(message);
      return { success: false, message };
    }
  };

  // ── Register ──────────────────────────────────────────────
  const register = async (payload) => {
    setAuthError(null);
    try {
      const res   = await authAPI.register(payload);
      const token = extractToken(res);
      const raw   = extractUser(res);
      const user  = buildUser(raw);

      if (token) localStorage.setItem('accessToken', token);
      if (user)  setCurrentUser(user);
      return { success: true, user };
    } catch (err) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Registration failed. Please try again.';
      setAuthError(message);
      return { success: false, message };
    }
  };

  // ── Logout ────────────────────────────────────────────────
  const logout = async () => {
    try { await authAPI.logout(); } catch (_) { /* ignore */ }
    localStorage.removeItem('accessToken');
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    authLoading,
    authError,
    isAuthenticated: !!currentUser,
    login,
    register,
    logout,
    refreshSession: checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;