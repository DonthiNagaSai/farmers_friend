import React from 'react';
import './Dashboard.css';
import BackButton from '../components/BackButton';
import SoilGauges from '../components/SoilGauges';
import QuickStats from '../components/QuickStats';
import WeatherWidget from '../components/WeatherWidget';

export default function StudentDashboard({history = [], analyses = [], onClearDataset, clearDatasetTrigger, onDatasetLoaded}){
  const [datasets, setDatasets] = React.useState([]);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [soil, setSoil] = React.useState(history.length ? history[history.length-1].values : {ph: 6.5, nitrogen: 60, phosphorus: 30, potassium: 80, moisture: 45, temperature: 25});
  const [report, setReport] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [predictions, setPredictions] = React.useState([]);
  const [previewRows, setPreviewRows] = React.useState([]);

  // Handle clear dataset - reset all state
  const handleClearDataset = React.useCallback(() => {
    setSelectedFile(null);
    setReport(null);
    setError(null);
    setPredictions([]);
    setPreviewRows([]);
    setSoil(history.length ? history[history.length-1].values : {ph: 6.5, nitrogen: 60, phosphorus: 30, potassium: 80, moisture: 45, temperature: 25});
  }, [history]);

  // Effect to clear dataset when triggered from parent (clearDatasetTrigger counter changes)
  React.useEffect(() => {
    if (clearDatasetTrigger > 0 && report !== null) {
      handleClearDataset();
    }
  }, [clearDatasetTrigger, report, handleClearDataset]);

  // Fetch available datasets once on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('/api/admin/datasets');
        const json = await resp.json();
        if (mounted) setDatasets(json || []);
      } catch (e) { if (mounted) setDatasets([]); }
    })();
    return () => { mounted = false; };
  }, []);

  function splitCsvLine(line){
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"'){
        if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if(ch === ',' && !inQuotes){ cols.push(cur); cur = ''; } else { cur += ch; }
    }
    cols.push(cur);
    return cols.map(c => c.trim());
  }

  function parseCsv(text){
    const lines = text.split(/\r?\n/).filter(l=>l.trim()!== '');
    if(lines.length < 2) return [];
    const headers = splitCsvLine(lines[0]);
    return lines.slice(1).map(line => { const cols = splitCsvLine(line); const obj = {}; headers.forEach((h,i)=> obj[h]=cols[i]!==undefined?cols[i]:'' ); return obj; });
  }

  // (preview removed) selecting a dataset will clear previous report/predictions

  // helper: convert row to soil numeric fields
  function safeNum(v){
    if (v === undefined || v === null || v === '') return 0;
    const n = Number(String(v).replace(/[^0-9.+-eE]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function rowToSoil(row){
    const map = {
      ph: row.ph || row.pH || row.Ph || row['pH'] || row['PH'] || row['Ph'] || row['soil_ph'] || row['pH_Value'] || row['pH_value'] || row['ph_value'],
      nitrogen: row.nitrogen || row.Nitrogen || row.n || row.N || row['nitro'] || row['nitrogen_ppm'],
      phosphorus: row.phosphorus || row.Phosphorus || row.p || row.P || row['phosphorus_ppm'],
      potassium: row.potassium || row.Potassium || row.k || row.K || row['potash'] || row['potassium_ppm'],
      moisture: row.moisture || row.moist || row.Moisture || row['water'] || row.Humidity || row.humidity,
      temperature: row.temperature || row.Temperature || row.temp || row.Temp || row['temp'] || row['soil_temp']
    };
    return {
      ph: safeNum(map.ph),
      nitrogen: safeNum(map.nitrogen),
      phosphorus: safeNum(map.phosphorus),
      potassium: safeNum(map.potassium),
      moisture: safeNum(map.moisture),
      temperature: safeNum(map.temperature) || 25
    };
  }

  // analyzeRow removed (unused)

  function predictCrops(row){
    const s = rowToSoil(row);
    const rec = [];
    if (s.ph >=6 && s.ph <=7.5 && s.moisture > 30) rec.push('Tomato');
    if (s.ph >=5.5 && s.ph <=7 && s.nitrogen > 50) rec.push('Maize');
    if (s.ph >=6 && s.ph <=7 && s.phosphorus > 30) rec.push('Wheat');
    if (!rec.length) rec.push('Millet');
    return rec;
  }

  function datasetReport(rows){
    if(!rows || !rows.length) return null;
    const agg = { ph:0, nitrogen:0, phosphorus:0, potassium:0, moisture:0, temperature:0 };
    let count = 0;
    const issues = { acidic:0, alkaline:0, lowN:0, lowP:0, lowK:0, lowMoist:0 };
    const cropCounts = {};
    for(const r of rows){
      const s = rowToSoil(r);
      agg.ph += s.ph; agg.nitrogen += s.nitrogen; agg.phosphorus += s.phosphorus; agg.potassium += s.potassium; agg.moisture += s.moisture; agg.temperature += s.temperature;
      count++;
      if(s.ph < 5.5) issues.acidic++; else if(s.ph > 7.5) issues.alkaline++;
      if(s.nitrogen < 40) issues.lowN++;
      if(s.phosphorus < 20) issues.lowP++;
      if(s.potassium < 50) issues.lowK++;
      if(s.moisture < 20) issues.lowMoist++;
      const recs = predictCrops(r);
      for(const c of recs) cropCounts[c] = (cropCounts[c]||0)+1;
    }
    const avg = { ph: agg.ph/count, nitrogen: agg.nitrogen/count, phosphorus: agg.phosphorus/count, potassium: agg.potassium/count, moisture: agg.moisture/count, temperature: agg.temperature/count };
    const topCrops = Object.entries(cropCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c);
    return { count, avg, issues, topCrops, cropCounts };
  }

  // Validate if CSV has required soil columns
  function validateDataset(rows){
    if(!rows || !rows.length) return { valid: false, message: 'Dataset is empty.' };
    
    const firstRow = rows[0];
    const headers = Object.keys(firstRow).map(h => h.toLowerCase());
    
    // Check for at least some soil-related columns
    const hasPh = headers.some(h => h.includes('ph'));
    const hasNitrogen = headers.some(h => h.includes('nitrogen') || h.includes('n'));
    const hasPhosphorus = headers.some(h => h.includes('phosphorus') || h.includes('p'));
    const hasPotassium = headers.some(h => h.includes('potassium') || h.includes('k'));
    const hasMoisture = headers.some(h => h.includes('moisture') || h.includes('humidity') || h.includes('water'));
    
    // Check if at least 3 required fields are present
    const validColumns = [hasPh, hasNitrogen, hasPhosphorus, hasPotassium, hasMoisture].filter(Boolean).length;
    
    if(validColumns < 3){
      return { 
        valid: false, 
        message: 'This CSV file does not contain enough required soil data columns (pH, Nitrogen, Phosphorus, Potassium, Moisture). Please choose a different CSV file with proper soil data.' 
      };
    }
    
    return { valid: true };
  }

  async function loadDatasetForStudent(){
    if(!selectedFile) { setError('No dataset selected'); return; }
    setError(null);
    try{
      const resp = await fetch(`/api/admin/dataset?file=${encodeURIComponent(selectedFile)}`);
      if(!resp.ok){
        const body = await resp.text().catch(()=>null);
        console.error('Failed to fetch dataset:', resp.status, body);
        setError(`Failed to load dataset (status ${resp.status}).`);
        return;
      }
      const text = await resp.text();
      console.log('Loaded dataset length:', text.length, 'first200:', text.slice(0,200));
      const parsed = parseCsv(text);
      if(!parsed || !parsed.length){
        console.warn('CSV parsed to zero rows — check header/formatting');
        setError('Dataset parsed to 0 rows. Check the CSV has a header row and at least one data row. Please choose a different CSV file.');
        setReport(null);
        setPredictions([]);
        setPreviewRows([]);
        return;
      }
      
      // Validate dataset has required columns
      const validation = validateDataset(parsed);
      if(!validation.valid){
        setError(validation.message);
        setReport(null);
        setPredictions([]);
        setPreviewRows([]);
        return;
      }
      
      // compute dataset report and average soil
      const rep = datasetReport(parsed);
      setReport(rep);
      // store a small preview (first 5 rows)
      setPreviewRows(parsed.slice(0,5));
      // compute average soil and set gauges
      setSoil(rep ? rep.avg : rowToSoil(parsed[0]));
      // compute per-row predictions (for quickstats)
      const preds = parsed.map(r => predictCrops(r));
      setPredictions(preds);
      // Notify parent that dataset is loaded
      if (onDatasetLoaded) onDatasetLoaded();
    } catch (e) { console.error(e); setError('Error loading dataset — see console for details'); }
  }

  return React.createElement('div', { className: 'dashboard-page' },
    React.createElement('div', { className: 'admin-panel user-panel' },
      // Dataset selector at top
      React.createElement('div', { className: 'card', style: { marginBottom: 16 } },
        React.createElement('div', { className: 'card-header' }, 'Available Datasets'),
        React.createElement('div', { style: { padding: 8 } },
          React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            React.createElement('select', { value: selectedFile || '', onChange: (e) => { const f = e.target.value; setSelectedFile(f); setReport(null); setPredictions([]); } },
              React.createElement('option', { value: '' }, '-- Select a dataset --'),
              datasets.map(d => React.createElement('option', { key: d.file, value: d.file }, d.originalName || d.file))
            ),
            React.createElement('button', { className: 'btn', onClick: () => { if (selectedFile) loadDatasetForStudent(); } }, 'Load')
          )
        )
      ),
      
      // Visual components section (similar to farmer dashboard)
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' } },
        React.createElement(SoilGauges, { soil: soil }),
        React.createElement('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
          React.createElement('div', { style: { flex: '1 1 400px' } },
            React.createElement(QuickStats, {
              analyses: analyses,
              predictions: predictions
            })
          ),
          React.createElement('div', { style: { flex: '0 1 300px' } },
            React.createElement(WeatherWidget)
          )
        )
      ),
      
      // Dataset analysis results section
      React.createElement('div', { className: 'visual-row' },
        // left column: error or empty space
        React.createElement('div', { style: { flex: '1 1 700px' } },
          error ? React.createElement('div', { className: 'card', style: { background: '#ffe6e6', color: '#6b0000' } },
            React.createElement('div', { className: 'card-header' }, 'Error'),
            React.createElement('div', { style: { padding: 8 } }, String(error))
          ) : null
        ),

        // right column: dataset analysis and preview
        React.createElement('div', { className: 'side-widgets' },
          report ? React.createElement('div', { className: 'card', style: { marginTop: 0, background: '#fffbe6' } },
            React.createElement('div', { className: 'card-header' }, 'Dataset Analysis'),
            React.createElement('div', { style: { padding: 8 } },
              React.createElement('div', null, `Rows: ${report.count}`),
              React.createElement('div', null, `Avg pH: ${report.avg.ph.toFixed(2)}`),
              React.createElement('div', null, `Avg N: ${report.avg.nitrogen.toFixed(1)}`),
              React.createElement('div', null, `Avg P: ${report.avg.phosphorus.toFixed(1)}`),
              React.createElement('div', null, `Avg K: ${report.avg.potassium.toFixed(1)}`),
              React.createElement('div', { style: { marginTop: 6, fontWeight: 600 } }, `Top crops: ${report.topCrops.join(', ')}`)
            )
          ) : null,
          // preview table
          previewRows && previewRows.length ? React.createElement('div', { className: 'card', style: { marginTop: 12 } },
            React.createElement('div', { className: 'card-header' }, 'Preview (first 5 rows)'),
            React.createElement('div', { style: { padding: 8, overflowX: 'auto' } },
              (() => {
                const headers = Object.keys(previewRows[0] || {});
                return React.createElement('table', { className: 'preview-table' },
                  React.createElement('thead', null, React.createElement('tr', null, headers.map(h => React.createElement('th', { key: h }, h)))),
                  React.createElement('tbody', null, previewRows.map((r,i) => React.createElement('tr', { key: i }, headers.map(h => React.createElement('td', { key: h }, String(r[h]===undefined ? '' : r[h]).slice(0,60))))))
                );
              })()
            )
          ) : null
        )
      )
    )
  );
}
