import './BreadcrumbBar.css'

export type BreadcrumbItem = {
  label: string
}

export function BreadcrumbBar({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null

  return (
    <div className="breadcrumb-bar" role="navigation" aria-label="Breadcrumb">
      {items.map((it, idx) => (
        <span key={`${it.label}-${idx}`} className="breadcrumb-item">
          {idx > 0 && <span className="breadcrumb-sep">›</span>}
          <span className={idx === items.length - 1 ? 'breadcrumb-current' : 'breadcrumb-label'}>{it.label}</span>
        </span>
      ))}
    </div>
  )
}
