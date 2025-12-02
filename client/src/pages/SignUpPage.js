import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SignUpPage.css";
import CenteredModal from '../components/CenteredModal';
import BackButton from '../components/BackButton';

const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [modal, setModal] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  }

  function validateEmail(email) {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  function validatePhone(phone) {
    if (!phone) return false;
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  function validatePassword(password) {
    return password && password.length >= 6;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};

    if (!form.firstName.trim()) {
      nextErrors.firstName = 'First name is required';
    }
    if (!form.lastName.trim()) {
      nextErrors.lastName = 'Last name is required';
    }
    if (!role) {
      nextErrors.role = 'Please select your role';
    }
    if (!validatePassword(form.password)) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }
    if (!validatePhone(form.phone)) {
      nextErrors.phone = 'Enter a valid phone number (7-15 digits)';
    }
    if (form.email && !validateEmail(form.email)) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          email: form.email ? form.email.trim() : "",
          role,
          password: form.password
        })
      });
      const json = await resp.json();
      if (!resp.ok) {
        setModal({ title: 'Signup failed', message: json.error || 'Signup failed' });
      } else {
        if (json.otpRequired) {
          navigate('/verify-otp', { state: { phone: form.phone.trim(), email: form.email ? form.email.trim() : '', next: '/login' } });
        } else {
          setModal({ 
            title: 'Success', 
            message: json.message || 'Account created successfully!', 
            actions: React.createElement('button', { className: 'btn btn-ok', onClick: () => { setModal(null); navigate('/login'); } }, 'Continue to Login') 
          });
        }
      }
    } catch (err) {
      console.error(err);
      setModal({ title: 'Server error', message: 'Unable to connect to server. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signup-container">
      <BackButton label="Back" />
      
      <div className="background-decoration deco-1"></div>
      <div className="background-decoration deco-2"></div>
      <div className="background-decoration deco-3"></div>

      <div className="signup-wrapper">
        {/* Left Content Section */}
        <div className="signup-content">
          <div className="content-header">
            <div className="brand-icon">🌾</div>
            <h1>Join Us Today</h1>
            <p>Start managing your farm intelligently</p>
          </div>

          <div className="signup-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <span>Real-time soil analysis</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <span>Smart crop recommendations</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">✓</span>
              <span>Farm performance tracking</span>
            </div>
          </div>

          <div className="login-link">
            Already have an account?
            <button 
              className="link-button"
              onClick={() => navigate("/login")}
            >
              Login here
            </button>
          </div>
        </div>

        {/* Right Signup Form Section */}
        <div className="signup-form-wrapper">
          <div className="signup-box">
            <div className="form-header">
              <h2>Create Account</h2>
              <p className="form-subtitle">Join the farming community</p>
            </div>

            <form className="signup-form" onSubmit={handleSubmit}>
              {/* Name Fields */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="John"
                    value={form.firstName}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                    className={errors.firstName ? 'error' : ''}
                    required
                  />
                  {errors.firstName && <span className="error-message">{errors.firstName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                    className={errors.lastName ? 'error' : ''}
                    required
                  />
                  {errors.lastName && <span className="error-message">{errors.lastName}</span>}
                </div>
              </div>

              {/* Role Selection */}
              <div className="form-group">
                <label htmlFor="role">I am a *</label>
                <select 
                  id="role"
                  name="role" 
                  value={role} 
                  onChange={(e) => {
                    setRole(e.target.value);
                    setErrors(prev => ({ ...prev, role: '' }));
                  }}
                  className={`role-select ${errors.role ? 'error' : ''}`}
                >
                  <option value="">-- Select Role --</option>
                  <option value="user">Farmer</option>
                  <option value="student">Student</option>
                  <option value="analyst">Analyst</option>
                </select>
                {errors.role && <span className="error-text">{errors.role}</span>}
              </div>

              {/* Phone */}
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={form.phone}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  className={errors.phone ? 'error' : ''}
                  required
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              {/* Email */}
              <div className="form-group">
                <label htmlFor="email">Email Address (Optional)</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              {/* Password */}
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-wrapper">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className={errors.password ? 'error' : ''}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-wrapper">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    className={errors.confirmPassword ? 'error' : ''}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>

              {/* Terms */}
              <div className="terms-checkbox">
                <input type="checkbox" id="terms" required />
                <label htmlFor="terms">I agree to the Terms of Service and Privacy Policy</label>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className={`btn-submit ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loader"></span>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🚀</span>
                    Create Account
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {modal && <CenteredModal {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}

export default SignUpPage;
