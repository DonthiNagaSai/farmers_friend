import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import BackButton from '../components/BackButton';

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

export default function AnalystDashboard({onDatasetLoaded, clearDatasetTrigger}){
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(0);
  const fileInputRef = React.useRef(null);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [datasets, setDatasets] = useState([]); // Available datasets
  const [selectedDataset, setSelectedDataset] = useState(null); // Selected dataset from list
  
  // NEW: Interactive Features State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [showInsights, setShowInsights] = useState(true);
  const [filters, setFilters] = useState({
    phMin: 0, phMax: 14,
    nMin: 0, nMax: 200,
    pMin: 0, pMax: 200,
    kMin: 0, kMax: 200
  });

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

  // Effect to clear dataset when triggered from parent (clearDatasetTrigger counter changes)
  React.useEffect(() => {
    if (clearDatasetTrigger > 0) {
      setData([]);
      setMessage('');
      setPendingUpload(null);
      setSelected(0);
      setSelectedDataset(null); // Clear selected dataset
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [clearDatasetTrigger]);

  function logout(){
    try { sessionStorage.removeItem('auth'); } catch(e){}
    try { localStorage.removeItem('ff_token'); } catch(e){}
    navigate('/login');
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

  async function handleFile(e){
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    
    // Validate dataset has required columns
    const validation = validateDataset(parsed);
    if(!validation.valid){
      setMessage(validation.message);
      setData([]);
      setPendingUpload(null);
      return;
    }
    
    setData(parsed);
    setMessage(`Loaded ${parsed.length} rows from uploaded file`);
    // also offer to save dataset to server for admin datasets list
    setPendingUpload({ filename: f.name, raw: text });
    setSelectedDataset(null); // Clear selected dataset when uploading a file
    // Notify parent that dataset is loaded
    if (onDatasetLoaded) onDatasetLoaded();
  }

  async function loadDatasetFromServer(){
    if(!selectedDataset) { 
      setMessage('No dataset selected'); 
      return; 
    }
    setMessage('Loading dataset...');
    try{
      const resp = await fetch(`/api/admin/dataset?file=${encodeURIComponent(selectedDataset)}`);
      if(!resp.ok){
        const body = await resp.text().catch(()=>null);
        console.error('Failed to fetch dataset:', resp.status, body);
        setMessage(`Failed to load dataset (status ${resp.status}).`);
        return;
      }
      const text = await resp.text();
      const parsed = parseCsv(text);
      if(!parsed || !parsed.length){
        console.warn('CSV parsed to zero rows');
        setMessage('Dataset parsed to 0 rows. Check the CSV has a header row and at least one data row. Please choose a different CSV file.');
        setData([]);
        return;
      }
      
      // Validate dataset has required columns
      const validation = validateDataset(parsed);
      if(!validation.valid){
        setMessage(validation.message);
        setData([]);
        return;
      }
      
      setData(parsed);
      setMessage(`Loaded ${parsed.length} rows from dataset`);
      setPendingUpload(null); // Clear pending upload when loading from server
      // Notify parent that dataset is loaded
      if (onDatasetLoaded) onDatasetLoaded();
    } catch (e) { 
      console.error(e); 
      setMessage('Error loading dataset — see console for details'); 
    }
  }

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
      ph: row.ph || row.pH || row.Ph || row['pH'] || row['PH'] || row['Ph'] || row['soil_ph'] || row['pH_Value'] || row['pH_value'] || row['ph_value'],
      nitrogen: row.nitrogen || row.Nitrogen || row.n || row.N || row['nitro'] || row['nitrogen_ppm'],
      phosphorus: row.phosphorus || row.Phosphorus || row.p || row.P || row['phosphorus_ppm'],
      potassium: row.potassium || row.Potassium || row.k || row.K || row['potash'] || row['potassium_ppm'],
      moisture: row.moisture || row.moist || row.Moisture || row['water'] || row.Humidity || row.humidity,
      temperature: row.temperature || row.Temperature || row.temp || row.Temp || row['soil_temp'] || row['soil_temperature'] || row['Temperature'] || row['TEMPERATURE']
    };
    return {
      ph: safeNum(map.ph),
      nitrogen: safeNum(map.nitrogen),
      phosphorus: safeNum(map.phosphorus),
      potassium: safeNum(map.potassium),
      moisture: safeNum(map.moisture),
      temperature: safeNum(map.temperature)
    };
  }

  function datasetReport(rows){
    if(!rows || !rows.length) return null;
    const agg = { ph:0, nitrogen:0, phosphorus:0, potassium:0, moisture:0, temperature:0 };
    let count = 0;
    const issues = { acidic:0, alkaline:0, lowN:0, lowP:0, lowK:0, lowMoist:0 };
    const cropCounts = {};
    for(const r of rows){
      const s = rowToSoil(r);
      agg.ph += s.ph; 
      agg.nitrogen += s.nitrogen; 
      agg.phosphorus += s.phosphorus; 
      agg.potassium += s.potassium; 
      agg.moisture += s.moisture;
      agg.temperature += s.temperature;
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
    const avg = { 
      ph: agg.ph/count, 
      nitrogen: agg.nitrogen/count, 
      phosphorus: agg.phosphorus/count, 
      potassium: agg.potassium/count, 
      moisture: agg.moisture/count,
      temperature: agg.temperature/count
    };
    const topCrops = Object.entries(cropCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c);
    return { count, avg, issues, topCrops, cropCounts };
  }

  // Calculate Dataset Health Score
  function calculateHealthScore(rows, report){
    if(!rows || !rows.length || !report) return null;
    
    let nutrientScore = 100;
    let phScore = 100;
    let completenessScore = 100;
    
    // Nutrient Balance Score (check if averages are in good ranges)
    const { avg } = report;
    if(avg.nitrogen < 40 || avg.nitrogen > 150) nutrientScore -= 20;
    if(avg.phosphorus < 20 || avg.phosphorus > 100) nutrientScore -= 20;
    if(avg.potassium < 50 || avg.potassium > 150) nutrientScore -= 20;
    if(avg.moisture < 20 || avg.moisture > 80) nutrientScore -= 20;
    
    // pH Stability Score (check variance and issues)
    const phIssuePercent = ((report.issues.acidic + report.issues.alkaline) / report.count) * 100;
    phScore = Math.max(0, 100 - phIssuePercent);
    
    // Calculate pH variance
    let phVariance = 0;
    const avgPh = avg.ph;
    rows.forEach(r => {
      const s = rowToSoil(r);
      phVariance += Math.pow(s.ph - avgPh, 2);
    });
    phVariance = phVariance / rows.length;
    if(phVariance > 1) phScore -= 20;
    if(phVariance > 2) phScore -= 20;
    
    // Data Completeness Score (check for missing/zero values)
    let missingCount = 0;
    rows.forEach(r => {
      const s = rowToSoil(r);
      if(s.ph === 0) missingCount++;
      if(s.nitrogen === 0) missingCount++;
      if(s.phosphorus === 0) missingCount++;
      if(s.potassium === 0) missingCount++;
    });
    const missingPercent = (missingCount / (rows.length * 4)) * 100;
    completenessScore = Math.max(0, 100 - missingPercent * 2);
    
    // Overall score (weighted average)
    const overall = Math.round((nutrientScore * 0.4 + phScore * 0.4 + completenessScore * 0.2));
    
    return {
      overall: Math.max(0, Math.min(100, overall)),
      nutrient: Math.max(0, Math.min(100, Math.round(nutrientScore))),
      ph: Math.max(0, Math.min(100, Math.round(phScore))),
      completeness: Math.max(0, Math.min(100, Math.round(completenessScore)))
    };
  }

  function generateInsights(rows, report) {
    if(!rows || !rows.length || !report) return [];
    
    const insights = [];
    
    // Nutrient insights
    if(report.avg.nitrogen < 20) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Low Nitrogen Levels',
        message: `Average nitrogen is ${report.avg.nitrogen.toFixed(1)} mg/kg. Consider nitrogen-rich fertilizers or legume rotation.`,
        priority: 'high'
      });
    } else if(report.avg.nitrogen > 140) {
      insights.push({
        type: 'info',
        icon: 'ℹ️',
        title: 'High Nitrogen Levels',
        message: `Average nitrogen is ${report.avg.nitrogen.toFixed(1)} mg/kg. Excellent for leafy crops like rice and maize.`,
        priority: 'medium'
      });
    }
    
    if(report.avg.phosphorus < 10) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Low Phosphorus Levels',
        message: `Average phosphorus is ${report.avg.phosphorus.toFixed(1)} mg/kg. Add phosphate fertilizers for better root development.`,
        priority: 'high'
      });
    }
    
    if(report.avg.potassium < 20) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Low Potassium Levels',
        message: `Average potassium is ${report.avg.potassium.toFixed(1)} mg/kg. Consider potash fertilizers for disease resistance.`,
        priority: 'high'
      });
    }
    
    // pH insights
    if(report.avg.ph < 5.5) {
      insights.push({
        type: 'warning',
        icon: '🧪',
        title: 'Acidic Soil Detected',
        message: `Average pH is ${report.avg.ph.toFixed(2)}. Lime application recommended to neutralize acidity. Best for: blueberries, potatoes.`,
        priority: 'high'
      });
    } else if(report.avg.ph > 8.5) {
      insights.push({
        type: 'warning',
        icon: '🧪',
        title: 'Alkaline Soil Detected',
        message: `Average pH is ${report.avg.ph.toFixed(2)}. Sulfur or organic matter can help lower pH. Best for: asparagus, cabbage.`,
        priority: 'high'
      });
    } else if(report.avg.ph >= 6.0 && report.avg.ph <= 7.5) {
      insights.push({
        type: 'success',
        icon: '✅',
        title: 'Optimal pH Range',
        message: `pH of ${report.avg.ph.toFixed(2)} is ideal for most crops. Excellent conditions for diverse agriculture.`,
        priority: 'low'
      });
    }
    
    // Temperature insights
    if(report.avg.temperature > 35) {
      insights.push({
        type: 'info',
        icon: '🌡️',
        title: 'High Temperature Zone',
        message: `Average temperature is ${report.avg.temperature.toFixed(1)}°C. Consider heat-tolerant crops: cotton, millet, watermelon.`,
        priority: 'medium'
      });
    } else if(report.avg.temperature < 15) {
      insights.push({
        type: 'info',
        icon: '❄️',
        title: 'Cool Climate Zone',
        message: `Average temperature is ${report.avg.temperature.toFixed(1)}°C. Ideal for: wheat, barley, apples, grapes.`,
        priority: 'medium'
      });
    }
    
    // Crop diversity insight
    if(report.topCrops && report.topCrops.length >= 5) {
      insights.push({
        type: 'success',
        icon: '🌾',
        title: 'High Crop Diversity',
        message: `Dataset shows potential for ${report.topCrops.length} different crops. Excellent for crop rotation strategies.`,
        priority: 'low'
      });
    }
    
    // Data quality insight
    const healthScore = calculateHealthScore(rows, report);
    if(healthScore.completeness < 80) {
      insights.push({
        type: 'warning',
        icon: '📊',
        title: 'Data Quality Issues',
        message: `${Math.round(100 - healthScore.completeness)}% of data may have missing values. Verify sensor calibration.`,
        priority: 'high'
      });
    }
    
    // Sort by priority
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return insights;
  }

  function detectAnomalies(rows) {
    if(!rows || !rows.length) return [];
    
    const anomalies = [];
    
    // Calculate statistics for outlier detection
    const values = {
      ph: rows.map(r => rowToSoil(r).ph),
      nitrogen: rows.map(r => rowToSoil(r).nitrogen),
      phosphorus: rows.map(r => rowToSoil(r).phosphorus),
      potassium: rows.map(r => rowToSoil(r).potassium),
      temperature: rows.map(r => rowToSoil(r).temperature),
      moisture: rows.map(r => rowToSoil(r).moisture)
    };
    
    // Calculate mean and standard deviation for each parameter
    const stats = {};
    Object.keys(values).forEach(key => {
      const arr = values[key];
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
      const stdDev = Math.sqrt(variance);
      stats[key] = { mean, stdDev };
    });
    
    // Scan for anomalies
    rows.forEach((row, idx) => {
      const soil = rowToSoil(row);
      const rowNum = idx + 1;
      
      // Check for extreme pH values
      if(soil.ph < 3) {
        anomalies.push({
          rowNum,
          type: 'extreme',
          severity: 'high',
          field: 'pH',
          value: soil.ph,
          message: `Extremely acidic pH (${soil.ph.toFixed(2)}) - May be sensor error or contamination`
        });
      } else if(soil.ph > 10) {
        anomalies.push({
          rowNum,
          type: 'extreme',
          severity: 'high',
          field: 'pH',
          value: soil.ph,
          message: `Extremely alkaline pH (${soil.ph.toFixed(2)}) - Check sensor calibration`
        });
      }
      
      // Check for impossible nutrient values
      if(soil.nitrogen > 200) {
        anomalies.push({
          rowNum,
          type: 'extreme',
          severity: 'high',
          field: 'Nitrogen',
          value: soil.nitrogen,
          message: `Unusually high nitrogen (${soil.nitrogen.toFixed(1)}) - Verify measurement`
        });
      }
      
      if(soil.phosphorus > 150) {
        anomalies.push({
          rowNum,
          type: 'extreme',
          severity: 'medium',
          field: 'Phosphorus',
          value: soil.phosphorus,
          message: `High phosphorus (${soil.phosphorus.toFixed(1)}) - May indicate over-fertilization`
        });
      }
      
      if(soil.potassium > 250) {
        anomalies.push({
          rowNum,
          type: 'extreme',
          severity: 'medium',
          field: 'Potassium',
          value: soil.potassium,
          message: `High potassium (${soil.potassium.toFixed(1)}) - Check fertilizer application`
        });
      }
      
      // Check for impossible temperature values
      if(soil.temperature > 60 || soil.temperature < -20) {
        anomalies.push({
          rowNum,
          type: 'extreme',
          severity: 'high',
          field: 'Temperature',
          value: soil.temperature,
          message: `Impossible temperature (${soil.temperature.toFixed(1)}°C) - Sensor malfunction likely`
        });
      }
      
      // Statistical outlier detection (3 sigma rule)
      Object.keys(stats).forEach(key => {
        const val = soil[key];
        const { mean, stdDev } = stats[key];
        const zScore = Math.abs((val - mean) / stdDev);
        
        if(zScore > 3 && val > 0) { // More than 3 standard deviations and not zero
          anomalies.push({
            rowNum,
            type: 'outlier',
            severity: 'low',
            field: key.charAt(0).toUpperCase() + key.slice(1),
            value: val,
            message: `Statistical outlier (${val.toFixed(1)}) - ${zScore.toFixed(1)}σ from mean`
          });
        }
      });
      
      // Check for zero/missing values
      if(soil.ph === 0 || soil.nitrogen === 0 || soil.phosphorus === 0 || soil.potassium === 0) {
        anomalies.push({
          rowNum,
          type: 'missing',
          severity: 'medium',
          field: 'Multiple',
          value: 0,
          message: `Missing or zero values detected - Data may be incomplete`
        });
      }
    });
    
    // Sort by severity
    const severityOrder = { high: 1, medium: 2, low: 3 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    return anomalies;
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
    lines.push(`  Temperature: ${report.avg.temperature.toFixed(1)}°C`);
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
  const healthScore = calculateHealthScore(data, report);
  const insights = generateInsights(data, report);
  const anomalies = detectAnomalies(data);
  
  // Apply filters to data
  const filteredData = data.filter(row => {
    const soil = rowToSoil(row);
    if(soil.ph < filters.phMin || soil.ph > filters.phMax) return false;
    if(soil.nitrogen < filters.nMin || soil.nitrogen > filters.nMax) return false;
    if(soil.phosphorus < filters.pMin || soil.phosphorus > filters.pMax) return false;
    if(soil.potassium < filters.kMin || soil.potassium > filters.kMax) return false;
    return true;
  });

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
      React.createElement('div', {className:'admin-panel user-panel'},
        React.createElement('div', {className:'dataset-panel-main'},
          // Dataset selector section
          React.createElement('div', { className: 'card', style: { marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } },
            React.createElement('div', { className: 'card-header', style: { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontSize: 16, fontWeight: 600 } }, '📁 Load Dataset from Server'),
            React.createElement('div', { style: { padding: 16 } },
              React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'center' } },
                React.createElement('select', { 
                  value: selectedDataset || '', 
                  onChange: (e) => { 
                    const f = e.target.value; 
                    setSelectedDataset(f); 
                    setMessage(''); 
                  },
                  style: {
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    outline: 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }
                },
                  React.createElement('option', { value: '' }, '-- Select a dataset --'),
                  datasets.map(d => React.createElement('option', { key: d.file, value: d.file }, d.originalName || d.file))
                ),
                React.createElement('button', { 
                  className: 'btn', 
                  onClick: () => { if (selectedDataset) loadDatasetFromServer(); },
                  style: {
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  },
                  onMouseOver: (e) => e.target.style.transform = 'translateY(-2px)',
                  onMouseOut: (e) => e.target.style.transform = 'translateY(0)'
                }, '📥 Load Dataset')
              )
            )
          ),
          // Upload section
          React.createElement('div', { className: 'card', style: { marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } },
            React.createElement('div', { className: 'card-header', style: { background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', color: 'white', fontSize: 16, fontWeight: 600 } }, '📤 Or Upload New CSV File'),
            React.createElement('div', { style: { padding: 16 } },
              React.createElement('div', {style: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }},
                React.createElement('input', {
                  type:'file', 
                  accept:'.csv', 
                  onChange: handleFile, 
                  ref: fileInputRef,
                  style: {
                    flex: '1 1 200px',
                    padding: '8px',
                    border: '2px dashed #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }
                }),
                React.createElement('button', {
                  className:'btn', 
                  onClick: downloadCsv,
                  style: {
                    padding: '10px 20px',
                    background: '#10b981',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }
                }, '💾 Export CSV'),
                pendingUpload ? React.createElement('button', {
                  className:'btn', 
                  onClick: saveDatasetToServer,
                  style: {
                    padding: '10px 20px',
                    background: '#059669',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }
                }, '💾 Save to Server') : null
              )
            )
          ),
          message ? React.createElement('div', {
            className:'muted', 
            style: {
              padding: 12, 
              marginBottom: 16, 
              background: '#fef3c7', 
              border: '1px solid #fbbf24',
              borderRadius: 8,
              fontSize: 14
            }
          }, message) : null,
          data && data.length ? React.createElement('div', {
            className:'card', 
            style:{
              marginTop:20, 
              marginBottom: 20,
              background:'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              border: '2px solid #e5e7eb'
            }
          },
            React.createElement('div', {
              className:'card-header', 
              style:{
                display:'flex', 
                justifyContent:'space-between', 
                alignItems:'center',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontSize: 16,
                fontWeight: 600,
                padding: 14
              }
            },
              React.createElement('span', null, '🎛️ Interactive Filters'),
              React.createElement('button', {
                className:'btn',
                style:{
                  fontSize:13, 
                  padding:'6px 14px',
                  background: 'white',
                  color: '#10b981',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                },
                onClick: () => setFilters({
                  phMin: 0, phMax: 14,
                  nMin: 0, nMax: 200,
                  pMin: 0, pMax: 200,
                  kMin: 0, kMax: 200
                })
              }, '🔄 Reset All')
            ),
            React.createElement('div', {style:{padding:16}},
              React.createElement('div', {style:{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}},
                // pH Filter
                React.createElement('div', {
                  style:{
                    padding: 12,
                    background: 'white',
                    borderRadius: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                  }
                },
                  React.createElement('label', {
                    style:{
                      fontSize:14, 
                      fontWeight:700, 
                      display:'block', 
                      marginBottom:8,
                      color: '#374151'
                    }
                  }, `🧪 pH: ${filters.phMin.toFixed(1)} - ${filters.phMax.toFixed(1)}`),
                  React.createElement('div', {style:{display:'flex', gap:8, alignItems:'center'}},
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Min'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:14, step:0.1,
                      value:filters.phMin,
                      onChange:(e) => setFilters({...filters, phMin: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#10b981'
                      }
                    }),
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Max'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:14, step:0.1,
                      value:filters.phMax,
                      onChange:(e) => setFilters({...filters, phMax: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#10b981'
                      }
                    })
                  )
                ),
                // Nitrogen Filter
                React.createElement('div', {
                  style:{
                    padding: 12,
                    background: 'white',
                    borderRadius: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                  }
                },
                  React.createElement('label', {
                    style:{
                      fontSize:14, 
                      fontWeight:700, 
                      display:'block', 
                      marginBottom:8,
                      color: '#374151'
                    }
                  }, `🌱 N: ${filters.nMin.toFixed(0)} - ${filters.nMax.toFixed(0)} mg/kg`),
                  React.createElement('div', {style:{display:'flex', gap:8, alignItems:'center'}},
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Min'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:200, step:1,
                      value:filters.nMin,
                      onChange:(e) => setFilters({...filters, nMin: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#10b981'
                      }
                    }),
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Max'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:200, step:1,
                      value:filters.nMax,
                      onChange:(e) => setFilters({...filters, nMax: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#10b981'
                      }
                    })
                  )
                ),
                // Phosphorus Filter
                React.createElement('div', {
                  style:{
                    padding: 12,
                    background: 'white',
                    borderRadius: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                  }
                },
                  React.createElement('label', {
                    style:{
                      fontSize:14, 
                      fontWeight:700, 
                      display:'block', 
                      marginBottom:8,
                      color: '#374151'
                    }
                  }, `🔶 P: ${filters.pMin.toFixed(0)} - ${filters.pMax.toFixed(0)} mg/kg`),
                  React.createElement('div', {style:{display:'flex', gap:8, alignItems:'center'}},
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Min'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:200, step:1,
                      value:filters.pMin,
                      onChange:(e) => setFilters({...filters, pMin: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#34d399'
                      }
                    }),
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Max'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:200, step:1,
                      value:filters.pMax,
                      onChange:(e) => setFilters({...filters, pMax: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#34d399'
                      }
                    })
                  )
                ),
                // Potassium Filter
                React.createElement('div', {
                  style:{
                    padding: 12,
                    background: 'white',
                    borderRadius: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                  }
                },
                  React.createElement('label', {
                    style:{
                      fontSize:14, 
                      fontWeight:700, 
                      display:'block', 
                      marginBottom:8,
                      color: '#374151'
                    }
                  }, `🔷 K: ${filters.kMin.toFixed(0)} - ${filters.kMax.toFixed(0)} mg/kg`),
                  React.createElement('div', {style:{display:'flex', gap:8, alignItems:'center'}},
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Min'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:200, step:1,
                      value:filters.kMin,
                      onChange:(e) => setFilters({...filters, kMin: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#059669'
                      }
                    }),
                    React.createElement('span', {style:{fontSize:11, color:'#6b7280'}}, 'Max'),
                    React.createElement('input', {
                      type:'range',
                      min:0, max:200, step:1,
                      value:filters.kMax,
                      onChange:(e) => setFilters({...filters, kMax: parseFloat(e.target.value)}),
                      style:{
                        flex:1,
                        accentColor: '#059669'
                      }
                    })
                  )
                )
              ),
              React.createElement('div', {
                style:{
                  marginTop:16, 
                  padding:14, 
                  background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  borderRadius:8, 
                  textAlign:'center', 
                  fontWeight:700,
                  color: 'white',
                  fontSize: 15,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }
              },
                `📊 Showing ${filteredData.length} of ${data.length} rows ${filteredData.length < data.length ? `(${data.length - filteredData.length} filtered)` : '✓ All rows visible'}`
              )
            )
          ) : null,
          data && data.length ? React.createElement('div', {style: {marginTop: 20}},
            React.createElement('div', {
              style: {
                display:'flex', 
                gap:12, 
                alignItems:'center', 
                marginBottom:16,
                padding:16,
                background:'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                borderRadius:10,
                boxShadow:'0 2px 8px rgba(0,0,0,0.1)'
              }
            },
              React.createElement('div', {style:{fontSize:18, fontWeight:700, color:'#374151'}}, `📋 ${data.length} Total Rows`),
              React.createElement('div', {style: {marginLeft:'auto', display:'flex', gap:8}}, 
                React.createElement('button', {
                  className:'btn', 
                  onClick: () => { setSelected(0); },
                  style:{
                    padding:'8px 16px',
                    background:'#10b981',
                    border:'none',
                    borderRadius:6,
                    color:'white',
                    fontWeight:600,
                    cursor:'pointer'
                  }
                }, '⬆️ First Row'), 
                React.createElement('button', {
                  className:'btn', 
                  onClick: () => downloadReport(data),
                  style:{
                    padding:'8px 16px',
                    background:'#3b82f6',
                    border:'none',
                    borderRadius:6,
                    color:'white',
                    fontWeight:600,
                    cursor:'pointer'
                  }
                }, '📥 Download Report'))
            ),
            React.createElement('div', {style: {display:'flex', gap:16, marginTop:8}},
              React.createElement('div', {style: {flex:'1 1 350px'}},
                React.createElement('div', {
                  className:'card',
                  style: {
                    background:'white',
                    borderRadius:12,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
                    overflow:'hidden'
                  }
                },
                  React.createElement('div', {
                    className:'card-header',
                    style:{
                      background:'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                      color:'white',
                      padding:12,
                      fontWeight:700,
                      fontSize:15
                    }
                  }, '📜 Dataset Rows'),
                  React.createElement('div', {style: {maxHeight: 320, overflow:'auto', padding:10}},
                  filteredData.map((row, idx) => {
                    const actualIdx = data.indexOf(row);
                    return React.createElement('div', {
                    key: actualIdx, 
                    style: {
                      padding:10, 
                      marginBottom:8,
                      cursor:'pointer', 
                      background: actualIdx===selected? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : 'white',
                      borderRadius: 8,
                      border: actualIdx===selected ? '2px solid #10b981' : '1px solid #e5e7eb',
                      transition: 'all 0.2s',
                      boxShadow: actualIdx===selected ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
                    }, 
                    onClick: () => setSelected(actualIdx),
                    onDoubleClick: () => {
                      setDetailRow(row);
                      setShowDetailModal(true);
                    }
                  },
                    React.createElement('div', {style:{fontWeight:700, fontSize:14, color:'#1f2937', marginBottom:4}}, row.name || row.id || `Row ${actualIdx+1}`),
                    React.createElement('div', {style:{fontSize:12, color:'#6b7280'}}, Object.keys(row).slice(0,4).map(k=>`${k}:${row[k]}`).join(' • '))
                  );
                  })
                )
                )
              ),
              React.createElement('div', {style: {flex:'1 1 500px'}},
                React.createElement('div', {
                  className:'card',
                  style:{
                    marginTop:0,
                    background:'white',
                    borderRadius:12,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
                    overflow:'hidden'
                  }
                },
                  React.createElement('div', {
                    className:'card-header',
                    style:{
                      background:'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color:'white',
                      padding:12,
                      fontWeight:700,
                      fontSize:15
                    }
                  }, '🔬 Soil Analysis'),
                  React.createElement('div', {style:{padding:14, fontSize:14, lineHeight:1.6}}, data.length ? analyzeRow(data[selected]) : 'No data')
                ),
                React.createElement('button', {
                  className:'btn', 
                  style:{
                    marginTop:12, 
                    width:'100%',
                    padding:'12px',
                    background:'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                    border:'none',
                    borderRadius:8,
                    color:'white',
                    fontWeight:700,
                    fontSize:15,
                    cursor:'pointer',
                    transition:'transform 0.2s',
                    boxShadow:'0 4px 12px rgba(52, 211, 153, 0.4)'
                  },
                  onMouseOver: (e) => e.target.style.transform = 'translateY(-2px)',
                  onMouseOut: (e) => e.target.style.transform = 'translateY(0)',
                  onClick: () => {
                    if(data.length) {
                      setDetailRow(data[selected]);
                      setShowDetailModal(true);
                    }
                  }
                }, '🔍 View Detailed Analysis'),
                React.createElement('div', {
                  className:'card',
                  style:{
                    marginTop:12,
                    background:'white',
                    borderRadius:12,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
                    overflow:'hidden'
                  }
                },
                  React.createElement('div', {
                    className:'card-header',
                    style:{
                      background:'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)',
                      color:'#1f2937',
                      padding:12,
                      fontWeight:700,
                      fontSize:15
                    }
                  }, '🌾 Recommended Crops'),
                  React.createElement('div', {style:{padding:14, fontSize:14, fontWeight:600, color:'#059669'}}, data.length ? predictCrops(data[selected]).join(', ') : 'No data')
                )
                , report ? React.createElement('div', {
                  className:'card', 
                  style:{
                    marginTop:12, 
                    background:'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                    borderRadius:12,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
                    overflow:'hidden',
                    border:'2px solid #10b981'
                  }
                },
                  React.createElement('div', {
                    className:'card-header',
                    style:{
                      background:'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color:'white',
                      padding:12,
                      fontWeight:700,
                      fontSize:15
                    }
                  }, '📊 Dataset Statistics'),
                  React.createElement('div', {style:{padding:14}},
                    React.createElement('div', {style:{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}},
                      React.createElement('div', {style:{fontSize:13, color:'#374151'}}, 
                        React.createElement('span', {style:{fontWeight:700}}, '📈 Rows: '), 
                        React.createElement('span', {style:{fontWeight:600, color:'#059669'}}, report.count)
                      ),
                      React.createElement('div', {style:{fontSize:13, color:'#374151'}}, 
                        React.createElement('span', {style:{fontWeight:700}}, '🧪 Avg pH: '), 
                        React.createElement('span', {style:{fontWeight:600, color:'#0ea5e9'}}, report.avg.ph.toFixed(2))
                      ),
                      React.createElement('div', {style:{fontSize:13, color:'#374151'}}, 
                        React.createElement('span', {style:{fontWeight:700}}, '🌱 Avg N: '), 
                        React.createElement('span', {style:{fontWeight:600, color:'#10b981'}}, `${report.avg.nitrogen.toFixed(1)} mg/kg`)
                      ),
                      React.createElement('div', {style:{fontSize:13, color:'#374151'}}, 
                        React.createElement('span', {style:{fontWeight:700}}, '🔶 Avg P: '), 
                        React.createElement('span', {style:{fontWeight:600, color:'#f59e0b'}}, `${report.avg.phosphorus.toFixed(1)} mg/kg`)
                      ),
                      React.createElement('div', {style:{fontSize:13, color:'#374151'}}, 
                        React.createElement('span', {style:{fontWeight:700}}, '🔷 Avg K: '), 
                        React.createElement('span', {style:{fontWeight:600, color:'#3b82f6'}}, `${report.avg.potassium.toFixed(1)} mg/kg`)
                      ),
                      React.createElement('div', {style:{fontSize:13, color:'#374151'}}, 
                        React.createElement('span', {style:{fontWeight:700}}, '🌡️ Avg Temp: '), 
                        React.createElement('span', {style:{fontWeight:600, color:'#ef4444'}}, `${report.avg.temperature.toFixed(1)}°C`)
                      )
                    ),
                    React.createElement('div', {style:{marginTop:10, padding:8, background:'rgba(255,255,255,0.7)', borderRadius:6, fontSize:13, fontWeight:700, color:'#059669'}}, 
                      `🌾 Top Crops: ${report.topCrops.join(', ')}`
                    )
                  )
                ) : null
                , healthScore ? React.createElement('div', {
                  className:'card', 
                  style:{
                    marginTop:12, 
                    background:'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    borderRadius:12,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
                    overflow:'hidden',
                    border:'2px solid #34d399'
                  }
                },
                  React.createElement('div', {
                    className:'card-header',
                    style:{
                      background:'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                      color:'white',
                      padding:12,
                      fontWeight:700,
                      fontSize:15
                    }
                  }, '💯 Dataset Health Score'),
                  React.createElement('div', {style:{padding:14}},
                    // Overall score with circular progress
                    React.createElement('div', {style:{textAlign:'center', marginBottom:12}},
                      React.createElement('div', {style:{
                        width:80, 
                        height:80, 
                        borderRadius:'50%',
                        border:`6px solid ${healthScore.overall >= 80 ? '#22c55e' : healthScore.overall >= 60 ? '#eab308' : '#ef4444'}`,
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        margin:'0 auto',
                        fontSize:24,
                        fontWeight:700,
                        color: healthScore.overall >= 80 ? '#22c55e' : healthScore.overall >= 60 ? '#eab308' : '#ef4444'
                      }}, Math.round(healthScore.overall)),
                      React.createElement('div', {style:{marginTop:8, fontSize:14, fontWeight:600}}, 'Overall Quality')
                    ),
                    // Score breakdown
                    React.createElement('div', {style:{borderTop:'1px solid #e5e7eb', paddingTop:8}},
                      React.createElement('div', {style:{display:'flex', justifyContent:'space-between', padding:'4px 0'}},
                        React.createElement('span', null, '🌱 Nutrient Balance:'),
                        React.createElement('span', {style:{
                          fontWeight:600, 
                          color: healthScore.nutrient >= 80 ? '#22c55e' : healthScore.nutrient >= 60 ? '#eab308' : '#ef4444'
                        }}, `${Math.round(healthScore.nutrient)}/100`)
                      ),
                      React.createElement('div', {style:{display:'flex', justifyContent:'space-between', padding:'4px 0'}},
                        React.createElement('span', null, '⚗️ pH Stability:'),
                        React.createElement('span', {style:{
                          fontWeight:600, 
                          color: healthScore.ph >= 80 ? '#22c55e' : healthScore.ph >= 60 ? '#eab308' : '#ef4444'
                        }}, `${Math.round(healthScore.ph)}/100`)
                      ),
                      React.createElement('div', {style:{display:'flex', justifyContent:'space-between', padding:'4px 0'}},
                        React.createElement('span', null, '📊 Data Completeness:'),
                        React.createElement('span', {style:{
                          fontWeight:600, 
                          color: healthScore.completeness >= 80 ? '#22c55e' : healthScore.completeness >= 60 ? '#eab308' : '#ef4444'
                        }}, `${Math.round(healthScore.completeness)}/100`)
                      )
                    )
                  )
                ) : null
                , insights && insights.length > 0 ? React.createElement('div', {
                  className:'card', 
                  style:{
                    marginTop:12, 
                    background:'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    borderRadius:12,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
                    overflow:'hidden',
                    border:'2px solid #34d399'
                  }
                },
                  React.createElement('div', {
                    className:'card-header', 
                    style:{
                      display:'flex', 
                      justifyContent:'space-between', 
                      alignItems:'center', 
                      cursor:'pointer',
                      background:'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                      color:'white',
                      padding:12,
                      fontWeight:700,
                      fontSize:15,
                      transition:'all 0.2s'
                    },
                    onClick: () => setShowInsights(!showInsights)
                  }, 
                    React.createElement('span', null, `🤖 AI Insights (${insights.length})`),
                    React.createElement('span', {style:{fontSize:18, fontWeight:700}}, showInsights ? '▼' : '▶')
                  ),
                  showInsights ? React.createElement('div', {style:{padding:12}},
                    insights.map((insight, idx) => 
                      React.createElement('div', {
                        key: idx,
                        style:{
                          padding:12,
                          marginBottom:10,
                          borderRadius:8,
                          border: `2px solid ${
                            insight.type === 'warning' ? '#fbbf24' : 
                            insight.type === 'success' ? '#22c55e' : 
                            '#60a5fa'
                          }`,
                          background: `${
                            insight.type === 'warning' ? '#fef3c7' : 
                            insight.type === 'success' ? '#dcfce7' : 
                            '#dbeafe'
                          }`,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                          transition: 'all 0.2s'
                        }
                      },
                        React.createElement('div', {style:{fontWeight:700, marginBottom:6, fontSize:14, color:'#1f2937'}},
                          `${insight.icon} ${insight.title}`
                        ),
                        React.createElement('div', {style:{fontSize:13, lineHeight:1.5, color:'#374151'}}, insight.message)
                      )
                    )
                  ) : null
                ) : null
                , anomalies && anomalies.length > 0 ? React.createElement('div', {
                  className:'card', 
                  style:{
                    marginTop:12, 
                    background:'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderRadius:12,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.1)',
                    overflow:'hidden',
                    border:'2px solid #fbbf24'
                  }
                },
                  React.createElement('div', {
                    className:'card-header',
                    style:{
                      background:'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                      color:'white',
                      padding:12,
                      fontWeight:700,
                      fontSize:15
                    }
                  }, 
                    React.createElement('span', null, `⚠️ Anomalies Detected (${anomalies.length})`),
                  ),
                  React.createElement('div', {style:{padding:12, maxHeight:350, overflowY:'auto'}},
                    anomalies.slice(0, 20).map((anomaly, idx) => 
                      React.createElement('div', {
                        key: idx,
                        style:{
                          padding:10,
                          marginBottom:8,
                          borderRadius:8,
                          fontSize:13,
                          border: `2px solid ${
                            anomaly.severity === 'high' ? '#ef4444' : 
                            anomaly.severity === 'medium' ? '#f97316' : 
                            '#94a3b8'
                          }`,
                          background: `${
                            anomaly.severity === 'high' ? '#fee2e2' : 
                            anomaly.severity === 'medium' ? '#ffedd5' : 
                            '#f1f5f9'
                          }`,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                        },
                        onMouseOver: (e) => e.currentTarget.style.transform = 'translateX(4px)',
                        onMouseOut: (e) => e.currentTarget.style.transform = 'translateX(0)',
                        onClick: () => {
                          setSelected(anomaly.rowNum - 1);
                          setShowDetailModal(true);
                          setDetailRow(data[anomaly.rowNum - 1]);
                        }
                      },
                        React.createElement('div', {style:{display:'flex', justifyContent:'space-between', marginBottom:2}},
                          React.createElement('span', {style:{fontWeight:600}}, 
                            `Row ${anomaly.rowNum}: ${anomaly.field}`
                          ),
                          React.createElement('span', {
                            style:{
                              fontSize:10,
                              fontWeight:600,
                              padding:'2px 6px',
                              borderRadius:3,
                              background: anomaly.severity === 'high' ? '#dc2626' : 
                                         anomaly.severity === 'medium' ? '#ea580c' : '#64748b',
                              color: 'white'
                            }
                          }, anomaly.severity.toUpperCase())
                        ),
                        React.createElement('div', null, anomaly.message)
                      )
                    ),
                    anomalies.length > 20 ? React.createElement('div', {
                      style:{marginTop:8, fontSize:12, textAlign:'center', color:'#64748b'}
                    }, `Showing first 20 of ${anomalies.length} anomalies`) : null
                  )
                ) : null
              )
            )
          ) : null
        ),
        // Row Detail Modal
        showDetailModal && detailRow ? React.createElement('div', {
          style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          },
          onClick: () => setShowDetailModal(false)
        },
          React.createElement('div', {
            style: {
              background: 'white',
              borderRadius: 8,
              padding: 20,
              maxWidth: 700,
              maxHeight: '80vh',
              overflowY: 'auto',
              width: '90%'
            },
            onClick: (e) => e.stopPropagation()
          },
            React.createElement('div', {style: {display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}},
              React.createElement('h2', {style:{margin:0}}, `Detailed Soil Profile - Row ${data.indexOf(detailRow) + 1}`),
              React.createElement('button', {
                className:'btn',
                onClick: () => setShowDetailModal(false),
                style: {fontSize:20, padding:'4px 12px'}
              }, '×')
            ),
            
            // Soil parameters section
            React.createElement('div', {className:'card', style:{marginBottom:12}},
              React.createElement('div', {className:'card-header'}, '🌱 Soil Parameters'),
              React.createElement('div', {style:{padding:12}},
                React.createElement('div', {style:{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}},
                  ['pH', 'nitrogen', 'phosphorus', 'potassium', 'temperature', 'moisture', 'humidity', 'rainfall'].map(param => {
                    const soil = rowToSoil(detailRow);
                    const value = soil[param];
                    if(value === undefined) return null;
                    
                    // Determine status color
                    let status = 'normal';
                    let statusColor = '#22c55e';
                    if(param === 'ph') {
                      if(value < 5.5 || value > 7.5) { status = 'warning'; statusColor = '#eab308'; }
                      if(value < 4 || value > 9) { status = 'critical'; statusColor = '#ef4444'; }
                    } else if(['nitrogen', 'phosphorus', 'potassium'].includes(param)) {
                      if(value < 20) { status = 'low'; statusColor = '#ef4444'; }
                      else if(value > 140) { status = 'high'; statusColor = '#eab308'; }
                    }
                    
                    return React.createElement('div', {
                      key: param,
                      style:{
                        padding:8,
                        border:`2px solid ${statusColor}`,
                        borderRadius:6,
                        background:`${statusColor}15`
                      }
                    },
                      React.createElement('div', {style:{fontSize:11, color:'#64748b', textTransform:'uppercase'}}, param),
                      React.createElement('div', {style:{fontSize:20, fontWeight:700, color:statusColor}}, 
                        param === 'temperature' ? `${value.toFixed(1)}°C` : value.toFixed(2)
                      )
                    );
                  })
                )
              )
            ),
            
            // Analysis section
            React.createElement('div', {className:'card', style:{marginBottom:12}},
              React.createElement('div', {className:'card-header'}, '📊 Detailed Analysis'),
              React.createElement('div', {style:{padding:12, fontSize:14}}, analyzeRow(detailRow))
            ),
            
            // Crop recommendations with reasoning
            React.createElement('div', {className:'card', style:{marginBottom:12}},
              React.createElement('div', {className:'card-header'}, '🌾 Crop Recommendations & Reasoning'),
              React.createElement('div', {style:{padding:12}},
                predictCrops(detailRow).map((crop, idx) => {
                  const soil = rowToSoil(detailRow);
                  let reasoning = [];
                  
                  // Generate reasoning based on crop and soil conditions
                  if(['rice', 'maize', 'cotton'].includes(crop.toLowerCase())) {
                    if(soil.nitrogen > 60) reasoning.push('✓ High nitrogen content');
                    if(soil.ph >= 6 && soil.ph <= 7.5) reasoning.push('✓ Optimal pH range');
                    if(soil.moisture > 60) reasoning.push('✓ Good moisture levels');
                  }
                  if(['wheat', 'barley'].includes(crop.toLowerCase())) {
                    if(soil.temperature < 25) reasoning.push('✓ Cool climate suitable');
                    if(soil.phosphorus > 30) reasoning.push('✓ Adequate phosphorus');
                  }
                  if(crop.toLowerCase() === 'coffee') {
                    if(soil.ph >= 5.5 && soil.ph <= 6.5) reasoning.push('✓ Slightly acidic pH ideal');
                    if(soil.potassium > 40) reasoning.push('✓ Good potassium levels');
                  }
                  
                  if(reasoning.length === 0) {
                    reasoning.push('✓ Suitable based on overall soil conditions');
                  }
                  
                  return React.createElement('div', {
                    key: idx,
                    style:{
                      padding:10,
                      marginBottom:8,
                      border:'1px solid #e5e7eb',
                      borderRadius:6,
                      background: idx === 0 ? '#f0fdf4' : 'white'
                    }
                  },
                    React.createElement('div', {style:{fontWeight:700, fontSize:16, marginBottom:4}}, 
                      `${idx + 1}. ${crop}${idx === 0 ? ' ⭐ (Best Match)' : ''}`
                    ),
                    reasoning.map((r, ridx) => 
                      React.createElement('div', {key:ridx, style:{fontSize:13, color:'#16a34a'}}, r)
                    )
                  );
                })
              )
            ),
            
            // Action buttons
            React.createElement('div', {style:{display:'flex', gap:8, justifyContent:'flex-end'}},
              React.createElement('button', {
                className:'btn',
                onClick: () => {
                  const idx = data.indexOf(detailRow);
                  if(idx > 0) {
                    setDetailRow(data[idx - 1]);
                    setSelected(idx - 1);
                  }
                }
              }, '← Previous'),
              React.createElement('button', {
                className:'btn',
                onClick: () => {
                  const idx = data.indexOf(detailRow);
                  if(idx < data.length - 1) {
                    setDetailRow(data[idx + 1]);
                    setSelected(idx + 1);
                  }
                }
              }, 'Next →'),
              React.createElement('button', {
                className:'btn',
                onClick: () => setShowDetailModal(false)
              }, 'Close')
            )
          )
        ) : null
      )
    )
  );
}
