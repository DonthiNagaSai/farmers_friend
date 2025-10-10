import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try { const res = await fetch(`${API_BASE}/users`); const json = await res.json(); setUsers(json || []); }
    catch (err) { console.error(err); setUsers([]); }
    finally { setLoading(false); }
  }

  async function toggleUser(userId) {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/toggle`, { method: 'PATCH' });
      const json = await res.json();
      if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? json.user : u));
      else alert(json.error || 'Failed to toggle');
    } catch (err) { console.error(err); alert('Server error'); }
  }

  return (
    <div className="admin-page admin-users-page">
      <div className="page-header">
        <button className="btn" onClick={() => navigate('/dashboard')}>← Back</button>
        <h2>Users</h2>
        <div style={{ marginLeft: 12 }}>
          <button className="seg-btn" onClick={() => navigate('/dashboard/role/all')}>All</button>
          <button className="seg-btn" onClick={() => navigate('/dashboard/role/student')}>Students</button>
          <button className="seg-btn" onClick={() => navigate('/dashboard/role/analyst')}>Analysts</button>
        </div>
      </div>

      {loading ? <p>Loading users...</p> : (
        <table className="users-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {users.length === 0 ? <tr><td colSpan={5}>No users yet</td></tr> : users.map(u => (
              <tr key={u.id || u.phone}>
                <td>{u.firstName} {u.lastName || ''}</td>
                <td>{u.phone}</td>
                <td>{u.email || '-'}</td>
                <td><span className={`status ${u.active ? 'green' : 'red'}`}>{u.active ? 'Active' : 'Passive'}</span></td>
                <td><button className="toggle-btn" onClick={() => toggleUser(u.id)}>{u.active ? 'Set Passive' : 'Set Active'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
