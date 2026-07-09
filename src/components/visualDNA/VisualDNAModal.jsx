import React, { useEffect, useRef, useState } from 'react';
import DeterministicBOSDNAVisualV2, {
  BOS_DNA_V2_POSTER_HEIGHT,
  BOS_DNA_V2_POSTER_WIDTH,
} from './DeterministicBOSDNAVisualV2.jsx';

const POSTER_WIDTH = BOS_DNA_V2_POSTER_WIDTH;
const POSTER_HEIGHT = BOS_DNA_V2_POSTER_HEIGHT;

export default function VisualDNAModal({
  isOpen,
  onClose,
  profile = null,
  viewModel = null,
  narrative = null,
  profileId = null,
}) {
  const viewportRef = useRef(null);
  const [posterScale, setPosterScale] = useState(1);

  const displayModel = viewModel || profile;
  const displayName = displayModel?.name
    || displayModel?.person_name
    || 'Behavioral Operating System';

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function updateScale() {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const availableWidth = Math.max(320, rect.width - 2);
      const availableHeight = Math.max(320, rect.height - 2);
      const nextScale = Math.min(1, availableWidth / POSTER_WIDTH, availableHeight / POSTER_HEIGHT);
      setPosterScale(Number(nextScale.toFixed(4)));
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
  }, [isOpen]);

  if (!isOpen || (!profile && !viewModel)) return null;

  const scaledPosterWidth = POSTER_WIDTH * posterScale;
  const scaledPosterHeight = POSTER_HEIGHT * posterScale;

  return (
    <div className="visual-dna-modal" role="dialog" aria-modal="true" aria-label="Full Visual DNA">
      <style>{styles}</style>
      <button
        type="button"
        className="visual-dna-modal-backdrop"
        aria-label="Close full Visual DNA"
        onClick={onClose}
      />
      <div className="visual-dna-modal-shell">
        <div className="visual-dna-modal-toolbar">
          <div>
            <span>BOS DNA Visual Artifact</span>
            <strong>{displayName}</strong>
          </div>
          <button type="button" className="visual-dna-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="visual-dna-modal-viewport" ref={viewportRef}>
          <div
            className="visual-dna-modal-poster-footprint"
            style={{
              width: `${scaledPosterWidth}px`,
              height: `${scaledPosterHeight}px`,
            }}
          >
            <div
              className="visual-dna-modal-poster-scale"
              style={{
                width: `${POSTER_WIDTH}px`,
                height: `${POSTER_HEIGHT}px`,
                transform: `scale(${posterScale})`,
              }}
            >
              <DeterministicBOSDNAVisualV2
                viewModel={viewModel}
                profile={profile}
                narrative={narrative}
                profileId={profileId}
                mode="fullscreen"
                variant="fullscreen"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = `
.visual-dna-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 2.5vh 2vw;
  background:
    radial-gradient(circle at 50% 45%, rgba(251, 146, 60, 0.16), transparent 36%),
    rgba(2, 6, 23, 0.94);
  overflow: hidden;
}

.visual-dna-modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: zoom-out;
}

.visual-dna-modal-shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: min(96vw, calc((95vh - 4.4rem) * 1672 / 941));
  max-width: 1672px;
  min-width: 0;
  max-height: 95vh;
}

.visual-dna-modal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(251, 146, 60, 0.32);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.82);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(12px);
}

.visual-dna-modal-toolbar span,
.visual-dna-modal-toolbar strong {
  display: block;
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.visual-dna-modal-toolbar strong {
  margin-top: 0.2rem;
  color: #f8fafc;
  font-size: 0.86rem;
}

.visual-dna-modal-close {
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  padding: 0.62rem 1rem;
  background: rgba(15, 23, 42, 0.74);
  color: #f8fafc;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.visual-dna-modal-close:hover,
.visual-dna-modal-close:focus-visible {
  border-color: rgba(251, 146, 60, 0.7);
  outline: none;
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.18);
}

.visual-dna-modal-viewport {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  border-radius: 10px;
  overscroll-behavior: contain;
  scrollbar-color: rgba(251, 146, 60, 0.45) rgba(15, 23, 42, 0.7);
}

.visual-dna-modal-poster-footprint {
  position: relative;
  flex: 0 0 auto;
  border-radius: 10px;
  box-shadow: 0 30px 100px rgba(0, 0, 0, 0.65);
}

.visual-dna-modal-poster-scale {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: top left;
}

.visual-dna-modal-poster-scale .bos-dna-v2,
.visual-dna-modal-poster-scale .bos-dna-v2__frame {
  width: 1672px !important;
  height: 941px !important;
  min-width: 1672px !important;
  max-width: 1672px !important;
  aspect-ratio: 1672 / 941 !important;
}

.visual-dna-modal-poster-scale .bos-dna-v2__grid {
  width: 1672px !important;
  height: 941px !important;
}

.visual-dna-modal-poster-scale .bos-dna-v2__frame,
.visual-dna-modal-poster-scale .bos-dna-v2__grid {
  border-radius: 10px;
}

.visual-dna-modal-poster-scale .dvd-frame {
  width: 1672px !important;
  height: 941px !important;
  min-width: 1672px !important;
  max-width: 1672px !important;
  aspect-ratio: 1672 / 941 !important;
}

.visual-dna-modal-poster-scale .dvd-grid {
  width: 1672px !important;
  height: 941px !important;
}

.visual-dna-modal-poster-scale .dvd-frame,
.visual-dna-modal-poster-scale .dvd-grid {
  border-radius: 10px;
}

.visual-dna-modal-poster-scale .dvd-fullscreen {
  width: 100%;
}

@media (max-width: 760px) {
  .visual-dna-modal {
    padding: 1rem;
  }

  .visual-dna-modal-shell {
    width: 100%;
    max-height: calc(100vh - 2rem);
  }

  .visual-dna-modal-toolbar {
    align-items: flex-start;
  }
}
`;
