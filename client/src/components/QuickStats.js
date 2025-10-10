import React from 'react';

function StatCard({title, value, subtitle}){
  return (
    <div className="stat-card card">
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
      {subtitle && <div className="stat-sub">{subtitle}</div>}
    </div>
  );
}

export default function QuickStats({analyses = [], predictions = []}){
  const total = analyses.length;
  const most = (predictions.flat().reduce((acc,c) => { acc[c] = (acc[c]||0)+1; return acc; }, {}));
  const best = Object.keys(most).sort((a,b)=>most[b]-most[a])[0] || '—';
  const avgScore = analyses.length ? Math.round(analyses.reduce((s,a)=>s+(a.score||0),0)/analyses.length) : 0;

  return (
    <div className="quick-stats">
      <StatCard title="Total analyses" value={total} subtitle="analyses performed" />
      <StatCard title="Top recommended crop" value={best} subtitle="most frequent" />
      <StatCard title="Avg soil health" value={avgScore + '%'} subtitle="across analyses" />
    </div>
  );
}
