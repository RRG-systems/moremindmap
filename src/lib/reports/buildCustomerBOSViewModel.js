/**
 * Production Customer BOS view model — dynamic from canonical + narrative.
 */

import { buildOperatingScoreCards } from './scoreLabels.js';
import { buildScoreMeaningViewModel } from './buildScoreMeaningViewModel.js';
import { FINAL_BOS_TABS } from './buildFinalBOSTabs.js';

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
  return clean;
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

function getMicroScenarioLine(payload) {
  const scenario = payload?.micro_scenario;
  if (!isRealCustomerContent(scenario)) return null;
  return `\n\n**A moment that shows this:** ${String(scenario).trim()}`;
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

export function formatCustomerSectionContent(sectionId, payload, { forCustomer = true } = {}) {
  if (!payload) return 'No section data available.';

  if (sectionId === 'executiveSummary') {
    const evidence = formatCustomerEvidence(
      payload.evidenceUsed || payload.grounding_used || [],
      { forCustomer },
    );
    const microScenarioLine = forCustomer
      ? getMicroScenarioLine(payload)
      : (isRealCustomerContent(payload?.micro_scenario)
        ? `\n\n**A moment that shows this:** ${String(payload.micro_scenario).trim()}`
        : null);
    return [
      payload.headline ? `**${payload.headline}**` : null,
      payload.body ? `\n${payload.body}` : null,
      microScenarioLine,
      payload.key_warning && isRealCustomerContent(payload.key_warning)
        ? `\n\n**Watch for:** ${payload.key_warning}`
        : null,
      evidence ? `\n\n**Evidence used:**\n${evidence}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'fiveFutures') {
    const futures = (payload.futures || []).map((future, index) => (
      `${index + 1}. **${future.title}** (${future.likelihood})\n${future.trajectory}\n\n_What the organization experiences:_ ${future.organization_experiences}`
    )).join('\n\n');
    return [
      payload.summary ? `${payload.summary}` : null,
      payload.most_likely
        ? `\n\n**${payload.most_likely.title || payload.most_likely.headline}** (${payload.most_likely.likelihood})\n${payload.most_likely.trajectory}\n\n_What the organization experiences:_ ${payload.most_likely.organization_experiences}`
        : null,
      futures ? `\n\n**All five futures:**\n\n${futures}` : null,
      !payload.summary && !payload.most_likely && !futures ? getSectionBody(payload) : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'recommendedNextStep') {
    const days = (payload.first30Days || payload.first_30_days || [])
      .filter((step) => isRealCustomerContent(step))
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n');
    const evidence = formatCustomerEvidence(
      payload.evidenceUsed || payload.grounding_used || [],
      { forCustomer },
    );
    const signals = (payload.proofSignals || payload.proof_signals || [])
      .filter((signal) => forCustomer ? isRealCustomerContent(signal) : Boolean(signal))
      .map((signal) => `- ${signal}`)
      .join('\n');
    return [
      payload.headline ? `**${payload.headline}**` : null,
      payload.body ? `\n\n${payload.body}` : null,
      payload.futureBottleneck ? `\n\n**Future bottleneck:** ${payload.futureBottleneck}` : null,
      payload.interventionType ? `\n\n**Type of move:** ${payload.interventionType}` : null,
      payload.intervention ? `\n\n**The move:** ${payload.intervention}` : null,
      payload.whyThisMatters ? `\n\n**Why this matters:** ${payload.whyThisMatters}` : null,
      payload.whatHappensIfIgnored ? `\n\n**If ignored:** ${payload.whatHappensIfIgnored}` : null,
      payload.confidence ? `\n\n**Confidence:** ${payload.confidence}` : null,
      days ? `\n\n**First 30 days:**\n${days}` : null,
      signals ? `\n\n**How you will know it is working:**\n${signals}` : null,
      evidence ? `\n\n**Evidence used:**\n${evidence}` : null,
      !payload.headline && !payload.body ? getSectionBody(payload) : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'facilitatorNotes') {
    const notes = (payload.notes || []).map(
      (note) => `**${note.label}:** ${note.guidance}\n_Why:_ ${note.rationale}`,
    ).join('\n\n');
    return [
      payload.summary ? `${payload.summary}` : null,
      payload.primary_guidance ? `\n\n**Primary guidance:** ${payload.primary_guidance}` : null,
      notes ? `\n\n**Environment design:**\n\n${notes}` : null,
      payload.caution ? `\n\n**Caution:** ${payload.caution}` : null,
      !payload.summary && !notes ? getSectionBody(payload) : null,
    ].filter(Boolean).join('');
  }

  return getSectionBody(payload) || 'No section data available.';
}

function buildOverviewSections(narrative, scoreMeaning) {
  const executive = narrative?.executiveSummary;
  const oneMove = narrative?.recommendedNextStep;
  const profileDna = narrative?.profileDNA;
  const scaling = narrative?.scalingConstraint || narrative?.strategicCeiling;

  return [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      preview: getSectionHeadline(executive) || previewText(getSectionBody(executive)),
      badge: 'Core Insight',
      defaultOpen: true,
      content: formatCustomerSectionContent('executiveSummary', executive),
    },
    {
      id: 'core-operating-pattern',
      title: 'Core Operating Pattern',
      preview: scoreMeaning.patternSummary.headline,
      badge: 'Core Insight',
      defaultOpen: true,
      content: `**${scoreMeaning.patternSummary.headline}**\n\n${scoreMeaning.patternSummary.meaning}\n\n${getSectionBody(profileDna)}`,
    },
    {
      id: 'key-advantage',
      title: 'Key Advantage',
      preview: previewText(scoreMeaning.scores[0]?.howItHelps),
      badge: 'Strength',
      defaultOpen: false,
      content: scoreMeaning.scores.length
        ? scoreMeaning.scores.slice(0, 2).map((score) => `**${score.dimension} (${score.score.toFixed(2)})**\n${score.howItHelps}`).join('\n\n')
        : getSectionBody(narrative?.coachingLeverage) || 'Advantage details will appear when score data is available.',
    },
    {
      id: 'main-scaling-risk',
      title: 'Main Scaling Risk',
      preview: executive?.key_warning || previewText(getSectionBody(scaling)),
      badge: 'Watch',
      defaultOpen: false,
      content: [
        executive?.key_warning ? `**${executive.key_warning}**` : null,
        getSectionBody(scaling),
        scoreMeaning.scores.length
          ? scoreMeaning.scores.slice(-2).map((score) => `**${score.dimension} (${score.score.toFixed(2)})**\n${score.howItWorksAgainst}`).join('\n\n')
          : null,
      ].filter(Boolean).join('\n\n'),
    },
    {
      id: 'best-next-move',
      title: 'Best Next Move',
      preview: getSectionHeadline(oneMove) || previewText(getSectionBody(oneMove)),
      badge: 'Action',
      defaultOpen: false,
      content: formatCustomerSectionContent('recommendedNextStep', oneMove),
    },
  ];
}

function buildFiveFuturesSections(narrative) {
  const fiveFutures = narrative?.fiveFutures;
  if (!fiveFutures) {
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
      preview: previewText(fiveFutures.summary),
      badge: 'Future',
      defaultOpen: true,
      content: formatCustomerSectionContent('fiveFutures', {
        summary: fiveFutures.summary,
        most_likely: fiveFutures.most_likely,
        futures: [],
      }),
    },
    ...(fiveFutures.futures || []).map((future, index) => ({
      id: `future-${index + 1}`,
      title: future.title,
      preview: previewText(future.trajectory),
      badge: String(future.likelihood || '').toLowerCase() === 'risk' ? 'Watch' : 'Future',
      defaultOpen: false,
      content: `**Likelihood:** ${future.likelihood}\n\n${future.trajectory}\n\n_What the organization experiences:_ ${future.organization_experiences}`,
    })),
  ];

  return items;
}

function buildHowToUseThis(personName, operatingScores) {
  const available = operatingScores.filter((score) => score.available);
  const strongest = available.slice().sort((a, b) => b.score - a.score).slice(0, 2).map((s) => s.dimension);
  const weakest = available.slice().sort((a, b) => a.score - b.score).slice(0, 2).map((s) => s.dimension);

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

function buildAdvancedSourceText(canonical, narrative) {
  const data = canonical?.canonical_profile_json || canonical;
  const cognition = data.rescoring_gpt || data.rescoring_v1 || {};
  const renderReady = cognition.render_ready || {};
  const model = cognition.model || cognition.version || cognition.source || 'technical source';

  const technicalBlocks = [];

  if (renderReady.profile_dna) {
    technicalBlocks.push(`**Profile DNA (technical)**\n${renderReady.profile_dna}`);
  }

  ['executiveSummary', 'fiveFutures', 'recommendedNextStep', 'facilitatorNotes'].forEach((sectionId) => {
    const payload = narrative?.[sectionId];
    if (!payload) return;
    technicalBlocks.push(`**${sectionId}**\n${formatCustomerSectionContent(sectionId, payload, { forCustomer: false })}`);
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

  const operatingScores = buildOperatingScoreCards(data, ranked);
  const scoreMeaning = buildScoreMeaningViewModel({ canonical, ranked, personName: displayName || 'You' });

  return {
    meta: {
      profileName: displayName || 'Your Behavioral Operating System',
      title: 'Behavioral Operating System',
      subtitle:
        'A clear map of how you think, decide, communicate, lead, and respond under pressure.',
      profileId: profileId || data?.profile_id || canonical?.profile_id || '',
      company,
    },
    operatingScores,
    tabs: FINAL_BOS_TABS,
    overviewSections: buildOverviewSections(narrative, scoreMeaning),
    scoreMeaning,
    fiveFuturesSections: buildFiveFuturesSections(narrative),
    oneMove: {
      headline: getSectionHeadline(narrative?.recommendedNextStep) || 'Your One Move',
      preview: previewText(getSectionBody(narrative?.recommendedNextStep)),
      content: formatCustomerSectionContent('recommendedNextStep', narrative?.recommendedNextStep),
      intervention: narrative?.recommendedNextStep?.intervention
        || getSectionBody(narrative?.recommendedNextStep),
    },
    teamFit: {
      content: formatCustomerSectionContent('facilitatorNotes', narrative?.facilitatorNotes),
    },
    howToUseThis: buildHowToUseThis(displayName || 'You', operatingScores),
    advancedSource: buildAdvancedSourceText(canonical, narrative),
    visualDNA: {
      approved: visualDNA,
      deterministic: deterministicVisualDNA,
    },
    narrative,
  };
}

export default buildCustomerBOSViewModel;