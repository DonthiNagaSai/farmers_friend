import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AdminPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // read optional ?role=student|analyst query param
  const q = new URLSearchParams(location.search);
  const role = q.get('role');

  return (
    <div className="admin-page admin-preview-page">
      <div className="page-header">
        <button className="btn" onClick={() => navigate('/dashboard')}>← Back</button>
        <h2>Preview User {role ? `(${role})` : ''}</h2>
      </div>

      <div style={{ marginBottom: 12 }}>
        <p className="muted">Preview mode: you can view a user's experience here. Use the Back button to return.</p>
      </div>

      <div>
        <p className="muted">Select a user from the Admin Users page to open a preview (this simplified preview is read-only).</p>
      </div>
    </div>
  );
}
