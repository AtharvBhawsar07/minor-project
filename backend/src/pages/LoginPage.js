import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLES = ['Student', 'Librarian', 'Admin'];

const LoginPage = () => {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]           = useState({ email: '', password: '', role: 'Student' });
  const [errors, setErrors]       = useState({});
  const [serverErr, setServerErr] = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPwd, setShowPwd]     = useState(false);

  useEffect(() => {
    localStorage.removeItem('accessToken');
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
    setServerErr('');
  };

  const validate = () => {
    const errs = {};
    if (!form.email.trim())            errs.email    = 'Email / ID is required.';
    if (!form.password)                errs.password = 'Password is required.';
    else if (form.password.length < 6) errs.password = 'Min. 6 characters required.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    
    setLoading(true);
    try {
      const result = await login({ email: form.email, password: form.password, role: form.role });
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setServerErr(result.message || 'Invalid credentials.');
      }
    } catch (error) {
      setServerErr(error.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ email: '', password: '', role: 'Student' });
    setErrors({}); setServerErr('');
  };


  return (
    <div style={{ minHeight:'100vh', background:'#dce3ea', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:'8px', boxShadow:'0 2px 20px rgba(0,0,0,0.15)', width:'100%', maxWidth:'420px', overflow:'hidden' }}>

        {/* Top bar */}
        <div style={{ background:'#1e3a5f', padding:'14px 24px', display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <img src="/cdgi_logo.jpg" alt="CDGI" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
          <span style={{ color:'#fff', fontWeight:600, fontSize:'1rem' }}>LibraCard — Digital Library System</span>
        </div>

        <div style={{ padding:'2rem 2rem 1.5rem' }}>

          {/* College logo big */}
          <div style={{ textAlign:'center', marginBottom:'1.25rem' }}>
            <div style={{ width:100, height:100, borderRadius:'50%', border:'3px solid #1e3a5f', margin:'0 auto 0.75rem', overflow:'hidden', background:'#fff', boxShadow:'0 2px 12px rgba(0,0,0,0.12)' }}>
              <img src="/cdgi_logo.jpg" alt="CDGI Logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            <div style={{ fontSize:'0.82rem', color:'#1e3a5f', fontWeight:600 }}>Chameli Devi Group of Institutions</div>
            <div style={{ fontSize:'0.72rem', color:'#888', marginTop:'2px' }}>Indore • Digital Library Management</div>
          </div>

          {/* Role selection */}
          <div style={{ display:'flex', justifyContent:'center', gap:'1.5rem', marginBottom:'1.25rem' }}>
            {ROLES.map(r => (
              <label key={r} style={{ display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', fontSize:'0.85rem', color: form.role===r ? '#1e3a5f' : '#666', fontWeight: form.role===r ? 600 : 400 }}>
                <input type="radio" name="role" value={r} checked={form.role===r} onChange={handleChange} style={{ accentColor:'#1e3a5f', width:15, height:15 }} />
                {r}
              </label>
            ))}
          </div>

          {/* Server error */}
          {serverErr && (
            <div style={{ background:'#fff3f3', border:'1px solid #ffb3b3', borderRadius:'6px', padding:'0.6rem 0.9rem', fontSize:'0.82rem', color:'#cc0000', marginBottom:'1rem' }}>
              ⚠️ {serverErr}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ width:'100%' }}>

  {/* Email */}
  <div style={{ marginBottom:'1.2rem' }}>
    <div style={{ position:'relative' }}>
      <input
        type="text"
        name="email"
        value={form.email}
        onChange={handleChange}
        placeholder="Enrollment ID / Email"
        style={{
          width:'100%',
          padding:'0.75rem 2.5rem 0.75rem 1rem',
          border: errors.email ? '1.5px solid #e94560' : '1.5px solid #d0d5dd',
          borderRadius:'8px',
          fontSize:'0.9rem',
          background:'#f9fafb',
          outline:'none',
          fontFamily:'inherit',
          boxSizing:'border-box',
          color:'#333',
        }}
      />
      
    </div>
    {errors.email && (
      <div style={{ color:'#e94560', fontSize:'0.75rem', marginTop:'5px' }}>⚠ {errors.email}</div>
    )}
  </div>

  {/* Password */}
  <div style={{ marginBottom:'1.5rem' }}>
    <div style={{ position:'relative' }}>
      <input
        type={showPwd ? 'text' : 'password'}
        name="password"
        value={form.password}
        onChange={handleChange}
        placeholder="Password"
        style={{
          width:'100%',
          padding:'0.75rem 2.5rem 0.75rem 1rem',
          border: errors.password ? '1.5px solid #e94560' : '1.5px solid #d0d5dd',
          borderRadius:'8px',
          fontSize:'0.9rem',
          background:'#f9fafb',
          outline:'none',
          fontFamily:'inherit',
          boxSizing:'border-box',
          color:'#333',
        }}
      />

      <button
        type="button"
        onClick={() => setShowPwd(!showPwd)}
        style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#888', fontSize:'0.85rem', padding:0 }}>
        {showPwd ? '🙈' : '👁️'}
      </button>
    </div>
    {errors.password && (
      <div style={{ color:'#e94560', fontSize:'0.75rem', marginTop:'5px' }}>⚠ {errors.password}</div>
    )}
  </div>

            {/* Login button */}
            <button type="submit" disabled={loading}
              style={{ 
                width:'100%', 
                padding:'0.7rem', 
                background: loading ? '#6b7280' : '#1e3a5f', 
                color:'#fff', 
                border:'none', 
                borderRadius:'6px', 
                fontSize:'1rem', 
                fontWeight:600, 
                cursor: loading ? 'not-allowed' : 'pointer', 
                opacity: loading ? 0.8 : 1, 
                fontFamily:'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
              {loading && <span className="spinner-border spinner-border-sm" style={{width: '16px', height: '16px'}}></span>}
              {loading ? 'Logging in...' : 'Login »'}
            </button>
          </form>

          {/* Bottom links */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem', fontSize:'0.83rem' }}>
            <button onClick={handleReset} style={{ background:'none', border:'none', color:'#1e3a5f', cursor:'pointer', fontSize:'0.83rem', fontFamily:'inherit' }}>
              Forgot Password?
            </button>
            <Link to="/register" style={{ color:'#1e3a5f', textDecoration:'none', fontWeight:500 }}>
              SignUp (New User)
            </Link>
          </div>


        </div>
      </div>
    </div>
  );
};

export default LoginPage;