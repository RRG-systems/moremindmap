/**
 * WebProfileReport.jsx
 * 
 * Premium web-first behavioral profile report
 * Replaces PDF-style template with responsive dashboard
 * 
 * Design: Premium executive dashboard (black/white/gray + accent)
 * Sections: 14 core report sections
 * Layout: Responsive cards, no page breaks, browser-first
 */

export default function WebProfileReport({ canonical, profileId }) {
  if (!canonical) {
    return <div className="web-report-error">Unable to load profile data</div>;
  }

  const data = canonical.canonical_profile_json || canonical;

  // Extract key data
  const personName = canonical.person_name || 'Assessment Subject';
  const company = canonical.company_name || '';
  const profileType = data.inferred_patterns?.profile_type || 'Behavioral Profile';
  const vectorScores = data.vector_scores || {};
  const topSystems = data.top_systems || {};
  const narratives = data.narratives || {};

  return (
    <div className="web-profile-report">
      {/* HEADER SECTION */}
      <header className="report-header">
        <div className="header-content">
          <div>
            <h1 className="report-title">{personName}</h1>
            <div className="header-meta">
              <span className="badge profile-type">{profileType}</span>
              <span className="badge profile-id">ID: {profileId}</span>
              {company && <span className="badge company">{company}</span>}
            </div>
          </div>
          <div className="header-signature">
            <div className="signature-label">PROFILE CODE</div>
            <div className="signature-code">
              {Object.entries(vectorScores)
                .sort(([, a], [, b]) => (b || 0) - (a || 0))
                .slice(0, 4)
                .map(([dim, score]) => `${dim.toUpperCase().substring(0, 1)}`)
                .join('')}
            </div>
          </div>
        </div>
      </header>

      {/* SECTION 1: PROFILE SIGNATURE & DNA */}
      <section className="report-section">
        <h2 className="section-title">Profile DNA</h2>
        <div className="cards-grid">
          <div className="info-card">
            <div className="card-label">Core Engine</div>
            <div className="card-value">
              {topSystems.primary_driver?.description || 'N/A'}
            </div>
            <div className="card-detail">
              {topSystems.primary_driver?.operating_manifestation || ''}
            </div>
          </div>

          <div className="info-card">
            <div className="card-label">Primary Driver</div>
            <div className="card-value">{topSystems.primary_driver?.dimension || 'N/A'}</div>
            <div className="card-detail">Score: {topSystems.primary_driver?.score}</div>
          </div>

          <div className="info-card">
            <div className="card-label">Stabilizer</div>
            <div className="card-value">{topSystems.secondary_stabilizer?.dimension || 'N/A'}</div>
            <div className="card-detail">Score: {topSystems.secondary_stabilizer?.score}</div>
          </div>

          <div className="info-card">
            <div className="card-label">Opposing Pattern</div>
            <div className="card-value">{topSystems.opposing_pattern_1?.dimension || 'N/A'}</div>
            <div className="card-detail">Score: {topSystems.opposing_pattern_1?.score}</div>
          </div>
        </div>
      </section>

      {/* SECTION 2: TOP DIMENSIONS */}
      <section className="report-section">
        <h2 className="section-title">Behavioral Dimensions</h2>
        <div className="dimension-grid">
          {(data.ranked_dimensions || []).slice(0, 8).map((dim) => (
            <div key={dim.dimension} className="dimension-item">
              <div className="dimension-label">{dim.dimension.toUpperCase()}</div>
              <div className="dimension-score">{dim.score > 0 ? '+' : ''}{dim.score}</div>
              <div className="dimension-explanation">
                {data.narratives?.[`${dim.dimension}_narrative`] || `Rank: ${dim.rank}`}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: EXECUTIVE SUMMARY */}
      <section className="report-section">
        <h2 className="section-title">Executive Summary</h2>
        <div className="narrative-block">
          {narratives.executive_summary || 
            `${personName} operates with ${topSystems.primary_driver?.description || 'distinctive patterns'}. ` +
            `Their primary operating mode emphasizes ${topSystems.primary_driver?.operating_manifestation || 'core strengths'}. ` +
            `Under pressure, this manifests as: ${topSystems.primary_driver?.pressure_manifestation || 'adaptive response'}.`
          }
        </div>
      </section>

      {/* SECTION 4: OPERATING PATTERN */}
      <section className="report-section">
        <h2 className="section-title">How They Operate</h2>
        <div className="two-column-grid">
          <div className="narrative-card">
            <h3 className="card-heading">Default Mode</h3>
            <p>{topSystems.primary_driver?.operating_manifestation || 'Core operating pattern'}</p>
          </div>
          <div className="narrative-card">
            <h3 className="card-heading">Under Pressure</h3>
            <p>{topSystems.primary_driver?.pressure_manifestation || 'Response under strain'}</p>
          </div>
        </div>
      </section>

      {/* SECTION 5: DECISION ARCHITECTURE */}
      <section className="report-section">
        <h2 className="section-title">Decision Architecture</h2>
        <div className="narrative-block">
          {narratives.decision_architecture || 
            `Decisions are driven by ${topSystems.primary_driver?.dimension}. ` +
            `They integrate ${topSystems.secondary_stabilizer?.dimension} for balance. ` +
            `Key tensions: ${data.contradictions?.[0]?.tension || 'multiple system trade-offs'}.`
          }
        </div>
      </section>

      {/* SECTION 6: COMMUNICATION STYLE */}
      <section className="report-section">
        <h2 className="section-title">Communication Style</h2>
        <div className="narrative-block">
          {narratives.communication_signals || 
            `Communication pattern reflects ${topSystems.primary_driver?.dimension}. ` +
            `Tends to ${topSystems.primary_driver?.operating_manifestation?.toLowerCase() || 'direct engagement'}. ` +
            `Receives feedback through: results, directness, clarity.`
          }
        </div>
      </section>

      {/* SECTION 7: SYSTEM UNDER STRAIN */}
      <section className="report-section">
        <h2 className="section-title">System Under Strain</h2>
        <div className="warning-box">
          <div className="warning-label">⚠ System Tension</div>
          <div className="warning-text">
            {data.contradictions?.[0]?.tension || 'Multiple system tensions exist'}
          </div>
        </div>
        <div className="narrative-block" style={{ marginTop: '1rem' }}>
          <strong>Manifestation:</strong> {data.contradictions?.[0]?.manifestation || 'Tension manifests under pressure'}
        </div>
      </section>

      {/* SECTION 8: CONTRADICTIONS & SELF-DECEPTION */}
      <section className="report-section">
        <h2 className="section-title">Hidden Contradictions</h2>
        {data.contradictions?.slice(0, 3).map((contradiction, idx) => (
          <div key={idx} className="contradiction-card">
            <div className="contradiction-tension">{contradiction.tension}</div>
            <div className="contradiction-detail">{contradiction.manifestation}</div>
          </div>
        ))}
      </section>

      {/* SECTION 9: STRATEGIC CEILING */}
      <section className="report-section">
        <h2 className="section-title">Strategic Ceiling Analysis</h2>
        <div className="narrative-block">
          {narratives.strategic_ceiling || 
            `Growth ceiling determined by: ${topSystems.opposing_pattern_1?.dimension || 'limiting factors'}. ` +
            `Current constraints: ${data.stress_patterns?.length > 0 ? 'stress-induced patterns limit expansion' : 'system tension boundaries'}. ` +
            `Next evolution requires conscious development of ${topSystems.secondary_stabilizer?.dimension || 'complementary patterns'}.`
          }
        </div>
      </section>

      {/* SECTION 10: HIDDEN RISKS */}
      <section className="report-section">
        <h2 className="section-title">Hidden Risk Patterns</h2>
        {data.self_deception_patterns && data.self_deception_patterns.length > 0 ? (
          data.self_deception_patterns.map((pattern, idx) => (
            <div key={idx} className="risk-item">
              <div className="risk-pattern">{pattern.pattern}</div>
              <div className="risk-consequence">{pattern.consequence}</div>
            </div>
          ))
        ) : (
          <div className="narrative-block">
            {narratives.hidden_risks || 'Blind spots develop in high-pressure environments where primary driver accelerates.'}
          </div>
        )}
      </section>

      {/* SECTION 11: COACHING LEVERAGE */}
      <section className="report-section">
        <h2 className="section-title">Coaching Leverage & Development</h2>
        <div className="leverage-grid">
          {data.coaching_leverage_points && data.coaching_leverage_points.length > 0 ? (
            data.coaching_leverage_points.map((point, idx) => (
              <div key={idx} className="leverage-item">
                <div className="leverage-point">{point}</div>
              </div>
            ))
          ) : (
            <>
              <div className="leverage-item">
                <div className="leverage-point">
                  Develop {topSystems.secondary_stabilizer?.dimension} to prevent overreliance on {topSystems.primary_driver?.dimension}
                </div>
              </div>
              <div className="leverage-item">
                <div className="leverage-point">
                  Practice {topSystems.opposing_pattern_1?.dimension} under low-stakes conditions to build resilience
                </div>
              </div>
              <div className="leverage-item">
                <div className="leverage-point">
                  Create feedback loops for pressure-mode recognition and conscious choice
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* SECTION 12: CONTEXTUAL SIGNALS */}
      <section className="report-section">
        <h2 className="section-title">Contextual Signals</h2>
        <div className="context-grid">
          <div className="context-item">
            <div className="context-label">Role Fit</div>
            <div className="context-value">
              {data.role_fit_analysis || 'High fit for directive, strategic roles'}
            </div>
          </div>
          <div className="context-item">
            <div className="context-label">Environment Fit</div>
            <div className="context-value">
              {data.environment_fit || 'Thrives in high-agency environments'}
            </div>
          </div>
          <div className="context-item">
            <div className="context-label">Leadership Readiness</div>
            <div className="context-value">
              {data.leadership_readiness || 'Ready for next level with conscious development'}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 13: NEXT STEP */}
      <section className="report-section final-section">
        <h2 className="section-title">Recommended Next Step</h2>
        <div className="next-step-box">
          <div className="next-step-text">
            {narratives.future_trajectory || 
              `Focus on integrating ${topSystems.secondary_stabilizer?.dimension} ` +
              `while maintaining ${topSystems.primary_driver?.dimension} advantage. ` +
              `This creates sustainable high performance.`
            }
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="report-footer">
        <div className="footer-meta">
          <span>Assessment Date: {canonical.created_at?.split('T')[0] || 'N/A'}</span>
          <span>Profile Type: {profileType}</span>
          <span>Confidence: High</span>
        </div>
      </footer>

      <style jsx>{`
        .web-profile-report {
          background: #ffffff;
          color: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .report-header {
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 2rem;
          margin-bottom: 2rem;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 2rem;
        }

        .report-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0;
          color: #000;
          line-height: 1.2;
        }

        .header-meta {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
          flex-wrap: wrap;
        }

        .badge {
          display: inline-block;
          padding: 0.35rem 0.75rem;
          background: #f0f0f0;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 500;
          color: #555;
        }

        .badge.profile-type {
          background: #f9f0e6;
          border-color: #d4af37;
          color: #8b6914;
        }

        .header-signature {
          text-align: center;
          padding: 1.5rem;
          background: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }

        .signature-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #999;
          margin-bottom: 0.5rem;
        }

        .signature-code {
          font-size: 1.5rem;
          font-weight: 700;
          color: #d4af37;
          font-family: 'Monaco', monospace;
          letter-spacing: 0.1em;
        }

        .report-section {
          margin-bottom: 3rem;
          padding: 0;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 1.5rem 0;
          color: #000;
          border-bottom: 2px solid #d4af37;
          padding-bottom: 0.5rem;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .info-card {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 1.25rem;
          transition: all 0.2s;
        }

        .info-card:hover {
          background: #fff;
          border-color: #d4af37;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .card-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #999;
          margin-bottom: 0.5rem;
        }

        .card-value {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }

        .card-detail {
          font-size: 0.9rem;
          color: #666;
          line-height: 1.4;
        }

        .dimension-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .dimension-item {
          background: linear-gradient(135deg, #f9f9f9 0%, #fff 100%);
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 1rem;
          text-align: center;
        }

        .dimension-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #999;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .dimension-score {
          font-size: 1.8rem;
          font-weight: 700;
          color: #d4af37;
          margin-bottom: 0.5rem;
        }

        .dimension-explanation {
          font-size: 0.85rem;
          color: #666;
          line-height: 1.35;
        }

        .narrative-block {
          background: #f9f9f9;
          border-left: 4px solid #d4af37;
          padding: 1.25rem;
          border-radius: 4px;
          font-size: 1rem;
          line-height: 1.7;
          color: #333;
        }

        .two-column-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .narrative-card {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 1.5rem;
        }

        .card-heading {
          font-size: 1rem;
          font-weight: 700;
          margin: 0 0 0.75rem 0;
          color: #000;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 0.9rem;
          color: #d4af37;
        }

        .card-heading + p {
          font-size: 0.95rem;
          color: #555;
          margin: 0;
          line-height: 1.5;
        }

        .warning-box {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-left: 4px solid #ff9800;
          border-radius: 6px;
          padding: 1.25rem;
          margin-bottom: 1rem;
        }

        .warning-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #856404;
          margin-bottom: 0.5rem;
          font-weight: 700;
        }

        .warning-text {
          font-size: 1rem;
          color: #333;
          font-weight: 500;
        }

        .contradiction-card {
          background: #fff;
          border: 1px solid #ffebee;
          border-left: 4px solid #f44336;
          border-radius: 4px;
          padding: 1rem;
          margin-bottom: 0.75rem;
        }

        .contradiction-tension {
          font-weight: 600;
          color: #c62828;
          margin-bottom: 0.25rem;
          font-size: 0.95rem;
        }

        .contradiction-detail {
          font-size: 0.9rem;
          color: #666;
          line-height: 1.4;
        }

        .leverage-grid {
          display: grid;
          gap: 1rem;
        }

        .leverage-item {
          background: #e8f5e9;
          border: 1px solid #4caf50;
          border-radius: 6px;
          padding: 1rem;
        }

        .leverage-point {
          font-size: 0.95rem;
          color: #1b5e20;
          line-height: 1.5;
        }

        .context-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .context-item {
          background: #f0f4f8;
          border-radius: 6px;
          padding: 1.25rem;
          border: 1px solid #bfd7ed;
        }

        .context-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #555;
          margin-bottom: 0.5rem;
          font-weight: 700;
        }

        .context-value {
          font-size: 0.95rem;
          color: #333;
          line-height: 1.5;
        }

        .final-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 2px solid #e0e0e0;
        }

        .next-step-box {
          background: linear-gradient(135deg, #d4af37 0%, #b8950a 100%);
          color: #fff;
          padding: 2rem;
          border-radius: 6px;
          text-align: center;
        }

        .next-step-text {
          font-size: 1.1rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .report-footer {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid #e0e0e0;
          text-align: center;
          font-size: 0.85rem;
          color: #999;
        }

        .footer-meta {
          display: flex;
          justify-content: center;
          gap: 2rem;
          flex-wrap: wrap;
        }

        .web-report-error {
          padding: 2rem;
          text-align: center;
          color: #f44336;
          font-weight: 500;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .web-profile-report {
            padding: 1rem;
          }

          .header-content {
            flex-direction: column;
          }

          .report-title {
            font-size: 1.75rem;
          }

          .section-title {
            font-size: 1.25rem;
          }

          .cards-grid,
          .dimension-grid,
          .two-column-grid,
          .context-grid {
            grid-template-columns: 1fr;
          }

          .next-step-box {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
