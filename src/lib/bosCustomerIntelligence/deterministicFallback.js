import {
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  TRANSLATION_FORMATS,
  TRANSLATION_STATUS,
} from './contracts.js';
import { isSufficientProjectedClaim } from './semanticPacket.js';
import { semanticContractsForSurface } from './translationValidator.js';

function sentenceCase(value) {
  const text = String(value || '').trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

function naturalList(items) {
  const values = [...new Set((items || []).filter(Boolean))];
  if (values.length <= 1) return values[0] || 'the supported pattern';
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function abstentionCopy(surface) {
  const claimIds = new Set((surface.claims || []).map(({ claim_id: claimId }) => claimId));
  if (claimIds.has('strategic_ceiling')) {
    return {
      headline: 'Scaling conclusions remain open',
      blocks: [{
        kind: 'limitation',
        text: 'This assessment does not include the follow-up evidence needed to predict a scaling constraint, so that conclusion has been left open.',
      }],
    };
  }
  if (claimIds.has('future_trajectory')) {
    return {
      headline: 'Future paths remain open',
      blocks: [{
        kind: 'limitation',
        text: 'This assessment does not include the follow-up evidence needed to forecast a future path, so no trajectory is presented here.',
      }],
    };
  }
  if (claimIds.has('team_experience')) {
    return {
      headline: 'Team experience remains open',
      blocks: [{
        kind: 'limitation',
        text: 'This assessment reflects self-report and does not include feedback from other people, so it does not conclude how a team experiences you.',
      }],
    };
  }
  return {
    headline: 'This conclusion remains open',
    blocks: [{
      kind: 'limitation',
      text: `The available information does not support a conclusion about ${String(surface.label || 'this area').toLowerCase()}, so it has been left open.`,
    }],
  };
}

function scoreCopy(surface) {
  const cue = surface.translation_guidance?.recognition_cues?.[0]
    || String(surface.label || 'this tendency').toLowerCase();
  const rank = Number(surface.protected_values?.rank);
  const relative = rank <= 2
    ? 'one of the most prominent parts of the overall pattern'
    : rank >= 7
      ? 'less prominent than most of the other measured tendencies'
      : 'near the middle of the overall pattern';
  return {
    headline: surface.label,
    blocks: [
      {
        kind: 'recognition',
        text: `${sentenceCase(cue)} is ${relative}.`,
      },
      {
        kind: 'self_check',
        text: `Notice when ${cue} feels natural and when the situation calls for a different response.`,
      },
    ],
  };
}

function oneMoveCopy(surface, sufficient) {
  const source = String(sufficient[0]?.claim || '')
    .replace(/^hypothesis to test:\s*/i, '')
    .trim();
  const action = source || 'Make the decision criteria, owner, and review point explicit for one recurring handoff.';
  return {
    headline: 'A practical test for your next decision',
    blocks: [
      { kind: 'action', text: sentenceCase(action) },
      {
        kind: 'observation',
        text: 'Watch whether clearer criteria and ownership coincide with more consistent follow-through.',
      },
      { kind: 'limitation', text: 'This is a test, not a promised result.' },
    ],
  };
}

function supportedCopy(surface, sufficient) {
  const format = surface.translation_guidance?.output_format;
  const cues = naturalList(surface.translation_guidance?.recognition_cues);
  if (format === TRANSLATION_FORMATS.SCORE) return scoreCopy(surface);
  if (format === TRANSLATION_FORMATS.ONE_MOVE) return oneMoveCopy(surface, sufficient);
  if (format === TRANSLATION_FORMATS.EXECUTIVE) {
    return {
      headline: 'The pattern at a glance',
      blocks: [
        { kind: 'summary', text: `The clearest themes in your responses are ${cues}.` },
        {
          kind: 'recognition',
          text: 'Your written responses also point to specific ways pressure may change your focus and response.',
        },
        {
          kind: 'self_check',
          text: 'Compare that description with what you notice across different situations and contexts.',
        },
      ],
    };
  }
  if (format === TRANSLATION_FORMATS.VISUAL_DNA) {
    return {
      headline: 'Your score pattern',
      blocks: [{
        kind: 'summary',
        text: `The strongest emphasis in this visual centers on ${cues}.`,
      }],
    };
  }
  if (format === TRANSLATION_FORMATS.FIVE_FUTURES) {
    return {
      headline: surface.label,
      blocks: [{
        kind: 'summary',
        text: `The supported future-oriented pattern centers on ${cues}.`,
      }],
    };
  }
  if (format === TRANSLATION_FORMATS.TEAM) {
    return {
      headline: surface.label,
      blocks: [{
        kind: 'summary',
        text: `The supported leadership pattern centers on ${cues}.`,
      }],
    };
  }
  if (surface.surface_id === 'overview.core-operating-pattern') {
    return {
      headline: surface.label,
      blocks: [
        {
          kind: 'recognition',
          text: `Your overall score pattern places the most emphasis on ${cues}.`,
        },
        {
          kind: 'self_check',
          text: 'Notice where that combination feels natural and where the situation brings out a different response.',
        },
      ],
    };
  }
  if (surface.surface_id === 'overview.key-advantage') {
    return {
      headline: 'What stands out',
      blocks: [{
        kind: 'recognition',
        text: `What stands out is the combination of ${cues}.`,
      }],
    };
  }
  return {
    headline: surface.label,
    blocks: [
      { kind: 'recognition', text: `This part of the assessment points to ${cues}.` },
      {
        kind: 'self_check',
        text: `Check where ${cues} matches your experience and where context changes the pattern.`,
      },
    ],
  };
}

function translationForSurface(surface) {
  const sufficient = (surface.claims || []).filter(isSufficientProjectedClaim);
  const abstained = sufficient.length === 0;
  return {
    surface_id: surface.surface_id,
    claim_ids: (surface.claims || []).map(({ claim_id }) => claim_id),
    status: abstained ? TRANSLATION_STATUS.ABSTAINED : TRANSLATION_STATUS.TRANSLATED,
    format: surface.translation_guidance.output_format,
    customer_copy: abstained
      ? abstentionCopy(surface)
      : supportedCopy(surface, sufficient),
    semantic_contracts: semanticContractsForSurface(surface),
  };
}

export function buildDeterministicLayer3Translation(packet) {
  return Object.freeze({
    version: BOS_CUSTOMER_INTELLIGENCE_VERSION,
    source_hash: packet.semantic_hash,
    translations: Object.freeze(packet.surfaces.map(translationForSurface)),
  });
}

export function isAbstentionTranslation(translation) {
  return translation?.status === TRANSLATION_STATUS.ABSTAINED;
}
