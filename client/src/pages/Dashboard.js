import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import CenteredModal from '../components/CenteredModal';
import SoilGauges from '../components/SoilGauges';
import QuickStats from '../components/QuickStats';
import WeatherWidget from '../components/WeatherWidget';
import StudentDashboard from './StudentDashboard';
import AnalystDashboard from './AnalystDashboard';

const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const fallbackAuth = (() => { try { const raw = sessionStorage.getItem('auth'); return raw ? JSON.parse(raw) : null } catch (e) { return null } })();
  const role = location.state?.role || fallbackAuth?.role || 'user';
  const user = location.state?.user || fallbackAuth?.user || null;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const uploadInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('none');
  const [previewUser, setPreviewUser] = useState(false);
  const [selectedPreviewUserId, setSelectedPreviewUserId] = useState(null);
  const [previewRole, setPreviewRole] = useState(null); // null | 'student' | 'analyst'

  const [showProfile, setShowProfile] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [modal, setModal] = useState(null);

  const initialSoil = { ph: 6.5, nitrogen: 60, phosphorus: 30, potassium: 80, moisture: 45 };
  const [soilInputs, setSoilInputs] = useState(initialSoil);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);

  function deriveNameFromEmail(email) {
    if (!email) return null;
    const local = String(email).split('@')[0];
    const spaced = local.replace(/[._\-+]+/g, ' ');
    return spaced.split(' ').map(s => s ? (s[0].toUpperCase() + s.slice(1)) : '').join(' ').trim();
  }

  // (removed unused crop icon helpers)

  const name = (() => {
    if (location.state && location.state.name) return location.state.name;
    if (fallbackAuth && fallbackAuth.name) return fallbackAuth.name;
    if (user) {
      if (user.firstName) return `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;
      if (user.name) return user.name;
      const fromEmail = deriveNameFromEmail(user.email);
      if (fromEmail) return fromEmail;
      if (user.phone) return user.phone;
    }
    return 'Guest';
  })();

  useEffect(() => { if (role === 'admin' && activeTab === 'users') fetchUsers(); }, [role, activeTab]);

  async function fetchUsers() {
    setLoading(true);
    try { const res = await fetch(`${API_BASE}/users`); const json = await res.json(); setUsers(json); }
    catch (err) { console.error(err); setModal({ title: 'Failed to load users', message: 'Failed to load users' }); }
    finally { setLoading(false); }
  }

  async function toggleUser(userId) {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/toggle`, { method: 'PATCH' });
      const json = await res.json();
      if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? json.user : u));
      else setModal({ title: 'Failed to toggle', message: json.error || 'Failed to toggle' });
    } catch (err) { console.error(err); setModal({ title: 'Server error', message: 'Server error' }); }
  }

  async function fetchDatasets() { try { const res = await fetch(`${API_BASE}/admin/datasets`); if (!res.ok) throw new Error('Failed'); const list = await res.json(); setDatasets(list); } catch (err) { console.error(err); setDatasets([]); } }
  useEffect(() => { if (role === 'admin' && activeTab === 'datasets') fetchDatasets(); }, [role, activeTab]);

  function handleFileChange(e) { const f = e.target.files && e.target.files[0]; setUploadFile(f || null); }
  async function uploadDataset() {
    if (!uploadFile) return setModal({ title: 'No file', message: 'Pick a file first' });
    setUploading(true);
    try {
      // send raw file as application/octet-stream so server can store any file type
      const resp = await fetch(`${API_BASE}/admin/dataset?filename=${encodeURIComponent(uploadFile.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: await uploadFile.arrayBuffer()
      });
      const json = await resp.json();
  if (!resp.ok) return setModal({ title: 'Upload failed', message: json.error || 'Upload failed' });
  setModal({ title: 'Uploaded', message: 'Uploaded: ' + json.file });
  // Clear chosen file UI and state
  setUploadFile(null);
  try { if (uploadInputRef.current) uploadInputRef.current.value = ''; } catch (e) { /* ignore */ }
      await fetchDatasets();
    } catch (err) {
      console.error(err);
      setModal({ title: 'Upload error', message: 'Upload error' });
    } finally {
      setUploading(false);
    }
  }

  async function importDataset(name) { if (!window.confirm(`Import dataset ${name} into users? This will merge users by phone.`)) return; try { const resp = await fetch(`${API_BASE}/admin/datasets/${encodeURIComponent(name)}/import`, { method: 'POST' }); const json = await resp.json(); if (!resp.ok) return setModal({ title: 'Import failed', message: json.error || 'Import failed' }); setModal({ title: 'Imported', message: json.message || 'Imported' }); fetchUsers(); } catch (err) { console.error(err); setModal({ title: 'Import error', message: 'Import error' }); } }

  // Delete a dataset file (admin only)
  async function deleteDataset(name) {
    if (!window.confirm(`Delete dataset ${name}? This will permanently remove the file.`)) return;
    try {
      const resp = await fetch(`${API_BASE}/admin/dataset?file=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const json = await resp.json();
      if (!resp.ok) return setModal({ title: 'Delete failed', message: json.error || 'Delete failed' });
      setModal({ title: 'Deleted', message: `Deleted ${name}` });
      // remove from local list
      setDatasets(prev => prev.filter(d => {
        const fname = (typeof d === 'string') ? d : (d.file || '');
        return fname !== name;
      }));
    } catch (err) {
      console.error(err);
      setModal({ title: 'Delete error', message: 'Delete error' });
    }
  }

  function updateSoilField(field, value) { setSoilInputs(s => ({ ...s, [field]: value })); }
  function analyzeSoil(vals = soilInputs) { const messages = []; const ph = parseFloat(vals.ph); if (!Number.isFinite(ph)) messages.push('Invalid pH'); else if (ph < 5.5) messages.push('Soil is acidic'); else if (ph <= 7) messages.push('Soil is neutral'); else messages.push('Soil is alkaline'); const nk = (v) => (v < 50 ? 'low' : v <= 100 ? 'medium' : 'high'); messages.push(`Nitrogen: ${nk(vals.nitrogen)}`); messages.push(`Phosphorus: ${nk(vals.phosphorus)}`); messages.push(`Potassium: ${nk(vals.potassium)}`); messages.push(`Moisture: ${vals.moisture < 30 ? 'low' : vals.moisture <= 60 ? 'moderate' : 'high'}`); setAnalysisResult(messages); setHistory(h => [{ id: Date.now(), ts: new Date().toISOString(), type: 'analysis', inputs: vals, result: messages }, ...h].slice(0, 100)); }
  function predictCrop(vals = soilInputs) { const recs = []; const ph = parseFloat(vals.ph); const n = Number(vals.nitrogen); const p = Number(vals.phosphorus); const m = Number(vals.moisture); if (ph >= 6 && ph <= 7.5) recs.push('Maize'); if (ph < 6) recs.push('Potato', 'Tea (acidic soils)'); if (ph > 7.5) recs.push('Barley'); if (m >= 50) recs.unshift('Rice'); if (n < 50) recs.push('Legumes (e.g. Green gram)'); if (p < 30) recs.push('Root crops (consider P fertilizer)'); const uniq = [...new Set(recs)].slice(0, 5); setPredictionResult(uniq); setHistory(h => [{ id: Date.now(), ts: new Date().toISOString(), type: 'prediction', inputs: vals, result: uniq }, ...h].slice(0, 100)); }

  function handleLogout() { try { sessionStorage.removeItem('auth'); } catch (e) {} navigate('/'); }
  // handlePreviewToggle removed (unused)

  const headerProfileTarget = (role === 'admin' && previewUser) ? (users.find(u => (u.id || u.phone) === selectedPreviewUserId) || (users.length > 0 ? users[0] : { firstName: 'Preview', lastName: 'User', phone: '-', email: '', active: true })) : user;

  // Ensure only one admin panel tab is open at a time. Clicking the same tab will close it.
  // Special case: 'preview' toggles previewUser state and closes other tabs when active.
  function toggleSection(tab) {
    if (tab === 'preview') {
      // Immediately open/close preview. If users are not yet loaded, fetch them in background.
      if (!previewUser) {
        // open preview immediately so UI responds to single click
        setPreviewUser(true);
        setShowProfile(false);
        setShowHistory(false);
        // if no users yet, fetch in background
        if (users.length === 0 && role === 'admin') {
          fetchUsers().catch(err => setModal({ title: 'Failed to load users', message: 'Failed to load users' }));
        }
      } else {
        // close preview
        setPreviewUser(p => {
          const newVal = !p;
          if (!newVal) {
            setShowProfile(false);
            setShowHistory(false);
            setPreviewRole(null);
          }
          return newVal;
        });
      }
      // always close other panels when preview is toggled
      setActiveTab('none');
      setShowProfile(false);
      setShowHistory(false);
      return;
    }

    // opening a normal tab should close preview mode and any header dropdowns
    if (previewUser) {
      setPreviewUser(false);
      setPreviewRole(null);
    }
    setShowProfile(false);
    setShowHistory(false);
    // If clicking the already-open tab, close it; otherwise open the requested tab.
    if (activeTab === tab) setActiveTab('none'); else setActiveTab(tab);
  }

  // Toggle profile dropdown but ensure other panels are closed when opening
  function toggleProfile() {
    setShowProfile(prev => {
      const newVal = !prev;
      if (newVal) {
        // opening profile should close others
        setShowHistory(false);
        setActiveTab('none');
      }
      return newVal;
    });
  }

  // Toggle history dropdown but ensure other panels are closed when opening
  function toggleHistory() {
    setShowHistory(prev => {
      const newVal = !prev;
      if (newVal) {
        setShowProfile(false);
        setActiveTab('none');
      }
      return newVal;
    });
  }

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <h1>{role === 'admin' ? `Admin Dashboard` : `Welcome ${name}`}</h1>
        <div className="header-actions">
          <div className="segmented" role="tablist" aria-label="Admin controls">
            {role === 'admin' && <button role="tab" className={`seg-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => toggleSection('users')} aria-expanded={activeTab === 'users'}>Users</button>}
            {role === 'admin' && <button role="tab" className={`seg-btn ${activeTab === 'datasets' ? 'active' : ''}`} onClick={() => toggleSection('datasets')} aria-expanded={activeTab === 'datasets'}>Datasets</button>}
            {role === 'admin' && <button role="tab" className={`seg-btn ${previewUser && !previewRole ? 'active' : ''}`} onClick={() => {
              if (previewUser && previewRole !== null) { setPreviewRole(null); return; }
              setPreviewRole(null);
              toggleSection('preview');
            }}>{previewUser && !previewRole ? 'Close User View' : 'Preview User'}</button>}
            {role === 'admin' && <button role="tab" className={`seg-btn ${previewUser && previewRole === 'student' ? 'active' : ''}`} onClick={() => {
              if (previewUser) { setPreviewRole('student'); return; }
              setPreviewRole('student');
              toggleSection('preview');
            }}>Preview Student</button>}
            {role === 'admin' && <button role="tab" className={`seg-btn ${previewUser && previewRole === 'analyst' ? 'active' : ''}`} onClick={() => {
              if (previewUser) { setPreviewRole('analyst'); return; }
              setPreviewRole('analyst');
              toggleSection('preview');
            }}>Preview Analyst</button>}
          </div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>

          {role !== 'admin' && (
            <div className="header-user-controls">
              <button className={`btn-profile ${showProfile ? 'active' : ''}`} onClick={toggleProfile}>{showProfile ? 'Hide Profile' : 'Profile'}</button>
              {showProfile && (
                <div className="profile-dropdown">
                  <div className="user-card">
                    <h4>{(headerProfileTarget?.firstName || '') + ' ' + (headerProfileTarget?.lastName || '')}</h4>
                    <div>{headerProfileTarget?.email || '-'}</div>
                    <div>{headerProfileTarget?.phone || '-'}</div>
                  </div>
                </div>
              )}

              <button className={`btn history-btn ${showHistory ? 'active' : ''}`} onClick={toggleHistory}>{showHistory ? 'Hide History' : 'History'}</button>
            </div>
          )}
        </div>
      </header>

      {/* history dropdown removed from global header scope - use preview-local dropdown instead */}

      <main className="main-content">
        {role === 'admin' ? (
          <div className="admin-panel">
            {activeTab === 'users' && (
              loading ? <p>Loading users...</p> : (
                <table className="users-table">
                  <thead>
                    <tr><th>Name</th><th>Phone</th><th>Email</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? <tr><td colSpan={5}>No users yet</td></tr> : users.map(u => (
                      <tr key={u.id}>
                        <td>{u.firstName} {u.lastName || ''}</td>
                        <td>{u.phone}</td>
                        <td>{u.email || '-'}</td>
                        <td><span className={`status ${u.active ? 'green' : 'red'}`}>{u.active ? 'Active' : 'Passive'}</span></td>
                        <td><button className="toggle-btn" onClick={() => toggleUser(u.id)}>{u.active ? 'Set Passive' : 'Set Active'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'datasets' && (
              <div className="dataset-panel">
                <div className="upload-row">
                  <input ref={uploadInputRef} type="file" onChange={handleFileChange} />
                  <button onClick={uploadDataset} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
                </div>
                <div className="datasets-list">
                  {datasets.length === 0 ? <p>No datasets uploaded</p> : (
                    <ul>{datasets.map((d, idx) => {
                      // d may be either a string (filename) or an object metadata
                      const file = typeof d === 'string' ? d : d.file || `dataset-${idx}`;
                      const original = typeof d === 'object' && d.originalName ? d.originalName : null;
                      const size = typeof d === 'object' && d.size ? d.size : null;
                      return (
                          <li key={file}>
                            <span style={{display:'block'}}>{original || file}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                              {size ? <small className="muted">{Math.round(size/1024)} KB</small> : null}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => importDataset(file)}>Import</button>
                                <a className="btn-download" href={`${API_BASE}/admin/dataset?file=${encodeURIComponent(file)}`} target="_blank" rel="noreferrer">Download</a>
                                <button className="danger" onClick={() => deleteDataset(file)}>Delete</button>
                              </div>
                            </div>
                          </li>
                        );
                    })}</ul>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="user-panel">
            <div className="soil-section">
              <h3>Soil Analysis & Crop Prediction</h3>
              <div className="soil-grid">
                <div className="soil-three-col">
                  <div className="col-inputs">
                    <label>pH<input type="number" step="0.1" value={soilInputs.ph} onChange={(e) => updateSoilField('ph', e.target.value)} /></label>
                    <label>N (Nitrogen)<input type="number" value={soilInputs.nitrogen} onChange={(e) => updateSoilField('nitrogen', e.target.value)} /></label>
                    <label>P (Phosphorus)<input type="number" value={soilInputs.phosphorus} onChange={(e) => updateSoilField('phosphorus', e.target.value)} /></label>
                    <label>K (Potassium)<input type="number" value={soilInputs.potassium} onChange={(e) => updateSoilField('potassium', e.target.value)} /></label>
                    <label>Moisture (%)<input type="number" value={soilInputs.moisture} onChange={(e) => updateSoilField('moisture', e.target.value)} /></label>
                  </div>

                  <div className="col-actions">
                    <button className="btn analyze" onClick={() => analyzeSoil()}>Analyze Soil</button>
                    <button className="btn predict" onClick={() => predictCrop()}>Predict Crops</button>
                  </div>

                  <div className="col-results">
                    {analysisResult ? <div className="soil-result"><h4>Analysis</h4><ul>{analysisResult.map((m,i) => <li key={i}>{m}</li>)}</ul></div> : <p className="muted">No analysis yet.</p>}
                    {predictionResult ? <div className="prediction-result"><h4>Recommended Crops</h4><ul>{predictionResult.map((c,i) => <li key={i}><span className="crop-initial" aria-hidden>{String(c).substring(0,1)}</span> {c}</li>)}</ul></div> : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual components placed below soil analysis */}
            <div className="visual-row">
              <SoilGauges soil={soilInputs} />
              <div className="side-widgets">
                <QuickStats analyses={history.filter(h=>h.type==='analysis')} predictions={[predictionResult||[]]} />
                <WeatherWidget />
              </div>
            </div>
          </div>
        )}

        {role === 'admin' && previewUser && (
          <div className="user-panel preview">
            <div className="preview-header">
              {users.length > 0 ? (
                (() => {
                  const filtered = previewRole ? users.filter(u => u.role === previewRole) : users;
                  const first = filtered[0];
                  return (
                    <select value={selectedPreviewUserId || (first ? (first.id || first.phone) : '')} onChange={(e) => setSelectedPreviewUserId(e.target.value)}>
                      {filtered.map(u => <option key={u.id || u.phone} value={(u.id || u.phone)}>{u.firstName} {u.lastName || ''} ({u.phone || '-'})</option>)}
                    </select>
                  );
                })()
              ) : <span>Previewing as user: {users.length>0 ? users[0].firstName : 'Preview'}</span>}

              <div className="preview-controls">
                <div className="profile-dropdown-wrapper">
                  <button className={`btn-profile ${showProfile ? 'active' : ''}`} onClick={toggleProfile}>{showProfile ? 'Hide Profile' : 'Profile'}</button>
                  {showProfile && (
                    <div className="profile-dropdown">
                      <div className="user-card"><h4>{headerProfileTarget.firstName} {headerProfileTarget.lastName || ''}</h4><div>{headerProfileTarget.email || '-'}</div><div>{headerProfileTarget.phone || '-'}</div></div>
                    </div>
                  )}
                </div>

                <div className="history-dropdown-wrapper">
                  <button className={`btn history-btn ${showHistory ? 'active' : ''}`} onClick={toggleHistory}>{showHistory ? 'Hide History' : 'History'}</button>
                  {showHistory && (
                    <div className="history-dropdown">
                      {history.length === 0 ? <p>No history for this user.</p> : (
                        <ul className="history-list">
                          {history.map(h => (
                            <li key={h.id} className="history-entry">
                              <div className="history-meta">{(h.type || '') + ' • ' + (new Date(h.ts)).toLocaleString()}</div>
                              <div className="history-summary">{Array.isArray(h.result) ? h.result.join(', ') : String(h.result)}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {previewRole === 'student' ? (
              // render the full Student dashboard for preview
              React.createElement('div', { style: { width: '100%' } }, React.createElement(StudentDashboard, { history: history, analyses: [] }))
            ) : previewRole === 'analyst' ? (
              React.createElement('div', { style: { width: '100%' } }, React.createElement(AnalystDashboard))
            ) : (
              <div className="soil-section">
                <h3>Soil Analysis & Crop Prediction (Preview)</h3>
                <div className="soil-grid">
                  <div className="soil-three-col">
                    <div className="col-inputs">
                      <label>pH<input type="number" step="0.1" value={soilInputs.ph} onChange={(e) => updateSoilField('ph', e.target.value)} /></label>
                      <label>N (Nitrogen)<input type="number" value={soilInputs.nitrogen} onChange={(e) => updateSoilField('nitrogen', e.target.value)} /></label>
                      <label>P (Phosphorus)<input type="number" value={soilInputs.phosphorus} onChange={(e) => updateSoilField('phosphorus', e.target.value)} /></label>
                      <label>K (Potassium)<input type="number" value={soilInputs.potassium} onChange={(e) => updateSoilField('potassium', e.target.value)} /></label>
                      <label>Moisture (%)<input type="number" value={soilInputs.moisture} onChange={(e) => updateSoilField('moisture', e.target.value)} /></label>
                    </div>

                    <div className="col-actions">
                      <button className="btn analyze" onClick={() => analyzeSoil()}>Analyze Soil</button>
                      <button className="btn predict" onClick={() => predictCrop()}>Predict Crops</button>
                    </div>

                    <div className="col-results">
                      {analysisResult ? <div className="soil-result"><h4>Analysis</h4><ul>{analysisResult.map((m,i) => <li key={i}>{m}</li>)}</ul></div> : <p className="muted">No analysis yet.</p>}
                      {predictionResult ? <div className="prediction-result"><h4>Recommended Crops</h4><ul>{predictionResult.map((c,i) => <li key={i}><span className="crop-initial" aria-hidden>{String(c).substring(0,1)}</span> {c}</li>)}</ul></div> : null}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Visual components placed below soil analysis (preview) */}
            <div className="visual-row">
              <SoilGauges soil={soilInputs} />
              <div className="side-widgets">
                <QuickStats analyses={history.filter(h=>h.type==='analysis')} predictions={[predictionResult||[]]} />
                <WeatherWidget />
              </div>
            </div>
          </div>
        )}

      </main>

      {modal && <CenteredModal {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}

