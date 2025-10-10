import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SoilGauges from '../components/SoilGauges';
import QuickStats from '../components/QuickStats';
import WeatherWidget from '../components/WeatherWidget';
import './Dashboard.css';

function parseCsv(text){
  // small CSV parser that supports quoted fields and commas inside quotes
  // Assumes header row exists. Returns array of objects (header -> value)
  const rows = [];
  if(!text) return rows;
  // split into lines but keep empty lines ignored
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if(lines.length < 2) return rows;

  function splitCsvLine(line){
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"'){
        // handle escaped double quotes by peeking ahead
        if(inQuotes && line[i+1] === '"'){
          cur += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if(ch === ',' && !inQuotes){
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols.map(c => c.trim());
  }

  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  for(const line of lines.slice(1)){
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((h,i)=>{ obj[h] = cols[i] !== undefined ? cols[i] : ''; });
    rows.push(obj);
  }
  return rows;
}

export default function AnalystDashboard(){
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(0);

  function logout(){
    try { sessionStorage.removeItem('auth'); } catch(e){}
    try { localStorage.removeItem('ff_token'); } catch(e){}
    navigate('/login');
  }

  async function handleFile(e){
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    setData(parsed);
    setMessage(`Loaded ${parsed.length} rows`);
    // also offer to save dataset to server for admin datasets list
    setPendingUpload({ filename: f.name, raw: text });
  }

  // pendingUpload holds raw file details for saving to server
  const [pendingUpload, setPendingUpload] = useState(null);

  async function saveDatasetToServer(){
    if(!pendingUpload) return setMessage('No dataset selected to save');
    try {
      const url = '/api/admin/dataset?filename=' + encodeURIComponent(pendingUpload.filename);
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Filename': pendingUpload.filename }, body: pendingUpload.raw });
      let json = null;
      try { json = await resp.json(); } catch (e) { /* ignore parse errors */ }
      if(!resp.ok) {
        const msg = json && json.error ? json.error : `HTTP ${resp.status}`;
        return setMessage('Save failed: ' + msg);
      }
      setMessage('Dataset saved: ' + (json && json.file ? json.file : 'ok'));
      setPendingUpload(null);
    } catch (err) {
      console.error(err);
      setMessage('Save failed: ' + (err && err.toString()));
    }
  }

  function downloadCsv(){
    if(!data || !data.length) return setMessage('No data to export');
    const keys = Object.keys(data[0]);
    const rows = [keys.join(',')].concat(data.map(r=>keys.map(k=>r[k]||'').join(',')));
    const blob = new Blob([rows.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'export.csv'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function safeNum(v){
    if (v === undefined || v === null || v === '') return 0;
    const n = Number(String(v).replace(/[^0-9.+-eE]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function rowToSoil(row){
    // try common column names
    const map = {
      ph: row.ph || row.pH || row.Ph || row['pH'] || row['PH'] || row['Ph'] || row['soil_ph'],
      nitrogen: row.nitrogen || row.n || row.N || row['nitro'] || row['nitrogen_ppm'],
      phosphorus: row.phosphorus || row.p || row.P || row['phosphorus_ppm'],
      potassium: row.potassium || row.k || row.K || row['potash'] || row['potassium_ppm'],
      moisture: row.moisture || row.moist || row.Moisture || row['water']
    };
    return {
      ph: safeNum(map.ph),
      nitrogen: safeNum(map.nitrogen),
      phosphorus: safeNum(map.phosphorus),
      potassium: safeNum(map.potassium),
      moisture: safeNum(map.moisture)
    };
  }

  function datasetReport(rows){
    if(!rows || !rows.length) return null;
    const agg = { ph:0, nitrogen:0, phosphorus:0, potassium:0, moisture:0 };
    let count = 0;
    const issues = { acidic:0, alkaline:0, lowN:0, lowP:0, lowK:0, lowMoist:0 };
    const cropCounts = {};
    for(const r of rows){
      const s = rowToSoil(r);
      agg.ph += s.ph; agg.nitrogen += s.nitrogen; agg.phosphorus += s.phosphorus; agg.potassium += s.potassium; agg.moisture += s.moisture;
      count++;
      if(s.ph < 5.5) issues.acidic++;
      else if(s.ph > 7.5) issues.alkaline++;
      if(s.nitrogen < 40) issues.lowN++;
      if(s.phosphorus < 20) issues.lowP++;
      if(s.potassium < 50) issues.lowK++;
      if(s.moisture < 20) issues.lowMoist++;
      const recs = predictCrops(r);
      for(const c of recs){ cropCounts[c] = (cropCounts[c]||0)+1; }
    }
    const avg = { ph: agg.ph/count, nitrogen: agg.nitrogen/count, phosphorus: agg.phosphorus/count, potassium: agg.potassium/count, moisture: agg.moisture/count };
    const topCrops = Object.entries(cropCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c);
    return { count, avg, issues, topCrops, cropCounts };
  }

  function downloadReport(rows){
    const report = datasetReport(rows);
    if(!report) return setMessage('No data to report');
    const lines = [];
    lines.push(`Dataset rows: ${report.count}`);
    lines.push('Average values:');
    lines.push(`  pH: ${report.avg.ph.toFixed(2)}`);
    lines.push(`  Nitrogen: ${report.avg.nitrogen.toFixed(1)}`);
    lines.push(`  Phosphorus: ${report.avg.phosphorus.toFixed(1)}`);
    lines.push(`  Potassium: ${report.avg.potassium.toFixed(1)}`);
    lines.push(`  Moisture: ${report.avg.moisture.toFixed(1)}`);
    lines.push('Issues counts:');
    lines.push(`  Acidic soils (pH<5.5): ${report.issues.acidic}`);
    lines.push(`  Alkaline soils (pH>7.5): ${report.issues.alkaline}`);
    lines.push(`  Low N: ${report.issues.lowN}`);
    lines.push(`  Low P: ${report.issues.lowP}`);
    lines.push(`  Low K: ${report.issues.lowK}`);
    lines.push(`  Low moisture: ${report.issues.lowMoist}`);
    lines.push(`Top recommended crops: ${report.topCrops.join(', ')}`);
    lines.push('Crop recommendation counts:');
    for(const [c,n] of Object.entries(report.cropCounts)) lines.push(`  ${c}: ${n}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'dataset-report.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // compute dataset report for UI
  const report = datasetReport(data);

  function analyzeRow(row){
    const s = rowToSoil(row);
    const messages = [];
    if (s.ph < 5.5) messages.push('Soil is acidic (pH < 5.5) — consider liming.');
    else if (s.ph > 7.5) messages.push('Soil is alkaline (pH > 7.5) — consider sulfur or acidifying practices.');
    else messages.push('pH is in the good range.');
    if (s.nitrogen < 40) messages.push('Nitrogen is low — apply nitrogen-rich fertilizer.');
    else if (s.nitrogen > 120) messages.push('Nitrogen is high — avoid heavy N applications.');
    if (s.phosphorus < 20) messages.push('Phosphorus is low — consider P fertilizer.');
    if (s.potassium < 50) messages.push('Potassium is low — consider K fertilizer.');
    if (s.moisture < 20) messages.push('Soil moisture is low — irrigation recommended.');
    return messages.join(' ');
  }

  function predictCrops(row){
    const s = rowToSoil(row);
    // crude matching
    const rec = [];
    if (s.ph >=6 && s.ph <=7.5 && s.moisture > 30) rec.push('Tomato');
    if (s.ph >=5.5 && s.ph <=7 && s.nitrogen > 50) rec.push('Maize');
    if (s.ph >=6 && s.ph <=7 && s.phosphorus > 30) rec.push('Wheat');
    if (!rec.length) rec.push('Millet');
    return rec;
  }

  return (
    React.createElement('div', {className:'dashboard-page'},
      React.createElement('div', {className:'dash-header'}, React.createElement('h2', null, 'Analyst Dashboard'), React.createElement('div', {style: {marginLeft: 'auto'}}, React.createElement('button', {className: 'btn-logout', onClick: logout}, 'Logout'))),
      React.createElement('div', {className:'admin-panel user-panel'},
        React.createElement('div', {className:'dataset-panel-main'},
          React.createElement('h3', null, 'Upload CSV dataset'),
          React.createElement('div', {className:'upload-row'},
            React.createElement('input', {type:'file', accept:'.csv', onChange: handleFile}),
            React.createElement('button', {className:'btn', onClick: downloadCsv}, 'Export CSV'),
            pendingUpload ? React.createElement('button', {className:'btn', onClick: saveDatasetToServer}, 'Save to Datasets') : null
          ),
          message ? React.createElement('div', {className:'muted'}, message) : null,
          data && data.length ? React.createElement('div', {style: {marginTop: 12}},
            React.createElement('div', {style: {display:'flex', gap:8, alignItems:'center'}},
              React.createElement('div', null, `${data.length} rows loaded`),
              React.createElement('div', {style: {marginLeft:'auto', display:'flex', gap:8}}, React.createElement('button', {className:'btn', onClick: () => { setSelected(0); }}, 'Select first'), React.createElement('button', {className:'btn', onClick: () => downloadReport(data)}, 'Download Report'))
            ),
            React.createElement('div', {style: {display:'flex', gap:12, marginTop:8}},
              React.createElement('div', {style: {flex:'1 1 320px'}},
                React.createElement('div', {style: {maxHeight: 260, overflow:'auto', border:'1px solid #eee', padding:8, borderRadius:6}},
                  data.map((row, idx) => React.createElement('div', {key: idx, style: {padding:6, cursor:'pointer', background: idx===selected? '#f2fff2' : 'transparent'}, onClick: () => setSelected(idx)},
                    React.createElement('div', {style:{fontWeight:600}}, row.name || row.id || `Row ${idx+1}`),
                    React.createElement('div', {className:'muted', style:{fontSize:12}}, Object.keys(row).slice(0,4).map(k=>`${k}:${row[k]}`).join(' • '))
                  ))
                )
              ),
              React.createElement('div', {style: {flex:'1 1 480px'}},
                React.createElement(SoilGauges, {soil: data.length ? rowToSoil(data[selected]) : {}}),
                React.createElement('div', {className:'card', style:{marginTop:8}},
                  React.createElement('div', {className:'card-header'}, 'Analysis'),
                  React.createElement('div', {style:{padding:8}}, data.length ? analyzeRow(data[selected]) : 'No data')
                ),
                React.createElement('div', {className:'card', style:{marginTop:8}},
                  React.createElement('div', {className:'card-header'}, 'Recommended Crops'),
                  React.createElement('div', {style:{padding:8}}, data.length ? predictCrops(data[selected]).join(', ') : 'No data')
                )
                , report ? React.createElement('div', {className:'card', style:{marginTop:8, background:'#fffbe6'}},
                  React.createElement('div', {className:'card-header'}, 'Dataset Report Summary'),
                  React.createElement('div', {style:{padding:8}},
                    React.createElement('div', null, `Rows: ${report.count}`),
                    React.createElement('div', null, `Avg pH: ${report.avg.ph.toFixed(2)}`),
                    React.createElement('div', null, `Avg N: ${report.avg.nitrogen.toFixed(1)}`),
                    React.createElement('div', null, `Avg P: ${report.avg.phosphorus.toFixed(1)}`),
                    React.createElement('div', null, `Avg K: ${report.avg.potassium.toFixed(1)}`),
                    React.createElement('div', {style:{marginTop:6, fontWeight:600}}, `Top crops: ${report.topCrops.join(', ')}`)
                  )
                ) : null
              ),
              React.createElement('div', {className:'side-widgets'}, React.createElement(WeatherWidget, null))
            )
          ) : null
        ),

        React.createElement('div', {className:'visual-row'},
          React.createElement('div', null,
            React.createElement(QuickStats, {analyses: [], predictions: data.length ? data.map(r=>predictCrops(r)) : []})
          ),
          React.createElement('div', {className:'side-widgets'}, React.createElement(WeatherWidget, null))
        )
      )
    )
  );
}
