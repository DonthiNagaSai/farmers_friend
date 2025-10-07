import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import CenteredModal from '../components/CenteredModal';

// Use REACT_APP_API_URL to override backend, otherwise use relative '/api' for CRA proxy
const API_BASE = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') : '') || '/api';

function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password })
      });
      const json = await resp.json();
      if (!resp.ok) {
        setModal({ title: 'Login failed', message: json.error || 'Login failed' });
      } else {
        if (json.role === "admin") {
          // persist a small auth object so dashboard still knows the role after a refresh
          const auth = { role: "admin", name: json.name };
          try { sessionStorage.setItem("auth", JSON.stringify(auth)); } catch (e) { /* ignore */ }
          navigate("/dashboard", { state: auth });
        } else {
          // user - prefer a friendly display name: firstName, then name, then email, then phone
          const displayName = json.user.firstName || json.user.name || json.user.email || json.user.phone || 'Guest';
          const auth = { role: "user", name: displayName, user: json.user };
          try { sessionStorage.setItem("auth", JSON.stringify(auth)); } catch (e) { /* ignore */ }
          navigate("/dashboard", { state: auth });
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
    React.createElement("div", { className: "login-container" },
      React.createElement("div", { className: "login-box" },
        React.createElement("h2", null, "Login"),
        React.createElement("form", { onSubmit: handleSubmit, className: "login-form" },
          React.createElement("input", {
            name: "identifier",
            placeholder: "Email or Phone Number",
            value: form.identifier,
            onChange: handleChange,
            required: true
          }),
          React.createElement("input", {
            name: "password",
            type: "password",
            placeholder: "Password",
            value: form.password,
            onChange: handleChange,
            required: true
          }),
          React.createElement("button", { type: "submit", className: "btn-login", disabled: loading }, loading ? "Signing in..." : "Login")
        )
      )
      , modal ? React.createElement(CenteredModal, Object.assign({}, modal, { onClose: () => setModal(null) })) : null
    )
  );
}

export default LoginPage;
