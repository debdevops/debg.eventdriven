import React from 'react';

interface ReauthModalProps {
  isOpen: boolean;
  onEnterConnectionString: () => void;
  onCloseNamespace: () => void;
}

export const ReauthModal: React.FC<ReauthModalProps> = ({
  isOpen,
  onEnterConnectionString,
  onCloseNamespace,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ textAlign: 'center' }}>
        <h2>🔐 Re-Authentication Required</h2>
        <p>Your session credentials are no longer valid. Please provide a fresh connection string.</p>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={onEnterConnectionString}>
            Enter Connection String
          </button>
          <button className="btn-secondary" onClick={onCloseNamespace}>
            Close Namespace
          </button>
        </div>
      </div>
    </div>
  );
};