import './JsonModal.css'

interface JsonModalProps {
  title: string
  data: any
  onClose: () => void
}

function JsonModal({ title, data, onClose }: JsonModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content json-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3>{title}</h3>
        <pre className="json-modal-pre">
          {JSON.stringify(data, null, 2)}
        </pre>
        <button onClick={onClose} className="json-modal-close">
          Close
        </button>
      </div>
    </div>
  )
}

export default JsonModal
