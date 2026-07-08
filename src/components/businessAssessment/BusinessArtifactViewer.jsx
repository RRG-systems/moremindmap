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

export default function BusinessArtifactViewer({
  children,
  width = BUSINESS_ARTIFACT_WIDTH,
  height = BUSINESS_ARTIFACT_HEIGHT,
  viewMode = 'fit',
}) {
  const viewportRef = useRef(null);
  const readableMode = isReadableArtifactViewMode(viewMode);
  const [scale, setScale] = useState(1);

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
      const nextScale = Math.min(1, availableWidth / width, availableHeight / height);
      setScale(Number(nextScale.toFixed(4)));
    }

    updateScale();

    if (readableMode) {
      return undefined;
    }

    let observer;
    if (typeof ResizeObserver !== 'undefined' && viewportRef.current) {
      observer = new ResizeObserver(updateScale);
      observer.observe(viewportRef.current);
    }

    window.addEventListener('resize', updateScale);

    return () => {
      window.removeEventListener('resize', updateScale);
      observer?.disconnect();
    };
  }, [height, readableMode, width]);

  const effectiveScale = readableMode ? 1 : scale;
  const scaledWidth = width * effectiveScale;
  const scaledHeight = height * effectiveScale;
  const viewerClassName = readableMode
    ? 'ba-artifact-viewer ba-artifact-viewer--readable'
    : 'ba-artifact-viewer';

  return (
    <div
      className={viewerClassName}
      data-view-mode={normalizeArtifactViewMode(viewMode)}
      ref={viewportRef}
    >
      <style>{styles}</style>
      <div
        className="ba-artifact-footprint"
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
      >
        <div
          className="ba-artifact-scale"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            transform: readableMode ? 'none' : `scale(${effectiveScale})`,
          }}
        >
          {children}
        </div>
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
  box-shadow: 0 30px 100px rgba(0, 0, 0, 0.62);
}

.ba-artifact-scale {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: top left;
}

.ba-fixed-canvas {
  width: var(--ba-artifact-width, 1672px);
  height: var(--ba-artifact-height, 941px);
  min-width: var(--ba-artifact-width, 1672px);
  max-width: var(--ba-artifact-width, 1672px);
  overflow: hidden;
  border-radius: 14px;
}
`;
