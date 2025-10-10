import React from 'react';

export default function WeatherWidget({location = 'Local'}){
  // Mock small widget (no external API)
  const data = {temp: 28, cond: 'Sunny', humidity: 55};
  return (
    <div className="weather-widget card">
      <div className="card-header"><span className="icon">☀️</span> Weather</div>
      <div className="weather-body">
        <div className="weather-temp">{data.temp}°C</div>
        <div className="weather-cond">{data.cond}</div>
        <div className="weather-meta">{data.humidity}% humidity • {location}</div>
      </div>
    </div>
  );
}
