import React, { useEffect } from 'react';
import DeterministicVisualDNA from './DeterministicVisualDNA.jsx';

export default function VisualDNAModal({ isOpen, onClose, profile }) {
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

  if (!isOpen || !profile) return null;

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
            <span>Visual DNA Artifact</span>
            <strong>{profile.name || 'Behavioral Operating System'}</strong>
          </div>
          <button type="button" className="visual-dna-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="visual-dna-modal-poster">
          <DeterministicVisualDNA profile={profile} variant="fullscreen" />
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
  display: grid;
  place-items: center;
  padding: 2.5vh 2vw;
  background:
    radial-gradient(circle at 50% 45%, rgba(251, 146, 60, 0.16), transparent 36%),
    rgba(2, 6, 23, 0.94);
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
  width: min(96vw, calc(90vh * 1672 / 941));
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

.visual-dna-modal-poster {
  width: 100%;
  aspect-ratio: 1672 / 941;
  border-radius: 10px;
  box-shadow: 0 30px 100px rgba(0, 0, 0, 0.65);
}

.visual-dna-modal-poster .dvd-frame {
  width: 100%;
}

@media (max-width: 760px) {
  .visual-dna-modal {
    padding: 1rem;
    align-items: start;
    overflow: auto;
  }

  .visual-dna-modal-shell {
    width: max(980px, 96vw);
    max-height: none;
  }
}
`;
