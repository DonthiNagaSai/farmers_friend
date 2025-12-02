import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

export default function AdminDatasetsPage() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const uploadInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchDatasets(); }, []);

  async function fetchDatasets() { try { const res = await fetch(`${API_BASE}/admin/datasets`); const json = await res.json(); setDatasets(json || []); } catch (err) { console.error(err); setDatasets([]); } }

  function handleFileChange(e) { const f = e.target.files && e.target.files[0]; setUploadFile(f || null); }

  async function uploadDataset() {
    if (!uploadFile) return alert('Choose a file first');
    setUploading(true);
    try {
      const resp = await fetch(`${API_BASE}/admin/dataset?filename=${encodeURIComponent(uploadFile.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: await uploadFile.arrayBuffer() });
      const json = await resp.json();
      if (!resp.ok) return alert(json.error || 'Upload failed');
      alert('Uploaded: ' + json.file);
      setUploadFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      fetchDatasets();
    } catch (err) { console.error(err); alert('Upload error'); }
    finally { setUploading(false); }
  }

  async function importDataset(name) { if (!window.confirm(`Import dataset ${name}?`)) return; try { const resp = await fetch(`${API_BASE}/admin/datasets/${encodeURIComponent(name)}/import`, { method: 'POST' }); const json = await resp.json(); if (!resp.ok) return alert(json.error || 'Import failed'); alert('Imported'); } catch (err) { console.error(err); alert('Import error'); } }

  async function deleteDataset(name) { if (!window.confirm(`Delete dataset ${name}?`)) return; try { const resp = await fetch(`${API_BASE}/admin/dataset?file=${encodeURIComponent(name)}`, { method: 'DELETE' }); const json = await resp.json(); if (!resp.ok) return alert(json.error || 'Delete failed'); alert('Deleted'); setDatasets(prev => prev.filter(d => (typeof d === 'string' ? d : d.file) !== name)); } catch (err) { console.error(err); alert('Delete error'); } }

  return (
    <div className="admin-page admin-datasets-page">
      <BackButton label="Back" />
      <div className="page-header">
        <h2>Datasets</h2>
      </div>

      <div className="upload-row">
        <input ref={uploadInputRef} type="file" onChange={handleFileChange} />
        <button onClick={uploadDataset} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
      </div>

      <div className="datasets-list">
        {datasets.length === 0 ? <p>No datasets uploaded</p> : (
          <ul>{datasets.map((d, idx) => {
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
  );
}
