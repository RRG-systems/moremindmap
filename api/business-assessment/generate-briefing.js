import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  getCanonicalProfile,
  parseProfileId,
  setCors
} from './shared.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../engine/businessAssessment/realEstateBusinessModelV1.js';
import { buildExecutiveDiagnosticBriefingPrompt } from '../engine/businessAssessment/buildExecutiveDiagnosticBriefingPrompt.js';
import {
  buildModelProvenance,
  resolveModelForRoute
} from '../engine/config/modelRegistry.js';

const BRIEFING_VERSION = 'executive_diagnostic_briefing_v1';
const BRIEFING_ROUTE = 'business_assessment.briefing';
const briefingModelResolution = resolveModelForRoute(BRIEFING_ROUTE);
const MODEL = briefingModelResolution.model;
const REQUIRED_SECTION_TITLES = [
  'Executive Readout',
  'Current Business Reality',
  'Behavioral Reality Applied to the Business',
  'Relationship / Database Reality',
  'Lead Generation Reality',
  'Lead Conversion / Follow-Up Reality',
  'Systems Reality',
  'Accountability Reality',
  'Financial Reality',
  'Team / Leadership Reality',
  'Contradictions and Blind Spots',
  'Primary Constraint',
  'Current Trajectory Signal',
  'Confidence / Missing Data',
  'Strategic Interpretation',
  'Preliminary One Move Direction'
];
const MINIMUM_BRIEFING_CHARACTERS = 12000;
const MINIMUM_BRIEFING_WORDS = 1800;
const MINIMUM_SECTION_BODY_WORDS = 90;
const MAX_REPAIR_ATTEMPTS = 2;
const NARROW_SECTION_WORD_GAP = 25;
const BRIEFING_ENDPOINT_TIME_BUDGET_MS = 165000;
const BRIEFING_INITIAL_OPENAI_CALL_TIMEOUT_MS = 90000;
const BRIEFING_OPENAI_CALL_TIMEOUT_MS = 70000;
const BRIEFING_REPAIR_SAFETY_BUFFER_MS = 35000;
const BRIEFING_TARGETED_EXPANSION_TIMEOUT_MS = 45000;
const BRIEFING_TARGETED_EXPANSION_SAFETY_BUFFER_MS = 15000;
const BRIEFING_SUPPLEMENTAL_EXPANSION_TIMEOUT_MS = 25000;
const BRIEFING_SUPPLEMENTAL_EXPANSION_SAFETY_BUFFER_MS = 10000;
const NEAR_PASS_CHARACTER_GAP = 500;
const NEAR_PASS_WORD_GAP = 75;
const UNDER_LENGTH_CHARACTER_GAP = 2500;
const UNDER_LENGTH_WORD_GAP = 500;
const DETERMINISTIC_CLOSE_GAP_WORD_GAP = 250;
const DETERMINISTIC_CLOSE_GAP_CHARACTER_GAP = 1500;
const SECOND_SUPPLEMENTAL_CHARACTER_GAP = 1500;
const SUPPLEMENTAL_MIN_APPEND_TEXT_WORDS = 60;
const SUPPLEMENTAL_PROMPT_MIN_APPEND_TEXT_WORDS = 90;
const UNDER_LENGTH_SUPPLEMENTAL_MIN_APPEND_TEXT_WORDS = 80;
const MAX_THIN_SECTION_BATCH_SIZE = 10;
const STRUCTURAL_TOP_LEVEL_KEYS = [
  'sections',
  'primary_constraint_snapshot',
  'current_trajectory_signal',
  'confidence_snapshot',
  'missing_data',
  'caveats'
];

async function resolveAssessmentId(redis, { assessment_id, owner_profile_id }) {
  if (assessment_id) return assessment_id;
  const parsedProfile = parseProfileId(owner_profile_id);
  if (!parsedProfile) return null;
  return redis.get(businessAssessmentByProfileKey(parsedProfile.normalized));
}

function extractJsonObject(content) {
  const body = String(content || '').trim();
  if (!body) throw new Error('empty_model_response');

  try {
    return JSON.parse(body);
  } catch {
    const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const first = body.indexOf('{');
    const last = body.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(body.slice(first, last + 1));
    }

    throw new Error('invalid_json_response');
  }
}

function normalizeBriefingOutput(parsed, { assessmentId, ownerProfileId, prompt }) {
  const now = new Date().toISOString();
  const normalized = {
    ...parsed,
    version: parsed.version || BRIEFING_VERSION,
    generated_at: parsed.generated_at || now,
    assessment_id: parsed.assessment_id || assessmentId,
    owner_profile_id: parsed.owner_profile_id || ownerProfileId,
    title: parsed.title || 'Executive Diagnostic Briefing',
    audience_type: parsed.audience_type || prompt.audience_type,
    word_count_target: parsed.word_count_target || prompt.word_count_target
  };

  const sectionMarkdown = buildBriefingMarkdownFromSections(normalized);
  if (wordCount(sectionMarkdown) > wordCount(normalized.briefing_markdown)) {
    normalized.briefing_markdown = sectionMarkdown;
  }

  return normalized;
}

function buildBriefingMarkdownFromSections(value) {
  if (!value || !Array.isArray(value.sections) || !value.sections.length) {
    return String(value?.briefing_markdown || '').trim();
  }

  const parts = [`# ${value.title || 'Executive Diagnostic Briefing'}`];

  for (const section of value.sections) {
    if (!section || typeof section !== 'object') continue;
    const title = String(section.title || '').trim();
    const body = String(section.body || '').trim();
    if (!title && !body) continue;

    if (title) parts.push(`\n## ${title}`);
    if (body) parts.push(body);

    if (Array.isArray(section.evidence) && section.evidence.length) {
      parts.push(
        [
          'Evidence:',
          ...section.evidence
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 6)
            .map((item) => `- ${item}`)
        ].join('\n')
      );
    }

    if (section.confidence) {
      parts.push(`Confidence: ${String(section.confidence).trim()}`);
    }
  }

  const caveats = Array.isArray(value.caveats)
    ? value.caveats.map((item) => String(item || '').trim()).filter(Boolean)
    : [String(value.caveats || '').trim()].filter(Boolean);
  if (caveats.length) {
    parts.push(`\n## Caveats\n${caveats.join('\n')}`);
  }

  return parts.join('\n\n').trim();
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function sectionWordCount(section) {
  const bodyWords = wordCount(section?.body);
  const evidenceWords = Array.isArray(section?.evidence) ? wordCount(section.evidence.join(' ')) : 0;
  return {
    bodyWords,
    combinedWords: bodyWords + evidenceWords
  };
}

function sectionTitleFingerprint(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bthe\b/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateBriefingOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, reason: 'briefing_not_object' };
  }

  const required = [
    'version',
    'generated_at',
    'assessment_id',
    'owner_profile_id',
    'title',
    'audience_type',
    'word_count_target',
    'briefing_markdown',
    'sections',
    'primary_constraint_snapshot',
    'current_trajectory_signal',
    'confidence_snapshot',
    'missing_data',
    'caveats'
  ];

  const missing = required.filter((key) => value[key] === undefined || value[key] === null);
  if (missing.length) return { valid: false, reason: 'missing_required_keys', missing };

  if (value.version !== BRIEFING_VERSION) {
    return { valid: false, reason: 'invalid_version', version: value.version };
  }

  if (value.title !== 'Executive Diagnostic Briefing') {
    return { valid: false, reason: 'invalid_title', title: value.title };
  }

  const briefingMarkdown = String(value.briefing_markdown || '').trim();
  const briefingWordCount = wordCount(briefingMarkdown);

  if (typeof value.briefing_markdown !== 'string' || briefingMarkdown.length < MINIMUM_BRIEFING_CHARACTERS) {
    return {
      valid: false,
      reason: 'briefing_markdown_too_short',
      minimum_characters: MINIMUM_BRIEFING_CHARACTERS,
      actual_characters: briefingMarkdown.length
    };
  }

  if (briefingWordCount < MINIMUM_BRIEFING_WORDS) {
    return {
      valid: false,
      reason: 'briefing_word_count_too_short',
      minimum_words: MINIMUM_BRIEFING_WORDS,
      actual_words: briefingWordCount
    };
  }

  if (!Array.isArray(value.sections) || value.sections.length < REQUIRED_SECTION_TITLES.length) {
    return {
      valid: false,
      reason: 'sections_missing_or_too_few',
      minimum_sections: REQUIRED_SECTION_TITLES.length,
      actual_sections: Array.isArray(value.sections) ? value.sections.length : 0
    };
  }

  const sectionText = [
    briefingMarkdown,
    ...value.sections.map((section) => `${section?.title || ''}\n${section?.body || ''}`)
  ].join('\n');
  const sectionTextFingerprint = sectionTitleFingerprint(sectionText);
  const missingSectionTitles = REQUIRED_SECTION_TITLES.filter(
    (title) =>
      !sectionText.includes(title) &&
      !sectionTextFingerprint.includes(sectionTitleFingerprint(title))
  );

  if (missingSectionTitles.length) {
    return {
      valid: false,
      reason: 'required_section_titles_missing',
      missing_section_titles: missingSectionTitles
    };
  }

  const malformedSection = value.sections.find((section) => {
    if (
      !section ||
      typeof section !== 'object' ||
      !section.key ||
      !section.title ||
      typeof section.body !== 'string'
    ) {
      return true;
    }

    const counts = sectionWordCount(section);
    return counts.bodyWords < 60 || counts.combinedWords < MINIMUM_SECTION_BODY_WORDS;
  });

  if (malformedSection) {
    const counts = sectionWordCount(malformedSection);
    return {
      valid: false,
      reason: 'malformed_or_thin_section',
      section: malformedSection?.key || malformedSection?.title,
      minimum_words: MINIMUM_SECTION_BODY_WORDS,
      actual_body_words: counts.bodyWords,
      actual_words: counts.combinedWords
    };
  }

  return { valid: true };
}

function structurallyComplete(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return STRUCTURAL_TOP_LEVEL_KEYS.every((key) => value[key] !== undefined && value[key] !== null);
}

function thinSectionFailures(value) {
  if (!Array.isArray(value?.sections)) return [];
  return value.sections
    .map((section) => {
      const counts = sectionWordCount(section);
      const structurallyInvalid =
        !section ||
        typeof section !== 'object' ||
        !section.key ||
        !section.title ||
        typeof section.body !== 'string';

      if (!structurallyInvalid && counts.bodyWords >= 60 && counts.combinedWords >= MINIMUM_SECTION_BODY_WORDS) {
        return null;
      }

      return {
        key: section?.key || null,
        title: section?.title || null,
        structurally_invalid: structurallyInvalid,
        body_words: counts.bodyWords,
        combined_words: counts.combinedWords,
        words_needed: Math.max(0, MINIMUM_SECTION_BODY_WORDS - counts.combinedWords)
      };
    })
    .filter(Boolean);
}

function expandableThinSectionFailure(validation, value) {
  if (!['malformed_or_thin_section', 'briefing_markdown_too_short', 'briefing_word_count_too_short'].includes(validation?.reason)) {
    return false;
  }
  if (!structurallyComplete(value)) return false;
  const failures = thinSectionFailures(value);
  if (!failures.length) return false;
  return failures.every((failure) => !failure.structurally_invalid && failure.words_needed > 0);
}

function nearPassBriefingGap(validation) {
  if (validation?.reason === 'briefing_markdown_too_short') {
    const gap = Math.max(0, (validation.minimum_characters || 0) - (validation.actual_characters || 0));
    return gap > 0 && gap <= NEAR_PASS_CHARACTER_GAP
      ? { type: 'character_gap', value: gap }
      : null;
  }

  if (validation?.reason === 'briefing_word_count_too_short') {
    const gap = Math.max(0, (validation.minimum_words || 0) - (validation.actual_words || 0));
    return gap > 0 && gap <= NEAR_PASS_WORD_GAP
      ? { type: 'word_gap', value: gap }
      : null;
  }

  if (validation?.reason === 'malformed_or_thin_section') {
    const gap = Math.max(0, (validation.minimum_words || 0) - (validation.actual_words || 0));
    return gap > 0 && gap <= NARROW_SECTION_WORD_GAP
      ? { type: 'section_word_gap', value: gap }
      : null;
  }

  return null;
}

function isNearPassingBriefing(validation, candidate) {
  if (!structurallyComplete(candidate)) return false;
  if (!Array.isArray(candidate?.sections) || !candidate.sections.length) return false;
  if (validation?.reason === 'missing_required_keys') return false;
  return Boolean(nearPassBriefingGap(validation));
}

function underLengthBriefingGap(validation) {
  if (validation?.reason === 'briefing_word_count_too_short') {
    const gap = Math.max(0, (validation.minimum_words || 0) - (validation.actual_words || 0));
    return gap > 0 && gap <= UNDER_LENGTH_WORD_GAP
      ? { type: 'word_gap', value: gap }
      : null;
  }

  if (validation?.reason === 'briefing_markdown_too_short') {
    const gap = Math.max(0, (validation.minimum_characters || 0) - (validation.actual_characters || 0));
    return gap > 0 && gap <= UNDER_LENGTH_CHARACTER_GAP
      ? { type: 'character_gap', value: gap }
      : null;
  }

  return null;
}

function briefingLengthGap(validation) {
  if (validation?.reason === 'briefing_word_count_too_short') {
    return {
      type: 'word_gap',
      value: Math.max(0, (validation.minimum_words || 0) - (validation.actual_words || 0))
    };
  }

  if (validation?.reason === 'briefing_markdown_too_short') {
    return {
      type: 'character_gap',
      value: Math.max(0, (validation.minimum_characters || 0) - (validation.actual_characters || 0))
    };
  }

  return null;
}

function thinSectionGap(validation) {
  if (validation?.reason !== 'malformed_or_thin_section' || !validation.section) return null;
  const requiredWords = Number(validation.minimum_words || MINIMUM_SECTION_BODY_WORDS);
  const actualBodyWords = Number(validation.actual_body_words ?? validation.actual_words ?? 0);
  const actualCombinedWords = Number(validation.actual_words ?? actualBodyWords);
  const gapWords = Math.max(0, requiredWords - actualCombinedWords);
  if (!gapWords || gapWords > NARROW_SECTION_WORD_GAP) return null;
  return {
    section: validation.section,
    required_words: requiredWords,
    actual_body_words: actualBodyWords,
    actual_combined_words: actualCombinedWords,
    gap_words: gapWords
  };
}

function findThinSections(candidate, limit = MAX_THIN_SECTION_BATCH_SIZE) {
  if (!Array.isArray(candidate?.sections)) return [];

  return candidate.sections
    .map((section) => {
      const counts = sectionWordCount(section);
      const structurallyInvalid =
        !section ||
        typeof section !== 'object' ||
        !section.key ||
        !section.title ||
        typeof section.body !== 'string';

      if (structurallyInvalid) return null;

      const bodyWordGap = Math.max(0, 60 - counts.bodyWords);
      const combinedWordGap = Math.max(0, MINIMUM_SECTION_BODY_WORDS - counts.combinedWords);
      const gapWords = Math.max(bodyWordGap, combinedWordGap);
      if (!gapWords) return null;

      const body = String(section.body || '').trim();
      return {
        section_key: section.key,
        section_title: section.title,
        body_words: counts.bodyWords,
        combined_words: counts.combinedWords,
        required_words: MINIMUM_SECTION_BODY_WORDS,
        gap_words: gapWords,
        body_excerpt: body.length > 700 ? `${body.slice(0, 700)}...` : body
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.gap_words - a.gap_words)
    .slice(0, limit);
}

function isStructurallyCompleteUnderLengthExpansionCandidate(validation, candidate) {
  if (!structurallyComplete(candidate)) return false;
  if (!Array.isArray(candidate?.sections) || !candidate.sections.length) return false;
  if (validation?.reason === 'missing_required_keys') return false;
  return Boolean(underLengthBriefingGap(validation));
}

function findSectionForValidation(candidate, validation) {
  const sectionLabel = String(validation?.section || '').trim();
  if (!sectionLabel || !Array.isArray(candidate?.sections)) return null;
  return candidate.sections.find(
    (section) =>
      section?.key === sectionLabel ||
      section?.title === sectionLabel ||
      sectionTitleFingerprint(section?.key) === sectionTitleFingerprint(sectionLabel) ||
      sectionTitleFingerprint(section?.title) === sectionTitleFingerprint(sectionLabel)
  ) || null;
}

function isStructurallyCompleteThinSectionSupplementCandidate(validation, candidate) {
  if (!structurallyComplete(candidate)) return false;
  if (!Array.isArray(candidate?.sections) || !candidate.sections.length) return false;
  if (validation?.reason === 'missing_required_keys') return false;
  if (!thinSectionGap(validation)) return false;
  return Boolean(findSectionForValidation(candidate, validation));
}

function isStructurallyCompleteBatchThinSectionSupplementCandidate(validation, candidate) {
  if (!structurallyComplete(candidate)) return false;
  if (!Array.isArray(candidate?.sections) || !candidate.sections.length) return false;
  if (validation?.reason === 'missing_required_keys') return false;
  if (validation?.reason !== 'malformed_or_thin_section') return false;
  return findThinSections(candidate).length > 0;
}

function shouldAttemptBriefingRepair(validation) {
  return [
    'briefing_markdown_too_short',
    'briefing_word_count_too_short',
    'malformed_or_thin_section'
  ].includes(validation?.reason);
}

function compactForRepair(value, maxLength = 36000) {
  const body = JSON.stringify(value ?? {}, null, 2);
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength)}\n[TRUNCATED ${body.length - maxLength} CHARACTERS]`;
}

function sectionLengthSummary(value) {
  if (!Array.isArray(value?.sections)) return [];
  return value.sections
    .map((section) => ({
      key: section?.key || null,
      title: section?.title || null,
      body_words: sectionWordCount(section).bodyWords,
      combined_words: sectionWordCount(section).combinedWords
    }))
    .sort((a, b) => a.body_words - b.body_words)
    .slice(0, 8);
}

function sectionExcerpts(value) {
  if (!Array.isArray(value?.sections)) return [];
  return value.sections.map((section) => {
    const body = String(section?.body || '').trim();
    return {
      key: section?.key || null,
      title: section?.title || null,
      body_words: sectionWordCount(section).bodyWords,
      excerpt: body.length > 700 ? `${body.slice(0, 700)}...` : body
    };
  });
}

function supplementalExpansionPlan(validation) {
  const gap = underLengthBriefingGap(validation);
  if (gap?.type === 'word_gap') {
    return {
      ...gap,
      requestedWords: Math.min(1000, Math.max(750, gap.value + 500)),
      minimumAppendTextWords: SUPPLEMENTAL_PROMPT_MIN_APPEND_TEXT_WORDS
    };
  }

  if (gap?.type === 'character_gap') {
    return {
      ...gap,
      requestedWords: 650,
      minimumAppendTextWords: SUPPLEMENTAL_PROMPT_MIN_APPEND_TEXT_WORDS
    };
  }

  return {
    type: null,
    value: null,
    requestedWords: 750,
    minimumAppendTextWords: SUPPLEMENTAL_PROMPT_MIN_APPEND_TEXT_WORDS
  };
}

function secondSupplementalExpansionCandidate(validation, candidate, attemptsUsed) {
  if (attemptsUsed >= 2) return false;
  if (!structurallyComplete(candidate)) return false;
  if (!Array.isArray(candidate?.sections) || !candidate.sections.length) return false;
  const gap = briefingLengthGap(validation);
  if (gap?.type === 'word_gap') return gap.value > 0 && gap.value <= UNDER_LENGTH_WORD_GAP;
  if (gap?.type === 'character_gap') return gap.value > 0 && gap.value <= SECOND_SUPPLEMENTAL_CHARACTER_GAP;
  return false;
}

function isDeterministicCloseGapCandidate(validation, candidate) {
  if (!structurallyComplete(candidate)) return false;
  if (!Array.isArray(candidate?.sections) || !candidate.sections.length) return false;
  if (validation?.reason === 'missing_required_keys') return false;

  const gap = briefingLengthGap(validation);
  if (gap?.type === 'word_gap') {
    return gap.value > 0 && gap.value <= DETERMINISTIC_CLOSE_GAP_WORD_GAP;
  }
  if (gap?.type === 'character_gap') {
    return gap.value > 0 && gap.value <= DETERMINISTIC_CLOSE_GAP_CHARACTER_GAP;
  }
  return false;
}

function findSectionForDeterministicCloseGap(candidate) {
  const priority = [
    'executive_readout',
    'primary_constraint',
    'behavioral_reality_applied_to_business',
    'relationship_database_reality',
    'accountability_reality',
    'preliminary_one_move_direction'
  ];
  const sections = Array.isArray(candidate?.sections) ? candidate.sections : [];
  for (const key of priority) {
    const section = sections.find((item) => item?.key === key);
    if (section) return section;
  }

  return sections
    .filter((section) => section?.key && typeof section.body === 'string')
    .sort((a, b) => sectionWordCount(a).bodyWords - sectionWordCount(b).bodyWords)[0] || null;
}

function displayTextFromValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map(displayTextFromValue).filter(Boolean).slice(0, 4).join('; ');
  }
  if (typeof value === 'object') {
    return firstNonEmpty(
      value.summary,
      value.constraint,
      value.signal,
      value.level,
      value.label,
      value.title,
      value.description,
      value.interpretation
    );
  }
  return '';
}

function firstNonEmpty(...values) {
  return values
    .map(displayTextFromValue)
    .find(Boolean) || '';
}

function buildDeterministicDiagnosticExpansion({ candidate, businessDraft }) {
  const primaryConstraint = firstNonEmpty(
    candidate?.primary_constraint_snapshot?.summary,
    candidate?.primary_constraint_snapshot?.constraint,
    candidate?.primary_constraint_snapshot,
    businessDraft?.constraint_analysis?.primary_constraint,
    businessDraft?.primary_constraint
  );
  const trajectory = firstNonEmpty(
    candidate?.current_trajectory_signal?.summary,
    candidate?.current_trajectory_signal?.signal,
    candidate?.current_trajectory_signal,
    businessDraft?.current_stage?.stage,
    businessDraft?.trajectory?.current_signal
  );
  const confidence = firstNonEmpty(
    candidate?.confidence_snapshot?.summary,
    candidate?.confidence_snapshot?.level,
    candidate?.confidence_snapshot,
    businessDraft?.confidence?.level
  );
  const missingData = Array.isArray(candidate?.missing_data)
    ? candidate.missing_data.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4).join('; ')
    : firstNonEmpty(candidate?.missing_data, businessDraft?.missing_data);

  const constraintSentence = primaryConstraint
    ? `The clearest constraint already named in the diagnostic is ${primaryConstraint}.`
    : 'The clearest constraint is the gap between the business the owner is trying to build and the operating rhythm currently visible in the evidence.';
  const trajectorySentence = trajectory
    ? `The current trajectory signal is ${trajectory}.`
    : 'The current trajectory should be read as a continuation of the existing operating pattern unless the leading activities become more visible and inspectable.';
  const confidenceSentence = confidence
    ? `The confidence picture is ${confidence}, which means the recommendation should be used as an operating hypothesis to inspect weekly rather than as a static label.`
    : 'The confidence picture depends on the owner turning the most important leading indicators into observable weekly facts.';
  const missingDataSentence = missingData
    ? `The missing or partial evidence still matters: ${missingData}.`
    : 'Where data is still missing, the business should treat that absence as operational evidence because unclear numbers make it harder to know which activity is working.';

  return [
    [
      `${constraintSentence} ${trajectorySentence}`,
      'That matters because the next stage of the business will not be created only by more effort; it will be created by a tighter connection between relationship activity, follow-up discipline, appointment creation, and visible review.',
      'When those links are left informal, the owner can still produce results, but the business remains harder to forecast, harder to coach, and harder to improve under pressure.',
      'The practical implication is that the operating system must make the leading behavior visible before the lagging result arrives.',
      'This keeps the diagnostic focused on operating leverage: what is happening repeatedly, what is not being inspected, and what must become measurable before the business can rely on the next level of production.'
    ].join(' '),
    [
      `${missingDataSentence} ${confidenceSentence}`,
      'The strongest next move is therefore not to add complexity, but to make the existing business easier to inspect.',
      'A useful weekly rhythm should clarify which relationships were activated, which opportunities moved forward, which follow-up promises were completed, and which constraints repeated.',
      'That gives the owner a way to separate a temporary activity problem from a structural system problem and creates a cleaner path from current production to the modeled future.',
      'It also protects the business from mistaking confidence, effort, or recent momentum for a repeatable system when the evidence still shows gaps in cadence, accountability, or source-level clarity.'
    ].join(' ')
  ].join('\n\n');
}

function applyDeterministicCloseGapFallback(candidate, validation, context) {
  if (!isDeterministicCloseGapCandidate(validation, candidate)) {
    return { attempted: false };
  }

  const targetSection = findSectionForDeterministicCloseGap(candidate);
  if (!targetSection?.key) {
    return { attempted: false, error: 'deterministic_close_gap_section_missing' };
  }

  const gap = briefingLengthGap(validation);
  const appendText = buildDeterministicDiagnosticExpansion({
    candidate,
    businessDraft: context?.businessDraft,
    assessmentRecord: context?.assessmentRecord
  });
  const merged = {
    ...candidate,
    sections: candidate.sections.map((section) => {
      if (section?.key !== targetSection.key) return section;
      return {
        ...section,
        body: [String(section.body || '').trim(), appendText].filter(Boolean).join('\n\n')
      };
    })
  };
  merged.briefing_markdown = buildBriefingMarkdownFromSections(merged);
  const normalized = normalizeBriefingOutput(merged, {
    assessmentId: context.assessmentId,
    ownerProfileId: context.ownerProfileId,
    prompt: context.prompt
  });
  const validationAfter = validateBriefingOutput(normalized);

  return {
    attempted: true,
    briefing: normalized,
    validation: validationAfter,
    section_key: targetSection.key,
    word_gap_before: gap?.type === 'word_gap' ? gap.value : null,
    character_gap_before: gap?.type === 'character_gap' ? gap.value : null,
    words_added: wordCount(appendText),
    validation_after: validationAfter
  };
}

function buildSupplementalUnderLengthExpansionPrompt(prompt, previousOutput, validation, attemptNumber = 1) {
  const plan = supplementalExpansionPlan(validation);
  return {
    ...prompt,
    messages: [
      {
        role: 'system',
        content: [
          'You are writing a small supplemental expansion for an already-structured MORE MindMap Executive Diagnostic Briefing.',
          'Return valid JSON only. Do not return the full briefing object. Do not use markdown fences.'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          'The Executive Diagnostic Briefing is structurally complete but under the required total length.',
          `Validation failure: ${JSON.stringify(validation)}`,
          plan.type ? `Under-length gap: ${plan.type} = ${plan.value}.` : '',
          `Supplemental attempt number: ${attemptNumber}.`,
          `Shortest sections by body length: ${JSON.stringify(sectionLengthSummary(previousOutput))}`,
          `Current sections and excerpts: ${JSON.stringify(sectionExcerpts(previousOutput))}`,
          'Return only this JSON shape: {"expansions":[{"section_key":"string","append_text":"string"}]}.',
          'section_key must exactly match one of the existing section keys.',
          `Add approximately ${plan.requestedWords} total words across 6-8 append_text values when enough existing sections are available.`,
          'Use exactly one expansion per selected section.',
          `Each append_text must be at least ${plan.minimumAppendTextWords} words.`,
          'Do not use headings.',
          'Do not use bullet lists.',
          'Do not use short summary statements.',
          'Add full diagnostic paragraphs.',
          'Prioritize practical implications, missing-data interpretation, constraint reasoning, business consequences, and why the current trajectory matters.',
          'Also include leadership/accountability implications where relevant.',
          'Preserve all existing conclusions. Do not contradict or rewrite the diagnostic.',
          'Keep the tone professional, direct, and diagnostic.',
          'Do not include markdown fences, raw JSON inside append_text, or headings that duplicate section titles.',
          'Return valid JSON only.'
        ]
          .filter(Boolean)
          .join('\n')
      }
    ]
  };
}

function buildThinSectionSupplementalPrompt(prompt, previousOutput, validation) {
  const gap = thinSectionGap(validation);
  const section = findSectionForValidation(previousOutput, validation);
  const body = String(section?.body || '').trim();
  return {
    ...prompt,
    messages: [
      {
        role: 'system',
        content: [
          'You are writing one supplemental paragraph for an already-structured MORE MindMap Executive Diagnostic Briefing.',
          'Return valid JSON only. Do not return the full briefing object. Do not use markdown fences.'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          'The Executive Diagnostic Briefing is structurally complete and has passed total length, but one section is narrowly under the section-depth requirement.',
          `Validation failure: ${JSON.stringify(validation)}`,
          gap ? `Thin section gap: ${JSON.stringify(gap)}.` : '',
          `Target section key: ${section?.key || validation.section}.`,
          `Target section title: ${section?.title || validation.section}.`,
          `Current target section body excerpt: ${body.length > 1200 ? `${body.slice(0, 1200)}...` : body}`,
          'Return only this JSON shape: {"expansions":[{"section_key":"string","append_text":"string"}]}.',
          `section_key must be exactly "${section?.key || validation.section}".`,
          'Return exactly one expansion.',
          'append_text must be one diagnostic paragraph of 90-140 words.',
          'Do not use headings.',
          'Do not use bullet lists.',
          'Do not use short summary statements.',
          'Expand practical implications, business consequence, and behavioral/operating impact of this section.',
          'Preserve all existing conclusions. Do not contradict or rewrite the diagnostic.',
          'Keep the tone professional, direct, and diagnostic.',
          'Do not include markdown fences, raw JSON inside append_text, or headings that duplicate section titles.',
          'Return valid JSON only.'
        ]
          .filter(Boolean)
          .join('\n')
      }
    ]
  };
}

function buildBatchThinSectionSupplementalPrompt(prompt, validation, thinSections) {
  return {
    ...prompt,
    messages: [
      {
        role: 'system',
        content: [
          'You are writing supplemental diagnostic paragraphs for an already-structured MORE MindMap Executive Diagnostic Briefing.',
          'Return valid JSON only. Do not return the full briefing object. Do not use markdown fences.'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          'The Executive Diagnostic Briefing is structurally complete, but multiple sections are below the section-depth requirement.',
          `Validation failure: ${JSON.stringify(validation)}`,
          `Thin sections to repair: ${JSON.stringify(thinSections)}`,
          'Return only this JSON shape: {"expansions":[{"section_key":"string","append_text":"string"}]}.',
          'Repair every listed thin section.',
          'Provide exactly one expansion per listed section.',
          'section_key must exactly match one of the provided section_key values.',
          'Each append_text must be 90-140 words.',
          'Do not use headings.',
          'Do not use bullet lists.',
          'Do not use short summaries.',
          'Use diagnostic paragraph style.',
          'Expand practical implications, business consequences, behavioral/operating impact, accountability implications, and why the section matters to the business trajectory.',
          'Preserve all existing conclusions. Do not contradict or rewrite the diagnostic.',
          'Do not return the full Executive Diagnostic object.',
          'Do not include markdown fences, raw JSON inside append_text, or headings that duplicate section titles.',
          'Return valid JSON only.'
        ]
          .filter(Boolean)
          .join('\n')
      }
    ]
  };
}

function invalidSupplementalText(value, minimumWords = SUPPLEMENTAL_MIN_APPEND_TEXT_WORDS) {
  const body = String(value || '').trim();
  if (!body) return true;
  if (/```/.test(body)) return true;
  if (/^\s*[{[]/.test(body)) return true;
  if (/"expansions"\s*:/.test(body)) return true;
  if (wordCount(body) < minimumWords) return true;
  return false;
}

function applySupplementalUnderLengthExpansions(candidate, parsedExpansion, options = {}) {
  const minimumAppendTextWords = options.minimumAppendTextWords || SUPPLEMENTAL_MIN_APPEND_TEXT_WORDS;
  if (!parsedExpansion || typeof parsedExpansion !== 'object' || Array.isArray(parsedExpansion)) {
    return { ok: false, error: 'supplemental_expansion_not_object', expansions_count: 0 };
  }

  const expansions = parsedExpansion.expansions;
  if (!Array.isArray(expansions) || !expansions.length) {
    return { ok: false, error: 'supplemental_expansions_missing', expansions_count: 0 };
  }

  const sectionKeys = new Set((candidate.sections || []).map((section) => section?.key).filter(Boolean));
  const accepted = [];
  for (const expansion of expansions) {
    const sectionKey = String(expansion?.section_key || '').trim();
    const appendText = String(expansion?.append_text || '').trim();
    if (!sectionKeys.has(sectionKey)) continue;
    if (invalidSupplementalText(appendText, minimumAppendTextWords)) continue;
    accepted.push({ section_key: sectionKey, append_text: appendText });
  }

  if (!accepted.length) {
    return {
      ok: false,
      error: 'no_valid_supplemental_expansions',
      expansions_count: expansions.length
    };
  }

  const merged = {
    ...candidate,
    sections: candidate.sections.map((section) => {
      const additions = accepted
        .filter((expansion) => expansion.section_key === section.key)
        .map((expansion) => expansion.append_text);
      if (!additions.length) return section;
      return {
        ...section,
        body: [String(section.body || '').trim(), ...additions].filter(Boolean).join('\n\n')
      };
    })
  };
  merged.briefing_markdown = buildBriefingMarkdownFromSections(merged);

  return {
    ok: true,
    merged,
    expansions_count: accepted.length,
    submitted_expansions_count: expansions.length,
    accepted_expansion_words_total: accepted.reduce(
      (total, expansion) => total + wordCount(expansion.append_text),
      0
    ),
    rejected_expansions_count: expansions.length - accepted.length
  };
}

function buildTargetedSectionExpansionPrompt(prompt, previousOutput, validation) {
  const thinFailures = thinSectionFailures(previousOutput);
  const nearPassGap = nearPassBriefingGap(validation);
  const failingSections = Array.isArray(previousOutput?.sections)
    ? previousOutput.sections.filter((section) =>
        thinFailures.some((failure) => failure.key === section?.key || failure.title === section?.title)
      )
    : [];
  const isNarrowSingleSection =
    thinFailures.length === 1 && thinFailures[0].words_needed <= NARROW_SECTION_WORD_GAP;

  return {
    ...prompt,
    messages: [
      ...prompt.messages,
      {
        role: 'assistant',
        content: compactForRepair(previousOutput)
      },
      {
        role: 'user',
        content: [
          nearPassGap
            ? 'The previous Executive Diagnostic Briefing JSON is structurally complete and very close to passing validation.'
            : isNarrowSingleSection
            ? 'The previous Executive Diagnostic Briefing JSON is structurally complete but one section is narrowly too thin.'
            : 'The previous Executive Diagnostic Briefing JSON is structurally complete but some sections are still too thin after repair.',
          `Validation failure: ${JSON.stringify(validation)}`,
          nearPassGap ? `Near-pass gap: ${nearPassGap.type} = ${nearPassGap.value}.` : '',
          failingSections.length
            ? `Sections that must be expanded: ${failingSections
                .map((section) => `${section.title} (${section.key})`)
                .join('; ')}.`
            : '',
          'Return the FULL corrected Executive Diagnostic Briefing JSON object, not a partial patch.',
          'Preserve every required top-level key exactly: version, generated_at, assessment_id, owner_profile_id, title, audience_type, word_count_target, briefing_markdown, sections, primary_constraint_snapshot, current_trajectory_signal, confidence_snapshot, missing_data, caveats.',
          'Preserve all existing diagnostic conclusions, section order, evidence, and confidence labels.',
          nearPassGap
            ? 'Do not rewrite the whole diagnostic. Add only enough evidence-based diagnostic detail to the weakest or shortest relevant section, caveat, or missing-data explanation to clear the validation gate comfortably.'
            : 'Expand only the listed thin sections enough to comfortably clear the section-depth requirement, adding evidence-based reasoning, implications, and missing-data interpretation.',
          'Each listed section body should be at least 120 words. Do not shorten any other section.',
          'Regenerate briefing_markdown so it reflects the corrected full sections.',
          'Do not remove sections, evidence, confidence labels, snapshots, missing_data, or caveats.',
          'Return valid JSON only. No markdown fences.'
        ]
          .filter(Boolean)
          .join('\n')
      }
    ]
  };
}

function buildRepairPrompt(prompt, previousOutput, validation) {
  return {
    ...prompt,
    messages: [
      ...prompt.messages,
      {
        role: 'assistant',
        content: compactForRepair(previousOutput)
      },
      {
        role: 'user',
        content: [
          'The previous JSON output failed validation for the Executive Diagnostic Briefing.',
          `Validation failure: ${JSON.stringify(validation)}`,
          'Return one corrected complete JSON object with every required top-level key.',
          'Required top-level keys: version, generated_at, assessment_id, owner_profile_id, title, audience_type, word_count_target, briefing_markdown, sections, primary_constraint_snapshot, current_trajectory_signal, confidence_snapshot, missing_data, caveats.',
          'Keep the product name exactly "Executive Diagnostic Briefing".',
          'Do not summarize briefly and do not use placeholder markdown.',
          'The briefing_markdown field must contain the full written briefing, not a pointer to the sections.',
          'The corrected output must be at least 12,000 characters and at least 1,800 words.',
          'Each of the 16 required sections must have a substantial body of at least 120 words.',
          'Preserve the same evidence and diagnostic conclusions, but expand the reasoning, implications, and missing-data explanation where needed.',
          'Return valid JSON only. No markdown fences.'
        ].join('\n')
      }
    ]
  };
}

function validationDiagnostics(validation, candidate, extra = {}) {
  return {
    ...extra,
    validation,
    structurally_complete: structurallyComplete(candidate),
    missing_structural_keys: STRUCTURAL_TOP_LEVEL_KEYS.filter(
      (key) => candidate?.[key] === undefined || candidate?.[key] === null
    ),
    thin_section_failures: thinSectionFailures(candidate)
  };
}

function elapsed(startedAt) {
  return `${Date.now() - startedAt}ms`;
}

function elapsedMs(startedAt) {
  return Date.now() - startedAt;
}

function remainingMs(startedAt) {
  return Math.max(0, BRIEFING_ENDPOINT_TIME_BUDGET_MS - elapsedMs(startedAt));
}

function hasTimeForOpenAICall(
  startedAt,
  minimumBufferMs = BRIEFING_REPAIR_SAFETY_BUFFER_MS,
  timeoutMs = BRIEFING_OPENAI_CALL_TIMEOUT_MS
) {
  return remainingMs(startedAt) > timeoutMs + minimumBufferMs;
}

function timeoutDiagnostics({
  assessmentId,
  ownerProfileId,
  validation,
  startedAt,
  repairAttempts,
  bestStructurallyCompleteBriefing,
  stage
}) {
  return {
    generated_at: new Date().toISOString(),
    reason: 'briefing_generation_time_budget_exceeded',
    stage,
    validation,
    elapsed_ms: elapsedMs(startedAt),
    remaining_ms: remainingMs(startedAt),
    last_validation_reason: validation?.reason || null,
    last_failing_section: validation?.section || null,
    repair_attempts: repairAttempts,
    structurally_complete_candidate_available: Boolean(bestStructurallyCompleteBriefing),
    assessment_id: assessmentId,
    owner_profile_id: ownerProfileId,
    message: 'Generation did not complete before server time budget. Retry can resume from saved draft.'
  };
}

async function saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics) {
  const now = new Date().toISOString();
  await redis.set(
    businessAssessmentKey(assessmentId),
    JSON.stringify({
      ...assessmentRecord,
      updated_at: now,
      metadata: {
        ...(assessmentRecord.metadata || {}),
        last_briefing_generation_error: diagnostics
      }
    })
  );
}

function sendTimeBudgetExceeded(res, diagnostics, assessmentStatus) {
  return res.status(503).json({
    ok: false,
    error: 'briefing_generation_time_budget_exceeded',
    status: assessmentStatus,
    assessment_id: diagnostics.assessment_id,
    owner_profile_id: diagnostics.owner_profile_id,
    diagnostics
  });
}

async function callOpenAIForBriefing(prompt, { timeoutMs = BRIEFING_OPENAI_CALL_TIMEOUT_MS } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'missing_openai_api_key';
    throw error;
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: prompt.messages,
      response_format: { type: 'json_object' },
      max_completion_tokens: 10000
    }),
    signal: controller.signal
  }).catch((error) => {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI call exceeded ${timeoutMs}ms`);
      timeoutError.code = 'openai_call_timeout';
      timeoutError.timeout_ms = timeoutMs;
      throw timeoutError;
    }
    throw error;
  }).finally(() => clearTimeout(timeout));

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('Empty response from OpenAI');
    error.details = data;
    throw error;
  }

  return {
    parsed: extractJsonObject(content),
    model: data.model || MODEL,
    usage: data.usage || null,
    duration_ms: Date.now() - startedAt
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let redis;
  const requestStartedAt = Date.now();
  let activeAssessmentRecord = null;
  let activeAssessmentId = null;
  let activeOwnerProfileId = null;
  try {
    const { assessment_id, owner_profile_id } = req.body || {};

    if (!assessment_id && !owner_profile_id) {
      return res.status(400).json({ ok: false, error: 'missing_assessment_id_or_profile_id' });
    }

    redis = createRedisClient();
    const assessmentId = await resolveAssessmentId(redis, { assessment_id, owner_profile_id });
    activeAssessmentId = assessmentId;

    if (!assessmentId) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found' });
    }

    const rawAssessment = await redis.get(businessAssessmentKey(assessmentId));
    if (!rawAssessment) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found', assessment_id: assessmentId });
    }

    const assessmentRecord = JSON.parse(rawAssessment);
    activeAssessmentRecord = assessmentRecord;
    const ownerProfileId = assessmentRecord.owner_profile_id || owner_profile_id;
    activeOwnerProfileId = ownerProfileId;
    const businessIntelligenceDraft = assessmentRecord.output?.business_intelligence_draft;

    if (!businessIntelligenceDraft) {
      return res.status(409).json({
        ok: false,
        error: 'missing_business_intelligence_draft',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const profileLookup = await getCanonicalProfile(redis, ownerProfileId);
    if (!profileLookup.found) {
      return res.status(404).json({
        ok: false,
        error: 'profile_not_found',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const promptStartedAt = Date.now();
    const prompt = buildExecutiveDiagnosticBriefingPrompt({
      assessmentRecord,
      businessIntelligenceDraft,
      canonicalProfile: profileLookup.dossier,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1
    });
    console.log('[BUSINESS-ASSESSMENT-BRIEFING] Prompt built', {
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      model: MODEL,
      messages_characters: JSON.stringify(prompt.messages).length,
      word_count_target: prompt.word_count_target,
      duration: elapsed(promptStartedAt)
    });

    if (!hasTimeForOpenAICall(requestStartedAt, 0)) {
      const diagnostics = timeoutDiagnostics({
        assessmentId,
        ownerProfileId,
        validation: { valid: false, reason: 'insufficient_time_before_initial_generation' },
        startedAt: requestStartedAt,
        repairAttempts: 0,
        bestStructurallyCompleteBriefing: null,
        stage: 'before_initial_generation'
      });
      await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
      return sendTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
    }

    let generation = await callOpenAIForBriefing(prompt, {
      timeoutMs: BRIEFING_INITIAL_OPENAI_CALL_TIMEOUT_MS
    });
    console.log('[BUSINESS-ASSESSMENT-BRIEFING] OpenAI completed', {
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      model: generation.model,
      duration_ms: generation.duration_ms,
      usage: generation.usage || null
    });
    let briefing = normalizeBriefingOutput(generation.parsed, {
      assessmentId,
      ownerProfileId,
      prompt
    });

    let validation = validateBriefingOutput(briefing);
    let bestStructurallyCompleteBriefing = structurallyComplete(briefing) ? briefing : null;
    const repairDiagnostics = [
      validationDiagnostics(validation, briefing, {
        attempt: 'initial',
        model: generation.model,
        usage: generation.usage || null,
        duration_ms: generation.duration_ms
      })
    ];

    let repairAttempts = 0;
    let underLengthExpansionAttempted = false;
    while (!validation.valid) {
      const repairSource = bestStructurallyCompleteBriefing || briefing;
      const repairSourceValidation = validateBriefingOutput(repairSource);
      const nearPassExpansion = isNearPassingBriefing(repairSourceValidation, repairSource);
      const underLengthExpansion =
        !underLengthExpansionAttempted &&
        isStructurallyCompleteUnderLengthExpansionCandidate(repairSourceValidation, repairSource);
      const targetedRepair =
        !underLengthExpansion &&
        (nearPassExpansion || expandableThinSectionFailure(repairSourceValidation, repairSource));
      const canAttemptStandardRepair = repairAttempts < MAX_REPAIR_ATTEMPTS;

      if (!canAttemptStandardRepair && !underLengthExpansion) {
        break;
      }

      if (!underLengthExpansion && !targetedRepair && !shouldAttemptBriefingRepair(repairSourceValidation)) {
        break;
      }

      repairAttempts += 1;
      if (underLengthExpansion) underLengthExpansionAttempted = true;
      const preExpansionGap = briefingLengthGap(repairSourceValidation);
      const preRepairDiagnostics = validationDiagnostics(repairSourceValidation, repairSource, {
        generated_at: new Date().toISOString(),
        reason: repairSourceValidation.reason,
        stage: underLengthExpansion
          ? 'before_supplemental_under_length_expansion'
          : targetedRepair
          ? 'before_targeted_section_expansion'
          : 'before_general_repair',
        elapsed_ms: elapsedMs(requestStartedAt),
        remaining_ms: remainingMs(requestStartedAt),
        repair_attempts_started: repairAttempts,
        repair_attempts: repairAttempts,
        targeted_section_expansion: targetedRepair,
        near_pass_expansion: nearPassExpansion,
        under_length_supplemental_expansion_candidate: underLengthExpansion,
        under_length_supplemental_expansion_attempted: underLengthExpansion,
        character_gap:
          repairSourceValidation.reason === 'briefing_markdown_too_short'
            ? (underLengthExpansion
                ? underLengthBriefingGap(repairSourceValidation)?.value
                : nearPassBriefingGap(repairSourceValidation)?.value) || null
            : null,
        word_gap:
          repairSourceValidation.reason === 'briefing_word_count_too_short'
            ? (underLengthExpansion
                ? underLengthBriefingGap(repairSourceValidation)?.value
                : nearPassBriefingGap(repairSourceValidation)?.value) || null
            : repairSourceValidation.reason === 'malformed_or_thin_section'
            ? nearPassBriefingGap(repairSourceValidation)?.value || null
            : null,
        targeted_timeout_ms: underLengthExpansion
          ? BRIEFING_SUPPLEMENTAL_EXPANSION_TIMEOUT_MS
          : nearPassExpansion
          ? BRIEFING_TARGETED_EXPANSION_TIMEOUT_MS
          : BRIEFING_OPENAI_CALL_TIMEOUT_MS,
        targeted_safety_buffer_ms: underLengthExpansion
          ? BRIEFING_SUPPLEMENTAL_EXPANSION_SAFETY_BUFFER_MS
          : nearPassExpansion
          ? BRIEFING_TARGETED_EXPANSION_SAFETY_BUFFER_MS
          : BRIEFING_REPAIR_SAFETY_BUFFER_MS,
        supplemental_timeout_ms: underLengthExpansion ? BRIEFING_SUPPLEMENTAL_EXPANSION_TIMEOUT_MS : null,
        supplemental_safety_buffer_ms: underLengthExpansion ? BRIEFING_SUPPLEMENTAL_EXPANSION_SAFETY_BUFFER_MS : null,
        word_gap_before: preExpansionGap?.type === 'word_gap' ? preExpansionGap.value : null,
        character_gap_before: preExpansionGap?.type === 'character_gap' ? preExpansionGap.value : null,
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
      await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, preRepairDiagnostics);

      const callTimeoutMs = underLengthExpansion
        ? BRIEFING_SUPPLEMENTAL_EXPANSION_TIMEOUT_MS
        : nearPassExpansion
        ? BRIEFING_TARGETED_EXPANSION_TIMEOUT_MS
        : BRIEFING_OPENAI_CALL_TIMEOUT_MS;
      const safetyBufferMs = underLengthExpansion
        ? BRIEFING_SUPPLEMENTAL_EXPANSION_SAFETY_BUFFER_MS
        : nearPassExpansion
        ? BRIEFING_TARGETED_EXPANSION_SAFETY_BUFFER_MS
        : BRIEFING_REPAIR_SAFETY_BUFFER_MS;

      if (!hasTimeForOpenAICall(requestStartedAt, safetyBufferMs, callTimeoutMs)) {
        const diagnostics = timeoutDiagnostics({
          assessmentId,
          ownerProfileId,
          validation: repairSourceValidation,
          startedAt: requestStartedAt,
          repairAttempts,
          bestStructurallyCompleteBriefing,
          stage: underLengthExpansion
            ? 'before_supplemental_under_length_expansion'
            : targetedRepair
            ? 'before_targeted_section_expansion'
            : 'before_general_repair'
        });
        diagnostics.near_pass_expansion = nearPassExpansion;
        diagnostics.under_length_supplemental_expansion_candidate = underLengthExpansion;
        diagnostics.under_length_supplemental_expansion_attempted = underLengthExpansion;
        diagnostics.character_gap =
          repairSourceValidation.reason === 'briefing_markdown_too_short'
            ? (underLengthExpansion
                ? underLengthBriefingGap(repairSourceValidation)?.value
                : nearPassBriefingGap(repairSourceValidation)?.value) || null
            : null;
        diagnostics.word_gap =
          repairSourceValidation.reason === 'briefing_word_count_too_short'
            ? (underLengthExpansion
                ? underLengthBriefingGap(repairSourceValidation)?.value
                : nearPassBriefingGap(repairSourceValidation)?.value) || null
            : repairSourceValidation.reason === 'malformed_or_thin_section'
            ? nearPassBriefingGap(repairSourceValidation)?.value || null
            : null;
        diagnostics.targeted_timeout_ms = callTimeoutMs;
        diagnostics.targeted_safety_buffer_ms = safetyBufferMs;
        diagnostics.supplemental_timeout_ms = underLengthExpansion ? BRIEFING_SUPPLEMENTAL_EXPANSION_TIMEOUT_MS : null;
        diagnostics.supplemental_safety_buffer_ms = underLengthExpansion
          ? BRIEFING_SUPPLEMENTAL_EXPANSION_SAFETY_BUFFER_MS
          : null;
        diagnostics.word_gap_before = preExpansionGap?.type === 'word_gap' ? preExpansionGap.value : null;
        diagnostics.character_gap_before = preExpansionGap?.type === 'character_gap' ? preExpansionGap.value : null;
        await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
        return sendTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
      }

      if (underLengthExpansion) {
        let supplementalSource = repairSource;
        let supplementalValidation = repairSourceValidation;
        let supplementalAttemptsUsed = 0;
        let thinSectionSupplementAttempted = false;
        while (true) {
          supplementalAttemptsUsed += 1;
          if (supplementalAttemptsUsed > 1) repairAttempts += 1;
          const supplementalAttemptNumber = supplementalAttemptsUsed;
          const supplementalStage =
            supplementalAttemptNumber === 1
              ? 'before_supplemental_under_length_expansion'
              : 'before_second_supplemental_under_length_expansion';
          const mergeStage =
            supplementalAttemptNumber === 1
              ? 'after_deterministic_under_length_merge'
              : 'after_second_deterministic_under_length_merge';
          const supplementalPlan = supplementalExpansionPlan(supplementalValidation);
          const gapBefore = briefingLengthGap(supplementalValidation);

          if (supplementalAttemptNumber > 1) {
            const beforeSecondDiagnostics = validationDiagnostics(supplementalValidation, supplementalSource, {
              generated_at: new Date().toISOString(),
              reason: supplementalValidation.reason,
              stage: supplementalStage,
              elapsed_ms: elapsedMs(requestStartedAt),
              remaining_ms: remainingMs(requestStartedAt),
              repair_attempts_started: repairAttempts,
              repair_attempts: repairAttempts,
              under_length_supplemental_expansion_candidate: true,
              under_length_supplemental_expansion_attempted: true,
              second_supplemental_expansion_attempted: true,
              supplemental_attempt_number: supplementalAttemptNumber,
              supplemental_expansion_attempts_used: supplementalAttemptsUsed,
              requested_supplemental_words: supplementalPlan.requestedWords,
              minimum_append_text_words: supplementalPlan.minimumAppendTextWords,
              supplemental_timeout_ms: callTimeoutMs,
              supplemental_safety_buffer_ms: safetyBufferMs,
              word_gap_before: gapBefore?.type === 'word_gap' ? gapBefore.value : null,
              character_gap_before: gapBefore?.type === 'character_gap' ? gapBefore.value : null,
              assessment_id: assessmentId,
              owner_profile_id: ownerProfileId
            });
            await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, beforeSecondDiagnostics);
          }

          if (!hasTimeForOpenAICall(requestStartedAt, safetyBufferMs, callTimeoutMs)) {
            const diagnostics = timeoutDiagnostics({
              assessmentId,
              ownerProfileId,
              validation: supplementalValidation,
              startedAt: requestStartedAt,
              repairAttempts,
              bestStructurallyCompleteBriefing,
              stage: supplementalStage
            });
            diagnostics.under_length_supplemental_expansion_candidate = true;
            diagnostics.under_length_supplemental_expansion_attempted = true;
            diagnostics.second_supplemental_expansion_attempted = supplementalAttemptNumber > 1;
            diagnostics.supplemental_attempt_number = supplementalAttemptNumber;
            diagnostics.supplemental_expansion_attempts_used = supplementalAttemptsUsed;
            diagnostics.requested_supplemental_words = supplementalPlan.requestedWords;
            diagnostics.minimum_append_text_words = supplementalPlan.minimumAppendTextWords;
            diagnostics.supplemental_timeout_ms = callTimeoutMs;
            diagnostics.supplemental_safety_buffer_ms = safetyBufferMs;
            diagnostics.word_gap_before = gapBefore?.type === 'word_gap' ? gapBefore.value : null;
            diagnostics.character_gap_before = gapBefore?.type === 'character_gap' ? gapBefore.value : null;
            await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
            return sendTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
          }

          console.log('[BUSINESS-ASSESSMENT-BRIEFING] Requesting supplemental under-length expansion', {
            assessment_id: assessmentId,
            owner_profile_id: ownerProfileId,
            reason: supplementalValidation.reason,
            repair_attempt: repairAttempts,
            supplemental_attempt_number: supplementalAttemptNumber,
            requested_supplemental_words: supplementalPlan.requestedWords,
            gap: gapBefore
          });

          let supplementalGeneration;
          try {
            supplementalGeneration = await callOpenAIForBriefing(
              buildSupplementalUnderLengthExpansionPrompt(
                prompt,
                supplementalSource,
                supplementalValidation,
                supplementalAttemptNumber
              ),
              { timeoutMs: callTimeoutMs }
            );
          } catch (error) {
            if (error?.code === 'openai_call_timeout') {
              const deterministicFallback = applyDeterministicCloseGapFallback(
                supplementalSource,
                supplementalValidation,
                {
                  assessmentId,
                  ownerProfileId,
                  prompt,
                  businessDraft: businessIntelligenceDraft,
                  assessmentRecord
                }
              );
              if (deterministicFallback.attempted) {
                repairDiagnostics.push(
                  validationDiagnostics(deterministicFallback.validation, deterministicFallback.briefing, {
                    attempt: `repair_${repairAttempts}`,
                    stage: 'after_deterministic_close_gap_fallback',
                    deterministic_close_gap_candidate: true,
                    deterministic_close_gap_attempted: true,
                    deterministic_close_gap_section_key: deterministicFallback.section_key,
                    deterministic_close_gap_word_gap_before: deterministicFallback.word_gap_before,
                    deterministic_close_gap_character_gap_before: deterministicFallback.character_gap_before,
                    deterministic_close_gap_words_added: deterministicFallback.words_added,
                    deterministic_close_gap_validation_after: deterministicFallback.validation_after,
                    prior_stage: 'openai_supplemental_expansion_timeout',
                    under_length_supplemental_expansion_candidate: true,
                    under_length_supplemental_expansion_attempted: true,
                    second_supplemental_expansion_attempted: supplementalAttemptNumber > 1,
                    supplemental_attempt_number: supplementalAttemptNumber,
                    supplemental_expansion_attempts_used: supplementalAttemptsUsed,
                    requested_supplemental_words: supplementalPlan.requestedWords,
                    minimum_append_text_words: supplementalPlan.minimumAppendTextWords,
                    supplemental_timeout_ms: callTimeoutMs,
                    supplemental_safety_buffer_ms: safetyBufferMs
                  })
                );
                briefing = deterministicFallback.briefing;
                validation = deterministicFallback.validation;
                bestStructurallyCompleteBriefing = deterministicFallback.briefing;
                break;
              }

              const diagnostics = timeoutDiagnostics({
                assessmentId,
                ownerProfileId,
                validation: {
                  valid: false,
                  reason: 'openai_supplemental_expansion_timeout',
                  timeout_ms: error.timeout_ms
                },
                startedAt: requestStartedAt,
                repairAttempts,
                bestStructurallyCompleteBriefing,
                stage: 'openai_supplemental_expansion_timeout'
              });
              diagnostics.under_length_supplemental_expansion_candidate = true;
              diagnostics.under_length_supplemental_expansion_attempted = true;
              diagnostics.second_supplemental_expansion_attempted = supplementalAttemptNumber > 1;
              diagnostics.supplemental_attempt_number = supplementalAttemptNumber;
              diagnostics.supplemental_expansion_attempts_used = supplementalAttemptsUsed;
              diagnostics.requested_supplemental_words = supplementalPlan.requestedWords;
              diagnostics.minimum_append_text_words = supplementalPlan.minimumAppendTextWords;
              diagnostics.supplemental_timeout_ms = callTimeoutMs;
              diagnostics.supplemental_safety_buffer_ms = safetyBufferMs;
              diagnostics.word_gap_before = gapBefore?.type === 'word_gap' ? gapBefore.value : null;
              diagnostics.character_gap_before = gapBefore?.type === 'character_gap' ? gapBefore.value : null;
              await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
              return sendTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
            }
            throw error;
          }

          const mergeResult = applySupplementalUnderLengthExpansions(
            supplementalSource,
            supplementalGeneration.parsed,
            { minimumAppendTextWords: UNDER_LENGTH_SUPPLEMENTAL_MIN_APPEND_TEXT_WORDS }
          );
          if (!mergeResult.ok) {
            const deterministicFallback = applyDeterministicCloseGapFallback(
              supplementalSource,
              supplementalValidation,
              {
                assessmentId,
                ownerProfileId,
                prompt,
                businessDraft: businessIntelligenceDraft,
                assessmentRecord
              }
            );
            if (deterministicFallback.attempted) {
              repairDiagnostics.push(
                validationDiagnostics(deterministicFallback.validation, deterministicFallback.briefing, {
                  attempt: `repair_${repairAttempts}`,
                  model: supplementalGeneration.model,
                  usage: supplementalGeneration.usage || null,
                  duration_ms: supplementalGeneration.duration_ms,
                  stage: 'after_deterministic_close_gap_fallback',
                  deterministic_close_gap_candidate: true,
                  deterministic_close_gap_attempted: true,
                  deterministic_close_gap_section_key: deterministicFallback.section_key,
                  deterministic_close_gap_word_gap_before: deterministicFallback.word_gap_before,
                  deterministic_close_gap_character_gap_before: deterministicFallback.character_gap_before,
                  deterministic_close_gap_words_added: deterministicFallback.words_added,
                  deterministic_close_gap_validation_after: deterministicFallback.validation_after,
                  prior_stage: mergeStage,
                  prior_supplemental_error: mergeResult.error,
                  under_length_supplemental_expansion_candidate: true,
                  under_length_supplemental_expansion_attempted: true,
                  second_supplemental_expansion_attempted: supplementalAttemptNumber > 1,
                  supplemental_attempt_number: supplementalAttemptNumber,
                  supplemental_expansion_attempts_used: supplementalAttemptsUsed,
                  requested_supplemental_words: supplementalPlan.requestedWords,
                  minimum_append_text_words: supplementalPlan.minimumAppendTextWords,
                  supplemental_timeout_ms: callTimeoutMs,
                  supplemental_safety_buffer_ms: safetyBufferMs,
                  expansions_count: mergeResult.expansions_count
                })
              );
              briefing = deterministicFallback.briefing;
              validation = deterministicFallback.validation;
              bestStructurallyCompleteBriefing = deterministicFallback.briefing;
              generation = supplementalGeneration;
              break;
            }

            validation = {
              valid: false,
              reason: mergeResult.error,
              expansions_count: mergeResult.expansions_count
            };
            repairDiagnostics.push(
              validationDiagnostics(validation, supplementalSource, {
                attempt: `repair_${repairAttempts}`,
                model: supplementalGeneration.model,
                usage: supplementalGeneration.usage || null,
                duration_ms: supplementalGeneration.duration_ms,
                stage: mergeStage,
                under_length_supplemental_expansion_candidate: true,
                under_length_supplemental_expansion_attempted: true,
                second_supplemental_expansion_attempted: supplementalAttemptNumber > 1,
                supplemental_attempt_number: supplementalAttemptNumber,
                supplemental_expansion_attempts_used: supplementalAttemptsUsed,
                requested_supplemental_words: supplementalPlan.requestedWords,
                minimum_append_text_words: supplementalPlan.minimumAppendTextWords,
                supplemental_timeout_ms: callTimeoutMs,
                supplemental_safety_buffer_ms: safetyBufferMs,
                expansions_count: mergeResult.expansions_count,
                accepted_expansion_words_total: mergeResult.accepted_expansion_words_total || null,
                rejected_expansions_count: mergeResult.rejected_expansions_count ?? null,
                word_gap_before: gapBefore?.type === 'word_gap' ? gapBefore.value : null,
                character_gap_before: gapBefore?.type === 'character_gap' ? gapBefore.value : null
              })
            );
            break;
          }

          const mergedBriefing = normalizeBriefingOutput(mergeResult.merged, {
            assessmentId,
            ownerProfileId,
            prompt
          });
          const mergedValidation = validateBriefingOutput(mergedBriefing);
          const postExpansionGap = briefingLengthGap(mergedValidation);
          repairDiagnostics.push(
            validationDiagnostics(mergedValidation, mergedBriefing, {
              attempt: `repair_${repairAttempts}`,
              model: supplementalGeneration.model,
              usage: supplementalGeneration.usage || null,
              duration_ms: supplementalGeneration.duration_ms,
              stage: mergeStage,
              under_length_supplemental_expansion_candidate: true,
              under_length_supplemental_expansion_attempted: true,
              second_supplemental_expansion_attempted: supplementalAttemptNumber > 1,
              supplemental_attempt_number: supplementalAttemptNumber,
              supplemental_expansion_attempts_used: supplementalAttemptsUsed,
              requested_supplemental_words: supplementalPlan.requestedWords,
              minimum_append_text_words: supplementalPlan.minimumAppendTextWords,
              supplemental_timeout_ms: callTimeoutMs,
              supplemental_safety_buffer_ms: safetyBufferMs,
              expansions_count: mergeResult.expansions_count,
              submitted_expansions_count: mergeResult.submitted_expansions_count,
              accepted_expansion_words_total: mergeResult.accepted_expansion_words_total,
              rejected_expansions_count: mergeResult.rejected_expansions_count,
              word_gap_before: gapBefore?.type === 'word_gap' ? gapBefore.value : null,
              character_gap_before: gapBefore?.type === 'character_gap' ? gapBefore.value : null,
              word_gap_after: postExpansionGap?.type === 'word_gap' ? postExpansionGap.value : null,
              character_gap_after: postExpansionGap?.type === 'character_gap' ? postExpansionGap.value : null
            })
          );

          briefing = mergedBriefing;
          validation = mergedValidation;
          bestStructurallyCompleteBriefing = mergedBriefing;
          generation = supplementalGeneration;
          if (validation.valid) break;

          const deterministicFallback = applyDeterministicCloseGapFallback(briefing, validation, {
            assessmentId,
            ownerProfileId,
            prompt,
            businessDraft: businessIntelligenceDraft,
            assessmentRecord
          });
          if (deterministicFallback.attempted) {
            repairDiagnostics.push(
              validationDiagnostics(deterministicFallback.validation, deterministicFallback.briefing, {
                attempt: `repair_${repairAttempts}`,
                model: supplementalGeneration.model,
                usage: supplementalGeneration.usage || null,
                duration_ms: supplementalGeneration.duration_ms,
                stage: 'after_deterministic_close_gap_fallback',
                deterministic_close_gap_candidate: true,
                deterministic_close_gap_attempted: true,
                deterministic_close_gap_section_key: deterministicFallback.section_key,
                deterministic_close_gap_word_gap_before: deterministicFallback.word_gap_before,
                deterministic_close_gap_character_gap_before: deterministicFallback.character_gap_before,
                deterministic_close_gap_words_added: deterministicFallback.words_added,
                deterministic_close_gap_validation_after: deterministicFallback.validation_after,
                prior_stage: mergeStage,
                under_length_supplemental_expansion_candidate: true,
                under_length_supplemental_expansion_attempted: true,
                second_supplemental_expansion_attempted: supplementalAttemptNumber > 1,
                supplemental_attempt_number: supplementalAttemptNumber,
                supplemental_expansion_attempts_used: supplementalAttemptsUsed,
                requested_supplemental_words: supplementalPlan.requestedWords,
                minimum_append_text_words: supplementalPlan.minimumAppendTextWords,
                supplemental_timeout_ms: callTimeoutMs,
                supplemental_safety_buffer_ms: safetyBufferMs,
                word_gap_before: postExpansionGap?.type === 'word_gap' ? postExpansionGap.value : null,
                character_gap_before: postExpansionGap?.type === 'character_gap' ? postExpansionGap.value : null
              })
            );
            briefing = deterministicFallback.briefing;
            validation = deterministicFallback.validation;
            bestStructurallyCompleteBriefing = deterministicFallback.briefing;
            if (validation.valid) break;
            break;
          }

          if (secondSupplementalExpansionCandidate(validation, briefing, supplementalAttemptsUsed)) {
            supplementalSource = briefing;
            supplementalValidation = validation;
            continue;
          }

          if (
            !thinSectionSupplementAttempted &&
            isStructurallyCompleteBatchThinSectionSupplementCandidate(validation, briefing)
          ) {
            thinSectionSupplementAttempted = true;
            repairAttempts += 1;
            const allThinSections = findThinSections(briefing, Number.POSITIVE_INFINITY);
            const requestedThinSections = allThinSections.slice(0, MAX_THIN_SECTION_BATCH_SIZE);
            const thinStage = 'before_batch_thin_section_supplemental_expansion';
            const thinBeforeDiagnostics = validationDiagnostics(validation, briefing, {
              generated_at: new Date().toISOString(),
              reason: validation.reason,
              stage: thinStage,
              elapsed_ms: elapsedMs(requestStartedAt),
              remaining_ms: remainingMs(requestStartedAt),
              repair_attempts_started: repairAttempts,
              repair_attempts: repairAttempts,
              batch_thin_section_supplemental_candidate: true,
              batch_thin_section_supplemental_attempted: true,
              thin_sections_found: allThinSections.length,
              thin_sections_requested: requestedThinSections.length,
              thin_section_keys: requestedThinSections.map((section) => section.section_key),
              thin_section_gaps: requestedThinSections.map((section) => ({
                section_key: section.section_key,
                gap_words: section.gap_words,
                body_words: section.body_words,
                combined_words: section.combined_words,
                required_words: section.required_words
              })),
              thin_section_supplemental_candidate: true,
              thin_section_supplemental_attempted: true,
              thin_section_key: requestedThinSections[0]?.section_key || null,
              thin_section_word_gap: requestedThinSections[0]?.gap_words || null,
              thin_section_actual_body_words: requestedThinSections[0]?.body_words || null,
              thin_section_actual_combined_words: requestedThinSections[0]?.combined_words || null,
              thin_section_required_words: requestedThinSections[0]?.required_words || null,
              supplemental_timeout_ms: callTimeoutMs,
              supplemental_safety_buffer_ms: safetyBufferMs,
              assessment_id: assessmentId,
              owner_profile_id: ownerProfileId
            });
            await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, thinBeforeDiagnostics);

            if (!hasTimeForOpenAICall(requestStartedAt, safetyBufferMs, callTimeoutMs)) {
              const diagnostics = timeoutDiagnostics({
                assessmentId,
                ownerProfileId,
                validation,
                startedAt: requestStartedAt,
                repairAttempts,
                bestStructurallyCompleteBriefing,
                stage: thinStage
              });
              diagnostics.batch_thin_section_supplemental_candidate = true;
              diagnostics.batch_thin_section_supplemental_attempted = true;
              diagnostics.thin_sections_found = allThinSections.length;
              diagnostics.thin_sections_requested = requestedThinSections.length;
              diagnostics.thin_section_keys = requestedThinSections.map((section) => section.section_key);
              diagnostics.thin_section_gaps = requestedThinSections.map((section) => ({
                section_key: section.section_key,
                gap_words: section.gap_words,
                body_words: section.body_words,
                combined_words: section.combined_words,
                required_words: section.required_words
              }));
              diagnostics.thin_section_supplemental_candidate = true;
              diagnostics.thin_section_supplemental_attempted = true;
              diagnostics.thin_section_key = requestedThinSections[0]?.section_key || null;
              diagnostics.thin_section_word_gap = requestedThinSections[0]?.gap_words || null;
              diagnostics.thin_section_actual_body_words = requestedThinSections[0]?.body_words || null;
              diagnostics.thin_section_actual_combined_words = requestedThinSections[0]?.combined_words || null;
              diagnostics.thin_section_required_words = requestedThinSections[0]?.required_words || null;
              diagnostics.supplemental_timeout_ms = callTimeoutMs;
              diagnostics.supplemental_safety_buffer_ms = safetyBufferMs;
              await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
              return sendTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
            }

            console.log('[BUSINESS-ASSESSMENT-BRIEFING] Requesting batch thin-section supplemental expansion', {
              assessment_id: assessmentId,
              owner_profile_id: ownerProfileId,
              repair_attempt: repairAttempts,
              thin_sections_found: allThinSections.length,
              thin_sections_requested: requestedThinSections.length,
              thin_section_keys: requestedThinSections.map((section) => section.section_key)
            });

            let thinGeneration;
            try {
              thinGeneration = await callOpenAIForBriefing(
                buildBatchThinSectionSupplementalPrompt(prompt, validation, requestedThinSections),
                { timeoutMs: callTimeoutMs }
              );
            } catch (error) {
              if (error?.code === 'openai_call_timeout') {
                const diagnostics = timeoutDiagnostics({
                  assessmentId,
                  ownerProfileId,
                  validation: {
                    valid: false,
                    reason: 'openai_thin_section_supplemental_timeout',
                    timeout_ms: error.timeout_ms
                  },
                  startedAt: requestStartedAt,
                  repairAttempts,
                  bestStructurallyCompleteBriefing,
                  stage: 'openai_batch_thin_section_supplemental_timeout'
                });
                diagnostics.batch_thin_section_supplemental_candidate = true;
                diagnostics.batch_thin_section_supplemental_attempted = true;
                diagnostics.thin_sections_found = allThinSections.length;
                diagnostics.thin_sections_requested = requestedThinSections.length;
                diagnostics.thin_section_keys = requestedThinSections.map((section) => section.section_key);
                diagnostics.thin_section_gaps = requestedThinSections.map((section) => ({
                  section_key: section.section_key,
                  gap_words: section.gap_words,
                  body_words: section.body_words,
                  combined_words: section.combined_words,
                  required_words: section.required_words
                }));
                diagnostics.thin_section_supplemental_candidate = true;
                diagnostics.thin_section_supplemental_attempted = true;
                diagnostics.thin_section_key = requestedThinSections[0]?.section_key || null;
                diagnostics.thin_section_word_gap = requestedThinSections[0]?.gap_words || null;
                diagnostics.thin_section_actual_body_words = requestedThinSections[0]?.body_words || null;
                diagnostics.thin_section_actual_combined_words = requestedThinSections[0]?.combined_words || null;
                diagnostics.thin_section_required_words = requestedThinSections[0]?.required_words || null;
                diagnostics.supplemental_timeout_ms = callTimeoutMs;
                diagnostics.supplemental_safety_buffer_ms = safetyBufferMs;
                await saveBriefingFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
                return sendTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
              }
              throw error;
            }

            const thinMergeResult = applySupplementalUnderLengthExpansions(briefing, thinGeneration.parsed);
            if (!thinMergeResult.ok) {
              validation = {
                valid: false,
                reason: thinMergeResult.error,
                expansions_count: thinMergeResult.expansions_count
              };
              repairDiagnostics.push(
                validationDiagnostics(validation, briefing, {
                  attempt: `repair_${repairAttempts}`,
                  model: thinGeneration.model,
                  usage: thinGeneration.usage || null,
                  duration_ms: thinGeneration.duration_ms,
                  stage: 'after_batch_thin_section_deterministic_merge',
                  batch_thin_section_supplemental_candidate: true,
                  batch_thin_section_supplemental_attempted: true,
                  thin_sections_found: allThinSections.length,
                  thin_sections_requested: requestedThinSections.length,
                  thin_section_keys: requestedThinSections.map((section) => section.section_key),
                  thin_section_gaps: requestedThinSections.map((section) => ({
                    section_key: section.section_key,
                    gap_words: section.gap_words,
                    body_words: section.body_words,
                    combined_words: section.combined_words,
                    required_words: section.required_words
                  })),
                  thin_section_supplemental_candidate: true,
                  thin_section_supplemental_attempted: true,
                  thin_section_key: requestedThinSections[0]?.section_key || null,
                  thin_section_word_gap: requestedThinSections[0]?.gap_words || null,
                  thin_section_actual_body_words: requestedThinSections[0]?.body_words || null,
                  thin_section_actual_combined_words: requestedThinSections[0]?.combined_words || null,
                  thin_section_required_words: requestedThinSections[0]?.required_words || null,
                  expansions_count: thinMergeResult.expansions_count,
                  supplemental_timeout_ms: callTimeoutMs,
                  supplemental_safety_buffer_ms: safetyBufferMs
                })
              );
              break;
            }

            const thinMergedBriefing = normalizeBriefingOutput(thinMergeResult.merged, {
              assessmentId,
              ownerProfileId,
              prompt
            });
            const thinMergedValidation = validateBriefingOutput(thinMergedBriefing);
            repairDiagnostics.push(
              validationDiagnostics(thinMergedValidation, thinMergedBriefing, {
                attempt: `repair_${repairAttempts}`,
                model: thinGeneration.model,
                usage: thinGeneration.usage || null,
                duration_ms: thinGeneration.duration_ms,
                stage: 'after_batch_thin_section_deterministic_merge',
                batch_thin_section_supplemental_candidate: true,
                batch_thin_section_supplemental_attempted: true,
                thin_sections_found: allThinSections.length,
                thin_sections_requested: requestedThinSections.length,
                thin_section_keys: requestedThinSections.map((section) => section.section_key),
                thin_section_gaps: requestedThinSections.map((section) => ({
                  section_key: section.section_key,
                  gap_words: section.gap_words,
                  body_words: section.body_words,
                  combined_words: section.combined_words,
                  required_words: section.required_words
                })),
                thin_section_supplemental_candidate: true,
                thin_section_supplemental_attempted: true,
                thin_section_key: requestedThinSections[0]?.section_key || null,
                thin_section_word_gap: requestedThinSections[0]?.gap_words || null,
                thin_section_actual_body_words: requestedThinSections[0]?.body_words || null,
                thin_section_actual_combined_words: requestedThinSections[0]?.combined_words || null,
                thin_section_required_words: requestedThinSections[0]?.required_words || null,
                expansions_count: thinMergeResult.expansions_count,
                submitted_expansions_count: thinMergeResult.submitted_expansions_count,
                supplemental_timeout_ms: callTimeoutMs,
                supplemental_safety_buffer_ms: safetyBufferMs
              })
            );

            briefing = thinMergedBriefing;
            validation = thinMergedValidation;
            bestStructurallyCompleteBriefing = thinMergedBriefing;
            generation = thinGeneration;
            break;
          }

          break;
        }

        if (!validation.valid) break;
        continue;
      }

      const repairPrompt = targetedRepair
        ? buildTargetedSectionExpansionPrompt(prompt, repairSource, repairSourceValidation)
        : buildRepairPrompt(prompt, repairSource, repairSourceValidation);

      console.log('[BUSINESS-ASSESSMENT-BRIEFING] Repairing briefing output', {
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId,
        reason: repairSourceValidation.reason,
        repair_attempt: repairAttempts,
        targeted_section_expansion: targetedRepair,
        near_pass_expansion: nearPassExpansion,
        under_length_expansion: underLengthExpansion
      });
      const repairGeneration = await callOpenAIForBriefing(repairPrompt, {
        timeoutMs: callTimeoutMs
      });
      console.log('[BUSINESS-ASSESSMENT-BRIEFING] Repair OpenAI completed', {
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId,
        model: repairGeneration.model,
        duration_ms: repairGeneration.duration_ms,
        usage: repairGeneration.usage || null,
        repair_attempt: repairAttempts
      });
      const repairedBriefing = normalizeBriefingOutput(repairGeneration.parsed, {
        assessmentId,
        ownerProfileId,
        prompt
      });
      const repairValidation = validateBriefingOutput(repairedBriefing);
      const repairStructurallyComplete = structurallyComplete(repairedBriefing);
      repairDiagnostics.push(
        validationDiagnostics(repairValidation, repairedBriefing, {
          attempt: `repair_${repairAttempts}`,
          model: repairGeneration.model,
          usage: repairGeneration.usage || null,
          duration_ms: repairGeneration.duration_ms,
          targeted_section_expansion: targetedRepair,
          near_pass_expansion: nearPassExpansion,
          character_gap:
            repairSourceValidation.reason === 'briefing_markdown_too_short'
              ? nearPassBriefingGap(repairSourceValidation)?.value || null
              : null,
          word_gap:
            repairSourceValidation.reason === 'briefing_word_count_too_short'
              ? nearPassBriefingGap(repairSourceValidation)?.value || null
              : repairSourceValidation.reason === 'malformed_or_thin_section'
              ? nearPassBriefingGap(repairSourceValidation)?.value || null
              : null,
          targeted_timeout_ms: callTimeoutMs,
          targeted_safety_buffer_ms: safetyBufferMs,
          structurally_worse_than_previous: Boolean(bestStructurallyCompleteBriefing && !repairStructurallyComplete)
        })
      );

      if (repairStructurallyComplete) {
        briefing = repairedBriefing;
        validation = repairValidation;
        bestStructurallyCompleteBriefing = repairedBriefing;
        generation = repairGeneration;
      } else if (bestStructurallyCompleteBriefing) {
        briefing = bestStructurallyCompleteBriefing;
        validation = validateBriefingOutput(bestStructurallyCompleteBriefing);
      } else {
        briefing = repairedBriefing;
        validation = repairValidation;
        generation = repairGeneration;
      }
    }

    if (!validation.valid) {
      const now = new Date().toISOString();
      const latestDiagnostic = repairDiagnostics[repairDiagnostics.length - 1] || null;
      const failureMetadata = {
        ...(assessmentRecord.metadata || {}),
        last_briefing_generation_error: {
          generated_at: now,
          stage: latestDiagnostic?.stage || 'after_briefing_validation',
          validation,
          assessment_id: assessmentId,
          owner_profile_id: ownerProfileId,
          initial_output_structurally_complete: Boolean(repairDiagnostics[0]?.structurally_complete),
          repair_output_structurally_incomplete: repairDiagnostics.some(
            (item) => String(item.attempt || '').startsWith('repair_') && !item.structurally_complete
          ),
          repair_attempts: repairAttempts,
          diagnostics: repairDiagnostics
        }
      };

      await redis.set(
        businessAssessmentKey(assessmentId),
        JSON.stringify({
          ...assessmentRecord,
          updated_at: now,
          metadata: failureMetadata
        })
      );

      return res.status(502).json({
        ok: false,
        error: 'invalid_briefing_output',
        validation,
        diagnostics: {
          stage: latestDiagnostic?.stage || 'after_briefing_validation',
          initial_output_structurally_complete: Boolean(repairDiagnostics[0]?.structurally_complete),
          repair_output_structurally_incomplete: repairDiagnostics.some(
            (item) => String(item.attempt || '').startsWith('repair_') && !item.structurally_complete
          ),
          repair_attempts: repairAttempts,
          attempts: repairDiagnostics
        },
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const now = new Date().toISOString();
    const previousMetadata = assessmentRecord.metadata || {};
    const {
      notes,
      last_briefing_generation_error: _lastBriefingGenerationError,
      ...metadataWithoutStaleBriefingFields
    } = previousMetadata;
    const cleanedMetadata =
      notes === 'Sprint 2 intake only. No intelligence generated.'
        ? metadataWithoutStaleBriefingFields
        : {
            ...metadataWithoutStaleBriefingFields,
            ...(notes ? { notes } : {})
          };
    const updatedRecord = {
      ...assessmentRecord,
      status: 'executive_diagnostic_briefing_ready',
      updated_at: now,
      output: {
        ...(assessmentRecord.output || {}),
        executive_diagnostic_briefing_v1: briefing
      },
      metadata: {
        ...cleanedMetadata,
        briefing_version: BRIEFING_VERSION,
        briefing_generated_at: now,
        briefing_model: generation.model,
        briefing_model_provenance: buildModelProvenance(BRIEFING_ROUTE, generation.model, {
          model_source: briefingModelResolution.model_source,
          cognition_source: 'business_assessment.briefing'
        }),
        briefing_usage: generation.usage,
        briefing_repair_attempts: repairAttempts,
        briefing_repair_diagnostics: repairDiagnostics
      }
    };

    await redis.set(businessAssessmentKey(assessmentId), JSON.stringify(updatedRecord));
    console.log('[BUSINESS-ASSESSMENT-BRIEFING] Saved briefing', {
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      total_duration: elapsed(requestStartedAt)
    });

    return res.status(200).json({
      ok: true,
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      status: 'executive_diagnostic_briefing_ready',
      executive_diagnostic_briefing_v1: briefing
    });
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-BRIEFING] Error:', error);
    if (error?.code === 'openai_call_timeout' && redis && activeAssessmentRecord && activeAssessmentId) {
      const diagnostics = timeoutDiagnostics({
        assessmentId: activeAssessmentId,
        ownerProfileId: activeOwnerProfileId || activeAssessmentRecord.owner_profile_id,
        validation: {
          valid: false,
          reason: 'openai_call_timeout',
          timeout_ms: error.timeout_ms
        },
        startedAt: requestStartedAt,
        repairAttempts: activeAssessmentRecord.metadata?.last_briefing_generation_error?.repair_attempts || 0,
        bestStructurallyCompleteBriefing: null,
        stage: 'openai_call_timeout'
      });
      await saveBriefingFailureMetadata(redis, activeAssessmentRecord, activeAssessmentId, diagnostics);
      return sendTimeBudgetExceeded(res, diagnostics, activeAssessmentRecord.status);
    }

    return res.status(500).json({
      ok: false,
      error: 'briefing_generation_failed',
      detail: error.message || 'Unknown briefing generation error',
      code: error.code,
      status: error.status,
      details: error.details
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}
