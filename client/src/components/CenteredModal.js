import React from 'react';
import './CenteredModal.css';

export default function CenteredModal({ title, message, onClose, actions }) {
  return (
    React.createElement('div', { className: 'cf-modal-overlay' },
      React.createElement('div', { className: 'cf-modal' },
        title ? React.createElement('h3', null, title) : null,
        message ? React.createElement('p', null, message) : null,
        React.createElement('div', { className: 'cf-modal-actions' },
          actions ? actions : React.createElement('button', { className: 'btn btn-ok', onClick: onClose }, 'OK')
        )
      )
    )
  );
}
