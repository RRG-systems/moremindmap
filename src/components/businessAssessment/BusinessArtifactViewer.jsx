import { useEffect, useRef, useState } from 'react';

export const BUSINESS_ARTIFACT_WIDTH = 1672;
export const BUSINESS_ARTIFACT_HEIGHT = 941;
export const BUSINESS_MAP_ARTIFACT_HEIGHT = 1180;
export const FIVE_FUTURES_ARTIFACT_HEIGHT = 1720;

export const BA_ARTIFACT_VIEW_MODES = ['fit', 'fullscreen', 'readable'];

export function normalizeArtifactViewMode(viewMode) {
  const normalized = String(viewMode || '').toLowerCase();
  if (normalized === 'fullscreen' || normalized === 'readable') return normalized;
  return 'fit';
}

export function isReadableArtifactViewMode(viewMode) {
  const normalized = normalizeArtifactViewMode(viewMode);
  return normalized === 'fullscreen' || normalized === 'readable';
}

/**
 * Fit-scale policy for tall executive artifacts (e.g. Business Engine Visual):
 * scale to available width and allow vertical scroll.
 * Short artifacts may still fit within both axes when they fit the viewport cleanly.
 */
function computeFitScale(availableWidth, availableHeight, width, height) {
  const widthScale = availableWidth / width;
  const heightScale = availableHeight / height;
  const aspect = height / Math.max(1, width);
  // Tall documents (> ~0.9 aspect): prefer width-fit so the executive story scrolls.
  if (aspect >= 0.9) {
    return Math.min(1, widthScale);
  }
  return Math.min(1, widthScale, heightScale);
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children - fixed-canvas artifact (fit-scaled)
 * @param {import('react').ReactNode} [props.unscaledFooter]
 *   Optional footer rendered OUTSIDE the transform scale at the footprint width.
 *   Use for native-responsive panels (e.g. MAKE YOUR MAP ALIVE) that must reflow
 *   instead of shrinking with the 1672px design canvas.
 * @param {number} [props.width]
 * @param {number} [props.height]
 * @param {string} [props.viewMode]
 */
export default function BusinessArtifactViewer({
  children,
  unscaledFooter = null,
  width = BUSINESS_ARTIFACT_WIDTH,
  height = BUSINESS_ARTIFACT_HEIGHT,
  viewMode = 'fit',
}) {
  const viewportRef = useRef(null);
  const scaleRef = useRef(null);
  const readableMode = isReadableArtifactViewMode(viewMode);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(height);

  useEffect(() => {
    function updateScale() {
      if (readableMode) {
        setScale(1);
        return;
      }

      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const availableWidth = Math.max(320, rect.width - 2);
      const availableHeight = Math.max(320, rect.height - 2);
      const nextScale = computeFitScale(availableWidth, availableHeight, width, height);
      setScale(Number(nextScale.toFixed(4)));
    }

    function measureContentHeight() {
      const node = scaleRef.current;
      if (!node) return;
      // Prefer first child canvas height when content grows beyond declared height.
      const child = node.firstElementChild;
      const measured = Math.max(
        height,
        Math.ceil(child?.scrollHeight || child?.offsetHeight || node.scrollHeight || height)
      );
      setContentHeight(measured);
    }

    updateScale();
    measureContentHeight();

    if (readableMode) {
      // Still measure content for readable footprint accuracy.
      let readableObserver;
      if (typeof ResizeObserver !== 'undefined' && scaleRef.current) {
        readableObserver = new ResizeObserver(measureContentHeight);
        readableObserver.observe(scaleRef.current);
        if (scaleRef.current.firstElementChild) {
          readableObserver.observe(scaleRef.current.firstElementChild);
        }
      }
      return () => readableObserver?.disconnect();
    }

    let observer;
    if (typeof ResizeObserver !== 'undefined' && viewportRef.current) {
      observer = new ResizeObserver(() => {
        updateScale();
        measureContentHeight();
      });
      observer.observe(viewportRef.current);
      if (scaleRef.current) {
        observer.observe(scaleRef.current);
        if (scaleRef.current.firstElementChild) {
          observer.observe(scaleRef.current.firstElementChild);
        }
      }
    }

    window.addEventListener('resize', updateScale);

    return () => {
      window.removeEventListener('resize', updateScale);
      observer?.disconnect();
    };
  }, [height, readableMode, width]);

  const effectiveScale = readableMode ? 1 : scale;
  const footprintHeight = contentHeight * effectiveScale;
  const scaledWidth = width * effectiveScale;
  const hasUnscaledFooter = Boolean(unscaledFooter);
  const viewerClassName = [
    'ba-artifact-viewer',
    readableMode ? 'ba-artifact-viewer--readable' : 'ba-artifact-viewer--fit-scroll',
    hasUnscaledFooter ? 'ba-artifact-viewer--with-unscaled-footer' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={viewerClassName}
      data-view-mode={normalizeArtifactViewMode(viewMode)}
      data-fit-policy={height / Math.max(1, width) >= 0.9 ? 'width-scroll' : 'contain'}
      data-has-unscaled-footer={hasUnscaledFooter ? 'true' : 'false'}
      data-fit-scale={String(effectiveScale)}
      ref={viewportRef}
      style={{
        '--ba-fit-scale': String(effectiveScale),
        '--ba-scaled-width': `${scaledWidth}px`,
      }}
    >
      <style>{styles}</style>
      <div className="ba-artifact-stack">
        <div
          className="ba-artifact-footprint"
          style={{
            width: `${scaledWidth}px`,
            height: `${footprintHeight}px`,
          }}
        >
          <div
            className="ba-artifact-scale"
            ref={scaleRef}
            style={{
              width: `${width}px`,
              height: `${contentHeight}px`,
              transform: readableMode ? 'none' : `scale(${effectiveScale})`,
            }}
          >
            {children}
          </div>
        </div>

        {hasUnscaledFooter ? (
          <div
            className="ba-artifact-unscaled-footer"
            data-region="artifact-unscaled-footer"
            style={{
              width: `${scaledWidth}px`,
              maxWidth: '100%',
            }}
          >
            {unscaledFooter}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = `
.ba-artifact-viewer {
  width: 100%;
  height: calc(100vh - 6.5rem);
  min-height: 28rem;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overscroll-behavior: contain;
  scrollbar-color: rgba(251, 146, 60, 0.45) rgba(15, 23, 42, 0.7);
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

/* Tall executive artifacts: calmer vertical scroll, centered width-fit */
.ba-artifact-viewer--fit-scroll {
  padding-bottom: 1.25rem;
}

.ba-artifact-viewer--with-unscaled-footer {
  /* Stack can grow taller than one viewport; keep vertical scroll. */
  align-items: flex-start;
}

.ba-artifact-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: max-content;
  max-width: 100%;
}

.ba-artifact-viewer--readable {
  width: 96vw;
  max-width: none;
  margin-inline: auto;
  justify-content: flex-start;
  overflow-x: auto;
  overflow-y: auto;
}

.ba-artifact-viewer--readable .ba-artifact-footprint {
  flex: 0 0 auto;
  max-width: none;
}

.ba-artifact-viewer--readable .ba-artifact-scale {
  position: relative;
}

.ba-artifact-footprint {
  position: relative;
  flex: 0 0 auto;
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}

.ba-artifact-scale {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: top left;
}

/* Native-width responsive host — never inherits transform: scale() */
.ba-artifact-unscaled-footer {
  position: relative;
  flex: 0 0 auto;
  box-sizing: border-box;
  max-width: 100%;
  /* Isolate from any ancestor transform inheritance edge cases */
  transform: none;
  z-index: 2;
}

.ba-fixed-canvas {
  width: var(--ba-artifact-width, 1672px);
  height: var(--ba-artifact-height, 941px);
  min-width: var(--ba-artifact-width, 1672px);
  max-width: var(--ba-artifact-width, 1672px);
  overflow: hidden;
  border-radius: 14px;
}

/* Business Engine V2 canvas may grow with content — do not hard-clip */
.ba-fixed-canvas.bev2-canvas {
  height: auto;
  min-height: var(--ba-artifact-height, 1780px);
  max-height: none;
  overflow: visible;
}
`;
