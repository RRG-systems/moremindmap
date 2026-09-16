import { validateCompleteNewBaRealization } from './completeness.js';
import { NEW_BA_FROZEN_AUTHORITY } from './frozenAuthority.js';
import { assembleBosBaFusionProof } from './fusionAssembler.js';
import { projectNewBaBox1ThroughCassette } from './projectionDispatch.js';
import { normalizeProfileId, sha256Stable } from './stable.js';
import { extractAssessmentMetricSources } from '../../../src/lib/businessEngine/contractDisplaySemantics.js';

const FUTURE_LABELS = Object.freeze({
  current_course: 'Current Course',
  emerging_future: 'Emerging Future',
  better_future: 'Better Future',
  bold_future: 'Bold Future',
  downside_future: 'Downside Future',
});

const DOMAIN_TONES = Object.freeze({
  relationship: 'green', demand: 'blue', pipeline: 'teal', conversion: 'teal', operations: 'violet',
  accountability: 'gold', financial: 'amber', capacity: 'coral', team: 'coral', goals: 'indigo',
  stage: 'indigo', constraints: 'amber', market: 'blue', listing: 'teal', buyer: 'teal', transaction: 'violet',
});

function invariant(condition, code) {
  if (condition) return;
  const error = new Error(code);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function list(value, limit = 6) {
  return [...new Set((Array.isArray(value) ? value : [value]).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))].slice(0, limit);
}

function wholePersonExecutionAdjustments(value, limit = 6) {
  return [...new Set((Array.isArray(value) ? value : [value])
    .filter((item) => item && typeof item === 'object' && item.business_truth_changed === false)
    .map((item) => item.execution_adjustment)
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim()))].slice(0, limit);
}

function sentence(value, fallback = 'Not yet established from the governed business evidence.', limit = 220) {
  const normalized = String(value || '').replace(/\s+/gu, ' ').trim();
  if (!normalized) return fallback;
  if (normalized.length <= limit) return normalized;
  const cut = normalized.slice(0, limit);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
  return `${cut.slice(0, boundary > 80 ? boundary : limit).trim()}…`;
}

function titleCase(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function inspector(id, {
  kicker,
  title,
  status = 'Evidence-bound interpretation',
  tone = 'blue',
  meaning,
  why,
  goal,
  helps = [],
  hurts = [],
  connection,
  notice,
  known = [],
  inferred = [],
  missing = [],
  counterevidence = [],
  mindChange = [],
  wholePerson = [],
} = {}) {
  const sections = [
    ['What we know', known],
    ['What we believe is happening', inferred],
    ['What is still missing', missing],
    ['Counterevidence', counterevidence],
    ['What would change our mind', mindChange],
    ['Person × business execution fit', wholePerson],
  ].map(([sectionTitle, items]) => ({ title: sectionTitle, items: list(items, 8) })).filter((section) => section.items.length);
  return deepFreeze({
    id,
    kicker: kicker || title,
    title,
    status,
    tone,
    level1: {
      meaning: sentence(meaning),
      why: sentence(why),
      goal: sentence(goal),
      helps: list(helps),
      hurts: list(hurts),
      connection: sentence(connection),
      notice: sentence(notice),
    },
    level2: sections,
  });
}

function evidenceCategoryCounts(wbm) {
  const claims = wbm.domain_states.flatMap((state) => state.claims || []);
  const known = claims.filter((claim) => ['KNOWN', 'STRONGLY_SUPPORTED'].includes(claim.epistemic_class)).length;
  const inferred = claims.filter((claim) => ['SUPPORTED_HYPOTHESIS', 'TENTATIVE'].includes(claim.epistemic_class)).length;
  const contradicted = (wbm.epistemic_state?.contradictions || []).length;
  const missing = (wbm.epistemic_state?.missing_evidence || []).length;
  return { known: Math.max(1, known), inferred: Math.max(1, inferred), missing: Math.max(1, missing), contradicted };
}

function card(id, label, value, qualifier, inspectorId, tone = 'neutral') {
  return deepFreeze({ id, label, value: sentence(value, 'Not yet measured.', 160), qualifier, tone, inspectorId });
}

function metricDisplay(metric) {
  if (!metric) return null;
  if (metric.range && Number.isFinite(metric.low) && Number.isFinite(metric.high)) {
    return `${metric.estimated ? '~' : ''}${metric.low.toLocaleString('en-US')}–${metric.high.toLocaleString('en-US')}`;
  }
  if (!Number.isFinite(metric.value)) return null;
  return `${metric.estimated ? '~' : ''}${metric.value.toLocaleString('en-US')}`;
}

function explicitMonthlyClosingGoal(answers = {}) {
  const source = `${answers.q2 || ''}\n${answers.q12 || ''}`;
  const patterns = [
    /(?:goal|target|close|closing|closings)[^\d]{0,40}([\d,]+)\s*(?:closings?|transactions?|units?)?\s*(?:\/|per|a)\s*month\b/iu,
    /([\d,]+)\s*(?:closings?|transactions?|units?)\s*(?:\/|per|a)\s*month\b/iu,
    /(?:monthly|each month)[^\d]{0,30}([\d,]+)\s*(?:closings?|transactions?|units?)\b/iu,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const value = Number(String(match?.[1] || '').replaceAll(',', ''));
    if (Number.isFinite(value) && value > 0 && value <= 10_000) return value;
  }
  return null;
}

function governedDisplayMetrics(source) {
  const answers = source.business_evidence?.answers || {};
  const extracted = extractAssessmentMetricSources({ answers });
  const monthlyGoal = explicitMonthlyClosingGoal(answers);
  const annualGoal = metricDisplay(extracted.goalUnits) || (monthlyGoal ? String(monthlyGoal * 12) : null);
  return Object.freeze({
    totalContacts: metricDisplay(extracted.totalContacts),
    trueRelationships: metricDisplay(extracted.currentTrueRelationships),
    currentUnits: metricDisplay(extracted.currentUnits),
    currentVolume: metricDisplay(extracted.currentVolume),
    monthlyGoal: monthlyGoal ? `${monthlyGoal.toLocaleString('en-US')} / month` : null,
    annualGoal,
  });
}

function loTypedDisplay(field, fallback = 'Not measured') {
  if (field?.question_state !== 'ANSWERED') return fallback;
  if (typeof field.value === 'number') return field.value.toLocaleString('en-US');
  if (typeof field.value === 'string') return field.value;
  if (Array.isArray(field.value) && field.value.every(item => typeof item === 'string')) return field.value.join(', ');
  return 'Recorded structured evidence';
}

function loPeriod(field) {
  const period = field?.period_or_not_temporal;
  if (period && typeof period === 'object') return [period.unit, period.start && period.end ? `${period.start} to ${period.end}` : null, period.as_of ? `as of ${period.as_of}` : null].filter(Boolean).join(' · ');
  return typeof period === 'string' ? period.replaceAll('_', ' ').toLowerCase() : 'Observation window not established';
}

function loanOriginatorQuickFacts(source, addInspector) {
  const fields = source.business_evidence.typed_evidence.fields;
  function sourceInspector(id, label, fieldIds, { withheld = false, desired = false } = {}) {
    const selected = fieldIds.map(fieldId => {
      const field = fields[fieldId];
      invariant(field, `new_ba_lo_metric_field_missing:${fieldId}`);
      return { fieldId, field };
    });
    const known = selected.filter(({ field }) => field.question_state === 'ANSWERED').map(({ fieldId, field }) =>
      `${fieldId.replaceAll('_', ' ')}: ${loTypedDisplay(field)}. ${loPeriod(field)}. Customer reported${desired ? ' desired state' : ''}.`);
    const missing = selected.filter(({ field }) => field.question_state !== 'ANSWERED').map(({ fieldId, field }) =>
      `${fieldId.replaceAll('_', ' ')}: ${field.question_state === 'NOT_APPLICABLE' ? 'explicitly not applicable' : 'not established'}. Expected scope: ${loPeriod(field)}.`);
    if (withheld) missing.unshift(`${label} has not been established by an accepted comparable measure or calculation. Supplied inputs do not by themselves establish this result.`);
    const sourceBinding = deepFreeze({
      contract_id: 'lo-quick-fact-evidence-binding-v1',
      profile_id: normalizeProfileId(source.profile_id), assessment_id: source.assessment_id,
      business_evidence_sha256: source.business_evidence.evidence_sha256,
      result_state: withheld ? 'NOT_ESTABLISHED' : desired ? 'CUSTOMER_REPORTED_GOAL' : missing.length ? 'MISSING' : 'CUSTOMER_REPORTED',
      fields: selected.map(({ fieldId, field }) => ({
        field_id: fieldId, source_ref: `business_assessment.inputs.typed_evidence.fields.${fieldId}`,
        question_state: field.question_state, value: field.value,
        definition_id: field.definition_id, period_or_not_temporal: field.period_or_not_temporal,
        subject_scope: field.subject_scope, provenance: field.provenance,
        field_sha256: sha256Stable(field),
      })),
    });
    const entry = inspector(`lo-fact-${id}`, { title: label, kicker: 'Saved Loan Originator assessment',
        status: withheld || missing.length ? 'MISSING' : desired ? 'DESIRED' : 'REPORTED',
        meaning: withheld ? `${label} remains unestablished.` : known.join(' '),
        why: 'This view refers to the specific saved fields supporting this claim.',
        goal: desired ? 'The customer stated this goal; it is not current performance or a commitment to an action.' : 'Keep current facts, desired goals and missing evidence separate.',
        known, missing,
        mindChange: ['A customer-approved correction or comparable observation with the same definition, period and subject scope.'],
        connection: 'These are assessment statements or explicit missing fields, not independent proof of business causes.',
      });
    return addInspector(deepFreeze({
      ...entry,
      level2: entry.level2.map(section => section.title === 'What we know' ? { ...section, items: known } : section.title === 'What is still missing' ? { ...section, items: missing } : section),
      source_binding: sourceBinding,
    }));
  }
  const metric = (id, label, fieldId) => {
    const field = fields[fieldId];
    return card(id, label, loTypedDisplay(field), field?.question_state === 'ANSWERED' ? `Customer reported · ${loPeriod(field)}` : 'Missing governed evidence', sourceInspector(fieldId, label, [fieldId]));
  };
  const goal = fields.goal_target_value?.question_state === 'ANSWERED'
    ? [loTypedDisplay(fields.goal_target_value), loTypedDisplay(fields.goal_unit_currency, 'unit not established')].join(' ')
    : 'Not numerically stated';
  const unestablished = (id, label, value, qualifier, fieldIds) => card(id, label, value, qualifier, sourceInspector(id, label, fieldIds, { withheld: true }));
  return [
    metric('combined-soi-current', 'Funded loans', 'funded_units_12m'),
    metric('attributed-contacts-estimate', 'Funded principal volume', 'funded_volume_12m'),
    metric('top-of-mind-current', 'Opportunity sources', 'osn_sources'),
    card('monthly-closing-goal', 'Customer business goal', goal, `Desired state · ${loPeriod(fields.goal_target_value)}`, sourceInspector('customer-goal', 'Customer business goal', ['goal_metric', 'goal_target_value', 'goal_unit_currency', 'goal_subject_scope'], { desired: true })),
    metric('annual-closing-goal', 'Goal priority', 'goal_priority'),
    metric('current-live-contacts', 'Customer relationship network size', 'crn_meaningful_size'),
    unestablished('current-active-pipeline', 'Comparable opportunity pipeline', 'Not measured', 'Counts, purpose, definition and cohort must be established together', ['funnel_purpose', 'funnel_window', 'funnel_cohort_basis', 'opportunity_count_definition', 'application_count_definition', 'purchase_active_transaction', 'refinance_active_loan', 'close_fund_count_definition']),
    unestablished('relationship-asset-target', 'Required opportunity flow', 'Not modeled from current evidence', 'No governed backsolve has been accepted', ['goal_metric', 'goal_target_value', 'goal_unit_currency', 'funnel_cohort_basis', 'conversion_displayed_derived_rate', 'conversion_affected_scope']),
    unestablished('live-contact-goal-pace', 'Required conversion', 'Not modeled from current evidence', 'No governed conversion requirement has been accepted', ['goal_metric', 'goal_target_value', 'opportunity_count_definition', 'close_fund_count_definition', 'conversion_displayed_derived_rate']),
    unestablished('combined-pipeline-target', 'Required sustainable capacity', 'Not modeled from current evidence', 'Current capacity and required capacity remain distinct', ['goal_target_value', 'work_load', 'sustainable_capacity', 'economic_sustainable_capacity', 'work_ownership_rows']),
  ];
}

function currentState(wbm, domain) {
  const direct = wbm.current_business_reality?.[domain]?.state;
  const state = wbm.domain_states.find((item) => item.domain_id === domain);
  return sentence(direct || state?.claims?.[0]?.meaning || state?.strengths?.[0] || state?.failure_modes?.[0]);
}

function loanOriginatorDomainInterpretations({ source, wbm, inspectors, domainClaimInspectorIds, add, goalState }) {
  const missions = {
    operations: ['LO_CORE_08_RELATIONSHIP_SYSTEMS', 'LO_CORE_10_PLATFORM_CAPABILITY'],
    capacity: ['LO_CORE_09_TEAM_CAPACITY', 'LO_CORE_12_ACCOUNTABILITY_EXECUTION'],
  };
  const evidenceIds = new Set(wbm.source_integrity.evidence_refs);
  return deepFreeze(Object.fromEntries(Object.entries(missions).map(([domain, missionIds]) => {
    // Interpretation custody comes from the full accepted WBM, independently of
    // the eight engines selected for display. Missing claims stay missing.
    const domainMatches = wbm.domain_states
      .map((state, index) => ({ state, index }))
      .filter(({ state }) => state.domain_id === domain);
    invariant(domainMatches.length <= 1, `lo_domain_interpretation_domain_duplicate:${domain}`);
    const domainIndex = domainMatches[0]?.index ?? -1;
    const domainState = domainMatches[0]?.state;
    const claimIndex = domainState?.claims?.findIndex(item => item.meaning?.trim()
      && !['INSUFFICIENT_EVIDENCE', 'ABSTAINED'].includes(item.epistemic_class)) ?? -1;
    const claim = domainState?.claims?.[claimIndex] || null;
    if (claim) invariant(claim.evidence_refs?.length
      && claim.evidence_refs.every(ref => evidenceIds.has(ref)), `lo_domain_interpretation_evidence_invalid:${domain}`);
    const fields = Object.values(source.business_evidence.typed_evidence.fields)
      .filter(field => missionIds.includes(field.mission_id)).sort((a, b) => a.field_id.localeCompare(b.field_id));
    invariant(fields.length > 0, `lo_domain_interpretation_fields_missing:${domain}`);
    invariant(missionIds.every(missionId => fields.some(field => field.mission_id === missionId)),
      `lo_domain_interpretation_mission_fields_missing:${domain}`);
    const inspectorId = claim ? domainClaimInspectorIds.get(`${domainIndex}:${claimIndex}`) : add(inspector(`lo-${domain}-interpretation-unestablished`, {
      title: `${titleCase(domain)} interpretation not established`, status: 'MISSING',
      meaning: `The accepted business model does not establish an ${domain} interpretation.`,
      why: 'Reported business facts and an accepted interpretation are different things.', goal: goalState,
      known: fields.filter(field => field.question_state === 'ANSWERED').map(field => `${titleCase(field.field_id)}: ${loTypedDisplay(field)}. ${loPeriod(field)}.`),
      missing: [`No accepted ${domain} interpretation.`, ...fields.filter(field => field.question_state !== 'ANSWERED').map(field => `${titleCase(field.field_id)}: ${field.question_state === 'NOT_APPLICABLE' ? 'customer marked not applicable' : 'not supplied'}.`)],
    }));
    invariant(inspectorId && inspectors[inspectorId], `lo_domain_interpretation_inspector_missing:${domain}`);
    const binding = deepFreeze({
      contract_id: 'lo-domain-interpretation-binding-v1', domain_id: domain,
      profile_id: normalizeProfileId(source.profile_id), assessment_id: source.assessment_id,
      business_evidence_sha256: source.business_evidence.evidence_sha256,
      whole_business_model_sha256: wbm.state_hash,
      state: claim ? 'ACCEPTED_CLAIM' : 'NOT_ESTABLISHED',
      claim: claim ? structuredClone(claim) : null, claim_sha256: claim ? sha256Stable(claim) : null,
      inspector_id: inspectorId,
      inspector_content_sha256: sha256Stable(inspectors[inspectorId]),
      fields: fields.map(field => ({ field_id: field.field_id, field_sha256: sha256Stable(field), question_state: field.question_state,
        source_ref: `business_assessment.inputs.typed_evidence.fields.${field.field_id}`,
        value: field.value, definition_id: field.definition_id, period_or_not_temporal: field.period_or_not_temporal,
        subject_scope: field.subject_scope, provenance: field.provenance })),
    });
    inspectors[inspectorId] = deepFreeze({ ...inspectors[inspectorId], source_binding: binding });
    return [domain, binding];
  })));
}

function makeSourceViewModel({ source, displayName, wbm, futures, oneMove }) {
  const profileId = normalizeProfileId(source.profile_id);
  invariant(wbm.assessment_identity?.assessment_id === source.assessment_id, 'new_ba_real_profile_wbm_assessment_binding_invalid');
  invariant(String(wbm.assessment_identity?.owner_profile_id).toUpperCase() === profileId, 'new_ba_real_profile_wbm_profile_binding_invalid');
  invariant(futures.whole_business_model_binding?.whole_business_model_hash === wbm.state_hash, 'new_ba_real_profile_futures_wbm_binding_invalid');
  invariant(oneMove.whole_business_model_binding?.hash === wbm.state_hash, 'new_ba_real_profile_move_wbm_binding_invalid');
  invariant(oneMove.five_futures_binding?.hash === futures.artifact_hash, 'new_ba_real_profile_move_futures_binding_invalid');

  const display = sentence(displayName, 'Customer', 60);
  const verticalBinding = source.business_evidence?.vertical_binding;
  const isLoanOriginator = verticalBinding?.vertical_id === 'loan_originator';
  const wholePersonAdjustments = wholePersonExecutionAdjustments(oneMove.whole_person_execution_considerations);
  const goalState = currentState(wbm, 'goals');
  const relationshipState = currentState(wbm, 'relationship');
  const demandState = currentState(wbm, 'demand');
  const operationsState = currentState(wbm, 'operations');
  const capacityState = currentState(wbm, 'capacity');
  const financialState = currentState(wbm, 'financial');
  const missingGoal = (wbm.epistemic_state?.missing_evidence || []).find((item) => item.domain === 'goals');
  const inspectors = {};
  const add = (value) => {
    invariant(value?.id && !inspectors[value.id], `new_ba_real_profile_inspector_duplicate:${value?.id}`);
    inspectors[value.id] = value;
    return value.id;
  };

  const evidenceInspectorIds = wbm.governed_business_evidence.map((evidence, index) => add(inspector(`evidence-${index + 1}`, {
    kicker: `Governed business evidence ${index + 1}`,
    title: titleCase(evidence.domain),
    status: 'Known · operator reported',
    tone: DOMAIN_TONES[evidence.domain] || 'green',
    meaning: evidence.value,
    why: 'This statement is part of the saved Business Assessment and remains distinct from interpretation.',
    goal: goalState,
    known: [evidence.value],
    connection: `Primary business domain: ${titleCase(evidence.domain)}.`,
    notice: 'Customer-reported business evidence is authoritative for what the operator reported; it does not become direct observation or a forecast.',
  })));

  const claimInspectorIds = new Map();
  const domainClaimInspectorIds = new Map();
  wbm.domain_states.forEach((state, stateIndex) => {
    (state.claims || []).forEach((claim, claimIndex) => {
      const id = `domain-${stateIndex + 1}-claim-${claimIndex + 1}`;
      claimInspectorIds.set(claim.claim_id, add(inspector(id, {
        kicker: `${titleCase(state.domain_id)} · ${claim.epistemic_class}`,
        title: sentence(claim.meaning, titleCase(state.domain_id), 100),
        status: claim.epistemic_class,
        tone: DOMAIN_TONES[state.domain_id] || 'blue',
        meaning: claim.meaning,
        why: state.failure_modes?.[0] || state.strengths?.[0],
        goal: goalState,
        helps: state.strengths,
        hurts: state.failure_modes,
        known: claim.epistemic_class === 'KNOWN' ? [claim.meaning] : [],
        inferred: claim.epistemic_class !== 'KNOWN' ? [claim.meaning] : [],
        missing: state.abstentions,
        counterevidence: claim.counterevidence_refs,
        mindChange: [claim.falsifier],
        connection: `This claim belongs to ${titleCase(state.domain_id)} and connects to causal mechanisms only by governed reference.`,
      })));
      domainClaimInspectorIds.set(`${stateIndex}:${claimIndex}`, id);
    });
  });

  const domainInterpretations = isLoanOriginator
    ? loanOriginatorDomainInterpretations({ source, wbm, inspectors, domainClaimInspectorIds, add, goalState })
    : null;

  const mechanismInspectorIds = wbm.causal_model.mechanisms.map((mechanism, index) => add(inspector(`mechanism-${index + 1}`, {
    kicker: `Causal mechanism ${index + 1}`,
    title: sentence(mechanism.underlying_mechanism, `Mechanism ${index + 1}`, 100),
    status: mechanism.epistemic_class,
    tone: 'violet',
    meaning: mechanism.underlying_mechanism,
    why: mechanism.observed_symptom,
    goal: goalState,
    helps: mechanism.causal_chain,
    hurts: mechanism.delayed_effects,
    known: mechanism.evidence_refs,
    inferred: mechanism.causal_chain,
    missing: mechanism.confounds,
    counterevidence: mechanism.counterevidence_refs,
    mindChange: [mechanism.falsifier],
    connection: `Affected domains: ${mechanism.affected_domains.map(titleCase).join(', ')}.`,
  })));

  const constraintInspectorId = add(inspector('governing-constraint', {
    kicker: 'Governing constraint',
    title: sentence(wbm.governing_constraint.candidate, 'Governing constraint', 100),
    status: wbm.governing_constraint.epistemic_class,
    tone: 'amber',
    meaning: wbm.governing_constraint.candidate,
    why: wbm.governing_constraint.why_current_candidate_stronger,
    goal: goalState,
    helps: wbm.assets.map((item) => item.meaning),
    hurts: wbm.vulnerabilities.map((item) => item.meaning),
    known: wbm.governing_constraint.evidence_refs,
    inferred: [wbm.governing_constraint.why_current_candidate_stronger],
    missing: wbm.epistemic_state.missing_evidence.map((item) => item.question),
    counterevidence: wbm.epistemic_state.counterevidence,
    mindChange: [wbm.governing_constraint.falsifier, ...wbm.epistemic_state.mind_change_conditions],
    connection: 'Business causes remain grounded in governed business evidence and WBM mechanisms. Whole-Person authority may modify execution only.',
  }));

  const futureItems = futures.futures.map((future, index) => {
    const inspectorId = add(inspector(`future-${index + 1}`, {
      kicker: `${FUTURE_LABELS[future.future_role]} · conditional trajectory`,
      title: future.title,
      status: future.certainty_support_classification,
      tone: future.future_role,
      meaning: future.business_state_if_realized,
      why: future.state_summary,
      goal: future.conditionality,
      helps: future.leading_indicators,
      hurts: future.risks,
      known: future.supporting_evidence_refs,
      inferred: future.governing_mechanisms,
      missing: future.assumptions,
      counterevidence: future.counterevidence_refs,
      mindChange: future.falsifiers,
      connection: future.trajectory_effect_intent,
    }));
    return deepFreeze({
      id: future.future_id,
      role: future.future_role,
      label: FUTURE_LABELS[future.future_role],
      weight: future.normalized_relative_support_weight,
      title: future.title,
      condition: future.conditionality,
      inspectorId,
    });
  });

  const moveInspectorId = add(inspector('one-move', {
    kicker: 'One Move · deterministic selection',
    title: oneMove.title,
    status: oneMove.certainty_support_classification,
    tone: 'amber',
    meaning: oneMove.intervention,
    why: oneMove.why_now,
    goal: goalState,
    helps: oneMove.success_evidence,
    hurts: oneMove.failure_evidence,
    known: oneMove.supporting_evidence_refs,
    inferred: oneMove.causal_chain,
    missing: oneMove.assumptions,
    counterevidence: oneMove.counterevidence_refs,
    mindChange: [...oneMove.falsifiers, ...oneMove.stop_or_reconsider_conditions],
    wholePerson: wholePersonAdjustments,
    connection: 'The intervention attacks the selected business mechanism; Whole-Person authority modifies execution feasibility only.',
  }));

  const firstStepInspectors = oneMove.bounded_execution_steps.map((step, index) => ({
    text: step,
    inspectorId: add(inspector(`move-step-${index + 1}`, {
      kicker: `Bounded execution step ${index + 1}`,
      title: sentence(step, `Step ${index + 1}`, 100),
      status: 'Future execution step',
      tone: 'blue',
      meaning: step,
      why: oneMove.why_now,
      goal: goalState,
      mindChange: oneMove.stop_or_reconsider_conditions,
      connection: oneMove.execution_definition,
    })),
  }));

  const counts = evidenceCategoryCounts(wbm);
  const displayMetrics = isLoanOriginator ? {} : governedDisplayMetrics(source);
  const categorySpecs = [
    ['known', 'What we know', counts.known, 'Customer-reported or strongly supported business reality.', 'green'],
    ['inferred', 'What we infer', counts.inferred, 'Supported business interpretation, not direct observation.', 'violet'],
    ['missing', 'What is missing', counts.missing, 'Decision-relevant information not yet available.', 'amber'],
    [counts.contradicted ? 'contradicted' : 'uncertain', counts.contradicted ? 'What is contradicted' : 'What is uncertain', counts.contradicted || Math.max(1, wbm.open_questions.length), counts.contradicted ? 'Accepted evidence that does not currently reconcile.' : 'Important areas that remain conditional or unresolved.', 'coral'],
  ];
  const evidenceCategories = categorySpecs.map(([id, label, value, summary, tone]) => ({
    id, label, value,
    summary,
    inspectorId: add(inspector(`evidence-${id}`, {
      kicker: 'Evidence and confidence', title: label, status: label, tone, meaning: summary, why: 'The evidence class is preserved through realization.', goal: goalState,
      known: id === 'known' ? wbm.governed_business_evidence.map((item) => item.value) : [],
      inferred: id === 'inferred' ? wbm.domain_states.flatMap((state) => state.claims || []).filter((claim) => claim.epistemic_class !== 'KNOWN').map((claim) => claim.meaning) : [],
      missing: id === 'missing' ? wbm.epistemic_state.missing_evidence.map((item) => item.question) : [],
      counterevidence: id === 'contradicted' ? wbm.epistemic_state.contradictions : wbm.epistemic_state.counterevidence,
      mindChange: wbm.epistemic_state.mind_change_conditions,
      connection: 'Evidence remains business-domain evidence; BOS remains execution-modifier authority.',
    })),
  }));

  const bosInspectorId = add(inspector('bos-integration', {
    kicker: 'BOS integration', title: 'Whole-Person execution fit', status: 'Execution modifier only', tone: 'green',
    meaning: 'Whole-Person authority is used only to shape feasibility, adoption, communication, role fit, and intervention design.',
    why: 'Personality cannot establish a business condition or replace business evidence.', goal: goalState,
    wholePerson: wholePersonAdjustments,
    connection: 'Business cause authority remains false.', notice: 'No raw BOS scores or private evidence appear in the Business Map.',
  }));
  const livingInspectorId = add(inspector('living-map', {
    kicker: 'Frozen map → living map', title: 'Keep the Business Map current as evidence changes', status: 'Inactive transition', tone: 'blue',
    meaning: 'This assessment is an immutable view of the currently governed business state.', why: 'A later living system can compare new evidence without rewriting this frozen realization.', goal: goalState,
    notice: 'No subscription, tracking, or activation is implied here.',
  }));

  const quickFacts = isLoanOriginator ? loanOriginatorQuickFacts(source, add) : [
    card('combined-soi-current', 'Combined SOI / Contacts', displayMetrics.totalContacts || 'Not measured', displayMetrics.totalContacts ? 'Current / operator reported' : 'Missing current count', evidenceInspectorIds[2] || evidenceInspectorIds[0], 'green'),
    card('attributed-contacts-estimate', 'Current closed units', displayMetrics.currentUnits || 'Not measured', displayMetrics.currentUnits ? 'Current / operator reported' : 'Missing current production count', evidenceInspectorIds[8] || evidenceInspectorIds[0], 'green'),
    card('top-of-mind-current', 'Verified true relationships', displayMetrics.trueRelationships || 'Not measured', displayMetrics.trueRelationships ? 'Current / operator reported' : 'Not separately verified', evidenceInspectorIds[2] || evidenceInspectorIds[0], 'green'),
    card('monthly-closing-goal', displayMetrics.monthlyGoal ? 'Stated monthly closing goal' : 'Stated business goal', displayMetrics.monthlyGoal || 'Qualitative goal', missingGoal ? 'Current goal / corroboration incomplete' : displayMetrics.monthlyGoal ? 'Desired / operator reported' : 'Desired / no numeric monthly target stated', evidenceInspectorIds[1] || evidenceInspectorIds[0], 'indigo'),
    card('annual-closing-goal', 'Stated annual closing goal', displayMetrics.annualGoal || 'Not numerically stated', displayMetrics.annualGoal ? 'Desired / reported or deterministically annualized' : 'Desired / no numeric annual target stated', evidenceInspectorIds[1] || evidenceInspectorIds[0], 'indigo'),
    card('current-live-contacts', 'Current live-contact pace', 'Not measured', 'Missing current operating evidence', evidenceInspectorIds[5] || evidenceInspectorIds[0], 'blue'),
    card('current-active-pipeline', 'Current active pipeline', 'Not measured', 'Missing current pipeline evidence', evidenceInspectorIds[0], 'teal'),
    card('relationship-asset-target', 'Qualified relationship requirement', 'Not modeled from current evidence', 'Goal-supporting model withheld', constraintInspectorId, 'violet'),
    card('live-contact-goal-pace', 'Live-contact requirement', 'Not modeled from current evidence', 'Goal-supporting model withheld', constraintInspectorId, 'blue'),
    card('combined-pipeline-target', 'Active opportunity requirement', 'Not modeled from current evidence', 'Goal-supporting model withheld', constraintInspectorId, 'teal'),
  ];

  const engines = wbm.domain_states.slice(0, 8).map((state, stateIndex) => ({
    id: state.domain_id,
    code: titleCase(state.domain_id).slice(0, 4).toUpperCase(),
    title: titleCase(state.domain_id),
    tone: DOMAIN_TONES[state.domain_id] || 'blue',
    status: state.epistemic_summary || state.claims?.[0]?.epistemic_class || 'Evidence-bound',
    summary: sentence(state.claims?.[0]?.meaning || state.failure_modes?.[0]),
    metrics: (state.claims || []).slice(0, 4).map((claim, claimIndex) => ({ label: sentence(claim.meaning, titleCase(state.domain_id), 80), value: claim.epistemic_class, qualifier: 'Business state', tone: DOMAIN_TONES[state.domain_id] || 'blue', inspectorId: isLoanOriginator ? domainClaimInspectorIds.get(`${stateIndex}:${claimIndex}`) : claimInspectorIds.get(claim.claim_id) })),
    inspectorId: (isLoanOriginator ? domainClaimInspectorIds.get(`${stateIndex}:0`) : claimInspectorIds.get(state.claims?.[0]?.claim_id)) || constraintInspectorId,
  }));

  const firstMechanism = wbm.causal_model.mechanisms[0];
  const moveLogic = [
    { label: "What's holding you back", value: wbm.governing_constraint.candidate, inspectorId: constraintInspectorId },
    { label: "What's causing it", value: firstMechanism?.underlying_mechanism || wbm.governing_constraint.why_current_candidate_stronger, inspectorId: mechanismInspectorIds[0] || constraintInspectorId },
    { label: 'The Move', value: oneMove.intervention, inspectorId: moveInspectorId },
    { label: "What we're testing", value: oneMove.success_evidence?.[0] || oneMove.observation_horizon, inspectorId: moveInspectorId },
  ];

  return deepFreeze({
    identity: { firstName: display, business: `${display}’s ${isLoanOriginator ? 'Loan Origination' : 'Real Estate'} Business`, vertical: isLoanOriginator ? 'Residential Loan Originator' : 'Residential Real Estate' },
    hero: { eyebrow: `${display}’s Business Twin`, title: 'Your business. Quantified. Diagnosed. Designed to move.', subtitle: 'One map. Five destinations. Every decision with confidence.', state: wbm.governing_constraint.epistemic_class },
    nav: ['now', 'why', 'futures', 'move', 'plan', 'evidence'].map((id, index) => ({ id, label: id.toUpperCase(), order: index + 1 })),
    quickFacts,
    businessMap: {
      center: { title: `${display}’s ${isLoanOriginator ? 'Loan Origination' : 'Real Estate'} Business`, model: sentence(wbm.business_model.value_creation, isLoanOriginator ? 'Loan origination business' : 'Real Estate business'), system: sentence(wbm.business_model.leverage), goal: goalState, inspectorId: constraintInspectorId },
      engines,
      trajectory: { value: titleCase(wbm.momentum.direction), label: 'Evidence-bound direction of travel', inspectorId: constraintInspectorId },
      helping: wbm.assets.slice(0, 4).map((item) => ({ label: item.meaning, inspectorId: constraintInspectorId })),
      holding: wbm.vulnerabilities.slice(0, 4).map((item) => ({ label: item.meaning, inspectorId: constraintInspectorId })),
      goalBacksolve: quickFacts.filter((item) => ['monthly-closing-goal', 'annual-closing-goal', 'relationship-asset-target', 'live-contact-goal-pace', 'combined-pipeline-target'].includes(item.id)),
    },
    why: {
      title: wbm.governing_constraint.candidate,
      summary: wbm.governing_constraint.why_current_candidate_stronger,
      whyStronger: wbm.governing_constraint.why_current_candidate_stronger,
      inspectorId: constraintInspectorId,
      chain: list(firstMechanism?.causal_chain, 6),
      mechanisms: wbm.causal_model.mechanisms.map((mechanism, index) => ({ label: mechanism.underlying_mechanism, inspectorId: mechanismInspectorIds[index] })),
      effects: list(wbm.vulnerabilities.map((item) => item.meaning), 6),
      alternatives: wbm.governing_constraint.alternatives.map((item) => item.explanation),
      mindChange: wbm.governing_constraint.falsifier,
    },
    futures: { items: futureItems, graphInspectorId: futureItems[0].inspectorId, semantics: futures.support_semantics, moveRelationship: oneMove.trajectory_effect_intent.map((item) => item.intent).join(' · ') },
    move: {
      title: oneMove.title,
      intervention: oneMove.intervention,
      whyNow: oneMove.why_now,
      inspectorId: moveInspectorId,
      logic: moveLogic,
      firstSteps: firstStepInspectors,
      proof: oneMove.success_evidence.slice(0, 4).map((label) => ({ label, inspectorId: moveInspectorId })),
      failure: oneMove.failure_evidence,
      observation: oneMove.observation_horizon,
      execution: { workflow: oneMove.execution_definition, owner: oneMove.owner_role, firstAction: oneMove.bounded_execution_steps[0], cadence: oneMove.observation_horizon, observation: oneMove.observation_horizon, scorecard: oneMove.leading_indicators },
    },
    plan: {
      objective: goalState,
      steps: oneMove.bounded_execution_steps,
      ownership: oneMove.owner_role,
      prerequisites: oneMove.prerequisites,
      observation: oneMove.observation_horizon,
      cadence: oneMove.observation_horizon,
      scorecard: oneMove.leading_indicators,
      stopConditions: oneMove.stop_or_reconsider_conditions,
      eToP: [],
      wholePerson: wholePersonAdjustments,
    },
    evidence: { categories: evidenceCategories, counterevidence: list(wbm.epistemic_state.counterevidence, 8), mindChanges: list(wbm.epistemic_state.mind_change_conditions, 8) },
    numerical: { headline: 'Business state and goal remain evidence-classified.', explanation: 'No displayed value changes evidence class.', comparisons: [], measurementScorecard: [], systemStandards: [], deeperScenarios: [] },
    bos: { label: 'BOS integrated', headline: 'Whole-Person Authority + Business Reality', boundary: 'Execution modifier only; never a fabricated business cause.', adjustments: wholePersonAdjustments, inspectorId: bosInspectorId },
    livingMap: { headline: 'Keep your Business Map alive as the business changes.', copy: 'This assessment captured the governed business at this moment.', action: 'What a Living Map would mean', inspectorId: livingInspectorId },
    inspectors,
    internal: { profile_id: profileId, assessment_id: source.assessment_id, business_evidence_sha256: source.business_evidence.evidence_sha256,
      ...(isLoanOriginator ? { whole_business_model_sha256: wbm.state_hash } : {}) },
    currentStates: { relationshipState, demandState, operationsState, capacityState, financialState },
    ...(isLoanOriginator ? { verticalBinding, loanOriginator: { typedEvidence: source.business_evidence.typed_evidence, domainInterpretations } } : {}),
  });
}

function buildLineage({ source, wbm, futures, oneMove, projection }) {
  const withoutHash = {
    contract_id: 'real-profile-new-ba-lineage-v1',
    version: '1.0.0',
    profile_id: normalizeProfileId(source.profile_id),
    assessment_id: source.assessment_id,
    business_evidence_sha256: source.business_evidence.evidence_sha256,
    vertical_binding_sha256: source.business_evidence.vertical_binding.binding_sha256,
    vertical_id: source.business_evidence.vertical_binding.vertical_id,
    cassette_id: source.business_evidence.vertical_binding.cassette_id,
    cassette_version: source.business_evidence.vertical_binding.cassette_version,
    bos_authority_sha256: source.bos_authority.sha256,
    bos_fusion_contract_sha256: source.bos_authority.fusion_contract_sha256,
    whole_business_model_sha256: wbm.state_hash,
    five_futures_sha256: futures.artifact_hash,
    one_move_sha256: oneMove.artifact_hash,
    plan_sha256: sha256Stable(projection.plan135),
    customer_projection_sha256: sha256Stable(projection.customerViewModel),
    evidence_boundary: 'BUSINESS_EVIDENCE_AND_WBM_MECHANISMS_ESTABLISH_BUSINESS_CAUSE__BOS_MODIFIES_EXECUTION_ONLY',
    provider_response_direct_publication: false,
  };
  return deepFreeze({ ...withoutHash, lineage_sha256: sha256Stable(withoutHash) });
}

export function buildRealProfileNewBaRealization({ source, displayName, wbm, futures, oneMove, providerAccounting, cassetteRegistry, projectionAdapters }) {
  invariant(providerAccounting?.store === false, 'new_ba_real_profile_store_false_required');
  invariant(Number(providerAccounting?.accepted_calls) === 3, 'new_ba_real_profile_three_accepted_stages_required');
  const sourceViewModel = makeSourceViewModel({ source, displayName, wbm, futures, oneMove });
  const verticalBinding = source.business_evidence.vertical_binding;
  const projection = projectNewBaBox1ThroughCassette({
    registry: cassetteRegistry, adapters: projectionAdapters,
    verticalBinding,
    sourceViewModel,
    bindings: {
      subjectKey: normalizeProfileId(source.profile_id),
      modelDate: source.business_evidence.updated_at || source.business_evidence.created_at,
      ...(verticalBinding.vertical_id === 'loan_originator' ? { verticalId: 'loan_originator' } : {}),
      verticalAuthorityRefs: verticalBinding.vertical_id === 'loan_originator' ? Object.keys(wbm.source_integrity.authority_hashes).filter(id => id.startsWith('loan-originator-intelligence-module-')) : [verticalBinding.cassette_id],
      sourceAuthority: 'REAL_PROFILE_WBM_V1_FIVE_FUTURES_V2_ONE_MOVE_V2',
    },
  });
  const lineage = buildLineage({ source, wbm, futures, oneMove, projection });
  const baseArtifact = {
    contract_id: 'new-ba-production-realization-v2',
    version: '2.0.0',
    profile_id: normalizeProfileId(source.profile_id),
    assessment_id: source.assessment_id,
    source_kind: source.source_kind,
    authority: NEW_BA_FROZEN_AUTHORITY,
    business_reality: wbm,
    five_futures: futures,
    one_move: oneMove,
    plan_135: projection.plan135,
    evidence: sourceViewModel.evidence,
    lineage,
    customer_view_model: projection.customerViewModel,
    internal_trace: projection.internalTrace,
    cassette_binding: projection.cassette_projection,
    provider_accounting: deepFreeze({ ...providerAccounting, model: 'gpt-5.6-sol', store: false, raw_request_persisted: false, raw_response_persisted: false }),
  };
  const artifact = deepFreeze({ ...baseArtifact, fusion: assembleBosBaFusionProof({ source, artifact: baseArtifact }) });
  validateCompleteNewBaRealization(artifact, { profileId: source.profile_id, assessmentId: source.assessment_id });
  return artifact;
}

export { makeSourceViewModel as buildRealProfileSourceViewModel };
