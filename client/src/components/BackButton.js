import React from 'react';
import { useNavigate } from 'react-router-dom';
import './BackButton.css';

export default function BackButton({ to, label = 'Back', onClick }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      // If custom onClick handler provided, use it
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button className="back-button" onClick={handleBack}>
      <span className="back-arrow">←</span>
      <span className="back-label">{label}</span>
    </button>
  );
}
