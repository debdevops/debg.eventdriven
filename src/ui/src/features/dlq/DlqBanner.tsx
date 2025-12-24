export type DlqBannerModel = {
  severityBadgeClass: 'critical' | 'warning' | 'healthy'
  label: string
  whyTooltip: string
  oldestAgeText: string
}

export function DlqBanner({
  snapshotEnabled,
  selectedEntityTypeLabel,
  entityName,
  subscriptionName,
  dlqCountTotal,
  model
}: {
  snapshotEnabled: boolean
  selectedEntityTypeLabel: string
  entityName: string
  subscriptionName?: string
  dlqCountTotal: number
  model: DlqBannerModel
}) {
  return (
    <div className="dlq-banner">
      <>
        <div className="dlq-banner-title">
          Dead-letter queue (DLQ)
          {snapshotEnabled && (
            <span className="dlq-frozen-badge" title="Frozen View">Frozen</span>
          )}
          <span className={`dlq-severity-badge ${model.severityBadgeClass}`} title={model.whyTooltip}>
            {model.label}
          </span>
          <span className="dlq-why" title={model.whyTooltip}>Why is this happening?</span>
        </div>
        <div className="dlq-banner-subtitle">
          {selectedEntityTypeLabel}: {subscriptionName
            ? `${entityName} / ${subscriptionName}`
            : entityName}
          <span className="dlq-banner-sep"> • </span>
          DLQ count: <strong>{dlqCountTotal}</strong>
          <span className="dlq-banner-sep"> • </span>
          Oldest DLQ age: <strong>{model.oldestAgeText}</strong>
        </div>
        <div className="dlq-banner-footnote">
          These messages failed delivery and require investigation.
        </div>
      </>
    </div>
  )
}
