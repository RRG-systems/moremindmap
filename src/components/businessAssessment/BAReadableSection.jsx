const BADGE_STYLES = {
  Focus: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Business: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Future: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  Confidence: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  Action: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Unavailable: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  NextStep: 'bg-cyan-400/20 text-cyan-100 border-cyan-300/45',
};

export function BABadge({ type, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${BADGE_STYLES[type] || BADGE_STYLES.Business}`}
    >
      {children ?? type}
    </span>
  );
}

export function BACard({ title, badge, children, className = '' }) {
  return (
    <article className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title ? <h3 className="text-base font-bold text-white">{title}</h3> : null}
        {badge ? <BABadge type={badge} /> : null}
      </div>
      {children}
    </article>
  );
}

export function BAEmptyState({ title, message }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/60">
      <p className="font-semibold text-white/75">{title}</p>
      {message ? <p className="mt-2 leading-relaxed">{message}</p> : null}
    </div>
  );
}

/**
 * Presentation-layer cleanup for customer-facing BA text.
 * Strips common markdown artifacts while preserving content words.
 * Does not mutate source assessment data.
 */
export function sanitizeCustomerMarkdown(text) {
  if (text === null || text === undefined) return '';
  let value = typeof text === 'string' ? text : String(text);

  // Normalize common markdown heading markers
  value = value.replace(/^#{1,6}\s+/gm, '');
  // Horizontal rules
  value = value.replace(/^\s*---+\s*$/gm, '');
  // Bold / italic markers (keep inner text)
  value = value.replace(/\*\*([^*]+)\*\*/g, '$1');
  value = value.replace(/__([^_]+)__/g, '$1');
  // Single-asterisk / underscore emphasis (avoid mid-word underscores)
  value = value.replace(/(^|[\s(])\*([^*\n]+)\*([\s).,;:!?]|$)/g, '$1$2$3');
  value = value.replace(/(^|[\s(])_([^_\n]+)_([\s).,;:!?]|$)/g, '$1$2$3');
  // Inline code
  value = value.replace(/`([^`]+)`/g, '$1');
  // List markers at line start (content preserved; bullets handled by CustomerSafeText)
  value = value.replace(/^\s*[-*+]\s+/gm, '');
  // Collapse excessive blank lines
  value = value.replace(/\n{3,}/g, '\n\n');
  return value.trim();
}

function renderInlineCustomerText(text) {
  const source = String(text || '');
  // Split on **bold** segments; strip remaining markers from non-bold parts.
  const parts = source.split(/(\*\*[^*]+\*\*)/g).filter((part) => part !== '');
  if (parts.length === 1 && !parts[0].includes('**')) {
    return sanitizeCustomerMarkdown(parts[0]);
  }
  return parts.map((part, index) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={`b-${index}`} className="font-semibold text-white">
          {boldMatch[1]}
        </strong>
      );
    }
    return <span key={`t-${index}`}>{part.replace(/\*\*/g, '')}</span>;
  });
}

/**
 * Renders customer-readable assessment text without exposing raw markdown syntax.
 * Supports ### headings, **bold** labels, and simple bullet lists.
 */
export function CustomerSafeText({
  text,
  className = 'text-sm leading-relaxed text-white/82',
  as: Component = 'div',
}) {
  if (text === null || text === undefined || text === '') return null;

  const lines = String(text).split('\n');
  const nodes = [];

  lines.forEach((line, idx) => {
    const raw = line.trim();
    if (!raw) {
      nodes.push(<div key={`sp-${idx}`} className="h-2" aria-hidden />);
      return;
    }
    if (/^---+$/.test(raw)) {
      return;
    }

    const headingMatch = raw.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      nodes.push(
        <p key={`h-${idx}`} className="pt-1 text-sm font-semibold text-white">
          {sanitizeCustomerMarkdown(headingMatch[1])}
        </p>
      );
      return;
    }

    const bulletMatch = raw.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      nodes.push(
        <p key={`li-${idx}`} className="pl-3 text-sm text-white/75">
          <span className="mr-2 text-white/40">•</span>
          {renderInlineCustomerText(bulletMatch[1])}
        </p>
      );
      return;
    }

    // Full-line bold as emphasis
    if (/^\*\*[^*]+\*\*$/.test(raw)) {
      nodes.push(
        <p key={`fb-${idx}`} className="text-sm font-semibold text-white">
          {raw.replace(/\*\*/g, '')}
        </p>
      );
      return;
    }

    nodes.push(
      <p key={`p-${idx}`} className={className}>
        {renderInlineCustomerText(raw)}
      </p>
    );
  });

  if (!nodes.length) return null;

  return <Component className="space-y-1">{nodes}</Component>;
}

/** Sanitize list item strings for customer-facing bullet lists. */
export function CustomerSafeListItems({ items, className = 'list-inside list-disc space-y-1 text-sm text-white/75' }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <ul className={className}>
      {list.map((item) => {
        const clean = sanitizeCustomerMarkdown(item);
        return <li key={clean || String(item)}>{clean}</li>;
      })}
    </ul>
  );
}
