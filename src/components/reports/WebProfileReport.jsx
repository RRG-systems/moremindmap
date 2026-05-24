/**
 * WebProfileReport.jsx
 * 
 * Premium Web-First Profile Report V2
 * Dark intelligence dashboard aesthetic (RRG/MORE inspired)
 * Black + gold + subtle signal accents
 * Dense, modular, executive-level behavioral analysis
 */

import { useState, useEffect } from 'react';
import { buildNarrativeV3 } from '../../lib/narrativeV3/buildNarrativeV3.js';

export default function WebProfileReport({ canonical, profileId }) {
  if (!canonical) {
    return <div className="web-report-error">Unable to load profile data</div>;
  }

  const data = canonical.canonical_profile_json || canonical;
  const personName = canonical.person_name || 'Assessment Subject';
  const company = canonical.company_name || '';
  const profileType = data.inferred_patterns?.profile_type || 'Behavioral Profile';
  const vectorScores = data.vector_scores || {};
  const topSystems = data.top_systems || {};
  const ranked = data.ranked_dimensions || [];

  // V3 narrative rendering (with GPT-5.5 texture layer when API key available)
  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(true);
  const [narrativeError, setNarrativeError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setNarrativeLoading(true);
        const v3Narrative = await buildNarrativeV3(canonical, true, profileId);
        setNarrative(v3Narrative);
        setNarrativeError(null);
        console.log('[WebProfileReport] V3 narrative rendered for', profileId);
      } catch (err) {
        console.error('[WebProfileReport] V3 rendering failed:', err);
        setNarrativeError(err.message);
        setNarrative(null);
      } finally {
        setNarrativeLoading(false);
      }
    })();
  }, [canonical, profileId]);

  // Handle loading/error states
  if (narrativeLoading) {
    return <div className="web-report-loading">Rendering behavioral analysis...</div>;
  }

  if (narrativeError || !narrative) {
    return <div className="web-report-error">Failed to render profile narrative: {narrativeError}</div>;
  }

  // Helper to safely render text
  const renderText = (value) => {
    if (!value && value !== 0) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
      return value
        .map(item => renderText(item))
        .filter(s => s && s.length > 0)
        .join(', ');
    }
    if (typeof value === 'object') {
      return (
        value.description ||
        value.dimension ||
        value.tension ||
        value.pattern ||
        value.manifestation ||
        ''
      );
    }
    return '';
  };

  return (
    <div className="web-profile-report-v2">
      {/* HEADER: Dark intelligence dashboard style */}
      <header className="dashboard-header">
        <div className="header-top">
          <div className="header-identity">
            <h1 className="person-name">{personName}</h1>
            <div className="profile-type-badge">{profileType}</div>
            {company && <div className="company-name">{company}</div>}
          </div>
          <div className="profile-id-box">
            <div className="label">Profile ID</div>
            <div className="id-value">{profileId}</div>
          </div>
        </div>

        {/* Profile DNA signature */}
        <div className="profile-dna-strip">
          <div className="dna-label">PROFILE DNA</div>
          <div className="dna-signature">
            {ranked.slice(0, 4).map((d) => (
              <span key={d.dimension} className="dna-item">
                {d.dimension.toUpperCase().substring(0, 1)}{d.score > 0 ? '+' : ''}{d.score}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN NARRATIVE SECTIONS */}
      <div className="dashboard-body">
        {/* Section 1: Profile DNA Intro */}
        <section className="narrative-section featured">
          <h2 className="section-title">Profile DNA</h2>
          <div className="narrative-text">{narrative.profileDNA}</div>
        </section>

        {/* Section 2: Executive Summary (V3) */}
        {narrative.executiveSummary && (
          <section className="narrative-section featured">
            <h2 className="section-title">Executive Summary</h2>
            <div className="narrative-text">{narrative.executiveSummary.body || narrative.executiveSummary}</div>
            {narrative.executiveSummary.key_warning && (
              <div className="key-warning">⚠️ {narrative.executiveSummary.key_warning}</div>
            )}
          </section>
        )}

        {/* Section 3: Vector Scores Grid */}
        <section className="data-section">
          <h2 className="section-title">Behavioral Dimensions</h2>
          <div className="dimensions-grid">
            {ranked.map((dim) => (
              <div key={dim.dimension} className="dimension-card">
                <div className="dim-name">{dim.dimension.toUpperCase()}</div>
                <div className="dim-score">{dim.score > 0 ? '+' : ''}{dim.score}</div>
                <div className="dim-rank">Rank {dim.rank}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Operating Pattern (Hidden - V3 integrated above) */}
        {/* Moved to V3 rendering */}

        {/* Section 5: Decision Architecture (Hidden - V3 integrated above) */}
        {/* Moved to V3 rendering */}

        {/* Section 6: Communication Style (V3) */}
        {narrative.communicationStyle && (
          <section className="narrative-section">
            <h2 className="section-title">Communication Style</h2>
            <div className="narrative-text">{narrative.communicationStyle.body || narrative.communicationStyle}</div>
            {narrative.communicationStyle.key_warning && (
              <div className="key-warning">⚠️ {narrative.communicationStyle.key_warning}</div>
            )}
          </section>
        )}

        {/* Section 7: System Under Strain (Hidden - V3 integrated above) */}
        {/* Moved to V3 rendering */}

        {/* Section 8: Hidden Contradictions (V3) */}
        {narrative.hiddenContradictions && (
          <section className="narrative-section">
            <h2 className="section-title">Hidden Contradictions</h2>
            <div className="narrative-text">{narrative.hiddenContradictions.body || narrative.hiddenContradictions}</div>
            {narrative.hiddenContradictions.key_warning && (
              <div className="key-warning">⚠️ {narrative.hiddenContradictions.key_warning}</div>
            )}
          </section>
        )}

        {/* Section 9: Strategic Ceiling (V3) */}
        {narrative.strategicCeiling && (
          <section className="narrative-section">
            <h2 className="section-title">Strategic Ceiling</h2>
            <div className="narrative-text">{narrative.strategicCeiling.body || narrative.strategicCeiling}</div>
            {narrative.strategicCeiling.key_warning && (
              <div className="key-warning">⚠️ {narrative.strategicCeiling.key_warning}</div>
            )}
          </section>
        )}

        {/* Section 10: Hidden Risks (Hidden - V3 integrated above) */}
        {/* Moved to V3 rendering */}

        {/* Section 11: Coaching Leverage */}
        <section className="narrative-section">
          <h2 className="section-title">Coaching Leverage</h2>
          <div className="narrative-text">{narrative.coachingLeverage}</div>
        </section>

        {/* Section 12: Recommended Next Step */}
        <section className="narrative-section action-section">
          <h2 className="section-title">Recommended Next Step</h2>
          <div className="narrative-text">{narrative.recommendedNextStep}</div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="dashboard-footer">
        <div className="footer-meta">
          <span>Assessment Date: {canonical.created_at?.split('T')[0] || 'N/A'}</span>
          <span>Profile Type: {profileType}</span>
          <span>Confidence: High</span>
        </div>
      </footer>

      <style jsx>{`
        .web-profile-report-v2 {
          background: linear-gradient(180deg, #0a0e27 0%, #0d1830 50%, #0a0e27 100%);
          color: #e0e0e0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          line-height: 1.65;
          min-height: 100vh;
          padding: 0;
          position: relative;
        }
        
        .web-profile-report-v2::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(ellipse at bottom, rgba(212, 175, 55, 0.03) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* HEADER */
        .dashboard-header {
          background: linear-gradient(135deg, #1a1f3a 0%, #0f1530 100%);
          border-bottom: 2px solid rgba(212, 175, 55, 0.4);
          border-radius: 0 0 16px 16px;
          padding: 3rem 2.5rem 2rem 2.5rem;
          max-width: none;
          position: relative;
          z-index: 1;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4), inset 0 -1px 0 rgba(212, 175, 55, 0.1);
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 2rem;
          margin-bottom: 1.5rem;
        }

        .header-identity h1 {
          font-size: 2.8rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.5px;
        }

        .profile-type-badge {
          display: inline-block;
          background: rgba(212, 175, 55, 0.15);
          border: 1px solid rgba(212, 175, 55, 0.4);
          color: #d4af37;
          padding: 0.4rem 0.8rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-right: 0.75rem;
        }

        .company-name {
          font-size: 0.95rem;
          color: #999;
          margin-top: 0.35rem;
        }

        .profile-id-box {
          text-align: right;
          background: rgba(212, 175, 55, 0.08);
          border: 1px solid rgba(212, 175, 55, 0.25);
          padding: 1rem 1.25rem;
          border-radius: 6px;
        }

        .profile-id-box .label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #888;
          margin-bottom: 0.35rem;
        }

        .profile-id-box .id-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #d4af37;
          font-family: 'Monaco', monospace;
        }

        .profile-dna-strip {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(212, 175, 55, 0.2);
        }

        .dna-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #888;
          min-width: 100px;
        }

        .dna-signature {
          display: flex;
          gap: 1rem;
        }

        .dna-item {
          background: rgba(212, 175, 55, 0.12);
          border: 1px solid rgba(212, 175, 55, 0.3);
          color: #d4af37;
          padding: 0.5rem 0.85rem;
          border-radius: 4px;
          font-size: 0.9rem;
          font-weight: 700;
          font-family: 'Monaco', monospace;
          letter-spacing: 0.05em;
        }

        /* BODY */
        .dashboard-body {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem;
        }

        /* SECTIONS */
        .narrative-section,
        .data-section {
          margin-bottom: 2.5rem;
          padding: 2rem;
          background: linear-gradient(135deg, rgba(15, 20, 40, 0.8) 0%, rgba(10, 14, 35, 0.6) 100%);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 8px;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(212, 175, 55, 0.08);
          transition: all 0.3s ease;
        }
        
        .narrative-section:hover,
        .data-section:hover {
          border-color: rgba(212, 175, 55, 0.35);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(212, 175, 55, 0.12);
        }

        .narrative-section.featured {
          background: rgba(212, 175, 55, 0.08);
          border: 1px solid rgba(212, 175, 55, 0.3);
        }

        .narrative-section.alert-section {
          background: rgba(255, 152, 0, 0.08);
          border: 1px solid rgba(255, 152, 0, 0.3);
        }

        .narrative-section.risk-section {
          background: rgba(244, 67, 54, 0.08);
          border: 1px solid rgba(244, 67, 54, 0.25);
        }

        .narrative-section.action-section {
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, rgba(76, 175, 80, 0.04) 100%);
          border: 1px solid rgba(76, 175, 80, 0.3);
        }

        .section-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 1rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid rgba(212, 175, 55, 0.4);
          padding-bottom: 0.5rem;
        }

        .narrative-text {
          font-size: 0.95rem;
          line-height: 1.75;
          color: #d0d0d0;
          margin: 0;
        }

        .narrative-text.pre-format {
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .narrative-text strong {
          color: #e8e8e8;
          font-weight: 600;
        }

        /* DIMENSIONS GRID */
        .dimensions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .dimension-card {
          background: rgba(212, 175, 55, 0.08);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 6px;
          padding: 1rem;
          text-align: center;
          transition: all 0.2s;
        }

        .dimension-card:hover {
          border-color: rgba(212, 175, 55, 0.4);
          background: rgba(212, 175, 55, 0.12);
        }

        .dim-name {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #888;
          margin-bottom: 0.4rem;
        }

        .dim-score {
          font-size: 1.6rem;
          font-weight: 700;
          color: #d4af37;
          margin-bottom: 0.25rem;
        }

        .dim-rank {
          font-size: 0.8rem;
          color: #666;
        }

        /* FOOTER */
        .dashboard-footer {
          border-top: 1px solid rgba(212, 175, 55, 0.2);
          padding: 1.5rem 2rem;
          text-align: center;
          background: rgba(10, 14, 39, 0.8);
        }

        .footer-meta {
          display: flex;
          justify-content: center;
          gap: 2rem;
          flex-wrap: wrap;
          font-size: 0.85rem;
          color: #888;
        }

        .web-report-error {
          background: #0a0e27;
          color: #f44336;
          padding: 2rem;
          text-align: center;
          font-weight: 500;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .dashboard-header {
            padding: 1.5rem;
          }

          .header-top {
            flex-direction: column;
            gap: 1rem;
          }

          .header-identity h1 {
            font-size: 2rem;
          }

          .profile-id-box {
            align-self: stretch;
            text-align: left;
          }

          .dashboard-body {
            padding: 1rem;
          }

          .narrative-section,
          .data-section {
            padding: 1.25rem;
            margin-bottom: 1.5rem;
          }

          .dimensions-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .dna-signature {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .footer-meta {
            gap: 1rem;
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
