import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import Dashboard from "./pages/Dashboard";
import StudentDashboard from "./pages/StudentDashboard";
import AnalystDashboard from "./pages/AnalystDashboard";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import ForgotPassword from "./pages/ForgotPassword";
import "./App.css";

function App() {
  return (
    React.createElement(Router, null,
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/", element: React.createElement(LandingPage) }),
  React.createElement(Route, { path: "/login", element: React.createElement(LoginPage) }),
        React.createElement(Route, { path: "/signup", element: React.createElement(SignUpPage) }),
        React.createElement(Route, { path: "/forgot-password", element: React.createElement(ForgotPassword) }),
        React.createElement(Route, { path: "/verify-otp", element: React.createElement(VerifyOtpPage) }),
  React.createElement(Route, { path: "/dashboard", element: React.createElement(Dashboard) }),
  React.createElement(Route, { path: "/dashboard/student", element: React.createElement(StudentDashboard) }),
  React.createElement(Route, { path: "/dashboard/analyst", element: React.createElement(AnalystDashboard) })
      )
    )
  );
}

export default App;
