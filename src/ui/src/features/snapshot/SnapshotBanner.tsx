export function SnapshotBanner({
  snapshotCapturedAtUtc,
  snapshotReason,
  onExit
}: {
  snapshotCapturedAtUtc: string | null
  snapshotReason: 'user' | 'dlq' | null
  onExit: () => void
}) {
  return (
    <div className="snapshot-banner" role="status" aria-live="polite">
      <div className="snapshot-banner-title">Snapshot (Frozen View)</div>
      <div className="snapshot-banner-body">
        Snapshot (Frozen View): Data is paused at a specific point in time.
        {snapshotCapturedAtUtc && (
          <>
            {' '}Captured at{' '}
            <strong>{new Date(snapshotCapturedAtUtc).toLocaleString()}</strong>.
          </>
        )}
        {' '}To resume live updates, exit Snapshot.
      </div>
      {snapshotReason === 'dlq' && (
        <div className="snapshot-banner-footnote">
          DLQ views open in Snapshot mode by default for investigation safety.
        </div>
      )}

      <div className="snapshot-banner-actions">
        <button
          type="button"
          className="btn-outline"
          onClick={onExit}
          title="Exit Snapshot and resume live updates"
        >
          Exit Snapshot
        </button>
      </div>
    </div>
  )
}
