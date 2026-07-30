import React from 'react';
import { buildVisualDNAViewModel } from '../../lib/visualDNA/buildVisualDNAViewModel.js';

const POSTER_WIDTH = 1672;
const POSTER_HEIGHT = 941;

const BAR_PALETTE = [
  'linear-gradient(90deg,#ff8a00,#ffd166)',
  'linear-gradient(90deg,#00d4ff,#6fffe9)',
  'linear-gradient(90deg,#7cff00,#c7ff5a)',
  'linear-gradient(90deg,#a66bff,#f3a6ff)',
  'linear-gradient(90deg,#ff4d2e,#ff9b71)',
  'linear-gradient(90deg,#71717a,#d4d4d8)',
];

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}`;
}

function riskClass(risk) {
  const value = String(risk || '').toLowerCase();
  if (value.includes('high')) return 'is-high';
  if (value.includes('low')) return 'is-low';
  return 'is-moderate';
}

function firstLine(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '—';
}

function asList(value, limit = 4) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item?.title && item?.summary) return `${item.title}: ${item.summary}`;
      if (item?.label) return String(item.label).trim();
      return '';
    })
    .filter(Boolean)
    .slice(0, limit);
}

function shortChip(value, fallback = '—', max = 72) {
  const text = firstLine(value, fallback);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function isPrebuiltViewModel(source) {
  return Boolean(source && typeof source === 'object' && source.profileId && source.engineLabel);
}

/**
 * Resolve a display view model without inventing personal facts.
 * Prefers prebuilt viewModel; rebuilds from profile/narrative when needed.
 * Avoids silent synthetic-sample substitution for empty customer data.
 */
function resolveViewModel({ viewModel, profile, narrative, allowSampleFallback = false }) {
  const preferred = viewModel || (isPrebuiltViewModel(profile) ? profile : null);
  if (preferred && isPrebuiltViewModel(preferred)) {
    return preferred;
  }

  const raw = preferred || profile || {};
  const built = buildVisualDNAViewModel(raw, narrative || {});
  const hasDimensions = Array.isArray(built.topDimensions) && built.topDimensions.length > 0;
  const isSyntheticSample = built.profileId === 'mm-20990103-labsyn03' && built.name === 'Rowan Field';

  if (!hasDimensions || (isSyntheticSample && !allowSampleFallback && !isPrebuiltViewModel(raw))) {
    return {
      ...built,
      topDimensions: hasDimensions && !isSyntheticSample ? built.topDimensions : [],
      primaryDimension: isSyntheticSample && !allowSampleFallback ? null : built.primaryDimension,
      secondaryDimension: isSyntheticSample && !allowSampleFallback ? null : built.secondaryDimension,
      tertiaryDimension: isSyntheticSample && !allowSampleFallback ? null : built.tertiaryDimension,
      name: firstLine(raw.person_name, raw.name, built.name, 'Profile Subject'),
      company: firstLine(raw.company_name, raw.company, built.company, '—'),
      profileId: firstLine(raw.profileId, raw.profile_id, built.profileId, '—'),
      type: firstLine(raw.profile_type, raw.type, built.type, 'Behavioral Operating System'),
      _thinRecord: true,
    };
  }

  return built;
}

function DimensionRow({ item, index }) {
  const abs = Math.abs(Number(item?.value) || 0);
  const width = Math.max(8, Math.min(100, abs * 100));
  const evidenceLabel = item?.evidence != null
    ? `EVIDENCE ${item.evidence}`
    : (item?.evidenceBand ? String(item.evidenceBand).toUpperCase() : '');
  const confidenceLabel = item?.intensityBand
    ? `CONFIDENCE ${String(item.intensityBand).toUpperCase()}`
    : (item?.confidenceBand ? `CONFIDENCE ${String(item.confidenceBand).toUpperCase()}` : '');
  const swatch = BAR_PALETTE[index % BAR_PALETTE.length];

  return (
    <div className="bos-dna-v2__dim-row">
      <span className="bos-dna-v2__dim-swatch" style={{ background: swatch }} aria-hidden="true" />
      <div className="bos-dna-v2__dim-main">
        <div className="bos-dna-v2__dim-top">
          <span className="bos-dna-v2__dim-label">{item?.label || item?.key || '—'}</span>
          <span className="bos-dna-v2__dim-score">{formatScore(item?.value)}</span>
        </div>
        <span className="bos-dna-v2__dim-bar">
          <i style={{ width: `${width}%`, background: swatch }} />
        </span>
        {(evidenceLabel || confidenceLabel) ? (
          <div className="bos-dna-v2__dim-chips">
            {evidenceLabel ? <em>{evidenceLabel}</em> : null}
            {confidenceLabel ? <em>{confidenceLabel}</em> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CompactList({ items, empty = 'Not available for this profile' }) {
  const list = asList(items, 4);
  if (!list.length) {
    return <p className="bos-dna-v2__empty">{empty}</p>;
  }
  return (
    <ul className="bos-dna-v2__list">
      {list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function TraitBadge({ rank, item, fallbackLabel, tone }) {
  const evidence = item?.evidence != null ? `EV ${item.evidence}` : null;
  return (
    <div className={`bos-dna-v2__badge bos-dna-v2__badge--${tone}`}>
      <span>{rank}</span>
      <strong>{item?.label || fallbackLabel || '—'}</strong>
      <em>{item ? formatScore(item.value) : '—'}</em>
      {evidence ? <small>{evidence}</small> : null}
    </div>
  );
}

function FutureCard({ item, index }) {
  return (
    <article className={`bos-dna-v2__future bos-dna-v2__future--${index + 1}`}>
      <div className="bos-dna-v2__future-head">
        <span>{item?.likelihood || '—'}</span>
      </div>
      <strong>{item?.title || `Future ${index + 1}`}</strong>
      <p>{item?.summary || '—'}</p>
    </article>
  );
}

function FooterChip({ label, value }) {
  return (
    <div className="bos-dna-v2__footer-chip">
      <span>{label}</span>
      <strong>{shortChip(value, '—', 56)}</strong>
    </div>
  );
}

function CircuitLayer() {
  return (
    <svg className="bos-dna-v2__circuit" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id="bosCircuitGlow" cx="50%" cy="48%" r="42%">
          <stop offset="0%" stopColor="rgba(255,138,0,0.22)" />
          <stop offset="45%" stopColor="rgba(0,212,255,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <circle cx="500" cy="290" r="210" fill="url(#bosCircuitGlow)" />
      <g fill="none" strokeWidth="1.15" opacity="0.62">
        <path d="M500 290 L160 100" stroke="#00d4ff" />
        <path d="M500 290 L140 290" stroke="#9f6bff" />
        <path d="M500 290 L170 480" stroke="#9f6bff" />
        <path d="M500 290 L500 70" stroke="#ff8a00" />
        <path d="M500 290 L840 100" stroke="#ff8a00" />
        <path d="M500 290 L880 290" stroke="#ff8a00" />
        <path d="M500 290 L830 480" stroke="#00d4ff" />
        <path d="M500 290 L500 520" stroke="#00d4ff" opacity="0.45" />
        <path d="M360 180 C420 210, 460 230, 500 230 C540 230, 580 210, 640 180" stroke="#00d4ff" opacity="0.45" />
        <path d="M340 400 C400 360, 450 350, 500 350 C550 350, 600 360, 660 400" stroke="#ff8a00" opacity="0.4" />
        <path d="M280 220 L340 250 L380 250" stroke="#9f6bff" opacity="0.5" />
        <path d="M720 220 L660 250 L620 250" stroke="#ff8a00" opacity="0.5" />
        <path d="M300 360 L360 330 L400 330" stroke="#00d4ff" opacity="0.45" />
        <path d="M700 360 L640 330 L600 330" stroke="#9f6bff" opacity="0.45" />
        <circle cx="160" cy="100" r="3.5" fill="#00d4ff" stroke="none" />
        <circle cx="140" cy="290" r="3.5" fill="#9f6bff" stroke="none" />
        <circle cx="170" cy="480" r="3.5" fill="#9f6bff" stroke="none" />
        <circle cx="840" cy="100" r="3.5" fill="#ff8a00" stroke="none" />
        <circle cx="880" cy="290" r="3.5" fill="#ff8a00" stroke="none" />
        <circle cx="830" cy="480" r="3.5" fill="#00d4ff" stroke="none" />
        <circle cx="500" cy="70" r="3" fill="#ff8a00" stroke="none" />
      </g>
    </svg>
  );
}

/**
 * Resolve display mode.
 * Preferred: mode="preview" | mode="fullscreen"
 * Legacy: variant="inline" | "preview" → preview; variant="fullscreen" → fullscreen
 */
function resolveDisplayMode({ mode, variant }) {
  const raw = String(mode || variant || 'preview').toLowerCase().trim();
  if (raw === 'fullscreen' || raw === 'full' || raw === 'modal') return 'fullscreen';
  // inline / preview / compact / hero all map to premium embedded poster
  return 'preview';
}

function defaultFutureCards(vm) {
  if (Array.isArray(vm.futureCards) && vm.futureCards.length) {
    return vm.futureCards.slice(0, 5);
  }
  return [
    { title: 'Current Trajectory', likelihood: '—', summary: 'Trajectory details not available for this profile.' },
    { title: 'Optimized Trajectory', likelihood: '—', summary: '—' },
    { title: 'Burnout Trajectory', likelihood: '—', summary: '—' },
    { title: 'Leadership Trajectory', likelihood: '—', summary: '—' },
    { title: 'Constraint Trajectory', likelihood: '—', summary: '—' },
  ];
}

/**
 * Premium compact poster for tab embed.
 * Intentionally reduced detail — not a squeezed full dashboard.
 */
function PreviewPoster({ vm, displayProfileId, futureCards }) {
  // Keep One Move short enough for a teaser poster — never a multi-line jam into the engine.
  const oneMoveHeadline = shortChip(
    firstLine(vm.oneMove, 'Open full screen for the highest-leverage move'),
    'Open full screen for the highest-leverage move',
    72,
  );
  const engineHeadline = shortChip(
    firstLine(vm.engineLabel, `${vm.primaryEngine || '—'} + ${vm.secondaryEngine || '—'}`),
    `${vm.primaryEngine || '—'} + ${vm.secondaryEngine || '—'}`,
    36,
  );
  const engineSub = shortChip(
    firstLine(vm.systemType, 'Behavioral Operating System'),
    'Behavioral Operating System',
    40,
  );

  return (
    <div className="bos-dna-v2__frame bos-dna-v2__frame--preview" aria-label="BOS DNA Visual preview">
      <div className="bos-dna-v2__preview">
        <div className="bos-dna-v2__preview-glow" aria-hidden="true" />
        <CircuitLayer />

        {/* 1. Header */}
        <header className="bos-dna-v2__preview-header">
          <div className="bos-dna-v2__preview-identity">
            <p className="bos-dna-v2__preview-eyebrow">Behavioral Operating System</p>
            <h1>{firstLine(vm.name, 'Profile Subject')}</h1>
            <p className="bos-dna-v2__preview-sub">
              {firstLine(vm.type, vm.systemType, 'Visual DNA Map')}
              {vm.company && vm.company !== '—' ? ` · ${vm.company}` : ''}
            </p>
          </div>
          <div className="bos-dna-v2__preview-id" title={displayProfileId}>
            <span>Profile ID</span>
            <strong>{shortChip(displayProfileId, '—', 22)}</strong>
          </div>
        </header>

        {/* 2. Trait cards */}
        <div className="bos-dna-v2__preview-traits">
          <TraitBadge rank="Primary" item={vm.primaryDimension} fallbackLabel={vm.primaryEngine} tone="p" />
          <TraitBadge rank="Secondary" item={vm.secondaryDimension} fallbackLabel={vm.secondaryEngine} tone="s" />
          <TraitBadge rank="Tertiary" item={vm.tertiaryDimension} fallbackLabel="Support" tone="t" />
        </div>

        {/* 3. Central engine — isolated band; never shares space with One Move */}
        <div className="bos-dna-v2__preview-engine" aria-hidden={false}>
          <div className="bos-dna-v2__reactor bos-dna-v2__reactor--preview">
            <div className="bos-dna-v2__ring bos-dna-v2__ring--halo" />
            <div className="bos-dna-v2__ring bos-dna-v2__ring--outer" />
            <div className="bos-dna-v2__ring bos-dna-v2__ring--middle" />
            <div className="bos-dna-v2__ring bos-dna-v2__ring--inner" />
            <div className="bos-dna-v2__reactor-core" aria-hidden="true" />
            <div className="bos-dna-v2__reactor-label">
              <span>Primary Engine</span>
              <strong>{engineHeadline}</strong>
              <em>{engineSub}</em>
            </div>
          </div>
        </div>

        {/* 4. One Move — separate lower band below engine (no absolute overlap) */}
        <section className="bos-dna-v2__preview-move">
          <span className="bos-dna-v2__label bos-dna-v2__label--orange">One Move · Highest Leverage</span>
          <h2>{oneMoveHeadline}</h2>
        </section>

        {/* 5. Compact futures strip */}
        <section className="bos-dna-v2__preview-futures" aria-label="Five Futures preview">
          {futureCards.map((future, index) => (
            <article
              key={`${future.title || 'future'}-${index}`}
              className={`bos-dna-v2__preview-future bos-dna-v2__future--${index + 1}`}
            >
              <span>{future?.likelihood && future.likelihood !== '—' ? future.likelihood : `F${index + 1}`}</span>
              <strong>{shortChip(future?.title, `Future ${index + 1}`, 18)}</strong>
            </article>
          ))}
        </section>

        {/* 6. Footer CTA hint */}
        <p className="bos-dna-v2__preview-hint">Preview · Open Full Screen for the full command center</p>
      </div>
    </div>
  );
}

/**
 * DeterministicBOSDNAVisualV2
 * Premium black / neon command-center BOS DNA poster.
 * Pure presentational + deterministic view-model resolution.
 * No storage, no network, no mutation.
 *
 * Modes:
 * - preview (default for tab embed): clean premium hero poster
 * - fullscreen (modal): dense full command-center dashboard
 */
export default function DeterministicBOSDNAVisualV2({
  viewModel = null,
  profile = null,
  narrative = null,
  customerViewModel = null,
  profileId = null,
  mode = null,
  variant = 'inline',
  density = 'full',
  allowSampleFallback = false,
}) {
  const displayMode = resolveDisplayMode({ mode, variant });
  const isPreview = displayMode === 'preview';
  const isFullscreen = displayMode === 'fullscreen';

  const sourceProfile = profile || customerViewModel || null;
  const vm = resolveViewModel({
    viewModel,
    profile: sourceProfile,
    narrative,
    allowSampleFallback,
  });

  const topDimensions = Array.isArray(vm.topDimensions) ? vm.topDimensions.slice(0, 6) : [];
  const tension = vm.tension || {
    left: vm.primaryDimension?.label || vm.primaryEngine || 'Primary',
    right: vm.secondaryDimension?.label || vm.secondaryEngine || 'Secondary',
    label: 'Transfer Gap',
    detail: vm.futureBottleneck || 'Operating pattern needs clearer handoff rules.',
  };
  const futureCards = defaultFutureCards(vm);

  const evidence = vm.evidenceSummary || {};
  const amplitude = vm.amplitude || { score: null, label: '—' };
  const loop = asList(vm.operatingLoop, 5);
  const displayProfileId = firstLine(profileId, vm.profileId, '—');
  const energySummary = asList(vm.energySource, 1)[0] || '—';
  const fatigueSummary = asList(vm.fatigueSource, 1)[0] || '—';
  const roleFitSummary = asList(vm.roleFitSignals, 2).join(' · ') || '—';

  // CSS class keeps legacy --inline/--fullscreen for modal scaler hooks;
  // --preview is the intentional embedded poster mode.
  const modeClass = isFullscreen ? 'fullscreen' : 'preview';
  const legacyVariantClass = isFullscreen ? 'fullscreen' : (variant === 'inline' ? 'inline' : modeClass);

  return (
    <div
      className={`bos-dna-v2 bos-dna-v2--${modeClass} bos-dna-v2--${legacyVariantClass} bos-dna-v2--${density}`}
      data-mode={displayMode}
      data-poster-width={POSTER_WIDTH}
      data-poster-height={POSTER_HEIGHT}
    >
      <style>{styles}</style>

      {isPreview ? (
        <PreviewPoster
          vm={vm}
          displayProfileId={displayProfileId}
          futureCards={futureCards}
        />
      ) : (
      <div className="bos-dna-v2__frame" aria-label="Behavioral Operating System Visual Map">
        <div className="bos-dna-v2__grid">
          <CircuitLayer />

          <header className="bos-dna-v2__header">
            <div className="bos-dna-v2__panel bos-dna-v2__identity">
              <h1>{firstLine(vm.name, 'Profile Subject')}</h1>
              <p className="bos-dna-v2__role">{firstLine(vm.company, '—')}</p>
              <p className="bos-dna-v2__kicker">Founder operating map · Visual DNA</p>
            </div>
            <div className="bos-dna-v2__title-block">
              <h2>Behavioral Operating System</h2>
              <p>Design · Decide · Move · Compound</p>
            </div>
            <div className="bos-dna-v2__meta">
              <div className="bos-dna-v2__panel bos-dna-v2__meta-card">
                <span>Profile ID</span>
                <strong title={displayProfileId}>{shortChip(displayProfileId, '—', 28)}</strong>
              </div>
              <div className="bos-dna-v2__panel bos-dna-v2__meta-card bos-dna-v2__meta-card--type">
                <span>Profile Type</span>
                <strong>{firstLine(vm.type, vm.systemType, '—')}</strong>
              </div>
            </div>
          </header>

          <aside className="bos-dna-v2__left">
            <section className="bos-dna-v2__panel">
              <div className="bos-dna-v2__label">Dimension Scorecard</div>
              {topDimensions.length ? (
                topDimensions.map((item, index) => (
                  <DimensionRow key={`${item.key || item.label}-${index}`} item={item} index={index} />
                ))
              ) : (
                <p className="bos-dna-v2__empty">Dimension scores are not available for this profile record.</p>
              )}
            </section>

            <section className="bos-dna-v2__panel">
              <div className="bos-dna-v2__label">Evidence &amp; Amplitude</div>
              <div className="bos-dna-v2__evidence">
                <div>
                  <div className="bos-dna-v2__ev-row">
                    <span>Strong</span>
                    <span className="bos-dna-v2__dim-bar"><i style={{ width: `${Math.min(100, (evidence.strong || 0) * 22)}%`, background: '#00d4ff' }} /></span>
                    <span className="bos-dna-v2__dim-score">{evidence.strong ?? '—'}</span>
                  </div>
                  <div className="bos-dna-v2__ev-row">
                    <span>Mod</span>
                    <span className="bos-dna-v2__dim-bar"><i style={{ width: `${Math.min(100, (evidence.moderate || 0) * 28)}%`, background: '#00d4ff' }} /></span>
                    <span className="bos-dna-v2__dim-score">{evidence.moderate ?? '—'}</span>
                  </div>
                  <div className="bos-dna-v2__ev-row">
                    <span>Thin</span>
                    <span className="bos-dna-v2__dim-bar"><i style={{ width: `${Math.min(100, (evidence.thin || 0) * 34)}%`, background: '#00d4ff' }} /></span>
                    <span className="bos-dna-v2__dim-score">{evidence.thin ?? '—'}</span>
                  </div>
                </div>
                <div className="bos-dna-v2__amp">
                  <strong>
                    {Number.isFinite(Number(amplitude.score)) ? Number(amplitude.score).toFixed(2) : '—'}
                  </strong>
                  <small>{amplitude.label || '—'}</small>
                </div>
              </div>
            </section>

            <div className="bos-dna-v2__dual">
              <section className="bos-dna-v2__panel">
                <div className="bos-dna-v2__label bos-dna-v2__label--cyan">Energy Source</div>
                <CompactList items={vm.energySource} />
              </section>
              <section className="bos-dna-v2__panel">
                <div className="bos-dna-v2__label bos-dna-v2__label--orange">Fatigue Source</div>
                <CompactList items={vm.fatigueSource} />
              </section>
            </div>
          </aside>

          <main className="bos-dna-v2__engine">
            <div className="bos-dna-v2__badges">
              <TraitBadge rank="Primary" item={vm.primaryDimension} fallbackLabel={vm.primaryEngine} tone="p" />
              <TraitBadge rank="Secondary" item={vm.secondaryDimension} fallbackLabel={vm.secondaryEngine} tone="s" />
              <TraitBadge rank="Tertiary" item={vm.tertiaryDimension} fallbackLabel="Support" tone="t" />
            </div>

            <div className="bos-dna-v2__io bos-dna-v2__io--left bos-dna-v2__panel">
              <div className="bos-dna-v2__label">Inputs</div>
              <CompactList items={vm.inputs} empty="—" />
            </div>

            <div className="bos-dna-v2__reactor" aria-hidden={false}>
              <div className="bos-dna-v2__ring bos-dna-v2__ring--halo" />
              <div className="bos-dna-v2__ring bos-dna-v2__ring--outer" />
              <div className="bos-dna-v2__ring bos-dna-v2__ring--middle" />
              <div className="bos-dna-v2__ring bos-dna-v2__ring--inner" />
              <div className="bos-dna-v2__reactor-core" aria-hidden="true" />
              <div className="bos-dna-v2__reactor-label">
                <span>Primary Engine</span>
                <strong>{firstLine(vm.engineLabel, `${vm.primaryEngine || '—'} + ${vm.secondaryEngine || '—'}`)}</strong>
                <em>{firstLine(vm.systemType, `${vm.primaryEngine || '—'} + ${vm.secondaryEngine || '—'}`)}</em>
              </div>
            </div>

            <div className="bos-dna-v2__io bos-dna-v2__io--right bos-dna-v2__panel">
              <div className="bos-dna-v2__label">Outputs</div>
              <CompactList items={vm.outputs} empty="—" />
            </div>

            <section className="bos-dna-v2__loop">
              <div className="bos-dna-v2__label bos-dna-v2__label--cyan">Operating Loop</div>
              <div className="bos-dna-v2__loop-row">
                {(loop.length ? loop : ['Sense', 'Decide', 'Move', 'Measure', 'Adapt']).map((step) => (
                  <span key={step}>{step}</span>
                ))}
              </div>
            </section>
          </main>

          <aside className="bos-dna-v2__right">
            <section className="bos-dna-v2__panel">
              <div className="bos-dna-v2__label">Core Tension</div>
              <div className="bos-dna-v2__tension-row">
                <strong>{tension.left || '—'}</strong>
                <span className="bos-dna-v2__vs">VS</span>
                <strong>{tension.right || '—'}</strong>
              </div>
              <h3 className="bos-dna-v2__panel-title">{tension.label || '—'}</h3>
              <p className="bos-dna-v2__panel-body">{tension.detail || vm.futureBottleneck || '—'}</p>
            </section>

            <section className={`bos-dna-v2__panel bos-dna-v2__risk ${riskClass(vm.wrongSeatRisk)}`}>
              <div className="bos-dna-v2__label">Wrong-Seat Risk</div>
              <p className="bos-dna-v2__risk-level">{firstLine(vm.wrongSeatRisk, 'Moderate')}</p>
              {vm.futureBottleneck ? (
                <p className="bos-dna-v2__panel-body">{vm.futureBottleneck}</p>
              ) : (
                <p className="bos-dna-v2__empty">Constraint detail not available</p>
              )}
            </section>

            <div className="bos-dna-v2__env">
              <section className="bos-dna-v2__panel">
                <div className="bos-dna-v2__label bos-dna-v2__label--green">Best Environment</div>
                <CompactList items={vm.bestEnvironment} />
              </section>
              <section className="bos-dna-v2__panel">
                <div className="bos-dna-v2__label bos-dna-v2__label--risk">Worst Environment</div>
                <CompactList items={vm.worstEnvironment} />
              </section>
            </div>

            <section className="bos-dna-v2__panel bos-dna-v2__one-move">
              <div className="bos-dna-v2__label bos-dna-v2__label--orange">One Move · Highest Leverage</div>
              <h3 className="bos-dna-v2__one-move-title">{firstLine(vm.oneMove, '—')}</h3>
              <p className="bos-dna-v2__panel-body bos-dna-v2__one-move-body">{firstLine(vm.roleTruth, vm.evolutionPath, '—')}</p>
            </section>
          </aside>

          <section className="bos-dna-v2__futures">
            {futureCards.map((future, index) => (
              <FutureCard key={`${future.title}-${index}`} item={future} index={index} />
            ))}
          </section>

          <section className="bos-dna-v2__panel bos-dna-v2__signals">
            <div className="bos-dna-v2__label">Key Signals</div>
            <CompactList items={vm.keySignals} empty="Key signals not available for this profile." />
          </section>

          <footer className="bos-dna-v2__footer bos-dna-v2__panel">
            <FooterChip label="Natural Advantage" value={vm.naturalAdvantage} />
            <FooterChip label="Natural Risk" value={vm.naturalRisk} />
            <FooterChip label="Energy" value={energySummary} />
            <FooterChip label="Fatigue" value={fatigueSummary} />
            <FooterChip label="Role Fit" value={roleFitSummary} />
            <FooterChip label="Wrong-Seat Risk" value={vm.wrongSeatRisk || '—'} />
          </footer>
        </div>
      </div>
      )}
    </div>
  );
}

export { POSTER_WIDTH as BOS_DNA_V2_POSTER_WIDTH, POSTER_HEIGHT as BOS_DNA_V2_POSTER_HEIGHT };

const styles = `
.bos-dna-v2 {
  --bos-bg: #020203;
  --bos-panel: rgba(255,255,255,0.045);
  --bos-border: rgba(255,255,255,0.13);
  --bos-text: #f7f7f2;
  --bos-muted: rgba(247,247,242,0.72);
  --bos-dim: rgba(247,247,242,0.46);
  --bos-orange: #ff8a00;
  --bos-cyan: #00d4ff;
  --bos-purple: #a66bff;
  --bos-green: #b8ff35;
  --bos-risk: #ff4d2e;
  width: 100%;
  color: var(--bos-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.bos-dna-v2__frame {
  width: min(100%, ${POSTER_WIDTH}px);
  aspect-ratio: ${POSTER_WIDTH} / ${POSTER_HEIGHT};
  margin: 0 auto;
  position: relative;
}

.bos-dna-v2--fullscreen .bos-dna-v2__frame {
  width: ${POSTER_WIDTH}px;
  height: ${POSTER_HEIGHT}px;
  min-width: ${POSTER_WIDTH}px;
  max-width: ${POSTER_WIDTH}px;
  aspect-ratio: ${POSTER_WIDTH} / ${POSTER_HEIGHT};
}

.bos-dna-v2__grid {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 23.5% minmax(0, 1fr) 23.5%;
  grid-template-rows: 84px minmax(0, 1fr) 124px 58px;
  gap: 12px;
  padding: 16px 18px 14px;
  border: 1px solid rgba(255,138,0,0.38);
  border-radius: 10px;
  background:
    radial-gradient(circle at 50% 40%, rgba(255,138,0,0.16), transparent 28%),
    radial-gradient(circle at 64% 46%, rgba(0,212,255,0.12), transparent 26%),
    radial-gradient(circle at 36% 54%, rgba(166,107,255,0.12), transparent 30%),
    linear-gradient(145deg, #030405 0%, #07090e 42%, #020203 100%);
  box-shadow:
    0 0 60px rgba(255,138,0,0.1),
    inset 0 0 120px rgba(0,0,0,0.78),
    inset 0 1px 0 rgba(255,255,255,0.04);
  overflow: hidden;
}

.bos-dna-v2__circuit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.78;
  z-index: 0;
}

.bos-dna-v2__panel {
  position: relative;
  z-index: 1;
  border: 1px solid var(--bos-border);
  border-radius: 9px;
  background:
    linear-gradient(160deg, rgba(255,255,255,0.075), rgba(255,255,255,0.018) 55%, rgba(0,0,0,0.18));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.05),
    inset 0 0 28px rgba(255,255,255,0.015),
    0 8px 22px rgba(0,0,0,0.28);
  backdrop-filter: blur(10px);
  padding: 10px 12px;
  min-height: 0;
  overflow: hidden;
}

.bos-dna-v2__label {
  color: var(--bos-purple);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  line-height: 1.2;
}

.bos-dna-v2__label--cyan { color: var(--bos-cyan); }
.bos-dna-v2__label--orange { color: var(--bos-orange); }
.bos-dna-v2__label--green { color: var(--bos-green); }
.bos-dna-v2__label--risk { color: var(--bos-risk); }

.bos-dna-v2__header {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 23.5% minmax(0, 1fr) 23.5%;
  gap: 12px;
  z-index: 1;
  min-height: 0;
  align-items: stretch;
}

.bos-dna-v2__identity {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-top: 8px;
  padding-bottom: 8px;
}

.bos-dna-v2__identity h1 {
  margin: 0;
  font-size: 23px;
  line-height: 1.05;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__role {
  margin: 5px 0 0;
  color: var(--bos-orange);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__kicker {
  margin: 5px 0 0;
  color: var(--bos-dim);
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.bos-dna-v2__title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  z-index: 1;
  padding: 0 8px;
}

.bos-dna-v2__title-block h2 {
  margin: 0;
  color: var(--bos-orange);
  font-size: 26px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 800;
  text-shadow:
    0 0 28px rgba(255,138,0,0.42),
    0 0 2px rgba(255,138,0,0.55);
  line-height: 1.05;
}

.bos-dna-v2__title-block p {
  margin: 8px 0 0;
  color: var(--bos-muted);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-weight: 600;
}

.bos-dna-v2__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  z-index: 1;
}

.bos-dna-v2__meta-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.bos-dna-v2__meta-card--type {
  border-color: rgba(0,212,255,0.35);
  box-shadow: inset 0 0 18px rgba(0,212,255,0.06), 0 0 16px rgba(0,212,255,0.08);
}

.bos-dna-v2__meta span {
  display: block;
  color: var(--bos-dim);
  font-size: 8.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.bos-dna-v2__meta strong {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__left,
.bos-dna-v2__right,
.bos-dna-v2__engine {
  min-height: 0;
  z-index: 1;
}

.bos-dna-v2__left {
  display: grid;
  grid-template-rows: 1.42fr 0.78fr 0.88fr;
  gap: 10px;
}

.bos-dna-v2__right {
  display: grid;
  grid-template-rows: 0.82fr 0.78fr 0.82fr 1.05fr;
  gap: 10px;
}

.bos-dna-v2__engine {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  place-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0 4px;
}

.bos-dna-v2__dim-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  margin-top: 8px;
}

.bos-dna-v2__dim-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 4px;
  box-shadow: 0 0 10px currentColor;
  flex-shrink: 0;
}

.bos-dna-v2__dim-main {
  min-width: 0;
}

.bos-dna-v2__dim-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.bos-dna-v2__dim-label {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bos-text);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__dim-bar {
  display: block;
  height: 7px;
  margin-top: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,0.07);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
}

.bos-dna-v2__dim-bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  box-shadow: 0 0 12px rgba(255,138,0,0.28);
}

.bos-dna-v2__dim-score {
  text-align: right;
  color: var(--bos-muted);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
}

.bos-dna-v2__dim-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 4px;
}

.bos-dna-v2__dim-chips em {
  font-style: normal;
  font-size: 7.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bos-dim);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 1px 4px;
  background: rgba(0,0,0,0.25);
  white-space: nowrap;
}

.bos-dna-v2__dim-meta {
  display: none;
}

.bos-dna-v2__evidence {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  gap: 10px;
  margin-top: 6px;
  align-items: center;
}

.bos-dna-v2__ev-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 28px;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
  font-size: 10px;
  color: var(--bos-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bos-dna-v2__ev-row .bos-dna-v2__dim-score {
  font-size: 10px;
}

.bos-dna-v2__amp {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid rgba(0,212,255,0.7);
  display: grid;
  place-items: center;
  text-align: center;
  box-shadow:
    0 0 24px rgba(0,212,255,0.28),
    inset 0 0 18px rgba(0,212,255,0.12);
  margin: 0 auto;
  background: radial-gradient(circle at 40% 35%, rgba(0,212,255,0.18), rgba(0,0,0,0.62));
}

.bos-dna-v2__amp strong {
  display: block;
  font-size: 15px;
  color: var(--bos-cyan);
  line-height: 1;
  font-weight: 800;
  text-shadow: 0 0 12px rgba(0,212,255,0.35);
}

.bos-dna-v2__amp small {
  display: block;
  margin-top: 3px;
  color: var(--bos-dim);
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}

.bos-dna-v2__dual,
.bos-dna-v2__env {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  min-height: 0;
}

.bos-dna-v2__list {
  margin: 7px 0 0;
  padding: 0 0 0 13px;
  color: var(--bos-muted);
  font-size: 10px;
  line-height: 1.38;
}

.bos-dna-v2__list li {
  margin: 2px 0;
}

.bos-dna-v2__empty {
  margin: 8px 0 0;
  color: var(--bos-dim);
  font-size: 10px;
  line-height: 1.35;
  font-style: italic;
}

.bos-dna-v2__badges {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  width: min(94%, 460px);
  z-index: 2;
}

.bos-dna-v2__badge {
  text-align: center;
  padding: 9px 7px 8px;
  border-radius: 10px;
  border: 1px solid var(--bos-border);
  background:
    linear-gradient(165deg, rgba(8,10,16,0.88), rgba(0,0,0,0.55));
  min-width: 0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}

.bos-dna-v2__badge span {
  display: block;
  font-size: 8.5px;
  color: var(--bos-dim);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.bos-dna-v2__badge strong {
  display: block;
  margin-top: 4px;
  font-size: 12.5px;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__badge em {
  display: block;
  margin-top: 3px;
  font-style: normal;
  color: var(--bos-muted);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bos-dna-v2__badge small {
  display: block;
  margin-top: 3px;
  color: var(--bos-dim);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bos-dna-v2__badge--p {
  border-color: rgba(166,107,255,0.62);
  box-shadow: 0 0 18px rgba(166,107,255,0.16), inset 0 0 16px rgba(166,107,255,0.06);
}
.bos-dna-v2__badge--s {
  border-color: rgba(255,138,0,0.62);
  box-shadow: 0 0 18px rgba(255,138,0,0.16), inset 0 0 16px rgba(255,138,0,0.06);
}
.bos-dna-v2__badge--t {
  border-color: rgba(0,212,255,0.62);
  box-shadow: 0 0 18px rgba(0,212,255,0.16), inset 0 0 16px rgba(0,212,255,0.06);
}

.bos-dna-v2__reactor {
  position: relative;
  width: min(78%, 360px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  z-index: 2;
}

.bos-dna-v2__ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
  pointer-events: none;
}

.bos-dna-v2__ring--halo {
  inset: -7%;
  border: 1px solid rgba(255,138,0,0.18);
  box-shadow:
    0 0 48px rgba(255,138,0,0.18),
    0 0 90px rgba(0,212,255,0.08);
  background: radial-gradient(circle, rgba(255,138,0,0.08), transparent 68%);
}

.bos-dna-v2__ring--outer {
  inset: 0;
  border-color: rgba(255,138,0,0.72);
  box-shadow:
    0 0 46px rgba(255,138,0,0.32),
    inset 0 0 34px rgba(0,212,255,0.1),
    0 0 0 1px rgba(166,107,255,0.18);
  background:
    conic-gradient(from 200deg,
      rgba(0,212,255,0.2),
      rgba(166,107,255,0.14),
      rgba(255,138,0,0.26),
      rgba(0,212,255,0.2));
}

.bos-dna-v2__ring--middle {
  inset: 11%;
  border-color: rgba(0,212,255,0.62);
  box-shadow:
    0 0 28px rgba(0,212,255,0.22),
    inset 0 0 20px rgba(0,212,255,0.08);
  background: radial-gradient(circle, rgba(0,212,255,0.05), transparent 70%);
}

.bos-dna-v2__ring--inner {
  inset: 24%;
  border-color: rgba(166,107,255,0.5);
  background:
    radial-gradient(circle at 45% 40%, rgba(40,22,12,0.96), rgba(2,3,6,0.98));
  box-shadow:
    inset 0 0 42px rgba(255,138,0,0.14),
    0 0 18px rgba(166,107,255,0.12);
}

.bos-dna-v2__reactor-core {
  position: absolute;
  inset: 38%;
  border-radius: 50%;
  border: 1px solid rgba(255,138,0,0.35);
  background: radial-gradient(circle at 40% 35%, rgba(255,138,0,0.22), rgba(0,0,0,0.55));
  box-shadow: 0 0 22px rgba(255,138,0,0.2);
  z-index: 2;
}

.bos-dna-v2__reactor-label {
  position: relative;
  z-index: 3;
  text-align: center;
  padding: 10px;
  max-width: 74%;
}

.bos-dna-v2__reactor-label span {
  display: block;
  color: var(--bos-orange);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 800;
  text-shadow: 0 0 12px rgba(255,138,0,0.35);
}

.bos-dna-v2__reactor-label strong {
  display: block;
  margin-top: 7px;
  font-size: 17px;
  line-height: 1.12;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  text-shadow:
    0 0 20px rgba(255,138,0,0.4),
    0 0 2px rgba(255,200,120,0.35);
}

.bos-dna-v2__reactor-label em {
  display: block;
  margin-top: 7px;
  font-style: normal;
  color: var(--bos-cyan);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
}

.bos-dna-v2__io {
  position: absolute;
  top: 40%;
  width: 104px;
  z-index: 2;
  padding: 9px 10px;
  background:
    linear-gradient(160deg, rgba(8,12,18,0.82), rgba(0,0,0,0.55));
}

.bos-dna-v2__io--left { left: 0.5%; }
.bos-dna-v2__io--right { right: 0.5%; text-align: right; }
.bos-dna-v2__io--right .bos-dna-v2__list {
  padding: 0 12px 0 0;
  list-style-position: inside;
}

.bos-dna-v2__io .bos-dna-v2__list {
  font-size: 9.5px;
  margin-top: 5px;
}

.bos-dna-v2__loop {
  width: min(94%, 540px);
  z-index: 2;
  text-align: center;
  padding: 2px 0 0;
}

.bos-dna-v2__loop-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  margin-top: 7px;
}

.bos-dna-v2__loop-row span {
  flex: 1;
  border: 1px solid rgba(0,212,255,0.4);
  border-radius: 999px;
  padding: 6px 3px;
  font-size: 9px;
  color: var(--bos-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  background: linear-gradient(180deg, rgba(0,20,28,0.55), rgba(0,0,0,0.4));
  box-shadow: 0 0 14px rgba(0,212,255,0.1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__tension-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  text-transform: uppercase;
}

.bos-dna-v2__tension-row strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  letter-spacing: 0.03em;
}

.bos-dna-v2__vs {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.18);
  display: grid;
  place-items: center;
  font-size: 9px;
  font-weight: 800;
  color: var(--bos-dim);
  background: rgba(0,0,0,0.35);
  box-shadow: 0 0 12px rgba(166,107,255,0.12);
}

.bos-dna-v2__panel-title {
  margin: 7px 0 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--bos-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__panel-body {
  margin: 6px 0 0;
  color: var(--bos-muted);
  font-size: 10px;
  line-height: 1.38;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bos-dna-v2__risk {
  border-color: rgba(255,77,46,0.5);
  background: linear-gradient(150deg, rgba(255,77,46,0.14), rgba(255,255,255,0.02) 55%, rgba(0,0,0,0.2));
  box-shadow: inset 0 0 22px rgba(255,77,46,0.06), 0 0 18px rgba(255,77,46,0.08);
}

.bos-dna-v2__risk.is-high .bos-dna-v2__risk-level { color: var(--bos-risk); text-shadow: 0 0 18px rgba(255,77,46,0.35); }
.bos-dna-v2__risk.is-moderate .bos-dna-v2__risk-level { color: var(--bos-orange); text-shadow: 0 0 16px rgba(255,138,0,0.3); }
.bos-dna-v2__risk.is-low .bos-dna-v2__risk-level { color: var(--bos-green); text-shadow: 0 0 14px rgba(184,255,53,0.25); }

.bos-dna-v2__risk-level {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}

.bos-dna-v2__risk .bos-dna-v2__panel-body,
.bos-dna-v2__risk .bos-dna-v2__empty {
  -webkit-line-clamp: 2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bos-dna-v2__one-move {
  border-color: rgba(255,138,0,0.62);
  background:
    linear-gradient(155deg, rgba(255,138,0,0.14), rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.22));
  box-shadow:
    0 0 28px rgba(255,138,0,0.14),
    inset 0 0 24px rgba(255,138,0,0.05);
}

.bos-dna-v2__one-move-title {
  margin: 8px 0 0;
  color: var(--bos-orange);
  font-size: 14.5px;
  line-height: 1.22;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-weight: 800;
  text-shadow: 0 0 16px rgba(255,138,0,0.28);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bos-dna-v2__one-move-body {
  -webkit-line-clamp: 2;
}

.bos-dna-v2__futures {
  grid-column: 1 / 3;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 9px;
  z-index: 1;
  min-height: 0;
}

.bos-dna-v2__future {
  padding: 10px 10px 9px;
  border: 1px solid var(--bos-border);
  border-radius: 9px;
  background:
    linear-gradient(160deg, rgba(255,255,255,0.065), rgba(255,255,255,0.015) 60%, rgba(0,0,0,0.2));
  min-width: 0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  overflow: hidden;
}

.bos-dna-v2__future--1 { border-color: rgba(255,138,0,0.5); box-shadow: inset 0 0 18px rgba(255,138,0,0.05); }
.bos-dna-v2__future--2 { border-color: rgba(0,212,255,0.5); box-shadow: inset 0 0 18px rgba(0,212,255,0.05); }
.bos-dna-v2__future--3 { border-color: rgba(255,77,46,0.45); box-shadow: inset 0 0 18px rgba(255,77,46,0.05); }
.bos-dna-v2__future--4 { border-color: rgba(166,107,255,0.55); box-shadow: inset 0 0 18px rgba(166,107,255,0.06); }
.bos-dna-v2__future--5 { border-color: rgba(166,107,255,0.32); box-shadow: inset 0 0 18px rgba(166,107,255,0.04); }

.bos-dna-v2__future-head {
  display: flex;
  align-items: center;
  min-width: 0;
}

.bos-dna-v2__future span {
  display: inline-block;
  max-width: 100%;
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bos-cyan);
  border: 1px solid rgba(0,212,255,0.38);
  border-radius: 4px;
  padding: 2px 6px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(0,20,28,0.35);
}

.bos-dna-v2__future strong {
  display: block;
  margin-top: 7px;
  color: var(--bos-text);
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__future p {
  margin: 6px 0 0;
  color: var(--bos-muted);
  font-size: 10px;
  line-height: 1.28;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bos-dna-v2__signals {
  grid-column: 3 / 4;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.bos-dna-v2__signals .bos-dna-v2__list {
  flex: 1;
  min-height: 0;
}

.bos-dna-v2__footer {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  z-index: 1;
  border-color: rgba(255,138,0,0.28);
  background:
    linear-gradient(180deg, rgba(255,138,0,0.08), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.25));
}

.bos-dna-v2__footer-chip {
  min-width: 0;
  padding: 0 2px;
  border-left: 1px solid rgba(255,255,255,0.08);
  padding-left: 8px;
}

.bos-dna-v2__footer-chip:first-child {
  border-left: 0;
  padding-left: 0;
}

.bos-dna-v2__footer-chip span {
  display: block;
  font-size: 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bos-dim);
  font-weight: 700;
}

.bos-dna-v2__footer-chip strong {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  line-height: 1.2;
  color: var(--bos-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Preview mode: clean premium teaser poster (NOT dense dashboard) ──
 * Layout doctrine (VDNA2E):
 *  header → traits → engine band → One Move band → futures → footer hint
 * Content-driven height (no short aspect-ratio jam). No absolute text overlap.
 */
.bos-dna-v2--preview {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.bos-dna-v2__frame--preview {
  width: 100%;
  max-width: 100%;
  /* Content-height poster — do NOT force 16/10 (that mashed engine + One Move) */
  aspect-ratio: auto;
  min-height: 0;
  margin: 0 auto;
  overflow: hidden;
}

.bos-dna-v2__preview {
  position: relative;
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: clamp(0.55rem, 1.4vw, 0.85rem);
  padding: clamp(0.9rem, 2.2vw, 1.35rem);
  border: 1px solid rgba(255,138,0,0.42);
  border-radius: 12px;
  background:
    radial-gradient(circle at 50% 42%, rgba(255,138,0,0.16), transparent 30%),
    radial-gradient(circle at 72% 38%, rgba(0,212,255,0.1), transparent 26%),
    radial-gradient(circle at 28% 55%, rgba(166,107,255,0.11), transparent 30%),
    linear-gradient(150deg, #030405 0%, #090b12 48%, #020203 100%);
  box-shadow:
    0 0 48px rgba(255,138,0,0.12),
    inset 0 0 90px rgba(0,0,0,0.72),
    inset 0 1px 0 rgba(255,255,255,0.04);
  overflow: hidden;
}

.bos-dna-v2__preview-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: min(48%, 16rem);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255,138,0,0.14), rgba(0,212,255,0.05) 42%, transparent 70%);
  filter: blur(2px);
  pointer-events: none;
  z-index: 0;
}

.bos-dna-v2__preview .bos-dna-v2__circuit {
  opacity: 0.5;
}

.bos-dna-v2__preview-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
  flex: 0 0 auto;
}

.bos-dna-v2__preview-identity {
  min-width: 0;
  flex: 1 1 auto;
}

.bos-dna-v2__preview-eyebrow {
  margin: 0;
  color: var(--bos-orange);
  font-size: clamp(0.6rem, 1.1vw, 0.72rem);
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-shadow: 0 0 18px rgba(255,138,0,0.4);
}

.bos-dna-v2__preview-identity h1 {
  margin: 0.28rem 0 0;
  font-size: clamp(1.05rem, 2.4vw, 1.55rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__preview-sub {
  margin: 0.28rem 0 0;
  color: var(--bos-muted);
  font-size: clamp(0.66rem, 1.15vw, 0.8rem);
  letter-spacing: 0.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__preview-id {
  flex: 0 0 auto;
  max-width: 34%;
  padding: 0.42rem 0.62rem;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 9px;
  background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(0,0,0,0.45));
  text-align: right;
  min-width: 0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}

.bos-dna-v2__preview-id span {
  display: block;
  color: var(--bos-dim);
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.bos-dna-v2__preview-id strong {
  display: block;
  margin-top: 0.16rem;
  font-size: clamp(0.6rem, 1.05vw, 0.72rem);
  color: var(--bos-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__preview-traits {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(0.4rem, 1.2vw, 0.7rem);
  width: min(100%, 34rem);
  margin: 0 auto;
  flex: 0 0 auto;
}

.bos-dna-v2__preview-traits .bos-dna-v2__badge {
  padding: clamp(0.42rem, 1vw, 0.58rem) 0.4rem;
}

.bos-dna-v2__preview-traits .bos-dna-v2__badge strong {
  font-size: clamp(0.68rem, 1.25vw, 0.88rem);
}

.bos-dna-v2__preview-traits .bos-dna-v2__badge em {
  font-size: clamp(0.64rem, 1.1vw, 0.78rem);
}

/* Engine band: reserved vertical space; clips halo bleed; never shares row with One Move */
.bos-dna-v2__preview-engine {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 100%;
  min-height: 10.5rem;
  padding: 0.35rem 0 0.45rem;
  overflow: hidden; /* clip ring halo so it cannot paint over One Move */
  isolation: isolate;
}

.bos-dna-v2__reactor--preview {
  width: min(38%, 11.5rem);
  max-width: 11.5rem;
  max-height: 11.5rem;
  flex: 0 0 auto;
}

.bos-dna-v2__reactor--preview .bos-dna-v2__ring--halo {
  inset: -4%; /* tighter halo — less bleed risk */
}

.bos-dna-v2__reactor--preview .bos-dna-v2__reactor-label {
  max-width: 82%;
  padding: 6px;
}

.bos-dna-v2__reactor--preview .bos-dna-v2__reactor-label strong {
  font-size: clamp(0.72rem, 1.35vw, 0.95rem);
  line-height: 1.15;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
}

.bos-dna-v2__reactor--preview .bos-dna-v2__reactor-label span {
  font-size: clamp(0.52rem, 0.95vw, 0.62rem);
}

.bos-dna-v2__reactor--preview .bos-dna-v2__reactor-label em {
  font-size: clamp(0.5rem, 0.9vw, 0.62rem);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* One Move: explicit band BELOW engine — flow layout only, no absolute positioning */
.bos-dna-v2__preview-move {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  text-align: center;
  min-width: 0;
  margin: 0 auto;
  width: min(100%, 40rem);
  padding: clamp(0.48rem, 1.1vw, 0.65rem) clamp(0.65rem, 1.8vw, 1.1rem);
  border: 1px solid rgba(255,138,0,0.4);
  border-radius: 10px;
  background:
    linear-gradient(160deg, rgba(255,138,0,0.12), rgba(255,255,255,0.02) 55%, rgba(0,0,0,0.25));
  box-shadow: 0 0 24px rgba(255,138,0,0.1), inset 0 0 18px rgba(255,138,0,0.04);
}

.bos-dna-v2__preview-move .bos-dna-v2__label {
  font-size: clamp(0.54rem, 0.95vw, 0.66rem);
}

.bos-dna-v2__preview-move h2 {
  margin: 0.28rem 0 0;
  color: var(--bos-orange);
  font-size: clamp(0.82rem, 1.65vw, 1.05rem);
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-shadow: 0 0 22px rgba(255,138,0,0.32);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bos-dna-v2__preview-futures {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: clamp(0.3rem, 0.9vw, 0.5rem);
  min-width: 0;
  flex: 0 0 auto;
}

.bos-dna-v2__preview-future {
  min-width: 0;
  padding: clamp(0.38rem, 0.95vw, 0.52rem) clamp(0.28rem, 0.75vw, 0.42rem);
  border: 1px solid var(--bos-border);
  border-radius: 8px;
  background: linear-gradient(150deg, rgba(255,255,255,0.07), rgba(0,0,0,0.2));
  text-align: center;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}

.bos-dna-v2__preview-future span {
  display: block;
  font-size: clamp(0.48rem, 0.9vw, 0.58rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bos-cyan);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__preview-future strong {
  display: block;
  margin-top: 0.26rem;
  color: var(--bos-text);
  font-size: clamp(0.56rem, 1vw, 0.7rem);
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bos-dna-v2__preview-hint {
  position: relative;
  z-index: 1;
  margin: 0;
  flex: 0 0 auto;
  text-align: center;
  color: var(--bos-dim);
  font-size: clamp(0.52rem, 0.95vw, 0.64rem);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
}

/* Narrow preview: keep poster stack; never jam a 3-column dashboard */
@media (max-width: 640px) {
  .bos-dna-v2__preview {
    gap: 0.55rem;
    padding: 0.85rem;
  }

  .bos-dna-v2__preview-identity h1 {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .bos-dna-v2__preview-sub {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .bos-dna-v2__preview-engine {
    min-height: 9.5rem;
  }

  .bos-dna-v2__reactor--preview {
    width: min(52%, 10.5rem);
    max-width: 10.5rem;
    max-height: 10.5rem;
  }

  .bos-dna-v2__preview-futures {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .bos-dna-v2__preview-future strong {
    font-size: 0.52rem;
  }

  .bos-dna-v2__preview-move h2 {
    font-size: 0.86rem;
  }
}

`;
