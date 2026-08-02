import { validateLayer3TranslationBundle } from './translationValidator.js';
import { buildLayer3VisualDNAViewModel } from './visualDNAAdapter.js';

function bySurface(bundle) {
  return new Map((bundle?.translations || []).map((item) => [item.surface_id, item]));
}

function customerCopyText(copy) {
  return [
    copy?.explanation,
    copy?.recognizable_pattern,
    copy?.evidence_boundary,
    copy?.practical_use,
  ].filter(Boolean).join('\n\n');
}

function scoreSurfaceId(score) {
  const claimId = score?.claimContract?.claim_id
    || `dimension_${String(score?.dimensionTechnical || score?.dimension || '').toLowerCase()}`;
  return `score.${claimId}`;
}

function applyOverview(viewModel, translations) {
  return (viewModel.overviewSections || []).map((section) => {
    const translation = translations.get(`overview.${section.id}`);
    if (!translation) return section;
    return {
      ...section,
      preview: translation.customer_copy.headline,
      content: customerCopyText(translation.customer_copy),
    };
  });
}

function applyOperatingScores(viewModel, translations) {
  return (viewModel.operatingScores || []).map((score) => {
    const translation = translations.get(scoreSurfaceId(score));
    if (!translation) return score;
    return {
      ...score,
      oneLine: translation.customer_copy.explanation,
    };
  });
}

function applyScoreMeaning(viewModel, translations) {
  if (!viewModel.scoreMeaning) return viewModel.scoreMeaning;
  const scores = (viewModel.scoreMeaning.scores || []).map((score) => {
    const translation = translations.get(scoreSurfaceId(score));
    if (!translation) return score;
    return {
      ...score,
      whatItMeans: translation.customer_copy.explanation,
      howItHelps: translation.customer_copy.practical_use,
      howItWorksAgainst: translation.customer_copy.evidence_boundary,
      bestUse: translation.customer_copy.practical_use,
    };
  });
  const core = translations.get('overview.core-operating-pattern');
  return {
    ...viewModel.scoreMeaning,
    customerIntelligenceActive: true,
    scores,
    patternSummary: core
      ? {
          ...viewModel.scoreMeaning.patternSummary,
          headline: core.customer_copy.headline,
          meaning: customerCopyText(core.customer_copy),
        }
      : viewModel.scoreMeaning.patternSummary,
  };
}

function applyOneMove(viewModel, translations) {
  const translation = translations.get('one_move.primary');
  if (!translation) return viewModel.oneMove;
  return {
    ...viewModel.oneMove,
    headline: translation.customer_copy.headline,
    preview: translation.customer_copy.explanation,
    content: customerCopyText(translation.customer_copy),
    blocks: [
      {
        id: 'what-the-evidence-supports',
        title: 'What the evidence supports',
        kind: 'text',
        content: translation.customer_copy.explanation,
      },
      {
        id: 'recognize-the-pattern',
        title: 'What you may notice',
        kind: 'text',
        content: translation.customer_copy.recognizable_pattern,
      },
      {
        id: 'use-with-care',
        title: 'How to use this honestly',
        kind: 'text',
        content: [
          translation.customer_copy.evidence_boundary,
          translation.customer_copy.practical_use,
        ].filter(Boolean).join('\n\n'),
      },
    ],
  };
}

function applyFiveFutures(viewModel, translations) {
  const translation = translations.get('five_futures.summary');
  if (!translation) return viewModel.fiveFuturesSections;
  return (viewModel.fiveFuturesSections || []).map((section) => ({
    ...section,
    preview: translation.customer_copy.headline,
    content: customerCopyText(translation.customer_copy),
  }));
}

function applyTeam(viewModel, translations) {
  const translation = translations.get('team.primary');
  if (!translation) return viewModel.teamFit;
  return {
    ...viewModel.teamFit,
    content: customerCopyText(translation.customer_copy),
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
  return {
    ...viewModel,
    meta: {
      ...viewModel.meta,
      subtitle:
        'A plain-language view of validated BOS evidence, with uncertainty and abstentions preserved.',
    },
    operatingScores: applyOperatingScores(viewModel, translations),
    overviewSections,
    scoreMeaning: applyScoreMeaning(viewModel, translations),
    fiveFuturesSections: applyFiveFutures(viewModel, translations),
    oneMove,
    teamFit: applyTeam(viewModel, translations),
    visualDNA: {
      ...viewModel.visualDNA,
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
    },
  };
}

export default applyLayer3Translations;
