import { useEffect, useRef, useState } from 'react';

export const BUSINESS_ARTIFACT_WIDTH = 1672;
export const BUSINESS_ARTIFACT_HEIGHT = 941;
export const BUSINESS_MAP_ARTIFACT_HEIGHT = 1180;
export const FIVE_FUTURES_ARTIFACT_HEIGHT = 1720;

export default function BusinessArtifactViewer({
  children,
  width = BUSINESS_ARTIFACT_WIDTH,
  height = BUSINESS_ARTIFACT_HEIGHT,
}) {
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const availableWidth = Math.max(320, rect.width - 2);
      const availableHeight = Math.max(320, rect.height - 2);
      const nextScale = Math.min(1, availableWidth / width, availableHeight / height);
      setScale(Number(nextScale.toFixed(4)));
    }

    updateScale();

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
  }, [height, width]);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return (
    <div className="ba-artifact-viewer" ref={viewportRef}>
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
            transform: `scale(${scale})`,
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
