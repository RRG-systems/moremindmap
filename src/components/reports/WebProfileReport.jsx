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
  // Check for cache bypass (for testing/refresh)
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const disableCache = searchParams.has('nocache') || searchParams.has('v3-refresh');

  useEffect(() => {
    (async () => {
      try {
        setNarrativeLoading(true);
        const v3Narrative = await buildNarrativeV3(canonical, true, profileId, disableCache);
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
  }, [canonical, profileId, disableCache]);

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
    <div className="web-profile-report-v2 two-page-dashboard">
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

      {/* PAGE CONTAINER */}
      <div className="pages-container">
        {/* PAGE 1: Foundation */}
        <div className="dashboard-page page-1">
          <div className="page-body">
            {/* Section 1: Profile DNA Intro */}
            <section className="narrative-section featured">
              <h2 className="section-title">Profile DNA</h2>
              <div className="narrative-text">{narrative.profileDNA?.body || narrative.profileDNA}</div>
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

            {/* Section 4: Communication Style or Operating Pattern */}
            {narrative.communicationStyle && (
              <section className="narrative-section">
                <h2 className="section-title">Communication Style</h2>
                <div className="narrative-text">{narrative.communicationStyle.body || narrative.communicationStyle}</div>
                {narrative.communicationStyle.key_warning && (
                  <div className="key-warning">⚠️ {narrative.communicationStyle.key_warning}</div>
                )}
              </section>
            )}
            
            {narrative.operatingPattern && !narrative.communicationStyle && (
              <section className="narrative-section">
                <h2 className="section-title">Operating Pattern</h2>
                <div className="narrative-text">{narrative.operatingPattern.body || narrative.operatingPattern}</div>
                {narrative.operatingPattern.key_warning && (
                  <div className="key-warning">⚠️ {narrative.operatingPattern.key_warning}</div>
                )}
              </section>
            )}

            <div className="page-footer page-1-footer">PAGE 1 OF 2</div>
          </div>
        </div>

        {/* PAGE 2: Deep Patterns & Leverage */}
        <div className="dashboard-page page-2">
          <div className="page-body">
            {/* Section 5: Hidden Contradictions (V3) */}
            {narrative.hiddenContradictions && (
              <section className="narrative-section">
                <h2 className="section-title">Hidden Contradictions</h2>
                <div className="narrative-text">{narrative.hiddenContradictions.body || narrative.hiddenContradictions}</div>
                {narrative.hiddenContradictions.key_warning && (
                  <div className="key-warning">⚠️ {narrative.hiddenContradictions.key_warning}</div>
                )}
              </section>
            )}

            {/* Section 6: System Under Strain (V3) */}
            {narrative.systemUnderStrain && (
              <section className="narrative-section">
                <h2 className="section-title">System Under Strain</h2>
                <div className="narrative-text">{narrative.systemUnderStrain.body || narrative.systemUnderStrain}</div>
                {narrative.systemUnderStrain.key_warning && (
                  <div className="key-warning">⚠️ {narrative.systemUnderStrain.key_warning}</div>
                )}
              </section>
            )}

            {/* Section 7: Strategic Ceiling (V3) */}
            {narrative.strategicCeiling && (
              <section className="narrative-section">
                <h2 className="section-title">Strategic Ceiling</h2>
                <div className="narrative-text">{narrative.strategicCeiling.body || narrative.strategicCeiling}</div>
                {narrative.strategicCeiling.key_warning && (
                  <div className="key-warning">⚠️ {narrative.strategicCeiling.key_warning}</div>
                )}
              </section>
            )}

            {/* Section 8: Coaching Leverage */}
            {narrative.coachingLeverage && (
              <section className="narrative-section">
                <h2 className="section-title">Coaching Leverage</h2>
                <div className="narrative-text">{narrative.coachingLeverage?.body || narrative.coachingLeverage}</div>
              </section>
            )}

            {/* Section 9: Recommended Next Step */}
            {narrative.recommendedNextStep && (
              <section className="narrative-section action-section">
                <h2 className="section-title">Recommended Next Step</h2>
                <div className="narrative-text">{narrative.recommendedNextStep?.body || narrative.recommendedNextStep}</div>
              </section>
            )}

            <div className="page-footer page-2-footer">PAGE 2 OF 2</div>
          </div>
        </div>
      </div>

      {/* GLOBAL FOOTER (after pages) */}
      <footer className="dashboard-footer global-footer">
        <div className="footer-meta">
          <span>Assessment Date: {canonical.created_at?.split('T')[0] || 'N/A'}</span>
          <span>Profile Type: {profileType}</span>
          <span>Confidence: High</span>
          {narrative && (
            <>
              <span>V3 Source: {narrative.render_source || 'unknown'}</span>
              <span>Fallback: {narrative.fallback_used ? 'true' : 'false'}</span>
              {narrative.SIGNAL_VERIFIED_55 && <span>Signal: {narrative.SIGNAL_VERIFIED_55}</span>}
            </>
          )}
        </div>
      </footer>

      <style jsx>{`
        .web-profile-report-v2.two-page-dashboard {
          display: flex;
          flex-direction: column;
        }

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

        /* PAGES CONTAINER */
        .pages-container {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .dashboard-page {
          flex: 1;
          min-height: 100vh;
          page-break-after: always;
          display: flex;
          flex-direction: column;
        }

        .dashboard-page.page-1 {
          background: linear-gradient(180deg, #0a0e27 0%, #0d1830 50%, #0a0e27 100%);
        }

        .dashboard-page.page-2 {
          background: linear-gradient(180deg, #0a0e27 0%, #0d1830 50%, #0a0e27 100%);
          border-top: 2px solid rgba(212, 175, 55, 0.2);
        }

        .page-body {
          flex: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 2.5rem 3rem;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 2.25rem;
        }

        .page-footer {
          text-align: right;
          font-size: 0.75rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding-top: 2rem;
          border-top: 1px solid rgba(212, 175, 55, 0.15);
          margin-top: auto;
        }

        /* BODY */
        .dashboard-body {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2.5rem 3rem;
        }

        /* SECTIONS - Dashboard Modules */
        .narrative-section,
        .data-section {
          margin-bottom: 0;
          padding: 1.75rem;
          background: linear-gradient(135deg, rgba(15, 20, 40, 0.9) 0%, rgba(10, 14, 35, 0.7) 100%);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 10px;
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(212, 175, 55, 0.1), inset 0 -1px 2px rgba(212, 175, 55, 0.04);
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        
        .narrative-section::before,
        .data-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(212, 175, 55, 0) 0%, rgba(212, 175, 55, 0.3) 50%, rgba(212, 175, 55, 0) 100%);
        }
        
        .narrative-section:hover,
        .data-section:hover {
          border-color: rgba(212, 175, 55, 0.4);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(212, 175, 55, 0.15);
          transform: translateY(-2px);
        }

        .narrative-section.featured {
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0.05) 100%);
          border: 1px solid rgba(212, 175, 55, 0.35);
          padding: 2rem;
        }

        .narrative-section.alert-section {
          background: rgba(255, 152, 0, 0.08);
          border: 1px solid rgba(255, 152, 0, 0.35);
        }

        .narrative-section.risk-section {
          background: rgba(244, 67, 54, 0.08);
          border: 1px solid rgba(244, 67, 54, 0.3);
        }

        .narrative-section.action-section {
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.12) 0%, rgba(76, 175, 80, 0.06) 100%);
          border: 2px solid rgba(76, 175, 80, 0.35);
          padding: 2rem;
          box-shadow: 0 8px 32px rgba(76, 175, 80, 0.1), inset 0 1px 0 rgba(76, 175, 80, 0.15);
        }

        .narrative-section.action-section:hover {
          border-color: rgba(76, 175, 80, 0.5);
          box-shadow: 0 12px 48px rgba(76, 175, 80, 0.15), inset 0 1px 0 rgba(76, 175, 80, 0.2);
        }

        .section-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 0.95rem 0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 2px solid rgba(212, 175, 55, 0.5);
          padding-bottom: 0.6rem;
          word-spacing: 0.05em;
        }
        
        .action-section .section-title {
          color: #4caf50;
          text-shadow: 0 0 8px rgba(76, 175, 80, 0.3);
        }

        .narrative-text {
          font-size: 0.93rem;
          line-height: 1.68;
          color: #d8d8d8;
          margin: 0;
        }
        
        .featured .narrative-text {
          font-size: 0.96rem;
          line-height: 1.72;
          color: #e8e8e8;
        }
        
        .action-section .narrative-text {
          font-size: 0.95rem;
          line-height: 1.7;
          color: #e0e0e0;
        }

        .narrative-text.pre-format {
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .narrative-text strong {
          color: #e8e8e8;
          font-weight: 600;
        }

        /* DIMENSIONS GRID - Analytical Dashboard */
        .dimensions-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .dimension-card {
          background: linear-gradient(180deg, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0.05) 100%);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 8px;
          padding: 1rem 0.85rem;
          text-align: center;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }

        .dimension-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, rgba(212, 175, 55, 0) 0%, rgba(212, 175, 55, 0.4) 50%, rgba(212, 175, 55, 0) 100%);
        }

        .dimension-card:hover {
          border-color: rgba(212, 175, 55, 0.5);
          background: linear-gradient(180deg, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0.08) 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(212, 175, 55, 0.15);
        }

        .dim-name {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #aaa;
          margin-bottom: 0.35rem;
          font-weight: 700;
        }

        .dim-score {
          font-size: 1.8rem;
          font-weight: 800;
          color: #d4af37;
          margin-bottom: 0.2rem;
          letter-spacing: -0.02em;
        }

        .dim-rank {
          font-size: 0.75rem;
          color: #888;
          font-weight: 600;
        }

        /* FOOTER */
        .dashboard-footer {
          border-top: 1px solid rgba(212, 175, 55, 0.2);
          padding: 1.5rem 2rem;
          text-align: center;
          background: rgba(10, 14, 39, 0.8);
        }

        .dashboard-footer.global-footer {
          margin-top: 2rem;
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

        /* PRINT STYLES */
        @media print {
          .web-profile-report-v2 {
            background: #fff;
          }
          
          .dashboard-page {
            break-inside: avoid;
            page-break-after: always;
            min-height: auto;
          }
          
          .dashboard-page:last-child {
            page-break-after: avoid;
          }
        }

        /* RESPONSIVE */
        @media (max-width: 1024px) {
          .page-body {
            padding: 2rem 2rem;
            gap: 2rem;
          }
          
          .dimensions-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .dashboard-page {
            min-height: auto;
          }
          
          .page-body {
            padding: 1.5rem 1rem;
            gap: 1.5rem;
          }
          
          .dashboard-header {
            padding: 1.5rem;
            border-radius: 0;
          }

          .header-top {
            flex-direction: column;
            gap: 1rem;
          }

          .header-identity h1 {
            font-size: 1.75rem;
          }

          .profile-id-box {
            align-self: stretch;
            text-align: left;
            padding: 0.75rem 1rem;
          }

          .dashboard-body {
            padding: 1.5rem 1rem;
          }

          .narrative-section,
          .data-section {
            padding: 1.25rem;
            margin-bottom: 1rem;
          }

          .dimensions-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .dna-signature {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .footer-meta {
            gap: 0.75rem;
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
}
