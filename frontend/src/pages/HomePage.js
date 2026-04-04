
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [


  { icon: '💳', title: 'Library Card',      desc: 'Request and manage your digital library card easily.' },
  { icon: '💰', title: 'Fine Management',   desc: 'Track overdue fines and payment history transparently.' },
  { icon: '👥', title: 'Role-Based Access', desc: 'Separate dashboards for Students, Librarians, and Admins.' },
  { icon: '🔍', title: 'Smart Search',      desc: 'Find books by title, author or category instantly.' },
  { icon: '🔒', title: 'Secure System',     desc: 'Your data is safe and accessible only to authorized users.' },
];

const HomePage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#f5f6fa', minHeight: '100vh' }}>

      {/* ── HERO ── */}
      <div style={{ background: '#1e3a5f', padding: '5rem 1rem', textAlign: 'center' }}>

        {/* CDGI Logo */}
<div style={{
  width: 110, height: 110, borderRadius: '50%',
  border: '3px solid #fff',
  margin: '0 auto 1.25rem',
  overflow: 'hidden',
  background: '#fff',
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
}}>
  <img src="/cdgi_logo.jpg" alt="CDGI Logo"
    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
</div>

        {/* College Name */}
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Chameli Devi Group of Institutions · Indore
        </div>

        {/* Title */}
        <h1 style={{ color: '#ffffff', fontSize: 'clamp(1.6rem, 4vw, 2.6rem)', fontWeight: 700, margin: '0 0 0.75rem', lineHeight: 1.3 }}>
          Digital Library Card <br />
          <span style={{ color: '#90caf9' }}>Management System</span>
        </h1>

        <p style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 460, margin: '0 auto 2.5rem', fontSize: '0.95rem', lineHeight: 1.7 }}>
          A complete solution for managing library cards, books, and fines
          for students, librarians, and administrators.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isAuthenticated ? (
            <Link to="/dashboard" style={{ background: '#fff', color: '#1e3a5f', padding: '0.7rem 2rem', borderRadius: '6px', fontWeight: 700, textDecoration: 'none', fontSize: '0.92rem' }}>
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link to="/login" style={{ background: '#fff', color: '#1e3a5f', padding: '0.7rem 2rem', borderRadius: '6px', fontWeight: 700, textDecoration: 'none', fontSize: '0.92rem' }}>
                Login »
              </Link>
              <Link to="/register" style={{ background: 'transparent', color: '#fff', padding: '0.65rem 2rem', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', fontSize: '0.92rem', border: '2px solid rgba(255,255,255,0.5)' }}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div style={{ background: '#163354', padding: '1.25rem 1rem' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', gap: '1rem' }}>
          {[
            { val: '20',   label: 'Books'       },
            { val: '3',    label: 'User Roles'  },
            { val: '100%', label: 'Free'        },
            { val: '24/7', label: 'Access'      },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ color: '#90caf9', fontSize: '1.5rem', fontWeight: 700 }}>{s.val}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '3.5rem 1rem' }}>
        <h2 style={{ textAlign: 'center', color: '#1e3a5f', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          Key Features
        </h2>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '2rem', fontSize: '0.88rem' }}>
          Everything you need for digital library management
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '1.1rem' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '1.5rem',
              border: '1px solid #e0e4ec',
              transition: 'box-shadow 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(30,58,95,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.6rem' }}>{f.icon}</div>
              <h5 style={{ color: '#1e3a5f', margin: '0 0 0.35rem', fontSize: '0.97rem', fontWeight: 600 }}>{f.title}</h5>
              <p style={{ color: '#777', fontSize: '0.83rem', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ background: '#fff', padding: '3rem 1rem', borderTop: '1px solid #e8eaf0', borderBottom: '1px solid #e8eaf0' }}>
        <div style={{ maxWidth: 750, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#1e3a5f', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.3rem' }}>How It Works</h2>
          <p style={{ color: '#888', marginBottom: '2.5rem', fontSize: '0.88rem' }}>3 simple steps to get started</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem' }}>
            {[
              { step: '01', icon: '📝', title: 'Register',      desc: 'Create account with enrollment ID' },
              { step: '02', icon: '💳', title: 'Request Card',  desc: 'Select book and submit request'    },
              { step: '03', icon: '📖', title: 'Borrow & Read', desc: 'Get approval and enjoy the book'   },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e8eef6', margin: '0 auto 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#1e3a5f', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.25rem' }}>STEP {s.step}</div>
                <h5 style={{ color: '#1e3a5f', margin: '0 0 0.3rem', fontSize: '0.93rem', fontWeight: 600 }}>{s.title}</h5>
                <p style={{ color: '#888', fontSize: '0.82rem', margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      {!isAuthenticated && (
        <div style={{ background: '#1e3a5f', padding: '3rem 1rem', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Ready to get started?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Create your account and start managing your library experience.
          </p>
          <Link to="/register" style={{ background: '#fff', color: '#1e3a5f', padding: '0.75rem 2.5rem', borderRadius: '6px', fontWeight: 700, textDecoration: 'none', fontSize: '0.92rem', marginRight: '0.75rem' }}>
            Register Now
          </Link>
          <Link to="/login" style={{ background: 'transparent', color: '#fff', padding: '0.7rem 2.5rem', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', fontSize: '0.92rem', border: '2px solid rgba(255,255,255,0.4)' }}>
            Login
          </Link>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{ background: '#111e2e', padding: '1rem', textAlign: 'center', fontSize: '0.76rem', color: 'rgba(255,255,255,0.35)' }}>
        © {new Date().getFullYear()} LibraCard — Chameli Devi Group of Institutions, Indore &nbsp;|&nbsp; Academic Project
      </div>

    </div>
  );
};

export default HomePage;