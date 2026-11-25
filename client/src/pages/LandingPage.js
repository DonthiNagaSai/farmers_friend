import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

function LandingPage() {
  const navigate = useNavigate();
  const [hoveredButton, setHoveredButton] = useState(null);

  const features = [
    { icon: "🌱", title: "Soil Analysis", description: "Real-time soil health monitoring" },
    { icon: "🎯", title: "Smart Recommendations", description: "AI-powered crop suggestions" },
    { icon: "📊", title: "Data Insights", description: "Track and optimize your yields" },
    { icon: "🤝", title: "Community", description: "Connect with fellow farmers" }
  ];

  return (
    <div className="landing-container">
      <nav className="navbar">
        <div className="navbar-logo">
          <span>🌾</span>
          <div>Farmer's Friends</div>
        </div>
      </nav>

      <div className="landing-wrapper">
        {/* Left Content Section */}
        <div className="landing-content">
          <h1 className="hero-title">Smart Farming Starts Here</h1>
          <p className="hero-tagline">
            Connecting farmers with timely knowledge and intelligent tools for better harvests
          </p>

          {/* Features List */}
          <ul className="features-list">
            {features.map((feature, index) => (
              <li key={index} className="feature-item">
                <div className="feature-icon">{feature.icon}</div>
                <div className="feature-text">
                  <div className="feature-title">{feature.title}</div>
                  <div className="feature-description">{feature.description}</div>
                </div>
              </li>
            ))}
          </ul>

          {/* CTA Buttons */}
          <div className="cta-buttons">
            <button
              className={`btn btn-primary ${hoveredButton === 'login' ? 'active' : ''}`}
              onClick={() => navigate("/login")}
              onMouseEnter={() => setHoveredButton('login')}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <span className="btn-icon">🔓</span>
              Login
            </button>
            <button
              className={`btn btn-secondary ${hoveredButton === 'signup' ? 'active' : ''}`}
              onClick={() => navigate("/signup")}
              onMouseEnter={() => setHoveredButton('signup')}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <span className="btn-icon">✨</span>
              Sign Up
            </button>
          </div>

          {/* Stats */}
          <div className="stats-section">
            <div className="stat">
              <div className="stat-number">10K+</div>
              <div className="stat-label">Active Farmers</div>
            </div>
            <div className="stat">
              <div className="stat-number">98%</div>
              <div className="stat-label">Accuracy Rate</div>
            </div>
            <div className="stat">
              <div className="stat-number">50+</div>
              <div className="stat-label">Crops Supported</div>
            </div>
          </div>
        </div>

        {/* Right Image Section */}
        <div className="landing-image">
          <div className="image-container">
            <div className="main-image">
              <svg viewBox="0 0 400 400" className="farmer-illustration">
                <defs>
                  <linearGradient id="soilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor: '#2e7d32', stopOpacity: 1}} />
                    <stop offset="100%" style={{stopColor: '#1f6f2a', stopOpacity: 1}} />
                  </linearGradient>
                </defs>
                
                {/* Sun */}
                <circle cx="350" cy="50" r="40" fill="#FFD700" opacity="0.8"/>
                
                {/* Plant */}
                <path d="M200 280 Q150 220 150 150 Q150 100 200 80 Q250 100 250 150 Q250 220 200 280" fill="url(#soilGradient)"/>
                
                {/* Leaves */}
                <ellipse cx="160" cy="150" rx="15" ry="35" fill="#4CAF50" opacity="0.7" transform="rotate(-25 160 150)"/>
                <ellipse cx="240" cy="150" rx="15" ry="35" fill="#4CAF50" opacity="0.7" transform="rotate(25 240 150)"/>
                <ellipse cx="200" cy="120" rx="12" ry="30" fill="#5CBF60"/>
                
                {/* Soil */}
                <rect x="80" y="320" width="240" height="60" fill="#8D6E63" rx="5"/>
                <circle cx="100" cy="280" r="12" fill="#795548"/>
                <circle cx="180" cy="290" r="15" fill="#795548"/>
                <circle cx="300" cy="275" r="10" fill="#795548"/>
              </svg>
            </div>

            {/* Floating Info Cards */}
            <div className="floating-card card-soil">
              <div className="card-title">Soil Health</div>
              <div className="card-content">
                <span className="card-icon">📈</span>
                <span>pH 6.5 · Excellent</span>
              </div>
            </div>

            <div className="floating-card card-crop">
              <div className="card-title">Top Crops</div>
              <div className="card-content">
                <span className="card-icon">🌽</span>
                <span>Maize, Wheat, Rice</span>
              </div>
            </div>

            <div className="floating-card card-weather">
              <div className="card-title">Weather</div>
              <div className="card-content">
                <span className="card-icon">☀️</span>
                <span>Sunny, 28°C</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;