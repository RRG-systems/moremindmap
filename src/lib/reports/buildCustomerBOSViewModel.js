/**
 * Production Customer BOS view model — dynamic from canonical + narrative.
 *
 * L2 architecture + L3 25/100 rewrite + L3R customer section body layer:
 * - Customer tabs bind customer-only section bodies built from structured facts.
 * - Raw narrative paragraphs are NOT the customer body strategy (Advanced Source only).
 * - Advanced Source / technicalSource keep raw technical strings (forCustomer: false).
 * - Canonical, narrative source objects, DNA engine, and BA fusion inputs are not mutated.
 * - Display-time only; works for old retrieved dossiers and new profiles. No OpenAI.
 */

import { buildOperatingScoreCards } from './scoreLabels.js';
import { buildScoreMeaningViewModel } from './buildScoreMeaningViewModel.js';
import { FINAL_BOS_TABS } from './buildFinalBOSTabs.js';
import {
  mapInterventionTypeForCustomer,
  mapDimensionNameForCustomer,
  presentPatternHeadlineForCustomer,
  cleanCustomerBOSCopy,
  stripCustomerMarkdown,
  preserveTechnicalSource,
  presentOneMoveHeadlineForCustomer,
  presentExecutiveSummaryForCustomer,
  presentScalingRiskForCustomer,
  presentFutureForCustomer,
  presentTeamFitNoteForCustomer,
  presentDimensionOneLineForCustomer,
  buildCustomerSectionBodies,
  buildCustomerPatternMeaning,
  buildCustomerOneMoveBlocks,
  buildCustomerMainConstraintBody,
  collapseDuplicateCustomerPhrasing,
} from './bosCustomerPresentationHelpers.js';

const PLACEHOLDER_PATTERNS = [
  /\[scenario would be injected\]/i,
  /scenario would be injected/i,
  /scenario placeholder/i,
  /\bTBD\b/i,
  /\bTODO\b/i,
  /\bFIXME\b/i,
  /\blorem\b/i,
  /\bplaceholder\b/i,
  /\bfixture\b/i,
  /\bmock\b/i,
  /sample text/i,
  /\[object Object\]/i,
  /^\(one concrete workplace moment\)$/i,
  /^\(one specific meeting moment\)$/i,
  /^\(one moment where contradiction surfaces\)$/i,
  /^\(one scaling moment of friction\)$/i,
  /^\(list canonical fields used\)$/i,
  /^\(which canonical fields/i,
  /^\(which sections \+/i,
  /^\(which decision pattern/i,
];

const RAW_EVIDENCE_KEY_PATTERN = /^(primarySystem|secondarySystem|canonical\.|scalingTension|constraintAtScale|communicationAsset|opposingPatterns|tradeoffs\[|rescoring_gpt|rescoring_v1|ranked \(all dimensions\))/i;

const EVIDENCE_KEY_LABELS = {
  'primarySystem.description': 'Primary operating pattern',
  'primarySystem.operating': 'Primary operating style',
  'primarySystem.score': 'Primary dimension score',
  'primarySystem.pressure': 'Pressure response pattern',
  'secondarySystem.description': 'Secondary operating pattern',
  'secondarySystem.operating': 'Secondary operating style',
  'secondarySystem.score': 'Secondary dimension score',
  'secondarySystem.pressure': 'Secondary pressure pattern',
  scalingTension: 'Scaling tension analysis',
  constraintAtScale: 'Scale constraint pattern',
  communicationAsset: 'Communication pattern',
  'ranked (all dimensions)': 'Operating dimension scores',
};

function isPlaceholderContent(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return true;
  if (clean === 'undefined' || clean === 'null') return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(clean));
}

function isRealCustomerContent(text) {
  return !isPlaceholderContent(text);
}

function extractEvidenceText(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'object') {
    return String(entry.text || entry.label || entry.description || '').trim();
  }
  return '';
}

function isRawBackendEvidenceKey(text) {
  const clean = String(text || '').trim();
  if (!clean) return true;
  if (RAW_EVIDENCE_KEY_PATTERN.test(clean)) return true;
  if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_[\]]+)+$/.test(clean)) return true;
  return false;
}

function toCustomerEvidenceLabel(text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  if (EVIDENCE_KEY_LABELS[clean]) return EVIDENCE_KEY_LABELS[clean];
  if (isRawBackendEvidenceKey(clean)) return '';
  if (isPlaceholderContent(clean)) return '';
  return cleanCustomerBOSCopy(clean);
}

function formatCustomerEvidence(entries, { forCustomer = true } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const formatted = list
    .map((entry) => {
      const raw = extractEvidenceText(entry);
      if (!raw) return '';
      if (forCustomer) return toCustomerEvidenceLabel(raw);
      return raw;
    })
    .filter(Boolean);

  if (!formatted.length) return '';
  return formatted.map((line) => `- ${line}`).join('\n');
}

function getMicroScenarioLine(payload, { forCustomer = true } = {}) {
  const scenario = payload?.micro_scenario;
  if (!isRealCustomerContent(scenario)) return null;
  const text = forCustomer
    ? cleanCustomerBOSCopy(String(scenario).trim())
    : String(scenario).trim();
  return `\n\n**A moment that shows this:** ${text}`;
}

function getSectionBody(section) {
  if (!section) return '';
  if (typeof section === 'string') return section.trim();
  return String(section.body || section.summary || '').trim();
}

function getSectionHeadline(section) {
  if (!section) return '';
  if (typeof section === 'string') return '';
  return String(section.headline || '').trim();
}

function previewText(text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Content available when you expand this section.';
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function customerPreview(text, max = 160) {
  return previewText(cleanCustomerBOSCopy(text), max);
}

/**
 * Serialize narrative section for customer tabs (forCustomer: true) or Advanced Source (false).
 * Customer path maps intervention enums and technical phrase fragments via helpers.
 * Technical path preserves raw engine/source strings.
 */
export function formatCustomerSectionContent(sectionId, payload, { forCustomer = true } = {}) {
  if (!payload) return 'No section data available.';

  if (sectionId === 'executiveSummary') {
    const evidence = formatCustomerEvidence(
      payload.evidenceUsed || payload.grounding_used || [],
      { forCustomer },
    );
    const microScenarioLine = forCustomer
      ? getMicroScenarioLine(payload, { forCustomer: true })
      : (isRealCustomerContent(payload?.micro_scenario)
        ? `\n\n**A moment that shows this:** ${String(payload.micro_scenario).trim()}`
        : null);
    const presented = forCustomer ? presentExecutiveSummaryForCustomer(payload) : null;
    const headline = forCustomer
      ? presented.headline
      : (payload.headline || '');
    const body = forCustomer
      ? presented.body
      : (payload.body || '');
    const keyWarning = payload.key_warning && isRealCustomerContent(payload.key_warning)
      ? (forCustomer ? presentScalingRiskForCustomer(payload.key_warning) : payload.key_warning)
      : null;
    return [
      headline ? `**${headline}**` : null,
      body ? `\n${body}` : null,
      microScenarioLine,
      keyWarning ? `\n\n**Watch for:** ${keyWarning}` : null,
      evidence ? `\n\n**Evidence used:**\n${evidence}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'fiveFutures') {
    const mapFuture = (future) => {
      if (!future) return future;
      if (!forCustomer) return future;
      return presentFutureForCustomer(future);
    };
    const futures = (payload.futures || []).map((future, index) => {
      const f = mapFuture(future);
      return `${index + 1}. **${f.title}** (${f.likelihood})\n${f.trajectory}\n\n_What the organization experiences:_ ${f.organization_experiences}`;
    }).join('\n\n');
    const mostLikely = mapFuture(payload.most_likely);
    const summary = forCustomer
      ? cleanCustomerBOSCopy(payload.summary || '')
      : (payload.summary || '');
    return [
      summary ? `${summary}` : null,
      mostLikely
        ? `\n\n**${mostLikely.title || mostLikely.headline}** (${mostLikely.likelihood})\n${mostLikely.trajectory}\n\n_What the organization experiences:_ ${mostLikely.organization_experiences}`
        : null,
      futures ? `\n\n**All five futures:**\n\n${futures}` : null,
      !payload.summary && !payload.most_likely && !futures
        ? (forCustomer ? cleanCustomerBOSCopy(getSectionBody(payload)) : getSectionBody(payload))
        : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'recommendedNextStep') {
    const days = (payload.first30Days || payload.first_30_days || [])
      .filter((step) => isRealCustomerContent(step))
      .map((step, index) => `${index + 1}. ${forCustomer ? cleanCustomerBOSCopy(step) : step}`)
      .join('\n');
    const evidence = formatCustomerEvidence(
      payload.evidenceUsed || payload.grounding_used || [],
      { forCustomer },
    );
    const signals = (payload.proofSignals || payload.proof_signals || [])
      .filter((signal) => (forCustomer ? isRealCustomerContent(signal) : Boolean(signal)))
      .map((signal) => `- ${forCustomer ? cleanCustomerBOSCopy(signal) : signal}`)
      .join('\n');

    const interventionTypeRaw = payload.interventionType || payload.intervention_type || '';
    const interventionTypeDisplay = forCustomer
      ? mapInterventionTypeForCustomer(interventionTypeRaw)
      : interventionTypeRaw;
    const interventionLabel = forCustomer ? 'Recommended move' : 'Type of move';

    const headline = forCustomer
      ? presentOneMoveHeadlineForCustomer(payload.headline || '')
      : (payload.headline || '');
    const body = forCustomer
      ? cleanCustomerBOSCopy(payload.body || '')
      : (payload.body || '');

    return [
      headline ? `**${headline}**` : null,
      body ? `\n\n${body}` : null,
      payload.futureBottleneck
        ? `\n\n**Future bottleneck:** ${forCustomer ? cleanCustomerBOSCopy(payload.futureBottleneck) : payload.futureBottleneck}`
        : null,
      interventionTypeDisplay
        ? `\n\n**${interventionLabel}:** ${interventionTypeDisplay}`
        : null,
      payload.intervention
        ? `\n\n**The move:** ${forCustomer ? cleanCustomerBOSCopy(payload.intervention) : payload.intervention}`
        : null,
      payload.whyThisMatters
        ? `\n\n**Why this matters:** ${forCustomer ? cleanCustomerBOSCopy(payload.whyThisMatters) : payload.whyThisMatters}`
        : null,
      payload.whatHappensIfIgnored
        ? `\n\n**If ignored:** ${forCustomer ? cleanCustomerBOSCopy(payload.whatHappensIfIgnored) : payload.whatHappensIfIgnored}`
        : null,
      // Confidence is technical; hide on customer tabs, keep in Advanced Source
      (!forCustomer && payload.confidence)
        ? `\n\n**Confidence:** ${payload.confidence}`
        : null,
      days ? `\n\n**First 30 days:**\n${days}` : null,
      signals ? `\n\n**How you will know it is working:**\n${signals}` : null,
      evidence ? `\n\n**Evidence used:**\n${evidence}` : null,
      !payload.headline && !payload.body
        ? (forCustomer ? cleanCustomerBOSCopy(getSectionBody(payload)) : getSectionBody(payload))
        : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'facilitatorNotes') {
    const notes = (payload.notes || []).map((note) => {
      if (!forCustomer) {
        return `**${note.label || ''}:** ${note.guidance || ''}\n_Why:_ ${note.rationale || ''}`;
      }
      const presented = presentTeamFitNoteForCustomer(note);
      return `**${presented.label}:** ${presented.guidance}\n_Why:_ ${presented.rationale}`;
    }).join('\n\n');
    const summary = forCustomer
      ? cleanCustomerBOSCopy(payload.summary || '')
      : (payload.summary || '');
    const primary = payload.primary_guidance
      ? (forCustomer ? cleanCustomerBOSCopy(payload.primary_guidance) : payload.primary_guidance)
      : null;
    const caution = payload.caution
      ? (forCustomer ? cleanCustomerBOSCopy(payload.caution) : payload.caution)
      : null;
    return [
      summary ? `${summary}` : null,
      primary ? `\n\n**Primary guidance:** ${primary}` : null,
      notes ? `\n\n**How to design the environment:**\n\n${notes}` : null,
      caution ? `\n\n**Caution:** ${caution}` : null,
      !payload.summary && !notes
        ? (forCustomer ? cleanCustomerBOSCopy(getSectionBody(payload)) : getSectionBody(payload))
        : null,
    ].filter(Boolean).join('');
  }

  const body = getSectionBody(payload) || 'No section data available.';
  return forCustomer ? cleanCustomerBOSCopy(body) : body;
}

function presentOperatingScoresForCustomer(operatingScores) {
  return (operatingScores || []).map((card) => ({
    ...card,
    dimensionTechnical: preserveTechnicalSource(card.dimension),
    displayName: mapDimensionNameForCustomer(card.dimension),
    oneLine: presentDimensionOneLineForCustomer(card.dimension, card.oneLine || ''),
  }));
}

function presentScoreMeaningForCustomer(scoreMeaning) {
  if (!scoreMeaning) return scoreMeaning;

  const scores = (scoreMeaning.scores || []).map((score) => ({
    ...score,
    dimensionTechnical: preserveTechnicalSource(score.dimension),
    displayName: mapDimensionNameForCustomer(score.dimension),
    whatItMeans: cleanCustomerBOSCopy(score.whatItMeans || ''),
    howItHelps: cleanCustomerBOSCopy(score.howItHelps || ''),
    howItWorksAgainst: cleanCustomerBOSCopy(score.howItWorksAgainst || ''),
    bestUse: cleanCustomerBOSCopy(score.bestUse || ''),
  }));

  const technicalHeadline = scoreMeaning.patternSummary?.headline || '';
  const technicalMeaning = scoreMeaning.patternSummary?.meaning || '';
  const top = [...scores].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 2);
  const bottom = [...scores].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 2);
  // L3R: customer meaning from score cards, not cleaned DNA natural_advantage/risk dump
  const customerMeaning = buildCustomerPatternMeaning(top, bottom);

  return {
    ...scoreMeaning,
    scores,
    patternSummary: {
      ...scoreMeaning.patternSummary,
      technicalHeadline: preserveTechnicalSource(technicalHeadline),
      technicalMeaning: preserveTechnicalSource(technicalMeaning),
      headline: presentPatternHeadlineForCustomer(technicalHeadline)
        || customerMeaning,
      meaning: customerMeaning,
    },
    unavailableDimensions: (scoreMeaning.unavailableDimensions || []).map((dim) =>
      mapDimensionNameForCustomer(dim),
    ),
  };
}

/**
 * Overview expandable cards — bind customer section bodies only.
 * Raw executive/profileDNA/scaling narrative bodies are not used as content.
 * R3B: Best Next Move → Main Constraint (bottleneck role, not action plan).
 */
function buildOverviewSections(customerBodies) {
  const exec = customerBodies.customerExecutiveSummary;
  const core = customerBodies.customerCorePattern;
  const advantage = customerBodies.customerKeyAdvantage;
  const risk = customerBodies.customerScalingRisk;
  const mainConstraint = customerBodies.customerMainConstraint
    || customerBodies.customerBestNextMove;

  return [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      preview: exec.headline || customerPreview(exec.body),
      badge: 'Core Insight',
      defaultOpen: true,
      content: stripCustomerMarkdown(
        collapseDuplicateCustomerPhrasing(exec.content || exec.body || ''),
      ),
    },
    {
      id: 'core-operating-pattern',
      title: 'Core Operating Pattern',
      preview: core.headline || customerBodies.customerPatternHeadline,
      badge: 'Core Insight',
      defaultOpen: true,
      content: stripCustomerMarkdown(
        collapseDuplicateCustomerPhrasing(core.content || core.body || ''),
      ),
    },
    {
      id: 'key-advantage',
      title: 'Key Advantage',
      preview: customerPreview(
        customerBodies.topScores?.[0]?.howItHelps || advantage.body,
      ),
      badge: 'Strength',
      defaultOpen: false,
      content: stripCustomerMarkdown(advantage.content || advantage.body || ''),
    },
    {
      id: 'main-scaling-risk',
      title: 'Main Scaling Risk',
      preview: risk.preview || customerPreview(risk.body),
      badge: 'Watch',
      defaultOpen: false,
      content: stripCustomerMarkdown(
        collapseDuplicateCustomerPhrasing(risk.content || risk.body || ''),
      ),
    },
    {
      id: 'main-constraint',
      title: 'Main Constraint',
      preview: mainConstraint?.preview
        || customerPreview(mainConstraint?.body || ''),
      badge: 'Watch',
      defaultOpen: false,
      content: stripCustomerMarkdown(
        collapseDuplicateCustomerPhrasing(
          mainConstraint?.content || mainConstraint?.body || '',
        ),
      ),
    },
  ];
}

function buildFiveFuturesSections(customerFutureLandscape) {
  if (!customerFutureLandscape || customerFutureLandscape.empty) {
    return [{
      id: 'five-futures-unavailable',
      title: 'Five Futures',
      preview: 'Five futures content is not available for this profile yet.',
      badge: 'Future',
      defaultOpen: true,
      content: 'Five futures content is not available for this profile yet.',
    }];
  }

  const items = [
    {
      id: 'five-futures-summary',
      title: 'Future Landscape',
      preview: customerPreview(customerFutureLandscape.summary),
      badge: 'Future',
      defaultOpen: true,
      content: stripCustomerMarkdown(
        collapseDuplicateCustomerPhrasing(customerFutureLandscape.content || ''),
      ),
    },
    ...(customerFutureLandscape.futures || []).map((future, index) => ({
      id: `future-${index + 1}`,
      title: stripCustomerMarkdown(future.title || `Future ${index + 1}`),
      preview: customerPreview(future.trajectory),
      badge: String(future.likelihood || '').toLowerCase() === 'risk' ? 'Watch' : 'Future',
      defaultOpen: false,
      content: stripCustomerMarkdown(
        collapseDuplicateCustomerPhrasing(future.content || ''),
      ),
    })),
  ];

  return items;
}

function buildHowToUseThis(personName, operatingScores) {
  const available = operatingScores.filter((score) => score.available);
  const strongest = available
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((s) => s.displayName || mapDimensionNameForCustomer(s.dimension));
  const weakest = available
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((s) => s.displayName || mapDimensionNameForCustomer(s.dimension));

  const strengthLine = strongest.length
    ? `Notice where you are strongest (${strongest.join(', ')})`
    : 'Start with the operating scores at the top';
  const structureLine = weakest.length
    ? ` and where external structure will matter most (${weakest.join(', ')}).`
    : '.';

  return {
    title: 'How to Use This',
    intro:
      'Your Behavioral Operating System is a practical map — not a grade, not a label, and not a fixed type. Use it to understand your operating pattern and make better decisions about how you lead and scale.',
    steps: [
      {
        title: 'Start with your score pattern',
        body: `${strengthLine}${structureLine} Your scores show patterns, not pass/fail results.`,
      },
      {
        title: 'Use One Move for the next 30 days',
        body: 'Your One Move is the highest-leverage intervention for your profile. Follow the first 30 days plan and track the proof signals when they are available.',
      },
      {
        title: 'Review Five Futures with your coach, team, or leadership partner',
        body: 'Five Futures is a map of possible paths, not a prediction. Discuss which futures feel most likely today and what would shift the trajectory.',
      },
      {
        title: 'Revisit when evidence changes',
        body: `This BOS reflects ${personName === 'You' ? 'your' : `${personName}'s`} assessment at a point in time. Revisit after major role changes, team growth, or when new friction patterns appear.`,
      },
    ],
  };
}

/**
 * Advanced Source / technical path — raw technical strings only.
 * Must not run customer phrase maps or enum customerization.
 */
function buildAdvancedSourceText(canonical, narrative) {
  const data = canonical?.canonical_profile_json || canonical;
  const cognition = data.rescoring_gpt || data.rescoring_v1 || {};
  const renderReady = cognition.render_ready || {};
  const model = cognition.model || cognition.version || cognition.source || 'technical source';

  const technicalBlocks = [];

  if (renderReady.profile_dna) {
    technicalBlocks.push(`**Profile DNA (technical)**\n${preserveTechnicalSource(renderReady.profile_dna)}`);
  }

  ['executiveSummary', 'fiveFutures', 'recommendedNextStep', 'facilitatorNotes'].forEach((sectionId) => {
    const payload = narrative?.[sectionId];
    if (!payload) return;
    technicalBlocks.push(
      `**${sectionId}**\n${formatCustomerSectionContent(sectionId, payload, { forCustomer: false })}`,
    );
  });

  if (cognition.audit) {
    technicalBlocks.push(`**Audit / provenance**\n${JSON.stringify(cognition.audit, null, 2)}`);
  }

  return {
    model,
    source: cognition.source || (data.rescoring_gpt ? 'gpt' : data.rescoring_v1 ? 'v1' : 'narrative'),
    content: technicalBlocks.join('\n\n---\n\n') || 'Technical source content is not available for this profile.',
  };
}

function buildTechnicalSourceBundle(canonical, narrative) {
  const data = canonical?.canonical_profile_json || canonical || {};
  const cognition = data.rescoring_gpt || data.rescoring_v1 || null;
  return {
    rescoring_gpt: preserveTechnicalSource(data.rescoring_gpt || null),
    rescoring_v1: preserveTechnicalSource(data.rescoring_v1 || null),
    render_ready: preserveTechnicalSource(cognition?.render_ready || null),
    ranked_dimensions: preserveTechnicalSource(cognition?.ranked_dimensions || null),
    vector_scores: preserveTechnicalSource(data.vector_scores || null),
    rawNarrative: preserveTechnicalSource(narrative || null),
    sourceCognition: preserveTechnicalSource(cognition),
  };
}

export function buildCustomerBOSViewModel({
  canonical,
  narrative,
  profileId,
  personName,
  company = '',
  ranked = [],
  visualDNA = null,
  deterministicVisualDNA = null,
}) {
  const data = canonical?.canonical_profile_json || canonical;
  const displayName = personName && personName !== 'Assessment Subject'
    ? personName
    : null;

  const operatingScoresRaw = buildOperatingScoreCards(data, ranked);
  const scoreMeaningRaw = buildScoreMeaningViewModel({
    canonical,
    ranked,
    personName: displayName || 'You',
  });

  // Customer presentation layer (display-time only; does not mutate source objects)
  const operatingScores = presentOperatingScoresForCustomer(operatingScoresRaw);
  const scoreMeaning = presentScoreMeaningForCustomer(scoreMeaningRaw);

  // L3R: customer-only section bodies from structured facts (not cleaned raw narrative)
  const customerBodies = buildCustomerSectionBodies({
    scoreMeaning,
    narrative,
    patternHeadline: scoreMeaning.patternSummary?.technicalHeadline
      || scoreMeaning.patternSummary?.headline
      || '',
    keyWarning: narrative?.executiveSummary?.key_warning || '',
    wrongSeatRisk: '',
  });

  // Align score pattern fields with section-body layer
  if (scoreMeaning?.patternSummary) {
    scoreMeaning.patternSummary.headline = customerBodies.customerPatternHeadline
      || scoreMeaning.patternSummary.headline;
    scoreMeaning.patternSummary.meaning = customerBodies.customerPatternMeaning
      || scoreMeaning.patternSummary.meaning;
  }

  const overviewSections = buildOverviewSections(customerBodies);
  const fiveFuturesSections = buildFiveFuturesSections(customerBodies.customerFutureLandscape);
  const mainConstraintBody = customerBodies.customerMainConstraint
    || buildCustomerMainConstraintBody(narrative?.recommendedNextStep);
  const oneMoveBody = customerBodies.customerOneMove
    || buildCustomerOneMoveBlocks(narrative?.recommendedNextStep, {
      mainConstraintPreview: mainConstraintBody.preview || mainConstraintBody.body || '',
    });
  const teamFitBody = customerBodies.customerTeamFit;
  const howToUseThis = buildHowToUseThis(displayName || 'You', operatingScores);
  const advancedSource = buildAdvancedSourceText(canonical, narrative);
  const technicalSource = buildTechnicalSourceBundle(canonical, narrative);

  const customerOneMove = {
    headline: oneMoveBody.headline || 'Your One Move',
    preview: oneMoveBody.preview || customerPreview(oneMoveBody.body),
    content: stripCustomerMarkdown(
      collapseDuplicateCustomerPhrasing(oneMoveBody.content || oneMoveBody.body || ''),
    ),
    blocks: Array.isArray(oneMoveBody.blocks) ? oneMoveBody.blocks : [],
    intervention: oneMoveBody.intervention || '',
    interventionType: oneMoveBody.interventionType || '',
    interventionTypeRaw: oneMoveBody.interventionTypeRaw || '',
    role: 'one_move',
  };

  const customerMainConstraint = {
    headline: mainConstraintBody.headline || 'Main Constraint',
    preview: mainConstraintBody.preview || customerPreview(mainConstraintBody.body),
    content: stripCustomerMarkdown(
      collapseDuplicateCustomerPhrasing(mainConstraintBody.content || mainConstraintBody.body || ''),
    ),
    role: 'main_constraint',
  };

  const customerSummary = {
    executive: customerBodies.customerExecutiveSummary?.content
      || customerBodies.customerExecutiveSummary?.body
      || '',
    patternHeadline: customerBodies.customerPatternHeadline
      || scoreMeaning.patternSummary.headline,
    patternMeaning: customerBodies.customerPatternMeaning
      || scoreMeaning.patternSummary.meaning,
  };

  return {
    meta: {
      profileName: displayName || 'Your Behavioral Operating System',
      title: 'Behavioral Operating System',
      subtitle:
        'A clear map of how you think, decide, communicate, lead, and respond under pressure.',
      profileId: profileId || data?.profile_id || canonical?.profile_id || '',
      company,
    },
    // Existing component contract (customer-presented)
    operatingScores,
    tabs: FINAL_BOS_TABS,
    overviewSections,
    scoreMeaning,
    fiveFuturesSections,
    oneMove: customerOneMove,
    mainConstraint: customerMainConstraint,
    teamFit: {
      content: stripCustomerMarkdown(
        collapseDuplicateCustomerPhrasing(teamFitBody?.content || teamFitBody?.body || ''),
      ),
    },
    howToUseThis,
    advancedSource,
    visualDNA: {
      approved: visualDNA,
      deterministic: deterministicVisualDNA,
    },
    // Raw narrative retained for Advanced Source / debugging; not for customer tab binding
    narrative,

    // Explicit L2/L3R/R3B layer split fields
    customerSections: overviewSections,
    customerSectionBodies: customerBodies,
    customerSummary,
    customerMainConstraint,
    customerOneMove,
    customerScoreMeanings: scoreMeaning,
    technicalSource,
    sourceNarrative: narrative,
    rawNarrative: narrative,
    rawCognition: technicalSource.sourceCognition,
    sourceCognition: technicalSource.sourceCognition,
    // Technical operating/score meaning before customer presentation (for audits)
    technicalOperatingScores: operatingScoresRaw,
    technicalScoreMeaning: scoreMeaningRaw,
  };
}

export default buildCustomerBOSViewModel;
