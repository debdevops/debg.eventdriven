interface JsonModalProps {
  title: string
  data: any
  onClose: () => void
}

function JsonModal({ title, data, onClose }: JsonModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3>{title}</h3>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '60vh',
          fontSize: '0.9em',
          color: '#333',
          border: '1px solid #e0e0e0'
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
        <button onClick={onClose} style={{ marginTop: '1rem' }}>
          Close
        </button>
      </div>
    </div>
  )
}

export default JsonModal
