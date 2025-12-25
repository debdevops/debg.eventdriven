export function SnapshotBanner({
  snapshotCapturedAtUtc,
  snapshotReason,
}: {
  snapshotCapturedAtUtc: string | null
  snapshotReason: 'user' | 'dlq' | null
}) {
  const capturedAtText = snapshotCapturedAtUtc
    ? new Date(snapshotCapturedAtUtc).toLocaleString()
    : null

  return (
    <div className="snapshot-details" role="status" aria-live="polite">
      <div className="snapshot-details-title">Snapshot (Frozen View)</div>
      <div className="snapshot-details-body">
        Snapshot (Frozen View): Data is paused at a specific point in time.
        {capturedAtText && (
          <>
            {' '}Captured at <strong>{capturedAtText}</strong>.
          </>
        )}
        {' '}To resume live updates, exit Snapshot.
      </div>
      {snapshotReason === 'dlq' && (
        <div className="snapshot-details-footnote">
          DLQ views open in Snapshot mode by default for investigation safety.
        </div>
      )}
    </div>
  )
}
