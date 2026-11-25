import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import BackButton from '../components/BackButton';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) return setStatus({ ok: false, msg: 'Please enter your email' });
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/test-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, message: 'Password reset requested' }) });
      const json = await res.json();
      if (!res.ok) return setStatus({ ok: false, msg: json.error || 'Failed to send reset email' });
      setStatus({ ok: true, msg: 'If that email exists we sent a reset link (dev: check server logs or inbox).' });
    } catch (err) {
      console.error(err);
      setStatus({ ok: false, msg: 'Server error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <BackButton label="Back" />
      
      <div className="login-wrapper">
        <div className="login-form-wrapper">
          <div className="login-box">
            <div className="form-header">
              <h2>Forgot Password</h2>
              <p className="form-subtitle">Enter the email associated with your account.</p>
            </div>

            {status && (
              <div className={`error-message ${status.ok ? 'success' : 'error'}`}> {status.msg} </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="fp-email">Email</label>
                <div className="input-wrapper">
                  <span className="input-icon">📧</span>
                  <input id="fp-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="submit" className="btn-login" disabled={loading}>{loading ? 'Sending...' : 'Send reset'}</button>
                <button type="button" className="link-button" onClick={() => navigate('/login')}>Back to login</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
