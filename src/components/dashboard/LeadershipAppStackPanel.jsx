import { useState } from 'react'

export default function LeadershipAppStackPanel({
  title,
  eyebrow,
  description,
  badge = 'Stack',
  defaultOpen = false,
  children,
  summary,
  telemetryId,
  onToggle
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const panelId = `stack-panel-${String(title || 'panel').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  function toggleOpen() {
    setIsOpen((value) => {
      const nextValue = !value
      if (typeof onToggle === 'function') {
        onToggle({ isOpen: nextValue, panelId: telemetryId || panelId, title })
      }
      return nextValue
    })
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] shadow-[0_18px_70px_rgba(0,0,0,0.22)]">
      <button
        type="button"
        className="flex w-full flex-col gap-4 px-5 py-5 text-left transition hover:bg-white/[0.035] md:flex-row md:items-start md:justify-between"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggleOpen}
      >
        <div>
          {eyebrow && <div className="text-xs uppercase tracking-[0.22em] text-white/42">{eyebrow}</div>}
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h3>
          {description && <p className="mt-2 max-w-4xl text-sm leading-6 text-white/58">{description}</p>}
          {!isOpen && summary && <p className="mt-3 text-xs leading-5 text-white/42">{summary}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/24 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white/52">
            {badge}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-white/62">
            {isOpen ? 'Hide' : 'Open'}
          </span>
        </div>
      </button>
      {isOpen && (
        <div id={panelId} className="border-t border-white/10 p-5">
          {children}
        </div>
      )}
    </section>
  )
}
