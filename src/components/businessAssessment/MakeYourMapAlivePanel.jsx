/**
 * MAKE YOUR MAP ALIVE — production subscription conversion panel.
 *
 * Universal BA conversion UI (no profile-specific hardcoding).
 * Presentation only: does not generate intelligence or invent Stripe routes.
 * CTA must use the canonical more_monthly_intelligence ingress via parent handler.
 *
 * Responsive doctrine:
 * - Desktop: premium 4-zone composition (promise | benefits | RSL | CTA) + trust strip
 * - Tablet: hybrid 2x2 reflow with full-width CTA
 * - Mobile: deliberate single-column stack (promise → benefits → RSL → CTA → trust)
 *
 * Intended to render OUTSIDE BusinessArtifactViewer fit-scale so layout reflows
 * natively instead of shrinking as a miniature desktop artifact.
 * Styles are self-contained (container queries + viewport fallbacks).
 */

import { useState } from 'react';
import {
  CTA_UNAVAILABLE_MESSAGE,
  getMapAliveSubscriptionProductKey,
} from '../../lib/stripe/subscriptionConversionIngress.js';

export const BUSINESS_ENGINE_BENEFITS = Object.freeze([
  'Track progress against your One Move',
  'Detect when your primary constraint improves or changes',
  'Recalculate your Five Futures from new business evidence',
  'Increase confidence as missing information is collected',
  'Recommend the next highest-leverage move when you are ready',
  'Build an evolving Business Intelligence history instead of isolated assessments',
]);

export const RSL_EVIDENCE_STAGES = Object.freeze([
  'Coach insights added as evidence',
  'Implementation progress captured',
  'Outcomes measured and tracked',
  'Business Engine learns and adapts',
]);

/**
 * @param {object} props
 * @param {{ loading?: string, error?: string }} [props.checkoutState]
 * @param {() => void | Promise<void>} [props.onStartCheckout] - parent wires canonical Stripe ingress
 * @param {{ last_updated?: string, snapshot_label?: string, last_updated_label?: string }} [props.temporalMeta]
 */
export default function MakeYourMapAlivePanel({
  checkoutState = { loading: '', error: '' },
  onStartCheckout = null,
  temporalMeta = null,
}) {
  const [localError, setLocalError] = useState('');
  const productKey = getMapAliveSubscriptionProductKey();
  const isLoading = checkoutState?.loading === productKey;
  const parentError =
    typeof checkoutState?.error === 'string' && checkoutState.error.trim()
      ? checkoutState.error.trim()
      : '';
  const displayError = parentError || localError;

  function handleClick() {
    setLocalError('');
    if (typeof onStartCheckout === 'function') {
      onStartCheckout();
      return;
    }
    // Fail closed — never route to "#" or silently no-op without feedback.
    setLocalError(CTA_UNAVAILABLE_MESSAGE);
  }

  return (
    <section
      className="bev2-map-alive"
      data-region="make-your-map-alive"
      data-subscription-conversion="true"
      data-cta-product-key={productKey}
      data-responsive-mode="native-unscaled"
      aria-labelledby="bev2-map-alive-heading"
    >
      <style>{mapAliveStyles}</style>
      <div className="bev2-map-alive-glow" aria-hidden="true" />

      <div className="bev2-map-alive-grid">
        {/* SECTION A — PRIMARY PROMISE */}
        <div className="bev2-map-alive-zone zone-promise" data-zone="promise">
          <p className="bev2-map-alive-kicker">Subscription</p>
          <h2 id="bev2-map-alive-heading">MAKE YOUR MAP ALIVE</h2>
          <p className="bev2-map-alive-lead">Your assessment is only the beginning.</p>
          <p className="bev2-map-alive-copy">
            Your Business Engine continues learning as your business changes, your evidence grows,
            and your results improve.
          </p>
        </div>

        {/* SECTION B — BUSINESS ENGINE VALUE */}
        <div className="bev2-map-alive-zone zone-benefits" data-zone="business-engine-benefits">
          <h3>YOUR BUSINESS ENGINE WILL:</h3>
          <ul className="bev2-map-alive-benefits">
            {BUSINESS_ENGINE_BENEFITS.map((item) => (
              <li key={item}>
                <span className="bev2-map-alive-check" aria-hidden="true">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SECTION C — RSL */}
        <div className="bev2-map-alive-zone zone-rsl" data-zone="rsl">
          <h3>RSL — RELATIONSHIP SUPPORT LAYER</h3>
          <p className="bev2-map-alive-copy">
            Your Business Engine can incorporate verified coaching conversations, implementation
            progress, and business outcomes, allowing your intelligence to become more accurate
            over time.
          </p>
          <h4 className="bev2-map-alive-subhead">COACH PARTICIPATION BECOMES PART OF YOUR RSL</h4>
          <ol className="bev2-map-alive-stages">
            {RSL_EVIDENCE_STAGES.map((stage, index) => (
              <li key={stage}>
                <span className="bev2-map-alive-stage-num" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{stage}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* SECTION D — CONVERSION CTA */}
        <div className="bev2-map-alive-zone zone-cta" data-zone="cta">
          <p className="bev2-map-alive-cta-headline">
            CONTINUE LEARNING.
            <br />
            CONTINUE GROWING.
            <br />
            KEEP WINNING.
          </p>
          <button
            type="button"
            className="bev2-map-alive-cta"
            data-cta="keep-my-map-alive"
            data-cta-count-role="primary"
            disabled={isLoading}
            onClick={handleClick}
          >
            {isLoading ? 'Opening Checkout...' : 'KEEP MY MAP ALIVE'}
          </button>
          <p className="bev2-map-alive-trust-inline">Secure. Cancel anytime. No long-term commitment.</p>
          <p className="bev2-map-alive-access-note">
            Instant access to your live Business Engine after checkout.
          </p>
          {displayError ? (
            <p className="bev2-map-alive-error" role="alert">
              {displayError}
            </p>
          ) : null}
        </div>
      </div>

      {/* BOTTOM TRUST STRIP */}
      <ul className="bev2-map-alive-trust-strip" aria-label="Subscription trust signals">
        <li>Secure payments by Stripe</li>
        <li>Cancel anytime</li>
        <li>New intelligence as your business evolves</li>
        <li>Your data stays yours</li>
      </ul>

      {temporalMeta ? (
        <div className="bev2-map-alive-meta">
          <span>
            {temporalMeta.last_updated_label || 'Last Updated'}: {temporalMeta.last_updated || '—'}
          </span>
          <span>{temporalMeta.snapshot_label || 'Assessment Snapshot'}</span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Self-contained styles.
 * Container queries drive reflow from the unscaled host width (not the 1672 design canvas).
 * Viewport @media kept as fallback when no container context is available.
 */
const mapAliveStyles = `
.bev2-map-alive {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(74, 222, 128, 0.42);
  padding: 28px 28px 20px;
  background:
    radial-gradient(ellipse at 18% 0%, rgba(34, 197, 94, 0.16), transparent 42%),
    radial-gradient(ellipse at 88% 100%, rgba(16, 185, 129, 0.12), transparent 40%),
    linear-gradient(165deg, #020805 0%, #04140c 42%, #010403 100%);
  box-shadow:
    0 0 0 1px rgba(74, 222, 128, 0.12),
    0 0 42px rgba(34, 197, 94, 0.22),
    0 0 80px rgba(16, 185, 129, 0.10),
    inset 0 1px 0 rgba(134, 239, 172, 0.12);
  color: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  container-type: inline-size;
  container-name: map-alive;
}

.bev2-map-alive *,
.bev2-map-alive *::before,
.bev2-map-alive *::after {
  box-sizing: border-box;
}

.bev2-map-alive-glow {
  pointer-events: none;
  position: absolute;
  inset: -2px;
  border-radius: 17px;
  box-shadow:
    inset 0 0 0 1px rgba(74, 222, 128, 0.35),
    inset 0 0 28px rgba(34, 197, 94, 0.08);
  z-index: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .bev2-map-alive {
    animation: bev2-map-alive-breathe 6.5s ease-in-out infinite;
  }
  @keyframes bev2-map-alive-breathe {
    0%, 100% { box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.12), 0 0 36px rgba(34, 197, 94, 0.18), 0 0 72px rgba(16, 185, 129, 0.08), inset 0 1px 0 rgba(134, 239, 172, 0.10); }
    50% { box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.22), 0 0 52px rgba(34, 197, 94, 0.28), 0 0 96px rgba(16, 185, 129, 0.14), inset 0 1px 0 rgba(134, 239, 172, 0.16); }
  }
}

.bev2-map-alive-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.25fr) minmax(0, 1.15fr) minmax(240px, 0.95fr);
  gap: 22px 20px;
  align-items: start;
}

.bev2-map-alive-zone {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.bev2-map-alive-kicker {
  margin: 0 0 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(134, 239, 172, 0.72);
}

.bev2-map-alive h2 {
  margin: 0 0 12px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.15;
  text-transform: uppercase;
  color: #bbf7d0;
  text-shadow: 0 0 24px rgba(74, 222, 128, 0.35);
}

.bev2-map-alive-lead {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.92);
}

.bev2-map-alive-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(220, 252, 231, 0.78);
}

.bev2-map-alive h3 {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #86efac;
}

.bev2-map-alive-subhead {
  margin: 14px 0 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(167, 243, 208, 0.88);
}

.bev2-map-alive-benefits {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bev2-map-alive-benefits li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.45;
  color: rgba(240, 253, 244, 0.88);
}

.bev2-map-alive-check {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #4ade80;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(74, 222, 128, 0.55);
}

.bev2-map-alive-stages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bev2-map-alive-stages li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 12.5px;
  line-height: 1.45;
  color: rgba(240, 253, 244, 0.86);
}

.bev2-map-alive-stage-num {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: #022c22;
  background: linear-gradient(180deg, #86efac, #4ade80);
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
}

.bev2-map-alive-cta-headline {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.35;
  text-transform: uppercase;
  color: #ecfdf5;
  text-shadow: 0 0 18px rgba(74, 222, 128, 0.28);
}

.bev2-map-alive-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  min-width: 44px;
  padding: 14px 18px;
  border: 1px solid rgba(187, 247, 208, 0.55);
  border-radius: 12px;
  background: linear-gradient(180deg, #4ade80 0%, #16a34a 100%);
  color: #022c22;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow:
    0 0 24px rgba(74, 222, 128, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}

.bev2-map-alive-cta:hover:not(:disabled) {
  filter: brightness(1.06);
  box-shadow:
    0 0 32px rgba(74, 222, 128, 0.48),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.bev2-map-alive-cta:focus-visible {
  outline: 2px solid #bbf7d0;
  outline-offset: 3px;
}

.bev2-map-alive-cta:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .bev2-map-alive-cta {
    transition: none;
  }
  .bev2-map-alive {
    animation: none !important;
  }
}

.bev2-map-alive-trust-inline {
  margin: 12px 0 0;
  font-size: 11.5px;
  line-height: 1.4;
  color: rgba(187, 247, 208, 0.78);
  text-align: center;
}

.bev2-map-alive-access-note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(220, 252, 231, 0.58);
  text-align: center;
}

.bev2-map-alive-error {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(127, 29, 29, 0.28);
  color: #fecaca;
  font-size: 12px;
  line-height: 1.45;
}

.bev2-map-alive-trust-strip {
  position: relative;
  z-index: 1;
  list-style: none;
  margin: 22px 0 0;
  padding: 14px 8px 0;
  border-top: 1px solid rgba(74, 222, 128, 0.18);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 14px;
}

.bev2-map-alive-trust-strip li {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1.35;
  color: rgba(187, 247, 208, 0.72);
  text-align: center;
}

.bev2-map-alive-meta {
  position: relative;
  z-index: 1;
  margin-top: 14px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px 24px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(167, 243, 208, 0.42);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Container-driven reflow (preferred when unscaled host sets width) ── */

/* Tablet: two-column hybrid */
@container map-alive (max-width: 1100px) {
  .bev2-map-alive-grid {
    grid-template-columns: 1fr 1fr;
  }
  .bev2-map-alive-zone.zone-cta {
    grid-column: 1 / -1;
  }
  .bev2-map-alive-trust-strip {
    grid-template-columns: 1fr 1fr;
  }
  .bev2-map-alive-cta {
    min-height: 52px;
    font-size: 14px;
  }
}

/* Mobile: deliberate stack */
@container map-alive (max-width: 720px) {
  .bev2-map-alive {
    padding: 22px 16px 16px;
  }
  .bev2-map-alive-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .bev2-map-alive h2 {
    font-size: 22px;
  }
  .bev2-map-alive-lead {
    font-size: 15px;
  }
  .bev2-map-alive-copy,
  .bev2-map-alive-benefits li,
  .bev2-map-alive-stages li {
    font-size: 13.5px;
  }
  .bev2-map-alive-zone.zone-cta {
    grid-column: auto;
  }
  .bev2-map-alive-cta {
    width: 100%;
    min-height: 48px;
    font-size: 13px;
    letter-spacing: 0.1em;
  }
  .bev2-map-alive-trust-strip {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .bev2-map-alive-trust-strip li {
    text-align: left;
    font-size: 12px;
  }
}

/* ── Viewport fallbacks (embedded / no container context) ── */
@media (max-width: 1100px) {
  .bev2-map-alive-grid {
    grid-template-columns: 1fr 1fr;
  }
  .bev2-map-alive-zone.zone-cta {
    grid-column: 1 / -1;
  }
  .bev2-map-alive-trust-strip {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .bev2-map-alive {
    padding: 22px 16px 16px;
  }
  .bev2-map-alive-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .bev2-map-alive h2 {
    font-size: 22px;
  }
  .bev2-map-alive-zone.zone-cta {
    grid-column: auto;
  }
  .bev2-map-alive-cta {
    width: 100%;
    min-height: 48px;
  }
  .bev2-map-alive-trust-strip {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .bev2-map-alive-trust-strip li {
    text-align: left;
  }
}
`;
