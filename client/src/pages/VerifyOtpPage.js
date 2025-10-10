import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './VerifyOtpPage.css';
import CenteredModal from '../components/CenteredModal';

const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

export default function VerifyOtpPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { phone = '', email = '', next = '/login' } = loc.state || {};

  // If the user refreshed the page the navigation state may be gone.
  // Allow them to enter their contact (phone or email) as a fallback.
  const [contact, setContact] = useState(phone || email || '');

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [devOtp, setDevOtp] = useState('');

  async function submitVerify(e) {
    e.preventDefault();
    if (!code.trim()) { setMessage('Enter OTP'); return; }
    setLoading(true);
    try {
      // build payload: prefer id (if passed in state), otherwise use phone/email or fallback contact input
      const payload = { otp: code.trim() };
      if (loc.state && loc.state.id) payload.id = loc.state.id;
      else if (phone) payload.phone = phone;
      else if (email) payload.email = email;
      else if (contact) {
        // guess whether contact looks like email
        if (contact.includes('@')) payload.email = contact.trim();
        else payload.phone = contact.trim();
      }

      const resp = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok) setModal({ title: 'Verification failed', message: json.error || 'Failed to verify' });
      else {
        // if server returned a token and user, store token and auth then navigate to dashboard
        if (json.token) {
          try { localStorage.setItem('ff_token', json.token); } catch (e) { /* ignore */ }
          // build a friendly display name consistent with LoginPage
          const user = json.user || {};
          const displayName = user.firstName || user.name || user.email || user.phone || 'Guest';
          const respRole = json.role || user.role || 'user';
          const auth = { role: respRole, name: displayName, user };
          try { sessionStorage.setItem('auth', JSON.stringify(auth)); } catch (e) { /* ignore */ }
          if (respRole === 'student') nav('/dashboard/student', { state: auth });
          else if (respRole === 'analyst') nav('/dashboard/analyst', { state: auth });
          else nav('/dashboard', { state: auth });
        } else {
          setModal({ title: 'Verified', message: json.message || 'Verified', actions: React.createElement('button', { className: 'btn btn-ok', onClick: () => { setModal(null); nav(next); } }, 'OK') });
        }
      }
    } catch (err) {
      console.error(err);
      setModal({ title: 'Server error', message: 'Server error' });
    } finally { setLoading(false); }
  }

  async function resend() {
    setMessage('Resending...');
    try {
      const resp = await fetch(`${API_BASE}/resend-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, email }) });
      const json = await resp.json();
      if (!resp.ok) setModal({ title: 'Resend failed', message: json.error || 'Failed to resend' });
      else {
        setModal({ title: 'OTP resent', message: json.message || 'OTP resent' });
        // show OTP in dev mode when server returns it
        if (json.otp) setDevOtp(String(json.otp));
      }
    } catch (err) { console.error(err); setMessage('Server error'); }
  }

  return (
    React.createElement('div', { className: 'verify-otp-page' },
      React.createElement('div', { className: 'verify-box' },
        React.createElement('h3', null, 'Verify account'),
        phone ? React.createElement('div', { className: 'muted' }, `Sending OTP to phone: ${phone}`) : null,
        email ? React.createElement('div', { className: 'muted' }, `Sending OTP to email: ${email}`) : null,
        React.createElement('form', { onSubmit: submitVerify },
          message ? React.createElement('div', { className: 'error-message' }, message) : null,
          devOtp ? React.createElement('div', { className: 'dev-otp' }, `DEV OTP: ${devOtp}`) : null,
          // show fallback contact input when nav state didn't include phone/email
          !(phone || email) ? React.createElement('input', { placeholder: 'Enter your email or phone', value: contact, onChange: (e) => setContact(e.target.value) }) : null,
          React.createElement('input', { placeholder: 'Enter OTP', value: code, onChange: (e) => setCode(e.target.value) }),
          React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 10 } },
            React.createElement('button', { type: 'submit', className: 'btn', disabled: loading }, loading ? 'Verifying...' : 'Verify'),
            React.createElement('button', { type: 'button', className: 'btn', onClick: resend }, 'Resend OTP')
          )
        )
      )
      , modal ? React.createElement(CenteredModal, Object.assign({}, modal, { onClose: () => setModal(null) })) : null
    )
  );
}
