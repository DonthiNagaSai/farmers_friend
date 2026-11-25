import React from 'react';

function colorForLevel(v){
  if(v >= 80) return '#2e7d32';
  if(v >= 60) return '#66bb6a';
  if(v >= 40) return '#f4b400';
  if(v >= 20) return '#ff9800';
  return '#d32f2f';
}

function ProgressBar({label, value, unit = '%'}){
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = colorForLevel(pct);
  return (
    <div className="gauge-row" title={`${label}: ${pct}${unit}`}>
      <div className="gauge-label">{label}</div>
      <div className="gauge-bar">
        <div className="gauge-fill" style={{width: pct + '%', background: color}} />
      </div>
      <div className="gauge-value">{pct}{unit}</div>
    </div>
  );
}

function CircleGauge({label, value, max, unit, icon}){
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const color = colorForLevel(pct);
  const size = 120;
  const r = (size/2) - 10;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  
  return (
    <div className="circle-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8"/>
            <stop offset="100%" stopColor={color} stopOpacity="1"/>
          </linearGradient>
        </defs>
        <g transform={`translate(${size/2},${size/2})`}>
          <circle r={r} fill="none" stroke="#e0e7ed" strokeWidth="10" />
          <circle 
            r={r} 
            fill="none" 
            stroke={`url(#gradient-${label})`}
            strokeWidth="10" 
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c-dash}`} 
            strokeDashoffset={c/4} 
            transform="rotate(-90)"
            style={{transition: 'stroke-dasharray 0.6s ease'}}
          />
          <text x="0" y="-5" textAnchor="middle" fontSize="24" fontWeight="700" fill={color}>
            {value}
          </text>
          <text x="0" y="15" textAnchor="middle" fontSize="12" fill="#666">
            {unit}
          </text>
        </g>
      </svg>
      <div className="circle-gauge-label">
        <span className="gauge-icon">{icon}</span>
        {label}
      </div>
    </div>
  );
}

function Radial({score = 0, size = 96}){
  const s = size; 
  const r = (s/2) - 10; 
  const c = 2 * Math.PI * r; 
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const dash = (pct/100) * c;
  const color = colorForLevel(pct);
  
  return (
    <svg className="radial" width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <defs>
        <linearGradient id="rg" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#2e7d32"/>
          <stop offset="50%" stopColor="#66bb6a"/>
          <stop offset="100%" stopColor="#81c784"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(${s/2},${s/2})`}>
        <circle r={r} fill="none" stroke="#e0e7ed" strokeWidth="12" />
        <circle 
          r={r} 
          fill="none" 
          stroke="url(#rg)" 
          strokeWidth="12" 
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c-dash}`} 
          strokeDashoffset={c/4} 
          transform="rotate(-90)"
          filter="url(#glow)"
          style={{transition: 'stroke-dasharray 0.6s ease'}}
        />
        <text x="0" y="8" textAnchor="middle" fontSize="28" fontWeight="800" fill={color}>
          {pct}
        </text>
        <text x="0" y="28" textAnchor="middle" fontSize="12" fill="#666" fontWeight="600">
          HEALTH
        </text>
      </g>
    </svg>
  );
}

export default function SoilGauges({soil = {ph:6.5,nitrogen:60,phosphorus:30,potassium:80,moisture:45,temperature:25,ec:1.5,organicMatter:3.5}}){
  const n = Number(soil.nitrogen || 0);
  const p = Number(soil.phosphorus || 0);
  const k = Number(soil.potassium || 0);
  const ph = Number(soil.ph || 6.5);
  const moisture = Number(soil.moisture || 40);
  const temperature = Number(soil.temperature || 25);
  const ec = Number(soil.ec || 1.5); // Electrical Conductivity
  const organicMatter = Number(soil.organicMatter || 3);
  
  // Calculate health scores
  const nutrientScore = Math.round((Math.min(100,n) + Math.min(100,p) + Math.min(100,k))/3);
  const phScore = Math.round((1 - Math.abs(ph-6.8)/3.2) * 100);
  const moistureScore = Math.round(Math.max(0, Math.min(100, moisture)));
  const tempScore = Math.round(Math.max(0, 100 - Math.abs(temperature - 25) * 3));
  const ecScore = Math.round(Math.max(0, Math.min(100, (ec / 3) * 100))); // EC typically 0-3 dS/m
  const omScore = Math.round(Math.max(0, Math.min(100, (organicMatter / 5) * 100))); // OM typically 0-5%
  
  const overall = Math.round(
    (nutrientScore * 0.35 + phScore * 0.15 + moistureScore * 0.2 + tempScore * 0.1 + ecScore * 0.1 + omScore * 0.1)
  );

  return (
    <div className="soil-gauges card">
      <div className="card-header">
        <span className="icon">🌱</span> 
        <span>Soil Health Dashboard</span>
      </div>
      
      <div className="soil-gauges-inner">
        {/* Overall Health Score */}
        <div className="health-score-section">
          <div className="radial-wrap">
            <Radial score={overall} size={140} />
          </div>
          <div className="health-description">
            <h3 className="health-title">Overall Soil Health</h3>
            <p className="health-status" style={{color: colorForLevel(overall)}}>
              {overall >= 80 ? '🌟 Excellent' : overall >= 60 ? '✅ Good' : overall >= 40 ? '⚠️ Fair' : '❌ Poor'}
            </p>
          </div>
        </div>

        {/* Circle Gauges for Key Metrics */}
        <div className="circle-gauges-grid">
          <CircleGauge label="Temperature" value={Math.round(temperature)} max={40} unit="°C" icon="🌡️" />
          <CircleGauge label="Moisture" value={moistureScore} max={100} unit="%" icon="💧" />
        </div>

        {/* NPK and pH Bars */}
        <div className="nutrient-section">
          <h4 className="section-title">
            <span className="section-icon">🧪</span>
            Primary Nutrients & pH
          </h4>
          <div className="bars">
            <ProgressBar label="Nitrogen (N)" value={n} />
            <ProgressBar label="Phosphorus (P)" value={p} />
            <ProgressBar label="Potassium (K)" value={k} />
            <ProgressBar label="pH Balance" value={phScore} />
          </div>
        </div>

        {/* Soil Quality Indicators */}
        <div className="quality-indicators">
          <div className="indicator-card" style={{borderLeftColor: colorForLevel(nutrientScore)}}>
            <div className="indicator-icon">🌿</div>
            <div className="indicator-content">
              <div className="indicator-label">Nutrient Level</div>
              <div className="indicator-value" style={{color: colorForLevel(nutrientScore)}}>
                {nutrientScore}%
              </div>
            </div>
          </div>
          
          <div className="indicator-card" style={{borderLeftColor: colorForLevel(moistureScore)}}>
            <div className="indicator-icon">💦</div>
            <div className="indicator-content">
              <div className="indicator-label">Moisture Level</div>
              <div className="indicator-value" style={{color: colorForLevel(moistureScore)}}>
                {moistureScore}%
              </div>
            </div>
          </div>
          
          <div className="indicator-card" style={{borderLeftColor: colorForLevel(phScore)}}>
            <div className="indicator-icon">⚖️</div>
            <div className="indicator-content">
              <div className="indicator-label">pH Level</div>
              <div className="indicator-value" style={{color: colorForLevel(phScore)}}>
                {ph.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
