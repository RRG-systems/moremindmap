import { useEffect, useRef } from 'react';

export function MoreBrand() {
  return <div className="campaign-more-brand" aria-label="MORE MindMap"><span aria-hidden="true">✧</span><strong>MORE<br />MINDMAP</strong></div>;
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function ProductHeader({ manager, role, backLabel = null, onBack = null, meta = null, error = '' }) {
  return (
    <header className="campaign-product-header recruiting-no-print">
      <div className="campaign-header-left">
        <MoreBrand />
        {backLabel && <button type="button" className="campaign-back" onClick={onBack}>← {backLabel}</button>}
      </div>
      <div className="campaign-header-right">
        {meta && <small>{meta}</small>}
        <span className="campaign-avatar">{initials(manager?.name)}</span>
        <div><strong>{manager?.name}</strong><small>{role || manager?.enterprise_name}</small></div>
      </div>
      {error && <p className="campaign-error" role="alert">{error}</p>}
    </header>
  );
}

export function CandidateAnchor({ candidate, intelligence, onChange, demo = false, note = null }) {
  if (!candidate) return null;
  const ready = candidate.ba_readiness === 'BA_INTELLIGENCE_READY'
    ? 'BOS ready · BA Intelligence ready'
    : candidate.bos_profile_id
      ? 'BOS ready · BA optional'
      : 'Invitation pending';
  const pathCount = intelligence?.output?.authentic_angles?.length;
  return (
    <section className="campaign-candidate-anchor" aria-label="Active candidate">
      <span>{initials(candidate.recruit_name)}</span>
      <div><small>Active candidate</small><strong>{candidate.recruit_name}</strong></div>
      <p>{ready}{Number.isInteger(pathCount) ? ` · ${pathCount} supported ${pathCount === 1 ? 'path' : 'paths'}` : ''}</p>
      {note && <em>{note}</em>}
      {onChange && <button type="button" onClick={onChange}>{demo ? 'Return to walkthrough' : 'Change candidate'}</button>}
    </section>
  );
}

export function JourneyMap({ eyebrow, title, subtitle, cards, footerLeft, footerRight, onOpen, variant = 'manager' }) {
  return (
    <section className={`campaign-map campaign-map-${variant}`} data-layer="00">
      <div className="campaign-map-copy">
        <p className="campaign-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="campaign-map-scroller" tabIndex="0" aria-label={`${variant} destination map`}>
        <div className="campaign-map-cards">
          {cards.map((card, index) => (
            <button type="button" className={`campaign-map-card tone-${card.tone}`} key={card.id} onClick={() => onOpen(card.id)}>
              <span className="campaign-card-number">{String(index + 1).padStart(2, '0')}</span>
              <strong className="campaign-card-title">{card.title}</strong>
              <p>{card.copy}</p>
              <b>{card.state}</b>
              <footer><span>{card.action}</span><i aria-hidden="true">→</i></footer>
            </button>
          ))}
        </div>
      </div>
      <footer className="campaign-map-footer"><span>{footerLeft}</span><small>{footerRight}</small></footer>
    </section>
  );
}

export function DetailDrawer({ eyebrow, title, subtitle = null, onClose, children, footer = null, label = null }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="campaign-drawer-backdrop recruiting-no-print" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="campaign-drawer" role="dialog" aria-modal="true" aria-label={label || title} data-layer="02">
        <button ref={closeRef} className="campaign-drawer-close" type="button" onClick={onClose} aria-label="Close details">×</button>
        <p className="campaign-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        {subtitle && <p className="campaign-drawer-subtitle">{subtitle}</p>}
        {children}
        {footer && <footer className="campaign-drawer-boundary">{footer}</footer>}
      </aside>
    </div>
  );
}
