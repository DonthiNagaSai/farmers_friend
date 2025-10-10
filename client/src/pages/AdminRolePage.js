import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

export default function AdminRolePage() {
  const navigate = useNavigate();
  const { role } = useParams(); // expected: 'all' | 'student' | 'analyst' | 'user'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, [role]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users`);
      const json = await res.json();
      if (!Array.isArray(json)) setUsers([]);
      else {
        const r = (role || 'all').toLowerCase();
        const filtered = (r === 'all' || r === 'users' || r === 'user') ? json : json.filter(u => String(u.role || '').toLowerCase() === r);
        setUsers(filtered);
      }
    } catch (err) {
      console.error(err);
      setUsers([]);
    } finally { setLoading(false); }
  }

  return (
    <div className="admin-page admin-role-page">
      <div className="page-header">
        <button className="btn" onClick={() => navigate('/dashboard')}>← Back</button>
        <h2>{(role || 'all').toString().toUpperCase()} Users</h2>
      </div>

      {loading ? <p>Loading...</p> : (
        <table className="users-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {users.length === 0 ? <tr><td colSpan={5}>No users found</td></tr> : users.map(u => (
              <tr key={u.id || u.phone}>
                <td>{u.firstName} {u.lastName || ''}</td>
                <td>{u.phone}</td>
                <td>{u.email || '-'}</td>
                <td>{u.role || '-'}</td>
                <td><span className={`status ${u.active ? 'green' : 'red'}`}>{u.active ? 'Active' : 'Passive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
