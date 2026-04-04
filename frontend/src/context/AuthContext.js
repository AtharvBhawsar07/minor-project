// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { normalizeAPIResponse } from '../utils/apiHelpers';

// ─────────────────────────────────────────────────────────────
// LOCAL HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Normalises the user object returned by the API.
 * Handles both `res.data.user`, `res.data.data`, and flat `res.data`.
 */
const normalizeUser = (raw) => {
  if (!raw) return null;

  // Some backends nest under a "user" key
  const user = raw?.user ?? raw;

  if (!user || typeof user !== 'object') return null;

  const normalizeRole = (role) => {
    const r = role?.toString?.().trim?.().toLowerCase?.();
    if (r === 'student') return 'Student';
    if (r === 'librarian') return 'Librarian';
    if (r === 'admin') return 'Admin';
    // Default to Student for a college submission-friendly experience
    return 'Student';
  };

  return {
    _id:    user._id   ?? user.id   ?? null,
    name:   user.name  ?? user.fullName ?? 'User',
    email:  user.email ?? null,
    role:   normalizeRole(user.role),
    // Spread remaining fields so nothing is lost
    ...user,
  };
};

// ─────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

// ─────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError,   setAuthError]   = useState(null);

  // ── Restore session on mount ─────────────────────────────
  const checkSession = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res  = await authAPI.me();
      const data = normalizeAPIResponse(res);
      setCurrentUser(normalizeUser(data));
    } catch (err) {
      // 401 = not logged in — treat as null, not an error
      if (err?.response?.status === 401 || err?.statusCode === 401) {
        setCurrentUser(null);
      } else {
        console.error('Session check error:', err);
        setAuthError('Could not verify session.');
        setCurrentUser(null);
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    
    // Listen for global auth:logout event to handle 401s centrally without looping
    const handleLogoutEvent = () => {
      localStorage.removeItem('accessToken');
      setCurrentUser(null);
    };
    window.addEventListener('auth:logout', handleLogoutEvent);
    
    return () => window.removeEventListener('auth:logout', handleLogoutEvent);
  }, [checkSession]);

  // ── Login ─────────────────────────────────────────────────
  const login = async (payload) => {
    setAuthError(null);
    try {
      const res  = await authAPI.login(payload);
      const data = normalizeAPIResponse(res);
      const user = normalizeUser(data);
      if (!user) throw new Error('Invalid response from server.');
      
      if (data?.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      
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
      const res  = await authAPI.register(payload);
      const data = normalizeAPIResponse(res);
      const user = normalizeUser(data);
      
      if (data?.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      
      if (user) setCurrentUser(user);
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
    try {
      await authAPI.logout();
    } catch (err) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('accessToken');
      setCurrentUser(null);
    }
  };

  // ── Update profile (optimistic) ──────────────────────────
  const updateProfile = async (updates) => {
    try {
      const res  = await authAPI.updateProfile(updates);
      const data = normalizeAPIResponse(res);
      const user = normalizeUser(data);
      if (user) setCurrentUser(user);
      return { success: true, user };
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? 'Update failed.';
      return { success: false, message };
    }
  };

  // ── Context value ─────────────────────────────────────────
  const value = {
    currentUser,
    authLoading,
    authError,
    isAuthenticated: !!currentUser,
    login,
    register,
    logout,
    updateProfile,
    refreshSession: checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;