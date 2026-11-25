import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import BackButton from "../components/BackButton";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password })
      });
      const json = await resp.json();
      console.log('[LOGIN] server response:', json);
      if (!resp.ok) {
        setError(json.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      // store minimal auth in sessionStorage for downstream pages
      try {
        const auth = { token: json.token, role: json.role, user: json.user };
        sessionStorage.setItem('auth', JSON.stringify(auth));
        if (json.role) sessionStorage.setItem('role', json.role);
      } catch (e) {
        // ignore storage errors
      }

      // navigate to dashboard; Dashboard reads role from location.state or session storage
      navigate('/dashboard', { 
        state: { role: json.role, user: json.user }
      });
    } catch (err) {
      console.error('login error', err);
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <BackButton label="Back" />
      
      {/* Decorative Background Elements */}
      <div className="background-decoration deco-1"></div>
      <div className="background-decoration deco-2"></div>
      <div className="background-decoration deco-3"></div>

      <div className="login-wrapper">
        {/* Left Content Section */}
        <div className="login-content">
          <div className="content-header">
            <div className="brand-icon">🌾</div>
            <h1>Welcome Back</h1>
            <p>Access your farm management dashboard</p>
          </div>

          <div className="login-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">📊</span>
              <span>Track soil health & analytics</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🌱</span>
              <span>Get crop recommendations</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">📈</span>
              <span>Optimize farm productivity</span>
            </div>
          </div>

          <div className="signup-link">
            Don't have an account?
            <button 
              className="link-button"
              onClick={() => navigate("/signup")}
            >
              Sign up here
            </button>
          </div>
        </div>

        {/* Right Login Form Section */}
        <div className="login-form-wrapper">
          <div className="login-box">
            <div className="form-header">
              <h2>Login</h2>
              <p className="form-subtitle">Enter your credentials to continue</p>
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              {/* Email Input */}
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className={`input-wrapper ${focusedField === 'email' ? 'focused' : ''}`}>
                  <span className="input-icon">📧</span>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className={`input-wrapper ${focusedField === 'password' ? 'focused' : ''}`}>
                  <span className="input-icon">🔒</span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="form-actions">
                <label className="remember-checkbox">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="forgot-password">Forgot password?</a>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className={`btn-login ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loader"></span>
                    Logging in...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🚀</span>
                    Login to Dashboard
                  </>
                )}
              </button>
            </form>

            <div className="divider">
              <span>or</span>
            </div>

            <button className="btn-social">
              <span className="social-icon">🌐</span>
              Continue with Google
            </button>

            <div className="security-note">
              <span className="lock-icon">🔐</span>
              <p>Your data is secured with end-to-end encryption</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
