export function SnapshotControl({
  frozenSnapshot,
  onToggleSnapshot,
  disabled
}: {
  frozenSnapshot: boolean
  onToggleSnapshot: () => void
  disabled: boolean
}) {
  return (
    <div className="toolbar-group">
      <button
        className={`toolbar-btn ${frozenSnapshot ? 'active' : ''}`}
        onClick={onToggleSnapshot}
        disabled={disabled}
        title="Freeze/unfreeze snapshot"
      >
        {frozenSnapshot ? '❄️ Frozen' : '📷 Snapshot'}
      </button>
    </div>
  )
}
