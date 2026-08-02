import { validateLayer3TranslationBundle } from './translationValidator.js';
import { buildLayer3VisualDNAViewModel } from './visualDNAAdapter.js';

function bySurface(bundle) {
  return new Map((bundle?.translations || []).map((item) => [item.surface_id, item]));
}

function copyBlocks(translation, kinds = null) {
  const allowed = kinds ? new Set(kinds) : null;
  return (translation?.customer_copy?.blocks || []).filter(
    ({ kind, text }) => text && (!allowed || allowed.has(kind)),
  );
}

function blockText(translation, kinds) {
  return copyBlocks(translation, kinds).map(({ text }) => text).join('\n\n');
}

function firstBlockText(translation, kinds) {
  return copyBlocks(translation, kinds)[0]?.text || '';
}

function isAbstained(translation) {
  return translation?.status === 'abstained';
}

function scoreSurfaceId(score) {
  const claimId = score?.claimContract?.claim_id
    || `dimension_${String(score?.dimensionTechnical || score?.dimension || '').toLowerCase()}`;
  return `score.${claimId}`;
}

function sectionIsUnsupported(section) {
  const claims = section?.claimContracts || [];
  return claims.length > 0 && claims.every((claim) => (
    claim?.evidence_sufficiency?.status !== 'sufficient'
    || claim?.abstention?.abstained !== false
  ));
}

function applyOverview(viewModel, translations) {
  return (viewModel.overviewSections || []).flatMap((section) => {
    const translation = translations.get(`overview.${section.id}`);
    if (isAbstained(translation) || (!translation && sectionIsUnsupported(section))) return [];
    if (!translation) return (section.claimContracts || []).length > 0 ? [section] : [];
    const content = blockText(translation, [
      'summary',
      'recognition',
      'self_check',
      'action',
      'observation',
    ]);
    return [{
      ...section,
      title: section.id === 'key-advantage' ? 'What Stands Out' : section.title,
      badge: section.id === 'key-advantage' ? 'Pattern' : section.badge,
      preview: translation.customer_copy.headline,
      content,
    }];
  });
}

function applyOperatingScores(viewModel, translations) {
  return (viewModel.operatingScores || []).map((score) => {
    const translation = translations.get(scoreSurfaceId(score));
    if (!translation || isAbstained(translation)) return score;
    return {
      ...score,
      oneLine: firstBlockText(translation, ['recognition', 'summary']),
      customerRecognition: firstBlockText(translation, ['recognition', 'summary']),
      customerSelfCheck: firstBlockText(translation, ['self_check', 'observation']),
    };
  });
}

function applyScoreMeaning(viewModel, translations) {
  if (!viewModel.scoreMeaning) return viewModel.scoreMeaning;
  const scores = (viewModel.scoreMeaning.scores || []).map((score) => {
    const translation = translations.get(scoreSurfaceId(score));
    if (!translation || isAbstained(translation)) return score;
    const recognition = firstBlockText(translation, ['recognition', 'summary']);
    const selfCheck = firstBlockText(translation, ['self_check', 'observation']);
    return {
      ...score,
      whatItMeans: recognition,
      howItHelps: '',
      howItWorksAgainst: '',
      bestUse: '',
      customerRecognition: recognition,
      customerSelfCheck: selfCheck,
    };
  });
  const core = translations.get('overview.core-operating-pattern');
  return {
    ...viewModel.scoreMeaning,
    customerIntelligenceActive: true,
    subtitle: 'See which tendencies carry the most weight, then compare the pattern with your experience.',
    scores,
    patternSummary: core && !isAbstained(core)
      ? {
          ...viewModel.scoreMeaning.patternSummary,
          headline: core.customer_copy.headline,
          meaning: blockText(core, ['summary', 'recognition', 'self_check']),
        }
      : viewModel.scoreMeaning.patternSummary,
  };
}

function oneMoveBlockTitle(kind) {
  if (kind === 'action') return 'Try this';
  if (kind === 'observation') return 'What to watch';
  if (kind === 'limitation') return 'Keep in mind';
  return 'Your test';
}

function applyOneMove(viewModel, translations) {
  const translation = translations.get('one_move.primary');
  if (!translation) return viewModel.oneMove;
  if (isAbstained(translation)) {
    return { ...viewModel.oneMove, available: false, content: '', blocks: [] };
  }
  const blocks = copyBlocks(translation).map(({ kind, text }, index) => ({
    id: `customer-${kind}-${index + 1}`,
    title: oneMoveBlockTitle(kind),
    kind: 'text',
    content: text,
  }));
  return {
    ...viewModel.oneMove,
    available: true,
    headline: translation.customer_copy.headline,
    preview: firstBlockText(translation, ['action', 'summary']),
    content: blocks.map(({ content }) => content).join('\n\n'),
    blocks,
  };
}

function applyFiveFutures(viewModel, translations) {
  const translation = translations.get('five_futures.summary');
  if (!translation) return viewModel.fiveFuturesSections;
  if (isAbstained(translation)) return [];
  const sections = viewModel.fiveFuturesSections || [];
  return sections.map((section, index) => (
    index === 0
      ? {
          ...section,
          preview: translation.customer_copy.headline,
          content: blockText(translation),
        }
      : section
  ));
}

function applyTeam(viewModel, translations) {
  const translation = translations.get('team.primary');
  if (!translation) return viewModel.teamFit;
  if (isAbstained(translation)) return { ...viewModel.teamFit, available: false, content: '' };
  return {
    ...viewModel.teamFit,
    available: true,
    content: blockText(translation),
  };
}

function collectLimitations(bundle) {
  const translations = bundle?.translations || [];
  if (translations.length > 0 && translations.every(isAbstained)) {
    return [{
      claim_ids: [...new Set(translations.flatMap(({ claim_ids: claimIds }) => claimIds || []))],
      headline: 'This report needs more information',
      text: 'The available responses do not support a reliable customer-facing interpretation, so the report leaves these conclusions open.',
    }];
  }
  const seenClaims = new Set();
  const limitations = [];
  for (const translation of translations) {
    if (!isAbstained(translation)) continue;
    const newClaimIds = (translation.claim_ids || []).filter((claimId) => !seenClaims.has(claimId));
    if (newClaimIds.length === 0) continue;
    newClaimIds.forEach((claimId) => seenClaims.add(claimId));
    const text = firstBlockText(translation, ['limitation']);
    if (!text) continue;
    limitations.push({
      claim_ids: newClaimIds,
      headline: translation.customer_copy.headline,
      text,
    });
  }
  return limitations;
}

function applyTabs(viewModel, {
  translations,
  overviewSections,
  operatingScores,
  limitations,
  fiveFuturesSections,
  oneMove,
  teamFit,
}) {
  const hasTranslatedScore = operatingScores.some((score) => (
    translations.get(scoreSurfaceId(score))?.status === 'translated'
  ));
  const visualSupported = translations.get('visual_dna.primary')?.status === 'translated';
  return (viewModel.tabs || []).filter((tab) => {
    if (tab.internal) return false;
    if (tab.id === 'overview') return overviewSections.length > 0 || limitations.length > 0;
    if (tab.id === 'scores-reveal') return hasTranslatedScore;
    if (tab.id === 'visual-dna') return visualSupported;
    if (tab.id === 'five-futures') return fiveFuturesSections.length > 0;
    if (tab.id === 'one-move') return oneMove?.available !== false;
    if (tab.id === 'team-fit') return teamFit?.available !== false;
    return true;
  });
}

function buildHowToUseThis({ oneMove, limitations }) {
  const steps = [
    {
      title: 'Start with the overall pattern',
      body: 'Notice which tendencies feel most familiar, and where the pattern changes with the situation.',
    },
    {
      title: 'Use the scores as a mirror',
      body: 'The relative pattern matters more than any single number. Look for examples that fit and examples that do not.',
    },
  ];
  if (oneMove?.available !== false) {
    steps.push({
      title: 'Run the One Move as a test',
      body: 'Try the proposed action in one recurring situation and pay attention to what actually changes.',
    });
  }
  if (limitations.length > 0) {
    steps.push({
      title: 'Leave unsupported conclusions open',
      body: 'Some questions require feedback from other people or observation over time. This report does not fill those gaps with guesses.',
    });
  }
  return {
    title: 'How to Use This',
    intro: 'Use this report as a mirror, not a label. Keep what consistently fits your experience and stay curious about what changes by context.',
    steps,
  };
}

export function applyLayer3Translations(viewModel, packet, bundle, receipt = null) {
  const validation = validateLayer3TranslationBundle(packet, bundle);
  if (!validation.valid) {
    const error = new Error('layer3_translation_bundle_rejected');
    error.failures = validation.failures;
    throw error;
  }
  const translations = bySurface(bundle);
  const overviewSections = applyOverview(viewModel, translations);
  const oneMove = applyOneMove(viewModel, translations);
  const fiveFuturesSections = applyFiveFutures(viewModel, translations);
  const teamFit = applyTeam(viewModel, translations);
  const limitations = collectLimitations(bundle);
  const operatingScores = applyOperatingScores(viewModel, translations);
  const tabs = applyTabs(viewModel, {
    translations,
    overviewSections,
    operatingScores,
    limitations,
    fiveFuturesSections,
    oneMove,
    teamFit,
  });
  return {
    ...viewModel,
    meta: {
      ...viewModel.meta,
      subtitle: 'A clear view of the patterns your responses support—and the questions they leave open.',
    },
    tabs,
    reviewerTabs: (viewModel.tabs || []).filter(({ internal }) => internal),
    operatingScores,
    overviewSections,
    scoreMeaning: applyScoreMeaning(viewModel, translations),
    fiveFuturesSections,
    oneMove,
    teamFit,
    howToUseThis: buildHowToUseThis({ oneMove, limitations }),
    limitations,
    evidenceNote:
      'This report reflects patterns supported by your responses. Conclusions that require observation over time or feedback from other people remain open.',
    visualDNA: {
      ...viewModel.visualDNA,
      approved: viewModel.visualDNA?.approved
        ? {
            ...viewModel.visualDNA.approved,
            layer3_translation_status: 'stored_visual_not_translated',
          }
        : viewModel.visualDNA?.approved,
      deterministic: buildLayer3VisualDNAViewModel(
        viewModel.visualDNA?.deterministic,
        bundle,
      ),
    },
    customerSections: overviewSections,
    customerOneMove: oneMove,
    customer_intelligence: {
      version: bundle.version,
      source_hash: bundle.source_hash,
      receipt,
      translation_only: true,
      technical_source_unchanged: true,
      limitations,
    },
  };
}

export default applyLayer3Translations;
