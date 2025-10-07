import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SignUpPage.css";
import CenteredModal from '../components/CenteredModal';

// Use REACT_APP_API_URL to override backend in development/production, otherwise
// use a relative '/api' path so CRA dev server proxy (client/package.json) works.
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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [modal, setModal] = useState(null);
  // OTP verification handled on separate page

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  }

  function validateEmail(email) {
    if (!email) return true; // optional
    // simple RFC-ish check
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  function validatePhone(phone) {
    if (!phone) return false; // phone required currently
    // allow digits, spaces, dashes, parentheses and leading +
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
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
          password: form.password
        })
      });
      const json = await resp.json();
      if (!resp.ok) {
        // show server error in centered modal
        setModal({ title: 'Signup failed', message: json.error || 'Signup failed' });
      } else {
        // if server requires OTP verification, show OTP input instead of navigating
        if (json.otpRequired) {
          // navigate to a dedicated OTP verification page with phone/email
          navigate('/verify-otp', { state: { phone: form.phone.trim(), email: form.email ? form.email.trim() : '', next: '/login' } });
        } else {
          setModal({ title: 'Success', message: json.message || 'Account created successfully!', actions: React.createElement('button', { className: 'btn btn-ok', onClick: () => { setModal(null); navigate('/login'); } }, 'OK') });
        }
      }
    } catch (err) {
      console.error(err);
      setModal({ title: 'Server error', message: 'Server error' });
    } finally {
      setLoading(false);
    }
  }

  

  return (
    React.createElement("div", { className: "signup-container" },
      React.createElement("div", { className: "signup-box" },
        React.createElement("h2", null, "Create Account"),
        React.createElement("form", { onSubmit: handleSubmit, className: "signup-form" },
          React.createElement("div", { className: "row name-row" },
            React.createElement("input", {
              name: "firstName",
              placeholder: "First Name",
              value: form.firstName,
              onChange: handleChange,
              required: true
            }),
            React.createElement("input", {
              name: "lastName",
              placeholder: "Last Name",
              value: form.lastName,
              onChange: handleChange,
              required: true
            })
          ),
          React.createElement("input", {
            name: "phone",
            placeholder: "Phone Number",
            value: form.phone,
            onChange: handleChange,
            required: true
          }),
          errors.phone ? React.createElement('div', { className: 'error-message' }, errors.phone) : null,
          React.createElement("input", {
            name: "email",
            type: "email",
            placeholder: "Email Address (Optional)",
            value: form.email,
            onChange: handleChange
          }),
          errors.email ? React.createElement('div', { className: 'error-message' }, errors.email) : null,
          React.createElement("input", {
            name: "password",
            type: "password",
            placeholder: "Password",
            value: form.password,
            onChange: handleChange,
            required: true
          }),
          React.createElement("input", {
            name: "confirmPassword",
            type: "password",
            placeholder: "Confirm Password",
            value: form.confirmPassword,
            onChange: handleChange,
            required: true
          }),
          errors.confirmPassword ? React.createElement('div', { className: 'error-message' }, errors.confirmPassword) : null,
          
          React.createElement("button", { type: "submit", className: "btn-submit", disabled: loading }, loading ? "Creating..." : "Sign Up")
        )
      )
        , modal ? React.createElement(CenteredModal, Object.assign({}, modal, { onClose: () => setModal(null) })) : null
    )
  );
}

export default SignUpPage;
