import React from 'react';

function colorForLevel(v){
  if(v >= 80) return '#2e7d32';
  if(v >= 50) return '#f4b400';
  return '#d32f2f';
}

function ProgressBar({label, value}){
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = colorForLevel(pct);
  return (
    <div className="gauge-row" title={`${label}: ${pct}`}>
      <div className="gauge-label">{label}</div>
      <div className="gauge-bar">
        <div className="gauge-fill" style={{width: pct + '%', background: color}} />
      </div>
      <div className="gauge-value">{pct}%</div>
    </div>
  );
}

function Radial({score = 0, size = 96}){
  const s = size; const r = (s/2)-8; const c = 2*Math.PI*r; const pct = Math.max(0, Math.min(100, Math.round(score)));
  const dash = (pct/100)*c;
  return (
    <svg className="radial" width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <linearGradient id="rg" x1="0%" x2="100%"><stop offset="0%" stopColor="#2e7d32"/><stop offset="100%" stopColor="#f4b400"/></linearGradient>
      </defs>
      <g transform={`translate(${s/2},${s/2})`}>
        <circle r={r} fill="none" stroke="#eee" strokeWidth="8" />
        <circle r={r} fill="none" stroke="url(#rg)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${c-dash}`} strokeDashoffset={c/4} transform={`rotate(-90)`} />
        <text x="0" y="6" textAnchor="middle" fontSize="16" fontWeight="700">{pct}</text>
        <text x="0" y="26" textAnchor="middle" fontSize="11" fill="#666">score</text>
      </g>
    </svg>
  );
}

export default function SoilGauges({soil = {ph:6.5,nitrogen:60,phosphorus:30,potassium:80,moisture:45}}){
  const n = Number(soil.nitrogen || 0);
  const p = Number(soil.phosphorus || 0);
  const k = Number(soil.potassium || 0);
  const ph = Number(soil.ph || 6.5);
  const moisture = Number(soil.moisture || 40);
  // crude health score
  const nutrientScore = Math.round((Math.min(100,n) + Math.min(100,p) + Math.min(100,k))/3);
  const phScore = Math.round( (1 - Math.abs(ph-6.8)/3.2) * 100 );
  const moistureScore = Math.round( Math.max(0, Math.min(100, moisture)) );
  const overall = Math.round((nutrientScore*0.6 + phScore*0.2 + moistureScore*0.2));

  return (
    <div className="soil-gauges card">
      <div className="card-header"><span className="icon">🌱</span> Soil Visuals</div>
      <div className="soil-gauges-inner">
        <div className="radial-wrap"><Radial score={overall} size={110} /></div>
        <div className="bars">
          <ProgressBar label="Nitrogen (N)" value={n} />
          <ProgressBar label="Phosphorus (P)" value={p} />
          <ProgressBar label="Potassium (K)" value={k} />
          <ProgressBar label="pH proximity" value={phScore} />
          <ProgressBar label="Moisture" value={moistureScore} />
        </div>
      </div>
    </div>
  );
}
