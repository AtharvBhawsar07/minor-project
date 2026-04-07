// ============================================================
// src/pages/RegisterPage.js
// Registration form with full client-side validation
// ============================================================
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLES = ['Student', 'Librarian', 'Admin'];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'Student',
    enrollmentNo: '', employeeId: '', semester: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors]     = useState({});
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  // ── Handle change ────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
    setSuccess('');
  };

  // ── Validation ───────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name.trim())                errs.name    = 'Full name is required.';
    else if (form.name.trim().length < 3) errs.name    = 'Name must be at least 3 characters.';

    if (!form.email.trim())               errs.email   = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address.';

    if (!form.phone.trim())               errs.phone   = 'Phone number is required.';
    else if (!/^\d{10}$/.test(form.phone)) errs.phone  = 'Enter a valid 10-digit phone number.';

    if (!form.role)                       errs.role    = 'Please select a role.';

    if (form.role === 'Student' && !form.enrollmentNo.trim())
      errs.enrollmentNo = 'Enrollment number is required for students.';

    if (form.role === 'Student') {
      const s = Number(form.semester);
      if (!form.semester || Number.isNaN(s) || s < 1 || s > 8) {
        errs.semester = 'Select your semester (1–8).';
      }
    }

    if (['Librarian', 'Admin'].includes(form.role) && !form.employeeId.trim())
      errs.employeeId = 'Employee ID is required.';

    if (!form.password)                   errs.password = 'Password is required.';
    else if (form.password.length < 6)    errs.password = 'Password must be at least 6 characters.';

    if (!form.confirmPassword)            errs.confirmPassword = 'Please confirm your password.';
    else if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Passwords do not match.';

    return errs;
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const result = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role.toLowerCase(), // API expects lowercase role
        studentId: form.role === 'Student' ? form.enrollmentNo : form.employeeId,
        semester: form.role === 'Student' ? Number(form.semester) : undefined,
        password: form.password
      });
      if (result.success) {
        setSuccess('Registration successful! Redirecting to dashboard…');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setErrors({ email: result.message || 'Registration failed' });
      }
    } catch (error) {
      setErrors({ email: error.message || 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────
  const handleReset = () => {
    setForm({ name: '', email: '', phone: '', role: 'Student', enrollmentNo: '', employeeId: '', semester: '', password: '', confirmPassword: '' });
    setErrors({});
    setSuccess('');
  };

  return (
    <div className="login-wrapper" style={{ alignItems: 'flex-start', paddingTop: '2rem', paddingBottom: '2rem' }}>
      <div className="login-card" style={{ maxWidth: '500px' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #1e3a5f', margin: '0 auto 1rem', overflow: 'hidden', background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
          <img src="/cdgi_logo.jpg" alt="CDGI Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <h4 className="text-center mb-1" style={{ fontFamily: 'Playfair Display,serif' }}>Create Account</h4>
        <p className="text-center text-muted mb-3" style={{ fontSize: '.85rem' }}>Register for LibraCard access</p>

        {success && (
          <div className="alert alert-success lib-alert" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>{success}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3">
            {/* Full Name */}
            <div className="col-12">
              <label className="lib-label">Full Name *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange}
                className={`form-control lib-form-control ${errors.name ? 'is-invalid' : ''}`}
                placeholder="Arjun Sharma" />
              {errors.name && <div className="invalid-feedback">{errors.name}</div>}
            </div>

            {/* Email */}
            <div className="col-md-6">
              <label className="lib-label">Email Address *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                className={`form-control lib-form-control ${errors.email ? 'is-invalid' : ''}`}
                placeholder="you@example.com" />
              {errors.email && <div className="invalid-feedback">{errors.email}</div>}
            </div>

            {/* Phone */}
            <div className="col-md-6">
              <label className="lib-label">Phone Number *</label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                className={`form-control lib-form-control ${errors.phone ? 'is-invalid' : ''}`}
                placeholder="10-digit number" maxLength={10} />
              {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
            </div>

            {/* Role */}
            <div className="col-12">
              <label className="lib-label">Role *</label>
              <select name="role" value={form.role} onChange={handleChange}
                className={`form-select lib-form-control ${errors.role ? 'is-invalid' : ''}`}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.role && <div className="invalid-feedback">{errors.role}</div>}
            </div>

            {/* Conditional ID field */}
            {form.role === 'Student' && (
              <div className="col-12">
                <label className="lib-label">Enrollment Number *</label>
                <input type="text" name="enrollmentNo" value={form.enrollmentNo} onChange={handleChange}
                  className={`form-control lib-form-control ${errors.enrollmentNo ? 'is-invalid' : ''}`}
                  placeholder="e.g. CS2021001" />
                {errors.enrollmentNo && <div className="invalid-feedback">{errors.enrollmentNo}</div>}
              </div>
            )}
            {form.role === 'Student' && (
              <div className="col-12">
                <label className="lib-label">Semester (1–8) *</label>
                <select
                  name="semester"
                  value={form.semester}
                  onChange={handleChange}
                  className={`form-select lib-form-control ${errors.semester ? 'is-invalid' : ''}`}
                >
                  <option value="">Select semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={String(n)}>Semester {n}</option>
                  ))}
                </select>
                {errors.semester && <div className="invalid-feedback">{errors.semester}</div>}
              </div>
            )}
            {['Librarian', 'Admin'].includes(form.role) && (
              <div className="col-12">
                <label className="lib-label">Employee ID *</label>
                <input type="text" name="employeeId" value={form.employeeId} onChange={handleChange}
                  className={`form-control lib-form-control ${errors.employeeId ? 'is-invalid' : ''}`}
                  placeholder="e.g. LIB001" />
                {errors.employeeId && <div className="invalid-feedback">{errors.employeeId}</div>}
              </div>
            )}

            {/* Password */}
            <div className="col-md-6">
              <label className="lib-label">Password *</label>
              <div className="input-group">
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange}
                  className={`form-control lib-form-control ${errors.password ? 'is-invalid' : ''}`}
                  placeholder="Min. 6 chars" style={{ borderRight: 'none' }} />
                <button type="button" className="input-group-text"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{ border: '1.5px solid var(--border)', borderLeft: 'none', background: '#f9f9fb', cursor: 'pointer' }}>
                  <i className={`bi bi-eye${showPwd ? '-slash' : ''} text-muted`}></i>
                </button>
              </div>
              {errors.password && <div className="invalid-feedback d-block">{errors.password}</div>}
            </div>

            {/* Confirm Password */}
            <div className="col-md-6">
              <label className="lib-label">Confirm Password *</label>
              <input type={showPwd ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={handleChange}
                className={`form-control lib-form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                placeholder="Repeat password" />
              {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
            </div>
          </div>

          {/* Buttons */}
          <div className="d-grid gap-2 mt-4">
            <button type="submit" className="btn btn-lib-primary" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Registering…</> : <><i className="bi bi-person-check me-2"></i>Register</>}
            </button>
            <button type="button" className="btn btn-lib-secondary" onClick={handleReset}>
              <i className="bi bi-arrow-counterclockwise me-2"></i>Reset Form
            </button>
          </div>
        </form>

        <p className="text-center mt-3 mb-0" style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
