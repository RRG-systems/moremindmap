import { WRITTEN_QUESTIONS } from '../../../api/engine/questionEvidenceRegistry.js';

const ROLE_SIGNAL_RULES = Object.freeze({
  life_direction: [
    ['family_or_relationships', 'family or relationships', ['family', 'children', 'relationship', 'relationships']],
    ['autonomy_or_freedom', 'autonomy or freedom', ['autonomy', 'freedom', 'independence']],
    ['service_or_impact', 'service or impact', ['service', 'serve', 'impact', 'legacy', 'purpose']],
    ['stability_or_security', 'stability or security', ['stability', 'stable', 'security', 'sustainable']],
    ['growth_or_learning', 'growth or learning', ['growth', 'learn', 'learning', 'develop']],
  ],
  setback_response: [
    ['reviewed_evidence', 'reviewed what happened', ['reviewed', 'examined', 'looked at', 'assessed']],
    ['owned_contribution', 'named personal ownership', ['I owned', 'my responsibility', 'I was responsible']],
    ['sought_feedback', 'sought feedback or input', ['asked for feedback', 'asked for input', 'spoke with']],
    ['changed_approach', 'changed the next approach', ['changed', 'adjusted', 'revised', 'different path']],
    ['learned_from_outcome', 'named learning', ['learned', 'lesson', 'realized', 'noticed']],
  ],
  immediate_pressure: [
    ['increases_pace', 'increases pace', ['move faster', 'moves faster', 'speed up', 'accelerate', 'urgency']],
    ['adds_structure', 'adds structure', ['structure', 'organize', 'prioritize', 'plan', 'sequence']],
    ['seeks_input', 'seeks input', ['ask for input', 'asks for input', 'seek input', 'feedback']],
    ['narrows_focus', 'narrows focus', ['focus', 'direct', 'decisive', 'next task']],
    ['withdraws_or_pauses', 'withdraws or pauses', ['withdraw', 'step back', 'pause', 'quiet space']],
  ],
  ambiguity_response: [
    ['gathers_information', 'gathers available information', ['gathered', 'available facts', 'asked questions', 'information']],
    ['makes_bounded_decision', 'makes a bounded decision', ['reversible', 'bounded decision', 'best decision', 'chose', 'decided']],
    ['waits_for_clarity', 'waits for additional clarity', ['waited', 'delay', 'more clarity', 'more information']],
    ['sets_review_point', 'sets a review point', ['review point', 'revisit', 'follow up', 'check back']],
  ],
  leadership_self_assessment: [
    ['sets_direction', 'sets direction', ['direction', 'expectations', 'priorities', 'clarity']],
    ['invites_questions', 'invites questions or input', ['questions', 'input', 'feedback', 'listen']],
    ['delegation_named', 'names delegation', ['delegate', 'delegation', 'ownership']],
    ['development_gap_named', 'names a development gap', ['need to improve', 'working on', 'struggle', 'requires attention']],
  ],
  sustained_pressure: [
    ['process_review', 'reviews process or sequence', ['process', 'sequence', 'system', 'review']],
    ['control_response', 'increases control', ['control', 'take over', 'do it myself', 'tighten']],
    ['relational_friction', 'names relational friction', ['resistance', 'people', 'team', 'conversation', 'conflict']],
    ['avoidance_named', 'names avoidance or delay', ['avoid', 'put off', 'delay', 'longer than']],
    ['frustration_named', 'names frustration', ['frustrated', 'frustrates', 'frustration', 'irritated', 'drain']],
  ],
  misunderstanding_response: [
    ['asks_for_other_view', 'asks what the other person understood', ['ask', 'what they heard', 'their perspective', 'understand']],
    ['clarifies_intent', 'clarifies intent', ['clarify', 'restate', 'explain', 'intent']],
    ['repairs_impact', 'addresses impact', ['impact', 'apologize', 'correct', 'repair']],
    ['withdraws_from_exchange', 'steps away from the exchange', ['walk away', 'leave it', 'revisit later', 'end the conversation']],
  ],
  business_operating_reality: [
    ['sets_direction', 'takes a direction-setting role', ['direction', 'priorities', 'decisions', 'lead']],
    ['organizes_work', 'organizes work', ['organize', 'structure', 'sequence', 'coordinate']],
    ['executes_directly', 'executes directly', ['execute', 'do the work', 'hands on', 'active role']],
    ['relational_role', 'takes a relational role', ['connect', 'relationships', 'people', 'alignment']],
    ['tension_named', 'names operating tension', ['tension', 'unclear', 'friction', 'follow-through']],
  ],
  growth_tension: [
    ['long_term_build', 'names a long-term build', ['long term', 'long-term', 'building', 'build', 'durable']],
    ['values_named', 'names operating values', ['values', 'responsibility', 'service', 'freedom', 'useful']],
    ['sustainability_named', 'names sustainability', ['sustainable', 'durable', 'stability', 'family time']],
    ['growth_named', 'names growth', ['growth', 'scale', 'expand', 'develop']],
  ],
  systems_accountability: [
    ['planning_system', 'uses a planning system', ['plan', 'planning', 'priorities', 'calendar']],
    ['review_cadence', 'uses a review cadence', ['review', 'weekly', 'cadence', 'check-in']],
    ['tool_support', 'uses an operating tool', ['crm', 'tool', 'tracker', 'journal', 'written']],
    ['ownership_structure', 'uses explicit ownership', ['ownership', 'owner', 'accountability', 'responsibility']],
    ['future_strain_named', 'names future strain', ['strain', 'scaling', 'capacity', 'break', 'bottleneck']],
  ],
});

function textFromAnswer(answer) {
  if (typeof answer === 'string') return answer;
  if (!answer || typeof answer !== 'object') return '';
  return String(answer.text ?? answer.answer_text ?? answer.answer ?? answer.value ?? '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termPattern(term) {
  const escaped = escapeRegExp(term).replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`, 'gi');
}

function findMatches(text, terms) {
  const matches = [];
  for (const term of terms) {
    const pattern = termPattern(term);
    const found = text.match(pattern) || [];
    if (found.length > 0) {
      matches.push({ term, count: found.length });
    }
  }
  return matches;
}

function analyzeSignals(role, text) {
  return (ROLE_SIGNAL_RULES[role] || []).flatMap(([signalId, label, terms]) => {
    const matches = findMatches(text, terms);
    if (matches.length === 0) return [];
    return [{
      signal_id: signalId,
      label,
      matched_terms: matches.map(({ term }) => term),
      match_count: matches.reduce((sum, match) => sum + match.count, 0),
    }];
  });
}

function clipExcerpt(text, maxCharacters = 240) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxCharacters) return normalized;
  return `${normalized.slice(0, maxCharacters - 1).trimEnd()}…`;
}

function resolveAnswerSources(canonical) {
  const data = canonical?.canonical_profile_json
    || canonical?.canonical_dossier?.canonical_profile_json
    || canonical
    || {};
  const retained = canonical?.intake_answers || {};
  const nested = data?.intake_answers || {};
  return { retained, nested };
}

export function analyzeWrittenEvidence(canonical) {
  const { retained, nested } = resolveAnswerSources(canonical);
  const questions = {};

  for (const question of WRITTEN_QUESTIONS) {
    const key = `q${question.id}`;
    const retainedText = textFromAnswer(retained[key]);
    const nestedText = textFromAnswer(nested[key]);
    const sourceText = retainedText || nestedText;
    const normalized = sourceText.trim();
    const signals = normalized ? analyzeSignals(question.evidence_role, normalized) : [];

    questions[key] = {
      question_id: question.id,
      evidence_role: question.evidence_role,
      answer_present: normalized.length > 0,
      source_path: retainedText
        ? `intake_answers.${key}.text`
        : nestedText
          ? `canonical_profile_json.intake_answers.${key}.answer_text`
          : null,
      character_count: normalized.length,
      word_count: normalized ? normalized.split(/\s+/).length : 0,
      excerpt: normalized ? clipExcerpt(normalized) : null,
      signals,
      source_text: normalized,
    };
  }

  const entries = Object.values(questions);
  return {
    question_count: entries.length,
    answered_count: entries.filter(({ answer_present }) => answer_present).length,
    signal_count: entries.reduce((sum, entry) => sum + entry.signals.length, 0),
    questions,
  };
}

export function toPublicWrittenEvidence(analysis) {
  return {
    question_count: analysis?.question_count || 0,
    answered_count: analysis?.answered_count || 0,
    signal_count: analysis?.signal_count || 0,
    questions: Object.fromEntries(
      Object.entries(analysis?.questions || {}).map(([key, entry]) => [key, {
        question_id: entry.question_id,
        evidence_role: entry.evidence_role,
        answer_present: entry.answer_present,
        source_path: entry.source_path,
        character_count: entry.character_count,
        word_count: entry.word_count,
        excerpt: entry.excerpt,
        signals: entry.signals,
      }]),
    ),
  };
}

export { ROLE_SIGNAL_RULES };
