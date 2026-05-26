/**
 * WebProfileReport.jsx
 * 
 * Dashboard Report V1 (NEW PRESENTATION LAYER)
 * Behavioral Intelligence System Dashboard
 * Asymmetrical grid composition, cinematic dark luxury
 * 
 * ARCHITECTURAL NOTES:
 * - Uses same canonical + narrative data as V2
 * - Completely reimagined presentation layer
 * - No backend changes, no logic rewrites
 * - Falls back to old stacked render if DashboardReportV1 fails
 */

import { useState, useEffect } from 'react';
import { buildNarrativeV3 } from '../../lib/narrativeV3/buildNarrativeV3.js';
import { buildRenderPlan, extractSectionContent } from '../../lib/profile/renderContract.js';

// ============================================================================
// DASHBOARD COMPONENTS (V1)
// ============================================================================

function DashboardReportV1({ canonical, profileId, narrative, profileNumber, profileCode, personName, company, profileType, ranked, behavioralIntelligence }) {
  return (
    <div className="dashboard-report-v1 intelligence-system">
      {/* HERO HEADER */}
      <header className="dashboard-hero">
        <div className="hero-grid">
          <div className="hero-identity-zone">
            <div className="identity-anchor">
              <div className="identity-number">{profileNumber}</div>
              <div className="identity-label">BEHAVIORAL OPERATING SYSTEM</div>
            </div>
            <div className="identity-text">
              <h1 className="identity-name">{personName}</h1>
              <p className="identity-tagline">The architecture of how you think, decide, and create impact</p>
              {company && <p className="identity-company">{company}</p>}
            </div>
          </div>
          
          <div className="hero-meta-zone">
            <div className="meta-card">
              <div className="meta-label">PROFILE</div>
              <div className="meta-code">{profileCode}</div>
            </div>
            <div className="meta-card">
              <div className="meta-label">TYPE</div>
              <div className="meta-value">{profileType}</div>
            </div>
            <div className="meta-card">
              <div className="meta-label">ID</div>
              <div className="meta-value meta-mono">{profileId?.substring(0, 20)}</div>
            </div>
          </div>
        </div>
        
        {/* DNA SIGNATURE */}
        <div className="dna-signature-zone">
          <span className="dna-zone-label">PROFILE DNA</span>
          <div className="dna-hexagon-grid">
            {ranked.slice(0, 8).map((d) => (
              <div key={d.dimension} className="dna-hex">
                <div className="hex-inner">
                  <span className="hex-abbr">{d.dimension.substring(0, 3).toUpperCase()}</span>
                  <span className="hex-score">{d.score > 0 ? '+' : ''}{d.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* PAGE 1: OPERATING SYSTEM */}
      <PageOneDashboard narrative={narrative} ranked={ranked} />
      
      {/* PAGE 2: STRATEGIC CONSEQUENCES */}
      <PageTwoDashboard narrative={narrative} ranked={ranked} behavioralIntelligence={behavioralIntelligence} canonical={canonical} />
      
      {/* PAGE 3: HOW THIS SYSTEM MOVES */}
      <PageThreeDashboard narrative={narrative} behavioralIntelligence={behavioralIntelligence} canonical={canonical} />
      
      {/* PAGE 4: WHAT PRESSURE CHANGES */}
      <PageFourDashboard narrative={narrative} behavioralIntelligence={behavioralIntelligence} canonical={canonical} />
      
      {/* PAGE 5: HOW OTHER PEOPLE ADAPT */}
      <PageFiveDashboard narrative={narrative} behavioralIntelligence={behavioralIntelligence} canonical={canonical} />
      
      {/* PAGE 6: WHY SCALE BREAKS */}
      <PageSixDashboard narrative={narrative} behavioralIntelligence={behavioralIntelligence} canonical={canonical} />
      
      {/* PAGE 7: FUTURE TRAJECTORIES (FEATURED) */}
      <PageSevenDashboard narrative={narrative} behavioralIntelligence={behavioralIntelligence} canonical={canonical} />
      
      {/* PAGE 8: INTERVENTION */}
      <PageEightDashboard narrative={narrative} behavioralIntelligence={behavioralIntelligence} canonical={canonical} />
    </div>
  );
}

function PageOneDashboard({ narrative, ranked }) {
  return (
    <div className="dashboard-page page-one">
      <div className="page-content">
        {/* ZONE 1: HERO + TRIAD (3 core operating patterns) */}
        <div className="zone-hero-triad">
          {/* Hero: Profile DNA (main operating model) */}
          <InsightPanel
            className="hero-dna-module"
            icon="🧬"
            title="Profile DNA"
            subtitle="Operating Model"
            content={narrative.profileDNA?.body || narrative.profileDNA}
            prominence="hero"
          />
          
          {/* Triad: 3 Core Dimensions */}
          <div className="triad-grid">
            <MetricCard
              icon="🔄"
              title="Command Clarity"
              metric={ranked[0]?.score || 0}
              dimension={ranked[0]?.dimension || 'Primary'}
              color="clarity"
            />
            <MetricCard
              icon="⚖️"
              title="Speed vs Fidelity"
              metric={ranked[1]?.score || 0}
              dimension={ranked[1]?.dimension || 'Secondary'}
              color="balance"
            />
            <MetricCard
              icon="🎯"
              title="Strategic Leverage"
              metric={ranked[2]?.score || 0}
              dimension={ranked[2]?.dimension || 'Tertiary'}
              color="leverage"
            />
          </div>
        </div>

        {/* ZONE 2: Analytical Pair (DNA Summary + Behavioral Summary) */}
        <div className="zone-analytical-pair">
          <InsightPanel
            icon="📊"
            title="DNA Summary"
            subtitle="Vector Analysis"
            content={ranked.slice(0, 6).map(d => `${d.dimension}: ${d.score > 0 ? '+' : ''}${d.score}`).join(' • ')}
            prominence="analytical"
            className="left-panel"
          />
          
          {narrative.executiveSummary && (
            <InsightPanel
              icon="💼"
              title="Executive Summary"
              subtitle="Behavioral Briefing"
              content={narrative.executiveSummary?.body || narrative.executiveSummary}
              prominence="analytical"
              warning={narrative.executiveSummary?.key_warning}
              className="right-panel"
            />
          )}
        </div>

        {/* ZONE 3: Pressure Dynamics (4-column flow) */}
        {narrative.systemUnderStrain && (
          <PressureFlow narrative={narrative} />
        )}
      </div>
    </div>
  );
}

function PageTwoDashboard({ narrative, behavioralIntelligence, canonical }) {
  // Build render plan if behavioral intelligence available
  const renderPlan = behavioralIntelligence ? buildRenderPlan(behavioralIntelligence, canonical) : null;
  
  // Extract behavioral intelligence content for new sections
  const organizationalConsequencesBI = renderPlan ? extractSectionContent('section-organizational-consequences', behavioralIntelligence, canonical) : null;
  const facilitatorNotesBI = renderPlan ? extractSectionContent('section-facilitator-notes', behavioralIntelligence, canonical) : null;

  return (
    <div className="dashboard-page page-two">
      <div className="page-content">
        {/* ZONE 1: Diagnostics Pair (Hidden Contradictions + Strain) */}
        <div className="zone-diagnostics-pair">
          {narrative.hiddenContradictions && (
            <InsightPanel
              icon="⚠️"
              title="Hidden Contradictions"
              subtitle="Warning / Diagnostic"
              content={narrative.hiddenContradictions?.body || narrative.hiddenContradictions}
              warning={narrative.hiddenContradictions?.key_warning}
              prominence="diagnostic"
              className="left-diagnostic"
            />
          )}
          
          {narrative.systemUnderStrain && (
            <InsightPanel
              icon="⚡"
              title="Operating Under Pressure"
              subtitle="Stress Dynamics"
              content={narrative.systemUnderStrain?.body || narrative.systemUnderStrain}
              warning={narrative.systemUnderStrain?.key_warning}
              prominence="diagnostic"
              className="right-diagnostic"
            />
          )}
        </div>

        {/* ZONE 2: Strategic Ceiling (horizontal systems map) */}
        {narrative.strategicCeiling && (
          <StrategicMap narrative={narrative} />
        )}

        {/* ZONE 3: Facilitator Notes (from Behavioral Intelligence) */}
        {facilitatorNotesBI?.found && facilitatorNotesBI?.content && (
          <div className="zone-facilitator-notes">
            <InsightPanel
              icon="⚙️"
              title="Facilitator Notes"
              subtitle="Environment Design Guidance"
              content={renderBIContent("facilitatorNotes", facilitatorNotesBI.content)}
              prominence="analytical"
              className="facilitator-notes-panel"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PageThreeDashboard({ narrative, behavioralIntelligence, canonical }) {
  // Extract World Experience from BI
  const renderPlan = behavioralIntelligence ? buildRenderPlan(behavioralIntelligence, canonical) : null;
  const worldExperienceBI = renderPlan ? extractSectionContent('section-world-experience', behavioralIntelligence, canonical) : null;

  // DEBUG: Log what we're receiving
  if (worldExperienceBI?.found && worldExperienceBI?.content) {
    console.log('=== PAGE 3: WORLD EXPERIENCE DEBUG ===');
    console.log('worldExperienceBI.content keys:', Object.keys(worldExperienceBI.content));
    console.log('Full content object:', JSON.stringify(worldExperienceBI.content, null, 2).substring(0, 1000));
  }

  return (
    <div className="dashboard-page page-three" id="section-2-how-system-moves">
      <div className="page-content">
        {/* SECTION 2: HOW THIS SYSTEM MOVES */}
        <div className="page-section-header">
          <h2 className="page-section-title">How This System Moves</h2>
          <p className="page-section-subtitle">Pure mechanism: operating patterns without yet showing consequences</p>
        </div>
        
        <div className="zone-progression">
          {worldExperienceBI?.found && worldExperienceBI?.content ? (
            <InsightPanel
              icon="🗣️"
              title="World Experience"
              subtitle="How You Experience Your Operating Environment"
              content={renderBIContent("worldExperience", worldExperienceBI.content)}
              prominence="analytical"
              className="world-experience-panel"
            />
          ) : narrative.communicationStyle ? (
            <InsightPanel
              icon="🗣️"
              title="World Experience"
              subtitle="How You Experience Your Operating Environment"
              content={narrative.communicationStyle?.body || narrative.communicationStyle}
              prominence="analytical"
              className="world-experience-panel"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PageFourDashboard({ narrative, behavioralIntelligence, canonical }) {
  // Extract Pressure Mechanics from BI
  const renderPlan = behavioralIntelligence ? buildRenderPlan(behavioralIntelligence, canonical) : null;
  const pressureMechanicsBI = renderPlan ? extractSectionContent('section-pressure-mechanics', behavioralIntelligence, canonical) : null;



  return (
    <div className="dashboard-page page-four">
      <div className="page-content">
        {/* PAGE 4: Pressure Mechanics */}
        <div className="page-section-header">
          <h2 className="page-section-title">What Pressure Changes</h2>
          <p className="page-section-subtitle">Behavioral escalation under operational load</p>
        </div>
        
        <div className="zone-progression">
          {pressureMechanicsBI?.found && pressureMechanicsBI?.content ? (
            <InsightPanel
              icon="⚡"
              title="Pressure Mechanics"
              subtitle="Behavior Escalation Under Load"
              content={renderBIContent("pressureMechanics", pressureMechanicsBI.content)}
              prominence="analytical"
              className="pressure-mechanics-panel"
            />
          ) : narrative.systemUnderStrain ? (
            <InsightPanel
              icon="⚡"
              title="Pressure Mechanics"
              subtitle="Behavior Escalation Under Load"
              content={narrative.systemUnderStrain?.body || narrative.systemUnderStrain}
              prominence="analytical"
              className="pressure-mechanics-panel"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PageFiveDashboard({ narrative, behavioralIntelligence, canonical }) {
  // Extract Others Experience from BI
  const renderPlan = behavioralIntelligence ? buildRenderPlan(behavioralIntelligence, canonical) : null;
  const othersExperienceBI = renderPlan ? extractSectionContent('section-how-others-experience', behavioralIntelligence, canonical) : null;

  return (
    <div className="dashboard-page page-five">
      <div className="page-content">
        {/* PAGE 5: How Other People Adapt */}
        <div className="page-section-header">
          <h2 className="page-section-title">How Others Experience You</h2>
          <p className="page-section-subtitle">Your operating pattern from team perspective</p>
        </div>
        
        <div className="zone-progression">
          {othersExperienceBI?.found && othersExperienceBI?.content ? (
            <InsightPanel
              icon="🤝"
              title="Team Experience"
              subtitle="How Your Operating Pattern Lands on Others"
              content={renderBIContent("othersExperience", othersExperienceBI.content)}
              prominence="analytical"
              className="team-experience-panel"
            />
          ) : narrative.communicationStyle ? (
            <InsightPanel
              icon="🤝"
              title="Team Experience"
              subtitle="How Your Operating Pattern Lands on Others"
              content={narrative.communicationStyle?.body || narrative.communicationStyle}
              prominence="analytical"
              className="team-experience-panel"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PageSixDashboard({ narrative, behavioralIntelligence, canonical }) {
  // Extract Scaling Constraint from BI (primary source)
  const renderPlan = behavioralIntelligence ? buildRenderPlan(behavioralIntelligence, canonical) : null;
  const scalingConstraintBI = renderPlan ? extractSectionContent('section-scaling-constraint', behavioralIntelligence, canonical) : null;

  return (
    <div className="dashboard-page page-six">
      <div className="page-content">
        <div className="page-section-header">
          <h2 className="page-section-title">Why Scale Breaks</h2>
          <p className="page-section-subtitle">Where personal execution becomes insufficient</p>
        </div>
        <div className="zone-progression">
          {scalingConstraintBI?.found && scalingConstraintBI?.content ? (
            <InsightPanel
              icon="📊"
              title="Scaling Constraint"
              subtitle="The Specific Ceiling You'll Hit"
              content={renderBIContent("scalingConstraint", scalingConstraintBI.content)}
              prominence="analytical"
              className="scaling-constraint-panel"
            />
          ) : narrative.strategicCeiling ? (
            <InsightPanel
              icon="📊"
              title="Scaling Constraint"
              subtitle="The Specific Ceiling You'll Hit"
              content={narrative.strategicCeiling?.body || narrative.strategicCeiling}
              warning={narrative.strategicCeiling?.key_warning}
              prominence="analytical"
              className="scaling-constraint-panel"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PageSevenDashboard({ narrative, behavioralIntelligence, canonical }) {
  // Extract Five Futures from BI
  const renderPlan = behavioralIntelligence ? buildRenderPlan(behavioralIntelligence, canonical) : null;
  const fiveFuturesBI = renderPlan ? extractSectionContent('section-five-futures', behavioralIntelligence, canonical) : null;

  return (
    <div className="dashboard-page page-seven">
      <div className="page-content">
        <div className="page-section-header">
          <h2 className="page-section-title">Five Futures</h2>
          <p className="page-section-subtitle">Five trajectory scenarios emerging from your current operating pattern</p>
        </div>
        
        {/* Render Five Futures as distinct items */}
        <div className="zone-progression five-futures-featured">
          {fiveFuturesBI?.found && fiveFuturesBI?.content ? (
            <FiveFuturesRenderer content={fiveFuturesBI.content} />
          ) : narrative.profileDNA ? (
            <InsightPanel
              icon="🌌"
              title="Five Futures"
              subtitle="Trajectory Simulations Based on Current Pattern"
              content={narrative.profileDNA?.body || 'Five scenarios emerge from current operating pattern.'}
              prominence="premium"
              className="five-futures-panel"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PageEightDashboard({ narrative, behavioralIntelligence, canonical }) {
  // Extract The One Move from BI (primary source)
  const renderPlan = behavioralIntelligence ? buildRenderPlan(behavioralIntelligence, canonical) : null;
  const theOneMoveBI = renderPlan ? extractSectionContent('section-the-one-move', behavioralIntelligence, canonical) : null;

  return (
    <div className="dashboard-page page-eight">
      <div className="page-content">
        <div className="page-section-header">
          <h2 className="page-section-title">The One Move</h2>
          <p className="page-section-subtitle">Highest-leverage intervention earned by evidence</p>
        </div>
        <div className="zone-progression">
          {theOneMoveBI?.found && theOneMoveBI?.content ? (
            <InsightPanel
              icon="⚡"
              title="The One Move"
              subtitle="Highest-Leverage Intervention"
              content={renderBIContent("theOneMove", theOneMoveBI.content)}
              prominence="premium"
              className="one-move-panel"
            />
          ) : narrative.recommendedNextStep ? (
            <InsightPanel
              icon="⚡"
              title="The One Move"
              subtitle="Highest-Leverage Intervention"
              content={narrative.recommendedNextStep?.body || narrative.recommendedNextStep}
              prominence="premium"
              className="one-move-panel"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS FOR CONTENT RENDERING
// ============================================================================

/**
 * Format behavioral intelligence content for display
 * Handles both string and object structures
 */
function renderBIContent(domain, content) {
  if (!content) return null;
  
  if (typeof content === 'string') {
    return content;
  }
  
  if (typeof content === 'object') {
    const parts = [];
    
    // Summary at top (narrative hook)
    if (content.summary) {
      parts.push(<p key="summary" className="bi-summary">{content.summary}</p>);
    }
    
    // World Experience - render as flowing narrative blocks
    if (domain === 'worldExperience') {
      const perceptions = [
        content.perception_filter && { title: 'Perception', content: content.perception_filter.interpretation },
        content.information_processing && { title: 'Information Processing', content: content.information_processing.interpretation },
        content.decision_formation && { title: 'Decision Formation', content: content.decision_formation.interpretation },
        content.time_horizon && { title: 'Time Horizon', content: content.time_horizon.interpretation },
        content.risk_calibration && { title: 'Risk Calibration', content: content.risk_calibration.interpretation },
      ].filter(Boolean);
      
      perceptions.forEach((item, idx) => {
        parts.push(
          <div key={`perc-${idx}`} className="bi-subsection">
            <h4 className="bi-subsection-title">{item.title}</h4>
            <p className="bi-subsection-text">{item.content}</p>
          </div>
        );
      });
      
      // Key signals - cleaner presentation
      if (content.key_signals && Array.isArray(content.key_signals)) {
        parts.push(
          <div key="signals" className="bi-key-signals">
            <h4 className="bi-subsection-title">Key Signals</h4>
            <ul className="bi-signal-list">
              {content.key_signals.map((signal, idx) => (
                <li key={idx}>{signal}</li>
              ))}
            </ul>
          </div>
        );
      }
    }
    
    // Pressure Mechanics - narrative + state changes
    if (domain === 'pressureMechanics') {
      const mechanics = [
        content.primary_under_load && { 
          type: 'primary',
          data: content.primary_under_load 
        },
        content.secondary_override && { 
          type: 'secondary',
          data: content.secondary_override 
        },
      ].filter(Boolean);
      
      mechanics.forEach((mech, idx) => {
        const data = mech.data;
        const title = mech.type === 'primary' 
          ? `${data.dimension} Under Load` 
          : `${data.dimension} Override Pattern`;
        
        parts.push(
          <div key={`mech-${idx}`} className="bi-subsection">
            <h4 className="bi-subsection-title">{title}</h4>
            <div className="bi-state-pair">
              <div className="bi-state">
                <p className="bi-state-label">Normal State</p>
                <p className="bi-state-text">{data.normal_state || data.normal}</p>
              </div>
              <div className="bi-state">
                <p className="bi-state-label">Under Pressure</p>
                <p className="bi-state-text">{data.pressure_state || data.override_pattern || data.pressure}</p>
              </div>
            </div>
            {data.interpretation && <p className="bi-interpretation">{data.interpretation}</p>}
          </div>
        );
      });
      
      // Key signals
      if (content.key_signals && Array.isArray(content.key_signals)) {
        parts.push(
          <div key="signals" className="bi-key-signals">
            <h4 className="bi-subsection-title">Key Signals</h4>
            <ul className="bi-signal-list">
              {content.key_signals.map((signal, idx) => (
                <li key={idx}>{signal}</li>
              ))}
            </ul>
          </div>
        );
      }
    }
    
    // Others Experience - how they perceive you
    if (domain === 'othersExperience') {
      const experiences = [
        content.first_impression && { title: 'First Impression', content: content.first_impression.interpretation },
        content.communication_pattern && { title: 'Communication Pattern', content: content.communication_pattern.interpretation },
        content.listening_pattern && { title: 'Listening Pattern', content: content.listening_pattern.interpretation },
        content.relational_friction && { title: 'Relational Dynamics', content: content.relational_friction.interpretation },
      ].filter(Boolean);
      
      experiences.forEach((item, idx) => {
        parts.push(
          <div key={`exp-${idx}`} className="bi-subsection">
            <h4 className="bi-subsection-title">{item.title}</h4>
            <p className="bi-subsection-text">{item.content}</p>
          </div>
        );
      });
      
      // Key signals
      if (content.key_signals && Array.isArray(content.key_signals)) {
        parts.push(
          <div key="signals" className="bi-key-signals">
            <h4 className="bi-subsection-title">Key Signals</h4>
            <ul className="bi-signal-list">
              {content.key_signals.map((signal, idx) => (
                <li key={idx}>{signal}</li>
              ))}
            </ul>
          </div>
        );
      }
    }
    
    // Scaling Constraint - three parts
    if (domain === 'scalingConstraint') {
      const constraints = [
        content.ceiling_mechanics && { 
          title: 'Ceiling Mechanism', 
          data: content.ceiling_mechanics 
        },
        content.current_systems_capacity && { 
          title: 'Current Capacity', 
          data: content.current_systems_capacity 
        },
        content.stated_vs_supported && { 
          title: 'Goal + Infrastructure Alignment', 
          data: content.stated_vs_supported 
        },
        content.implications && { 
          title: 'Implications', 
          data: content.implications 
        },
      ].filter(Boolean);
      
      constraints.forEach((constraint, idx) => {
        parts.push(
          <div key={`constraint-${idx}`} className="bi-subsection">
            <h4 className="bi-subsection-title">{constraint.title}</h4>
            {typeof constraint.data === 'string' ? (
              <p className="bi-subsection-text">{constraint.data}</p>
            ) : (
              <div className="bi-subsection-content">
                {constraint.data.interpretation && <p>{constraint.data.interpretation}</p>}
                {constraint.data.description && <p>{constraint.data.description}</p>}
                {constraint.data.capacity_description && <p>{constraint.data.capacity_description}</p>}
                {constraint.data.primary_constraint && <p><em>{constraint.data.primary_constraint}</em></p>}
              </div>
            )}
          </div>
        );
      });
      
      // Key signals
      if (content.key_signals && Array.isArray(content.key_signals)) {
        parts.push(
          <div key="signals" className="bi-key-signals">
            <h4 className="bi-subsection-title">Key Signals</h4>
            <ul className="bi-signal-list">
              {content.key_signals.map((signal, idx) => (
                <li key={idx}>{signal}</li>
              ))}
            </ul>
          </div>
        );
      }
    }
    
    // Facilitator Notes - primary guidance + structured notes
    if (domain === 'facilitatorNotes') {
      if (content.primary_guidance) {
        parts.push(
          <div key="guidance" className="bi-subsection">
            <p className="bi-subsection-highlight">{content.primary_guidance}</p>
          </div>
        );
      }
      
      if (Array.isArray(content.notes) && content.notes.length > 0) {
        parts.push(
          <div key="notes" className="bi-subsection">
            <h4 className="bi-subsection-title">Structural Notes</h4>
            <ul className="bi-notes-list">
              {content.notes.map((note, idx) => (
                <li key={idx} className="bi-note-item">
                  {note.note || note}
                </li>
              ))}
            </ul>
          </div>
        );
      }
      
      if (content.caution) {
        parts.push(
          <div key="caution" className="bi-subsection bi-caution">
            <p className="bi-caution-text">{content.caution}</p>
          </div>
        );
      }
    }
    
    // The One Move - highlight the move, then reasoning
    if (domain === 'theOneMove') {
      if (content.the_move) {
        parts.push(
          <div key="move" className="bi-subsection">
            <p className="bi-move-highlight">⭐ {content.the_move}</p>
          </div>
        );
      }
      
      if (content.reasoning) {
        parts.push(
          <div key="reasoning" className="bi-subsection">
            <h4 className="bi-subsection-title">Why</h4>
            <p className="bi-subsection-text">{content.reasoning}</p>
          </div>
        );
      }
      
      if (content.timeline) {
        parts.push(
          <div key="timeline" className="bi-subsection">
            <h4 className="bi-subsection-title">Timeline</h4>
            <p className="bi-subsection-text">{content.timeline}</p>
          </div>
        );
      }
      
      if (content.caution) {
        parts.push(
          <div key="caution" className="bi-subsection bi-caution">
            <p className="bi-caution-text">{content.caution}</p>
          </div>
        );
      }
    }
    
    return <>{parts}</>;
  }
  
  return null;
}
function FiveFuturesRenderer({ content }) {
  if (!content) return null;
  
  // Handle futures array from extractFiveFuturesStarter
  if (Array.isArray(content.futures) && content.futures.length > 0) {
    return (
      <div className="five-futures-section">
        <div className="five-futures-grid">
          {content.futures.map((future, idx) => (
            <div key={idx} className="future-card-container">
              <div className="future-card">
                <div className="future-header">
                  <span className="future-badge">{idx + 1}</span>
                  <h3 className="future-title">{future.title || 'Future'}</h3>
                </div>
                <div className="future-meta">
                  <span className="future-likelihood-label">Likelihood:</span>
                  <span className="future-likelihood">{future.likelihood}</span>
                </div>
                <div className="future-body">
                  {future.trajectory && (
                    <div className="future-trajectory">
                      <p className="future-trajectory-text">{future.trajectory}</p>
                    </div>
                  )}
                  {future.organization_experiences && (
                    <div className="future-org-impact">
                      <p className="future-org-text">{future.organization_experiences}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Fallback: Try individual field names (for compatibility)
  const futures = [];
  if (content.future_1_unchanged) futures.push({ title: 'Unchanged', content: content.future_1_unchanged });
  if (content.future_2_constrained) futures.push({ title: 'Constrained', content: content.future_2_constrained });
  if (content.future_3_breakpoint) futures.push({ title: 'Breakpoint', content: content.future_3_breakpoint });
  if (content.future_4_adapted) futures.push({ title: 'Adapted', content: content.future_4_adapted });
  if (content.future_5_transformed) futures.push({ title: 'Transformed', content: content.future_5_transformed });
  
  // If still no futures, try summary as fallback
  if (futures.length === 0 && (content.summary || content.body)) {
    return (
      <InsightPanel
        icon="🌌"
        title="Five Futures"
        subtitle="Trajectory Simulations Based on Current Pattern"
        content={content.summary || content.body}
        prominence="premium"
        className="five-futures-panel"
      />
    );
  }
  
  // Render individual field names as cards
  if (futures.length > 0) {
    return (
      <div className="five-futures-section">
        <div className="five-futures-grid">
          {futures.map((future, idx) => (
            <div key={idx} className="future-card-container">
              <div className="future-card">
                <div className="future-header">
                  <span className="future-badge">{idx + 1}</span>
                  <h3 className="future-title">{future.title}</h3>
                </div>
                <div className="future-body">
                  <div className="future-content">
                    {typeof future.content === 'string' ? (
                      <p>{future.content}</p>
                    ) : (
                      formatBIContent(future.content)
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return null;
}

// ============================================================================
// PRESENTATIONAL COMPONENTS (pure composition, no logic)
// ============================================================================

function MetricCard({ icon, title, metric, dimension, color }) {
  const colorMap = {
    clarity: 'metric-clarity',
    balance: 'metric-balance',
    leverage: 'metric-leverage',
  };
  
  return (
    <div className={`metric-card ${colorMap[color] || ''}`}>
      <div className="metric-icon">{icon}</div>
      <h3 className="metric-title">{title}</h3>
      <div className="metric-value">{metric > 0 ? '+' : ''}{metric}</div>
      <p className="metric-dimension">{dimension}</p>
    </div>
  );
}

function InsightPanel({ icon, title, subtitle, content, warning, prominence, className }) {
  return (
    <div className={`insight-panel prominence-${prominence} ${className || ''}`}>
      <div className="insight-header">
        <span className="insight-icon">{icon}</span>
        <div className="insight-title-group">
          <h3 className="insight-title">{title}</h3>
          {subtitle && <p className="insight-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="insight-body">
        {content}
      </div>
      {warning && <div className="insight-warning">⚠️ {warning}</div>}
    </div>
  );
}

function PressureFlow({ narrative }) {
  const modes = [
    {
      name: 'Optimal Mode',
      subtitle: 'When conditions align',
      description: 'Operating at peak efficiency',
    },
    {
      name: 'Strained Mode',
      subtitle: 'Under moderate pressure',
      description: 'Performance degradation begins',
    },
    {
      name: 'Overload Mode',
      subtitle: 'Critical stress levels',
      description: 'Coping mechanisms activated',
    },
    {
      name: 'Breakdown Mode',
      subtitle: 'System failure imminent',
      description: 'Recovery intervention needed',
    },
  ];
  
  return (
    <div className="pressure-dynamics-zone">
      <div className="pressure-header">
        <span className="pressure-icon">⚡</span>
        <div>
          <h3 className="pressure-title">Pressure Dynamics</h3>
          <p className="pressure-subtitle">System Response Under Strain</p>
        </div>
      </div>
      <div className="pressure-flow-grid">
        {modes.map((mode, idx) => (
          <div key={idx} className="pressure-mode-card">
            <div className="mode-badge">{idx + 1}</div>
            <h4 className="mode-name">{mode.name}</h4>
            <p className="mode-subtitle">{mode.subtitle}</p>
            <p className="mode-description">{mode.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategicMap({ narrative }) {
  return (
    <div className="strategic-ceiling-zone">
      <div className="strategic-header">
        <span className="strategic-icon">🎯</span>
        <div>
          <h3 className="strategic-title">Strategic Ceiling</h3>
          <p className="strategic-subtitle">Scaling Architecture & Limits</p>
        </div>
      </div>
      <div className="strategic-map-content">
        {narrative.strategicCeiling?.body || narrative.strategicCeiling}
      </div>
    </div>
  );
}

function ActionSystem({ facilitatorContent, nextStepContent, organizationalConsequences }) {
  return (
    <div className="action-system-zone">
      {organizationalConsequences && (
        <InsightPanel
          icon="🏢"
          title="Organizational Consequences"
          subtitle="What Your Organization Experiences"
          content={typeof organizationalConsequences === 'object' ? organizationalConsequences.summary || 'Organizational consequences identified' : organizationalConsequences}
          prominence="diagnostic"
          className="organizational-consequences-panel"
        />
      )}
      
      <div className="action-pair">
        <div className="action-coaching">
          <div className="action-header">
            <span className="action-icon">⚙️</span>
            <div>
              <h3 className="action-title">Facilitator Notes</h3>
              <p className="action-subtitle">Environment Design</p>
            </div>
          </div>
          <div className="action-body">
            {facilitatorContent}
          </div>
        </div>
        
        <div className="action-nextstep">
          <div className="action-header">
            <span className="action-icon nextstep-icon">⚡</span>
            <div>
              <h3 className="action-title">The One Move</h3>
              <p className="action-subtitle">Highest-Leverage Intervention</p>
            </div>
          </div>
          <div className="action-body">
            {nextStepContent}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT (with fallback to stacked render)
// ============================================================================

export default function WebProfileReport({ canonical, profileId, behavioralIntelligence: behavioralIntelligenceProp }) {
  if (!canonical) {
    return <div className="web-report-error">Unable to load profile data</div>;
  }

  const data = canonical.canonical_profile_json || canonical;
  const personName = canonical.person_name || 'Assessment Subject';
  const company = canonical.company_name || '';
  const profileType = data.inferred_patterns?.profile_type || 'Behavioral Profile';
  const ranked = data.ranked_dimensions || [];
  
  // Generate profile code (short hash from profileId)
  const profileCode = profileId ? profileId.split('-').pop().substring(0, 6).toUpperCase() : 'XXXX';
  // Derive profile number (01-99) from profileId
  const profileNumber = String(((profileId?.charCodeAt(0) || 0) % 50) + 1).padStart(2, '0');

  // V3 narrative rendering
  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(true);
  const [narrativeError, setNarrativeError] = useState(null);
  const [dashboardFailed, setDashboardFailed] = useState(false);
  
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
  
  // TRY DASHBOARD V1, FALLBACK TO STACKED IF ERROR
  if (!dashboardFailed) {
    try {
      // Use behavioral intelligence from prop (from backend) OR extract from canonical (fallback)
      const behavioralIntelligence = behavioralIntelligenceProp || canonical?.behavioral_intelligence_v1 || null;
      
      return (
        <div>
          <DashboardReportV1
            canonical={canonical}
            profileId={profileId}
            narrative={narrative}
            profileNumber={profileNumber}
            profileCode={profileCode}
            personName={personName}
            company={company}
            profileType={profileType}
            ranked={ranked}
            behavioralIntelligence={behavioralIntelligence}
          />
          <DashboardStyles />
        </div>
      );
    } catch (err) {
      console.error('[DashboardReportV1] Render failed, falling back to stacked report:', err);
      setDashboardFailed(true);
    }
  }

  // FALLBACK: Old stacked report render (preserved from V2)
  return <StackedReportFallback canonical={canonical} narrative={narrative} profileNumber={profileNumber} profileCode={profileCode} personName={personName} company={company} profileType={profileType} ranked={ranked} profileId={profileId} />;
}

// ============================================================================
// FALLBACK RENDER (preserved from V2, fallback only)
// ============================================================================

function StackedReportFallback({ canonical, narrative, profileNumber, profileCode, personName, company, profileType, ranked, profileId }) {
  return (
    <div className="web-profile-report-v2 two-page-dashboard">
      {/* HEADER: Premium identity card */}
      <header className="dashboard-header">
        <div className="header-frame">
          <div className="header-number-card">
            <div className="profile-number">{profileNumber}</div>
            <div className="profile-label">CORE DIAGNOSTIC</div>
          </div>
          
          <div className="header-title-section">
            <h1 className="person-name">{personName}</h1>
            <p className="header-tagline">Your Behavioral Operating System</p>
            <p className="header-subtitle">The architecture of how you think, decide, and create impact.</p>
          </div>
          
          <div className="header-profile-meta">
            <div className="profile-id-premium">
              <div className="meta-label">PROFILE ID</div>
              <div className="meta-value">{profileId}</div>
              <div className="profile-code-badge">{profileCode}</div>
            </div>
            {company && <div className="profile-company">{company}</div>}
            <div className="profile-type-badge">{profileType}</div>
          </div>
        </div>

        {/* Profile DNA signature - enhanced */}
        <div className="profile-dna-strip-v2">
          <div className="dna-label">PROFILE DNA</div>
          <div className="dna-signature-enhanced">
            {ranked.slice(0, 6).map((d) => (
              <div key={d.dimension} className="dna-item-v2">
                <span className="dna-dimension">{d.dimension.toUpperCase().substring(0, 2)}</span>
                <span className="dna-score">{d.score > 0 ? '+' : ''}{d.score}</span>
              </div>
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
            <section className="narrative-section featured operating-model-section">
              <div className="section-header-enhanced">
                <span className="section-icon">🧬</span>
                <h2 className="section-title">Profile DNA</h2>
              </div>
              <div className="section-descriptor">Operating Model</div>
              <div className="narrative-text">{narrative.profileDNA?.body || narrative.profileDNA}</div>
            </section>

            {/* Section 2: Executive Summary (V3) */}
            {narrative.executiveSummary && (
              <section className="narrative-section featured briefing-section">
                <div className="section-header-enhanced">
                  <span className="section-icon">💼</span>
                  <h2 className="section-title">Executive Summary</h2>
                </div>
                <div className="section-descriptor">Behavioral Briefing</div>
                <div className="narrative-text">{narrative.executiveSummary.body || narrative.executiveSummary}</div>
                {narrative.executiveSummary.key_warning && (
                  <div className="key-warning">⚠️ {narrative.executiveSummary.key_warning}</div>
                )}
              </section>
            )}

            {/* Section 3: Vector Scores Grid */}
            <section className="data-section analytics-section">
              <div className="section-header-enhanced">
                <span className="section-icon">📊</span>
                <h2 className="section-title">Behavioral Dimensions</h2>
              </div>
              <div className="section-descriptor">Analytical Profile</div>
              <div className="dimensions-grid-v2">
                {ranked.map((dim) => (
                  <div key={dim.dimension} className="dimension-card-v2">
                    <div className="dim-header">
                      <div className="dim-rank-badge">#{dim.rank}</div>
                      <div className="dim-name">{dim.dimension.toUpperCase()}</div>
                    </div>
                    <div className="dim-score-large">{dim.score > 0 ? '+' : ''}{dim.score}</div>
                    <div className="dim-label-secondary">{dim.score > 0 ? 'Amplifier' : 'Constraint'}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4: Communication Style or Operating Pattern */}
            {narrative.communicationStyle && (
              <section className="narrative-section relational-section">
                <div className="section-header-enhanced">
                  <span className="section-icon">💬</span>
                  <h2 className="section-title">Communication Style</h2>
                </div>
                <div className="section-descriptor">Relational Dynamics</div>
                <div className="narrative-text">{narrative.communicationStyle.body || narrative.communicationStyle}</div>
                {narrative.communicationStyle.key_warning && (
                  <div className="key-warning">⚠️ {narrative.communicationStyle.key_warning}</div>
                )}
              </section>
            )}
            
            {narrative.operatingPattern && !narrative.communicationStyle && (
              <section className="narrative-section relational-section">
                <div className="section-header-enhanced">
                  <span className="section-icon">⚙️</span>
                  <h2 className="section-title">Operating Pattern</h2>
                </div>
                <div className="section-descriptor">System Dynamics</div>
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
              <section className="narrative-section diagnostic-section">
                <div className="section-header-enhanced">
                  <span className="section-icon warning-icon">⚠️</span>
                  <h2 className="section-title">Hidden Contradictions</h2>
                </div>
                <div className="section-descriptor">Warning / Diagnostic</div>
                <div className="narrative-text">{narrative.hiddenContradictions.body || narrative.hiddenContradictions}</div>
                {narrative.hiddenContradictions.key_warning && (
                  <div className="key-warning">⚠️ {narrative.hiddenContradictions.key_warning}</div>
                )}
              </section>
            )}

            {/* Section 6: System Under Strain (V3) */}
            {narrative.systemUnderStrain && (
              <section className="narrative-section pressure-section">
                <div className="section-header-enhanced">
                  <span className="section-icon">⚡</span>
                  <h2 className="section-title">Operating Under Pressure</h2>
                </div>
                <div className="section-descriptor">Stress Dynamics</div>
                <div className="narrative-text">{narrative.systemUnderStrain.body || narrative.systemUnderStrain}</div>
                {narrative.systemUnderStrain.key_warning && (
                  <div className="key-warning">⚠️ {narrative.systemUnderStrain.key_warning}</div>
                )}
              </section>
            )}

            {/* Section 7: Strategic Ceiling (V3) */}
            {narrative.strategicCeiling && (
              <section className="narrative-section scaling-section">
                <div className="section-header-enhanced">
                  <span className="section-icon">🎯</span>
                  <h2 className="section-title">Strategic Ceiling</h2>
                </div>
                <div className="section-descriptor">Scaling Map</div>
                <div className="narrative-text">{narrative.strategicCeiling.body || narrative.strategicCeiling}</div>
                {narrative.strategicCeiling.key_warning && (
                  <div className="key-warning">⚠️ {narrative.strategicCeiling.key_warning}</div>
                )}
              </section>
            )}

            {/* Section 8: Coaching Leverage */}
            {narrative.coachingLeverage && (
              <section className="narrative-section coaching-action-section">
                <div className="section-header-enhanced">
                  <span className="section-icon action-icon">✓</span>
                  <h2 className="section-title">Coaching Leverage</h2>
                </div>
                <div className="section-descriptor">Tactical Actions</div>
                <div className="narrative-text">{narrative.coachingLeverage?.body || narrative.coachingLeverage}</div>
              </section>
            )}

            {/* Section 9: Recommended Next Step */}
            {narrative.recommendedNextStep && (
              <section className="narrative-section premium-action-section">
                <div className="section-header-enhanced">
                  <span className="section-icon strategic-icon">→</span>
                  <h2 className="section-title">Recommended Next Step</h2>
                </div>
                <div className="section-descriptor">Decisive Recommendation</div>
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
          border-bottom: 2px solid rgba(212, 175, 55, 0.55);
          border-radius: 0 0 18px 18px;
          padding: 3rem 3.5rem;
          max-width: none;
          position: relative;
          z-index: 1;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(212, 175, 55, 0.3), 0 0 40px rgba(212, 175, 55, 0.08) rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(212, 175, 55, 0.2), inset 0 -1px 2px rgba(212, 175, 55, 0.08);
          backdrop-filter: blur(8px);
        }
        
        .header-frame {
          display: flex;
          gap: 2.5rem;
          margin-bottom: 2.5rem;
          align-items: flex-start;
        }
        
        .header-number-card {
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0.08) 100%);
          border: 2px solid rgba(212, 175, 55, 0.45);
          border-radius: 14px;
          padding: 1.8rem 1.4rem;
          min-width: 120px;
          text-align: center;
          box-shadow: 0 12px 32px rgba(212, 175, 55, 0.12), inset 0 1px 2px rgba(212, 175, 55, 0.2);
          position: relative;
          overflow: hidden;
        }
        
        .header-number-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(212, 175, 55, 0) 0%, rgba(212, 175, 55, 0.4) 50%, rgba(212, 175, 55, 0) 100%);
        }
        
        .profile-number {
          font-size: 3.6rem;
          font-weight: 950;
          color: #d4af37;
          line-height: 0.95;
          letter-spacing: -0.08em;
          text-shadow: 0 6px 20px rgba(212, 175, 55, 0.25);
        }
        
        .profile-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #aaa;
          margin-top: 0.7rem;
          font-weight: 900;
        }
        
        .header-title-section {
          flex: 1;
        }
        
        .header-title-section h1 {
          font-size: 3.4rem;
          font-weight: 950;
          color: #ffffff;
          margin: 0 0 0.2rem 0;
          letter-spacing: -0.6px;
          line-height: 1.05;
        }
        
        .header-tagline {
          font-size: 1.4rem;
          font-weight: 700;
          color: #d4af37;
          margin: 0.75rem 0 0.5rem 0;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          opacity: 0.95;
        }
        
        .header-subtitle {
          font-size: 1.05rem;
          color: #c0c0c0;
          margin: 0.75rem 0 0 0;
          line-height: 1.7;
          max-width: 90%;
        }
        
        .header-profile-meta {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: flex-end;
        }
        
        .profile-id-premium {
          background: rgba(212, 175, 55, 0.08);
          border: 1px solid rgba(212, 175, 55, 0.25);
          padding: 0.85rem 1.15rem;
          border-radius: 6px;
          text-align: right;
          position: relative;
        }
        
        .profile-id-premium .meta-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #777;
          margin-bottom: 0.25rem;
          font-weight: 800;
        }
        
        .profile-id-premium .meta-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: #d4af37;
          font-family: 'Monaco', monospace;
          letter-spacing: 0.05em;
          margin-bottom: 0.35rem;
        }
        
        .profile-code-badge {
          display: inline-block;
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.1) 100%);
          border: 1px solid rgba(212, 175, 55, 0.3);
          color: #d4af37;
          padding: 0.35rem 0.65rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 800;
          font-family: 'Monaco', monospace;
          letter-spacing: 0.08em;
        }
        
        .profile-company {
          font-size: 0.85rem;
          color: #888;
          text-align: right;
        }
        
        .profile-type-badge {
          display: inline-block;
          background: rgba(212, 175, 55, 0.12);
          border: 1px solid rgba(212, 175, 55, 0.35);
          color: #d4af37;
          padding: 0.45rem 0.9rem;
          border-radius: 5px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .profile-dna-strip-v2 {
          display: flex;
          align-items: center;
          gap: 1.75rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(212, 175, 55, 0.25);
        }

        .dna-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #777;
          min-width: 110px;
          font-weight: 800;
        }

        .dna-signature-enhanced {
          display: flex;
          gap: 0.85rem;
          flex-wrap: wrap;
        }

        .dna-item-v2 {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.08) 100%);
          border: 1.5px solid rgba(212, 175, 55, 0.35);
          color: #d4af37;
          padding: 0.5rem 0.8rem;
          border-radius: 5px;
          font-weight: 700;
          font-family: 'Monaco', monospace;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 8px rgba(212, 175, 55, 0.08), inset 0 1px 2px rgba(212, 175, 55, 0.12);
        }
        
        .dna-item-v2 .dna-dimension {
          font-size: 0.75rem;
          font-weight: 800;
          opacity: 0.85;
        }
        
        .dna-item-v2 .dna-score {
          font-size: 0.95rem;
          font-weight: 900;
          letter-spacing: -0.02em;
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
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto auto auto auto;
          gap: 2rem;
          padding: 3rem;
          max-width: 1800px;
          grid-template-areas:
            "hero hero"
            "triad triad"
            "dna summary"
            "pressure pressure"
            "diagnostics diagnostics"
            "strategic strategic"
            "actions actions"
            "insight insight";
        }

        .page-footer {
          text-align: right;
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(212, 175, 55, 0.2);
          font-size: 0.85rem;
          color: #777;
          letter-spacing: 0.08em;
          font-weight: 700;
          text-transform: uppercase;
        }

        /* SECTIONS - Dashboard Modules */
        .narrative-section,
        .data-section {
          margin-bottom: 0;
          padding: 2rem;
          background: linear-gradient(135deg, rgba(15, 20, 40, 0.95) 0%, rgba(10, 14, 35, 0.8) 100%);
          border: 1.5px solid rgba(212, 175, 55, 0.3);
          border-radius: 12px;
          backdrop-filter: blur(14px);
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        /* Radial lighting effect */
        .narrative-section::after,
        .data-section::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.02) 0%, transparent 70%);
          pointer-events: none;
        }
        
        .narrative-section::before,
        .data-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(212, 175, 55, 0) 0%, rgba(212, 175, 55, 0.35) 50%, rgba(212, 175, 55, 0) 100%);
        }
        
        /* Section-specific styling */
        .narrative-section.featured.operating-model-section {
          grid-area: hero;
          background: linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(103, 58, 183, 0.08) 100%);
          border: 1.5px solid rgba(138, 43, 226, 0.4);
          padding: 3rem;
          box-shadow: 0 24px 96px rgba(0, 0, 0, 0.7), inset 0 2px 8px rgba(138, 43, 226, 0.15);
          border-radius: 16px;
          position: relative;
        }
        
        .operating-model-section::before {
          background: linear-gradient(90deg, rgba(138, 43, 226, 0) 0%, rgba(138, 43, 226, 0.3) 50%, rgba(138, 43, 226, 0) 100%);
        }
        
        .briefing-section {
          border-color: rgba(76, 175, 80, 0.35);
        }
        
        .briefing-section::before {
          background: linear-gradient(90deg, rgba(76, 175, 80, 0) 0%, rgba(76, 175, 80, 0.3) 50%, rgba(76, 175, 80, 0) 100%);
        }
        
        .analytics-section {
          margin-bottom: 0;
          padding: 2.5rem;
          background: linear-gradient(135deg, rgba(33, 150, 243, 0.08) 0%, rgba(33, 150, 243, 0.03) 100%);
          border: 1.5px solid rgba(33, 150, 243, 0.35);
          border-radius: 12px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(33, 150, 243, 0.1);
          backdrop-filter: blur(14px);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .analytics-section::before {
          background: linear-gradient(90deg, rgba(33, 150, 243, 0) 0%, rgba(33, 150, 243, 0.3) 50%, rgba(33, 150, 243, 0) 100%);
        }
        
        .relational-section {
          border-color: rgba(255, 152, 0, 0.35);
        }
        
        .relational-section::before {
          background: linear-gradient(90deg, rgba(255, 152, 0, 0) 0%, rgba(255, 152, 0, 0.3) 50%, rgba(255, 152, 0, 0) 100%);
        }
        
        .diagnostic-section {
          border-color: rgba(244, 67, 54, 0.35);
        }
        
        .diagnostic-section::before {
          background: linear-gradient(90deg, rgba(244, 67, 54, 0) 0%, rgba(244, 67, 54, 0.3) 50%, rgba(244, 67, 54, 0) 100%);
        }
        
        .pressure-section {
          border-color: rgba(233, 30, 99, 0.35);
        }
        
        .pressure-section::before {
          background: linear-gradient(90deg, rgba(233, 30, 99, 0) 0%, rgba(233, 30, 99, 0.3) 50%, rgba(233, 30, 99, 0) 100%);
        }
        
        .scaling-section {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, rgba(103, 58, 183, 0.08) 0%, rgba(103, 58, 183, 0.03) 100%);
          border: 1.5px solid rgba(103, 58, 183, 0.35);
          padding: 2.5rem;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(103, 58, 183, 0.1);
          border-radius: 12px;
        }
        
        .scaling-section::before {
          background: linear-gradient(90deg, rgba(103, 58, 183, 0) 0%, rgba(103, 58, 183, 0.3) 50%, rgba(103, 58, 183, 0) 100%);
        }
        
        .coaching-action-section {
          border-color: rgba(76, 175, 80, 0.4);
        }
        
        .coaching-action-section::before {
          background: linear-gradient(90deg, rgba(76, 175, 80, 0) 0%, rgba(76, 175, 80, 0.35) 50%, rgba(76, 175, 80, 0) 100%);
        }
        
        .premium-action-section {
          border: 2.5px solid rgba(255, 193, 7, 0.5);
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0.04) 100%);
          box-shadow: 0 20px 80px rgba(255, 193, 7, 0.15), inset 0 2px 8px rgba(255, 255, 255, 0.06);
          padding: 2.25rem;
        }
        
        .premium-action-section::before {
          background: linear-gradient(90deg, rgba(255, 193, 7, 0) 0%, rgba(255, 193, 7, 0.4) 50%, rgba(255, 193, 7, 0) 100%);
        }
        
        .narrative-section:hover,
        .data-section:hover {
          transform: translateY(-3px);
        }
        
        .premium-action-section:hover {
          border-color: rgba(255, 193, 7, 0.6);
          box-shadow: 0 20px 80px rgba(255, 193, 7, 0.18), inset 0 1px 0 rgba(255, 193, 7, 0.25);
          transform: translateY(-4px);
        }

        .narrative-section.featured {
          background: linear-gradient(135deg, rgba(138, 43, 226, 0.12) 0%, rgba(138, 43, 226, 0.05) 100%);
          border: 1.5px solid rgba(138, 43, 226, 0.4);
          padding: 2.5rem;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.6), inset 0 2px 8px rgba(138, 43, 226, 0.15);
          border-radius: 14px;
          position: relative;
        }
        
        /* Section header with icon */
        .section-header-enhanced {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }
        
        .section-icon {
          font-size: 1.4rem;
          opacity: 0.9;
        }
        
        .section-icon.warning-icon {
          font-size: 1.3rem;
        }
        
        .section-icon.action-icon {
          font-size: 1.25rem;
          color: #4caf50;
        }
        
        .section-icon.strategic-icon {
          font-size: 1.3rem;
          color: #ffc107;
        }
        
        .section-descriptor {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #999;
          margin-bottom: 1rem;
          font-weight: 800;
          display: block;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 900;
          color: #ffffff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          word-spacing: 0.05em;
        }

        .narrative-text {
          font-size: 1.05rem;
          line-height: 1.8;
          color: #d4d4d4;
          margin: 1rem 0 0 0;
          letter-spacing: 0.3px;
        }
        
        .featured .narrative-text {
          font-size: 1.05rem;
          line-height: 1.8;
          color: #d4d4d4;
          margin: 1rem 0 0 0;
          letter-spacing: 0.3px;
        }
        
        .action-section .narrative-text {
          font-size: 1.05rem;
          line-height: 1.8;
          color: #d4d4d4;
          margin: 1rem 0 0 0;
          letter-spacing: 0.3px;
        }

        .narrative-text.pre-format {
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .narrative-text strong {
          color: #e8e8e8;
          font-weight: 600;
        }

        /* DIMENSIONS GRID - Analytical Dashboard V2 */
        .dimensions-grid-v2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.2rem;
          margin-top: 1.5rem;
        }

        .dimension-card-v2 {
          background: linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.04) 100%);
          border: 1.5px solid rgba(33, 150, 243, 0.35);
          border-radius: 9px;
          padding: 1.15rem 0.95rem;
          text-align: center;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .dimension-card-v2::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(33, 150, 243, 0) 0%, rgba(33, 150, 243, 0.4) 50%, rgba(33, 150, 243, 0) 100%);
        }
        
        .dimension-card-v2::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          background: radial-gradient(ellipse at center, rgba(33, 150, 243, 0.04) 0%, transparent 70%);
          pointer-events: none;
        }

        .dimension-card-v2:hover {
          border-color: rgba(33, 150, 243, 0.5);
          background: linear-gradient(135deg, rgba(33, 150, 243, 0.15) 0%, rgba(33, 150, 243, 0.07) 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(33, 150, 243, 0.2), inset 0 1px 0 rgba(33, 150, 243, 0.2);
        }
        
        .dim-header {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          z-index: 1;
        }
        
        .dim-rank-badge {
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.25) 0%, rgba(255, 193, 7, 0.12) 100%);
          border: 1.5px solid rgba(255, 193, 7, 0.4);
          color: #ffc107;
          font-size: 0.7rem;
          font-weight: 950;
          padding: 0.4rem 0.6rem;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          box-shadow: 0 2px 6px rgba(255, 193, 7, 0.12);
        }

        .dim-name {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.13em;
          color: #999;
          font-weight: 900;
          position: relative;
          z-index: 1;
          margin-bottom: 0.25rem;
        }

        .dim-score-large {
          font-size: 2.4rem;
          font-weight: 950;
          color: #ffc107;
          margin: 0.3rem 0;
          letter-spacing: -0.06em;
          position: relative;
          z-index: 1;
          text-shadow: 0 4px 12px rgba(255, 193, 7, 0.25);
        }
        
        .dim-score-large::after {
          content: '';
          display: block;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 193, 7, 0.2) 50%, transparent 100%);
          margin-top: 0.35rem;
        }

        .dim-label-secondary {
          font-size: 0.75rem;
          color: #888;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          position: relative;
          z-index: 1;
          margin-top: 0.35rem;
        }

        /* FOOTER */
        .dashboard-footer {
          border-top: 1px solid rgba(212, 175, 55, 0.2);
          padding: 1.75rem 2rem;
          text-align: center;
          background: rgba(10, 14, 39, 0.95);
        }

        .dashboard-footer.global-footer {
          margin-top: 2rem;
        }

        .footer-meta {
          display: flex;
          justify-content: center;
          gap: 2.5rem;
          flex-wrap: wrap;
          font-size: 0.8rem;
          color: #777;
          letter-spacing: 0.05em;
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

        /* Paired Diagnostic Layout */
        .diagnostic-section,
        .pressure-section {
          grid-column: auto;
        }
        
        /* Create 2-column grid for diagnostic pair */
        .page-2 .dashboard-page {
          --diagnostic-pair-columns: 1fr 1fr;
        }


        .coaching-action-section,
        .premium-action-section {
          padding: 2.5rem;
          border-radius: 14px;
        }
        
        /* Action pair grouping */
        .page-2 .coaching-action-section {
          grid-column: 1;
        }
        
        .page-2 .premium-action-section {
          grid-column: 2;
        }
        

        /* Atmospheric separation zones */
        .dashboard-page {
          background: linear-gradient(180deg, 
            rgba(10, 14, 27, 0.5) 0%, 
            rgba(8, 12, 25, 0.3) 50%, 
            rgba(10, 14, 27, 0.5) 100%);
          position: relative;
        }
        
        /* Edge illumination effect */
        .page-body::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.2), transparent);
          pointer-events: none;
        }
.diagnostic-section {
          grid-area: diagnostics;
          grid-column: 1;
          padding: 2.5rem;
          background: linear-gradient(135deg, rgba(244, 67, 54, 0.08) 0%, rgba(244, 67, 54, 0.03) 100%);
          border: 1.5px solid rgba(244, 67, 54, 0.3);
          border-radius: 14px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
        }
        
        .page-2 .dashboard-page {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          grid-template-areas:
            "diagnostics diagnostics"
            "contradictions pressure"
            "strategic strategic"
            "coaching actions"
            "insight insight";
        }
        
        .page-2 .diagnostic-section {
          grid-area: contradictions;
        }
        
        .page-2 .pressure-section {
          grid-area: pressure;
        }
        
        .page-2 .scaling-section {
          grid-area: strategic;
          grid-column: 1 / -1;
          padding: 3rem;
          background: linear-gradient(135deg, rgba(103, 58, 183, 0.1) 0%, rgba(103, 58, 183, 0.04) 100%);
          border: 1.5px solid rgba(103, 58, 183, 0.35);
          border-radius: 14px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1.5rem;
        }
        
        .strategic-item {
          text-align: center;
          padding: 1.5rem;
          background: rgba(103, 58, 183, 0.08);
          border: 1px solid rgba(103, 58, 183, 0.2);
          border-radius: 10px;
        }
        
        .page-2 .coaching-action-section {
          grid-area: coaching;
          padding: 2.5rem;
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.04) 100%);
          border: 1.5px solid rgba(76, 175, 80, 0.35);
          border-radius: 14px;
        }
        
        .page-2 .premium-action-section {
          grid-area: actions;
          padding: 2.5rem;
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, rgba(255, 193, 7, 0.05) 100%);
          border: 2px solid rgba(255, 193, 7, 0.5);
          border-radius: 14px;
          box-shadow: 0 20px 80px rgba(255, 193, 7, 0.15);
        }

.pressure-section {
          grid-area: pressure;
          padding: 3rem;
          background: linear-gradient(135deg, rgba(233, 30, 99, 0.08) 0%, rgba(233, 30, 99, 0.03) 100%);
          border: 1.5px solid rgba(233, 30, 99, 0.3);
          border-radius: 14px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2rem;
          align-items: start;
        }
        
        .pressure-mode {
          text-align: center;
        }
        
        .pressure-mode-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 0.75rem;
        }
        
        .pressure-mode-subtitle {
          font-size: 0.9rem;
          color: #aaa;
          margin-bottom: 1.5rem;
        }
        
        .pressure-mode-items {
          font-size: 0.85rem;
          color: #bbb;
          text-align: left;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .pressure-mode-items li {
          margin-bottom: 0.5rem;
        }
        
        .pressure-mode-items li::before {
          content: "• ";
          color: #66d;
          margin-right: 0.5rem;
        }

.analytics-section {
          grid-area: dna;
          margin-bottom: 0;
          padding: 2.5rem;
          background: linear-gradient(135deg, rgba(33, 150, 243, 0.08) 0%, rgba(33, 150, 243, 0.03) 100%);
          border: 1.5px solid rgba(33, 150, 243, 0.35);
          border-radius: 14px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(33, 150, 243, 0.1);
          backdrop-filter: blur(14px);
        }
        
        .narrative-section.briefing-section {
          grid-area: summary;
          padding: 2.5rem;
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, rgba(76, 175, 80, 0.03) 100%);
          border: 1.5px solid rgba(76, 175, 80, 0.35);
          border-radius: 14px;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(76, 175, 80, 0.1);
        }

.narrative-section.featured.briefing-section {
          grid-area: triad;
          padding: 3rem 0;
          background: transparent;
          border: none;
          box-shadow: none;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 2.5rem;
        }
        
        .triad-card {
          background: linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.04) 100%);
          border: 1.5px solid rgba(33, 150, 243, 0.35);
          padding: 2.5rem;
          border-radius: 14px;
          text-align: center;
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(33, 150, 243, 0.1);
          position: relative;
          overflow: hidden;
        }
        
        .triad-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          opacity: 0.9;
        }
        
        .triad-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 1rem;
        }
        
        .triad-description {
          font-size: 0.95rem;
          color: #bbb;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        
        .triad-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
        }
        
        .triad-tag {
          font-size: 0.75rem;
          color: #88d;
          padding: 0.4rem 0.8rem;
          background: rgba(33, 150, 243, 0.15);
          border: 1px solid rgba(33, 150, 243, 0.3);
          border-radius: 4px;
        }

        @media (max-width: 1024px) {
          .page-2 .coaching-action-section,
          .page-2 .premium-action-section {
            grid-column: 1;
          }
        }

        @media (max-width: 1024px) {
          .page-body {
            padding: 2rem 2rem;
            gap: 2rem;
          }
          
          .dimensions-grid-v2 {
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
          margin-bottom: 0;
          padding: 2rem;
          background: linear-gradient(135deg, rgba(15, 20, 40, 0.95) 0%, rgba(10, 14, 35, 0.8) 100%);
          border: 1.5px solid rgba(212, 175, 55, 0.3);
          border-radius: 12px;
          backdrop-filter: blur(14px);
          box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        /* Radial lighting effect */
        .narrative-section::after,
        .data-section::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(212, 175, 55, 0.02) 0%, transparent 70%);
          pointer-events: none;
        }

          .dimensions-grid-v2 {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .dna-signature-enhanced {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .footer-meta {
          display: flex;
          justify-content: center;
          gap: 2.5rem;
          flex-wrap: wrap;
          font-size: 0.8rem;
          color: #777;
          letter-spacing: 0.05em;
        }
        }
      `}</style>
    </div>
  );
}

function DashboardStyles() {
  return (
    <style jsx global>{`
      .dashboard-report-v1.intelligence-system {
        background: linear-gradient(180deg, #0a0e27 0%, #0d1830 50%, #0a0e27 100%);
        color: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
        min-height: 100vh;
        padding: 0;
        position: relative;
      }

      .dashboard-hero {
        background: linear-gradient(135deg, #1a1f3a 0%, #0f1530 100%);
        border-bottom: 2px solid rgba(212, 175, 55, 0.55);
        padding: 4rem 3.5rem;
        position: relative;
        z-index: 10;
        box-shadow: 0 24px 96px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(212, 175, 55, 0.3);
        backdrop-filter: blur(8px);
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 3rem;
        margin-bottom: 3rem;
        align-items: start;
      }

      .hero-identity-zone {
        display: flex;
        gap: 2.5rem;
        align-items: flex-start;
      }

      .identity-anchor {
        background: linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0.08) 100%);
        border: 2px solid rgba(212, 175, 55, 0.45);
        border-radius: 14px;
        padding: 2rem 1.6rem;
        min-width: 140px;
        text-align: center;
        box-shadow: 0 12px 32px rgba(212, 175, 55, 0.12), inset 0 1px 2px rgba(212, 175, 55, 0.2);
        position: relative;
        overflow: hidden;
        flex-shrink: 0;
      }

      .identity-anchor::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, rgba(212, 175, 55, 0) 0%, rgba(212, 175, 55, 0.4) 50%, rgba(212, 175, 55, 0) 100%);
      }

      .identity-number {
        font-size: 4rem;
        font-weight: 950;
        color: #d4af37;
        line-height: 0.95;
        letter-spacing: -0.08em;
        text-shadow: 0 6px 20px rgba(212, 175, 55, 0.25);
      }

      .identity-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #aaa;
        margin-top: 0.8rem;
        font-weight: 900;
      }

      .identity-text {
        flex: 1;
      }

      .identity-name {
        font-size: 3.6rem;
        font-weight: 950;
        color: #ffffff;
        margin: 0 0 0.3rem 0;
        letter-spacing: -0.6px;
        line-height: 1.05;
      }

      .identity-tagline {
        font-size: 1.4rem;
        font-weight: 700;
        color: #d4af37;
        margin: 0.75rem 0 0.5rem 0;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.95;
      }

      .identity-company {
        font-size: 1rem;
        color: #c0c0c0;
        margin: 0.75rem 0 0 0;
      }

      .hero-meta-zone {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        justify-content: flex-start;
      }

      .meta-card {
        background: linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0.06) 100%);
        border: 1.5px solid rgba(212, 175, 55, 0.35);
        padding: 0.9rem 1.2rem;
        border-radius: 8px;
        text-align: right;
        box-shadow: 0 4px 12px rgba(212, 175, 55, 0.08);
      }

      .meta-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #777;
        margin-bottom: 0.3rem;
        font-weight: 800;
      }

      .meta-code {
        font-size: 1.1rem;
        font-weight: 800;
        color: #d4af37;
        font-family: 'Monaco', monospace;
        letter-spacing: 0.08em;
      }

      .meta-value {
        font-size: 0.95rem;
        font-weight: 700;
        color: #d4af37;
      }

      .meta-mono {
        font-family: 'Monaco', monospace;
        font-size: 0.8rem;
        letter-spacing: 0.05em;
      }

      .dna-signature-zone {
        display: flex;
        align-items: center;
        gap: 2rem;
        padding-top: 2rem;
        border-top: 1px solid rgba(212, 175, 55, 0.25);
      }

      .dna-zone-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #777;
        min-width: 120px;
        font-weight: 800;
        flex-shrink: 0;
      }

      .dna-hexagon-grid {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .dna-hex {
        width: 90px;
        height: 90px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(103, 58, 183, 0.08) 100%);
        border: 1.5px solid rgba(138, 43, 226, 0.4);
        border-radius: 8px;
        position: relative;
        overflow: hidden;
      }

      .dna-hex::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, rgba(138, 43, 226, 0) 0%, rgba(138, 43, 226, 0.3) 50%, rgba(138, 43, 226, 0) 100%);
      }

      .hex-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
        text-align: center;
      }

      .hex-abbr {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #999;
        font-weight: 900;
      }

      .hex-score {
        font-size: 1.4rem;
        font-weight: 950;
        color: #d4af37;
        letter-spacing: -0.05em;
      }

      /* PAGE STRUCTURE */
      .dashboard-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        page-break-after: always;
        background: linear-gradient(180deg, #0a0e27 0%, #0d1830 50%, #0a0e27 100%);
        position: relative;
      }

      .page-one {
        border-bottom: 2px solid rgba(212, 175, 55, 0.2);
      }

      .page-two {
        border-top: 2px solid rgba(212, 175, 55, 0.2);
      }

      .page-content {
        display: flex;
        flex-direction: column;
        gap: 3rem;
        padding: 4rem 3.5rem;
        flex: 1;
        max-width: 1800px;
        margin: 0 auto;
        width: 100%;
      }

      /* ZONES */
      .zone-hero-triad {
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
      }

      .hero-dna-module {
        background: linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(103, 58, 183, 0.08) 100%);
        border: 1.5px solid rgba(138, 43, 226, 0.4);
        padding: 3rem;
        border-radius: 16px;
        box-shadow: 0 24px 96px rgba(0, 0, 0, 0.7), inset 0 2px 8px rgba(138, 43, 226, 0.15);
        position: relative;
        overflow: hidden;
      }

      .triad-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 2rem;
      }

      .zone-analytical-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2.5rem;
      }

      .left-panel,
      .right-panel {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.08) 0%, rgba(76, 175, 80, 0.03) 100%);
        border: 1.5px solid rgba(76, 175, 80, 0.35);
        border-radius: 14px;
        padding: 2.5rem;
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(76, 175, 80, 0.1);
      }

      .zone-diagnostics-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2.5rem;
      }

      .left-diagnostic {
        background: linear-gradient(135deg, rgba(244, 67, 54, 0.08) 0%, rgba(244, 67, 54, 0.03) 100%);
        border: 1.5px solid rgba(244, 67, 54, 0.3);
        border-radius: 14px;
        padding: 2.5rem;
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
      }

      .right-diagnostic {
        background: linear-gradient(135deg, rgba(233, 30, 99, 0.08) 0%, rgba(233, 30, 99, 0.03) 100%);
        border: 1.5px solid rgba(233, 30, 99, 0.3);
        border-radius: 14px;
        padding: 2.5rem;
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
      }

      /* COMPONENTS */
      .metric-card {
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.04) 100%);
        border: 1.5px solid rgba(33, 150, 243, 0.35);
        border-radius: 12px;
        padding: 2rem;
        text-align: center;
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(33, 150, 243, 0.1);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      .metric-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, rgba(33, 150, 243, 0) 0%, rgba(33, 150, 243, 0.4) 50%, rgba(33, 150, 243, 0) 100%);
      }

      .metric-card:hover {
        border-color: rgba(33, 150, 243, 0.5);
        transform: translateY(-3px);
      }

      .metric-icon {
        font-size: 2.8rem;
        opacity: 0.9;
      }

      .metric-title {
        font-size: 1.1rem;
        font-weight: 800;
        color: #fff;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .metric-value {
        font-size: 3rem;
        font-weight: 950;
        color: #ffc107;
        letter-spacing: -0.05em;
        text-shadow: 0 4px 12px rgba(255, 193, 7, 0.25);
      }

      .metric-dimension {
        font-size: 0.8rem;
        color: #888;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 0;
      }

      .metric-clarity {
        border-color: rgba(33, 150, 243, 0.4);
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.12) 0%, rgba(33, 150, 243, 0.05) 100%);
      }

      .metric-balance {
        border-color: rgba(255, 152, 0, 0.4);
        background: linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(255, 152, 0, 0.05) 100%);
      }

      .metric-leverage {
        border-color: rgba(76, 175, 80, 0.4);
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.12) 0%, rgba(76, 175, 80, 0.05) 100%);
      }

      .insight-panel {
        background: linear-gradient(135deg, rgba(15, 20, 40, 0.95) 0%, rgba(10, 14, 35, 0.8) 100%);
        border: 1.5px solid rgba(212, 175, 55, 0.3);
        border-radius: 12px;
        padding: 2rem;
        backdrop-filter: blur(14px);
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5), inset 0 2px 8px rgba(255, 255, 255, 0.05);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }

      .insight-panel::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, rgba(212, 175, 55, 0) 0%, rgba(212, 175, 55, 0.35) 50%, rgba(212, 175, 55, 0) 100%);
      }

      .insight-panel:hover {
        transform: translateY(-3px);
      }

      .prominence-hero .insight-header {
        margin-bottom: 1.5rem;
      }

      .prominence-analytical .insight-header {
        margin-bottom: 1rem;
      }

      .prominence-diagnostic .insight-header {
        margin-bottom: 1rem;
      }

      .insight-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
      }

      .insight-icon {
        font-size: 1.6rem;
        flex-shrink: 0;
        margin-top: 0.1rem;
      }

      .insight-title-group {
        flex: 1;
      }

      .insight-title {
        font-size: 1.25rem;
        font-weight: 900;
        color: #ffffff;
        margin: 0 0 0.2rem 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .insight-subtitle {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #999;
        margin: 0;
        font-weight: 800;
      }

      .insight-body {
        font-size: 1.05rem;
        line-height: 1.8;
        color: #d4d4d4;
        letter-spacing: 0.3px;
      }

      .insight-warning {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(244, 67, 54, 0.3);
        font-size: 0.95rem;
        color: #f8a080;
      }

      .pressure-dynamics-zone {
        background: linear-gradient(135deg, rgba(233, 30, 99, 0.08) 0%, rgba(233, 30, 99, 0.03) 100%);
        border: 1.5px solid rgba(233, 30, 99, 0.3);
        border-radius: 14px;
        padding: 3rem;
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
      }

      .pressure-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .pressure-icon {
        font-size: 2rem;
        opacity: 0.9;
      }

      .pressure-title {
        font-size: 1.3rem;
        font-weight: 900;
        color: #fff;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .pressure-subtitle {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #999;
        margin: 0.3rem 0 0 0;
        font-weight: 800;
      }

      .pressure-flow-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 2rem;
      }

      .pressure-mode-card {
        background: rgba(233, 30, 99, 0.08);
        border: 1.5px solid rgba(233, 30, 99, 0.3);
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        position: relative;
      }

      .mode-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, rgba(233, 30, 99, 0.25) 0%, rgba(233, 30, 99, 0.12) 100%);
        border: 1.5px solid rgba(233, 30, 99, 0.4);
        border-radius: 50%;
        color: #ff6b9d;
        font-weight: 950;
        font-size: 1.2rem;
        margin-bottom: 1rem;
      }

      .mode-name {
        font-size: 1rem;
        font-weight: 800;
        color: #fff;
        margin: 0 0 0.5rem 0;
      }

      .mode-subtitle {
        font-size: 0.8rem;
        color: #aaa;
        margin: 0 0 1rem 0;
      }

      .mode-description {
        font-size: 0.9rem;
        color: #bbb;
        margin: 0;
      }

      .strategic-ceiling-zone {
        background: linear-gradient(135deg, rgba(103, 58, 183, 0.1) 0%, rgba(103, 58, 183, 0.04) 100%);
        border: 1.5px solid rgba(103, 58, 183, 0.35);
        border-radius: 14px;
        padding: 3rem;
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
      }

      .strategic-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .strategic-icon {
        font-size: 2rem;
        opacity: 0.9;
      }

      .strategic-title {
        font-size: 1.3rem;
        font-weight: 900;
        color: #fff;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .strategic-subtitle {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #999;
        margin: 0.3rem 0 0 0;
        font-weight: 800;
      }

      .strategic-map-content {
        font-size: 1.05rem;
        line-height: 1.8;
        color: #d4d4d4;
        letter-spacing: 0.3px;
      }

      .action-system-zone {
        margin-top: auto;
      }

      .action-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2.5rem;
      }

      .action-coaching,
      .action-nextstep {
        border-radius: 14px;
        padding: 2.5rem;
        position: relative;
        overflow: hidden;
      }

      .action-coaching {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.04) 100%);
        border: 1.5px solid rgba(76, 175, 80, 0.35);
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
      }

      .action-nextstep {
        background: linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, rgba(255, 193, 7, 0.05) 100%);
        border: 2px solid rgba(255, 193, 7, 0.5);
        box-shadow: 0 20px 80px rgba(255, 193, 7, 0.15);
      }

      .action-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .action-icon {
        font-size: 1.6rem;
        flex-shrink: 0;
        margin-top: 0.1rem;
        color: #4caf50;
      }

      .action-icon.nextstep-icon {
        color: #ffc107;
      }

      .action-title {
        font-size: 1.2rem;
        font-weight: 900;
        color: #ffffff;
        margin: 0 0 0.2rem 0;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .action-subtitle {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #999;
        margin: 0;
        font-weight: 800;
      }

      .action-body {
        font-size: 1.05rem;
        line-height: 1.8;
        color: #d4d4d4;
        letter-spacing: 0.3px;
      }

      .web-report-error,
      .web-report-loading {
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

      .web-report-loading {
        color: #d4af37;
      }

      @media print {
        .dashboard-page {
          page-break-after: always;
          break-inside: avoid;
          min-height: auto;
        }
      }

      @media (max-width: 1024px) {
        .hero-grid {
          grid-template-columns: 1fr;
        }

        .pressure-flow-grid,
        .action-pair {
          grid-template-columns: 1fr;
        }

        .triad-grid {
          grid-template-columns: 1fr 1fr;
        }

        .zone-analytical-pair,
        .zone-diagnostics-pair {
          grid-template-columns: 1fr;
        }

        .page-content {
          padding: 3rem 2rem;
        }
      }

      @media (max-width: 768px) {
        .hero-identity-zone {
          flex-direction: column;
          gap: 1.5rem;
        }

        .identity-name {
          font-size: 2.2rem;
        }

        .dashboard-hero {
          padding: 2rem;
        }

        .page-content {
          padding: 2rem 1rem;
          gap: 2rem;
        }

        .dna-hexagon-grid {
          gap: 0.5rem;
        }

        .dna-hex {
          width: 70px;
          height: 70px;
        }

        .triad-grid {
          grid-template-columns: 1fr;
        }

        .pressure-flow-grid {
          grid-template-columns: 1fr 1fr;
        }
      }

      /* ===== BEHAVIORAL INTELLIGENCE CONTENT STYLING ===== */
      
      .bi-summary {
        font-size: 1rem;
        line-height: 1.7;
        color: #d4d4d4;
        margin: 0 0 1.5rem 0;
        font-style: italic;
        border-left: 3px solid rgba(212, 175, 55, 0.4);
        padding-left: 1rem;
      }
      
      .bi-subsection {
        margin: 1.5rem 0;
        padding: 0;
      }
      
      .bi-subsection-title {
        font-size: 1rem;
        font-weight: 800;
        color: #d4af37;
        margin: 0 0 0.8rem 0;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      
      .bi-subsection-text {
        font-size: 1rem;
        line-height: 1.7;
        color: #d4d4d4;
        margin: 0;
      }
      
      .bi-subsection-highlight {
        font-size: 1.05rem;
        line-height: 1.7;
        color: #d4af37;
        margin: 0;
        font-weight: 600;
      }
      
      .bi-subsection-content {
        font-size: 1rem;
        line-height: 1.7;
        color: #d4d4d4;
      }
      
      .bi-subsection-content p {
        margin: 0.5rem 0;
      }
      
      .bi-state-pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin: 1rem 0;
      }
      
      .bi-state {
        padding: 1rem;
        border-radius: 8px;
        background: rgba(212, 175, 55, 0.08);
        border: 1px solid rgba(212, 175, 55, 0.2);
      }
      
      .bi-state-label {
        font-size: 0.85rem;
        color: #d4af37;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 0.5rem 0;
      }
      
      .bi-state-text {
        font-size: 0.95rem;
        line-height: 1.6;
        color: #d4d4d4;
        margin: 0;
      }
      
      .bi-interpretation {
        font-size: 0.95rem;
        line-height: 1.7;
        color: #b0b0b0;
        margin: 1rem 0 0 0;
        font-style: italic;
      }
      
      .bi-key-signals {
        margin: 2rem 0 0 0;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(212, 175, 55, 0.2);
      }
      
      .bi-signal-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .bi-signal-list li {
        padding: 0.5rem 0 0.5rem 1.5rem;
        position: relative;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #d4d4d4;
      }
      
      .bi-signal-list li::before {
        content: '→';
        position: absolute;
        left: 0;
        color: #d4af37;
        font-weight: 600;
      }
      
      .bi-notes-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .bi-notes-list .bi-note-item {
        padding: 0.6rem 0 0.6rem 1.5rem;
        position: relative;
        font-size: 0.95rem;
        line-height: 1.6;
        color: #d4d4d4;
      }
      
      .bi-notes-list .bi-note-item::before {
        content: '■';
        position: absolute;
        left: 0.3rem;
        color: #d4af37;
        font-size: 0.6rem;
      }
      
      .bi-move-highlight {
        font-size: 1.15rem;
        line-height: 1.8;
        color: #d4af37;
        margin: 0;
        font-weight: 600;
      }
      
      .bi-caution {
        background: rgba(255, 152, 0, 0.08);
        border-left: 3px solid rgba(255, 152, 0, 0.4);
        padding: 1rem;
        border-radius: 6px;
      }
      
      .bi-caution-text {
        font-size: 0.95rem;
        line-height: 1.6;
        color: #ffb74d;
        margin: 0;
        font-style: italic;
      }
      
      /* ===== FIVE FUTURES STYLING ===== */
      
      .five-futures-section {
        width: 100%;
      }
      
      .five-futures-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin: 0;
        padding: 0;
      }
      
      .future-card-container {
        display: flex;
        flex-direction: column;
      }
      
      .future-card {
        background: linear-gradient(135deg, rgba(15, 20, 40, 0.7) 0%, rgba(10, 14, 35, 0.6) 100%);
        border: 1.5px solid rgba(212, 175, 55, 0.25);
        border-radius: 12px;
        padding: 1.8rem;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .future-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, rgba(212, 175, 55, 0) 0%, rgba(212, 175, 55, 0.3) 50%, rgba(212, 175, 55, 0) 100%);
      }
      
      .future-card:hover {
        transform: translateY(-4px);
        border-color: rgba(212, 175, 55, 0.45);
        box-shadow: 0 12px 48px rgba(212, 175, 55, 0.15);
      }
      
      .future-header {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      
      .future-badge {
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, rgba(212, 175, 55, 0.8) 0%, rgba(212, 175, 55, 0.5) 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        color: #1a1a1a;
        font-size: 1rem;
        flex-shrink: 0;
      }
      
      .future-title {
        font-size: 1.1rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        flex: 1;
      }
      
      .future-meta {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 1rem;
        font-size: 0.85rem;
      }
      
      .future-likelihood-label {
        color: #999;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
      }
      
      .future-likelihood {
        color: #d4af37;
        font-weight: 600;
        text-transform: capitalize;
      }
      
      .future-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      
      .future-trajectory,
      .future-org-impact {
        margin: 0;
      }
      
      .future-trajectory-text,
      .future-org-text {
        font-size: 0.95rem;
        line-height: 1.6;
        color: #d4d4d4;
        margin: 0;
      }
      
      .future-org-impact {
        padding-top: 0.8rem;
        border-top: 1px solid rgba(212, 175, 55, 0.15);
      }
      
      .future-content {
        font-size: 0.95rem;
        line-height: 1.6;
        color: #d4d4d4;
      }

          `}</style>
  );
}
