import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CenteredModal from '../components/CenteredModal';
import './LoginPage.css';

const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

export default function RealLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password })
      });
      const json = await resp.json();
      if (!resp.ok) {
        setModal({ title: 'Login failed', message: json.error || 'Invalid credentials' });
        return;
      }
      if (json.token) localStorage.setItem('ff_token', json.token);
      if (json.user) localStorage.setItem('ff_user', JSON.stringify(json.user));
      const role = json.role || (json.user && json.user.role) || 'user';
      if (role === 'admin') navigate('/dashboard');
      else if (role === 'analyst') navigate('/dashboard/analyst');
      else if (role === 'student') navigate('/dashboard/student');
      else navigate('/dashboard');
    } catch (err) {
      console.error('login error', err);
      setModal({ title: 'Server error', message: 'Unable to contact server' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>Login</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email or Phone
            <input name="identifier" value={form.identifier} onChange={handleChange} required placeholder="email or phone" />
          </label>
          <label>
            Password
            <input name="password" type="password" value={form.password} onChange={handleChange} required placeholder="password" />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/signup')}>Sign Up</button>
          </div>
        </form>
      </div>
      {modal ? <CenteredModal {...modal} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
