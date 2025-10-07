import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

function LandingPage() {
  const navigate = useNavigate();

  return (
    React.createElement("div", { className: "landing-container" },
      React.createElement("div", { className: "landing-box" },
        React.createElement("h1", null, "🌾 Farmer's Friends"),
        React.createElement("p", null, "Connecting farmers with timely knowledge and tools"),
        React.createElement("div", { className: "landing-buttons" },
          React.createElement("button", {
            className: "btn btn-login",
            onClick: () => navigate("/login")
          }, "Login"),
          React.createElement("button", {
            className: "btn btn-signup",
            onClick: () => navigate("/signup")
          }, "Sign Up")
        )
      )
    )
  );
}

export default LandingPage;
