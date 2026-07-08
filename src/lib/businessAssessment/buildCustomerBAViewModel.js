/**
 * Production-safe Customer BA view model builder.
 * Technical BA = source of truth. Customer BA = readable comprehension layer.
 * No fixtures, no hardcoded profile IDs, no API/Redis/OpenAI calls, no input mutation.
 */

import { normalizeBusinessVisualArtifactData } from './normalizeBusinessVisualArtifactData.js';
import { hasPremiumFiveFuturesData } from '../../components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx';

export const BA_SHELL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'business-reality', label: 'Your Business Today' },
  { id: 'behavioral-os', label: 'How You Work' },
  { id: 'model-alignment', label: 'Business Fit' },
  { id: 'constraint-reality', label: "What's Holding You Back" },
  { id: 'five-futures', label: 'Where This Is Heading' },
  { id: 'one-move', label: 'Your One Move' },
  { id: 'keep-map-alive', label: 'Keep Your Map Alive' },
  { id: 'visual-dna', label: 'Visual Maps' },
  { id: 'advanced-source', label: 'Technical Source' },
];

export function customerLanguageSections(viewModel) {
  return viewModel?.customer_language_v2?.sections || null;
}

function isPrebuiltCustomerViewModel(input) {
  return Boolean(
    input &&
      typeof input === 'object' &&
      input.person_name &&
      (input.profile_id || input.assessment_id) &&
      (input.customer_language_v2 || input.overview || input.business_reality_summary)
  );
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function textValue(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((item) => textValue(item)).join(', ');
  if (typeof value === 'object') {
    return textValue(
      value.body || value.summary || value.title || value.label || value.headline || value.description,
      fallback
    );
  }
  return String(value);
}

function findBriefingSection(briefing, key) {
  const sections = briefing?.sections || briefing?.section_list || [];
  if (!Array.isArray(sections)) return null;
  return sections.find((section) => section.key === key || section.id === key) || null;
}

function deriveConfidenceSummary(confidenceEngine = {}, missingData = {}) {
  const known = asArray(confidenceEngine.known || confidenceEngine.known_evidence);
  const observed = asArray(confidenceEngine.observed || confidenceEngine.observed_evidence);
  const inferred = asArray(confidenceEngine.inferred || confidenceEngine.inferred_evidence);
  const missing = asArray(
    confidenceEngine.missing || confidenceEngine.missing_data || missingData.confidence_engine_missing
  );
  const score = confidenceEngine.score ?? confidenceEngine.confidence_score ?? null;
  const band = confidenceEngine.band || confidenceEngine.confidence_band || 'unknown';

  return {
    band,
    score: Number.isFinite(score) ? score : null,
    known_count: known.length,
    observed_count: observed.length,
    inferred_count: inferred.length,
    missing_count: missing.length,
    headline:
      confidenceEngine.headline ||
      confidenceEngine.summary ||
      `${band} confidence — evidence mix includes known, observed, inferred, and missing fields.`,
  };
}

function derivePremiumFuturesEligibility(output = {}, profileId = '') {
  const normalized = normalizeBusinessVisualArtifactData({
    assessment: { output },
    profileId,
  });
  const premiumEligible = hasPremiumFiveFuturesData(normalized);
  const missing = [];

  const futures = output.five_futures_v1?.futures;
  const oneMove = output.one_move_v1;

  if (!Array.isArray(futures) || futures.length < 5) {
    missing.push('five_futures_v1.futures (5 futures required)');
  }
  if (!oneMove?.title) missing.push('one_move_v1.title');
  if (!oneMove?.root_constraint && !oneMove?.rootConstraint) missing.push('one_move_v1.root_constraint');
  if (!oneMove?.recommendation) missing.push('one_move_v1.recommendation');
  if (!oneMove?.probability_shift && !oneMove?.probabilityShift && !oneMove?.modeled_shift) {
    missing.push('one_move_v1.probability_shift / modeled_shift');
  }
  const proofSignals = oneMove?.proof_signals || oneMove?.success_indicators || oneMove?.successIndicators;
  if (!asArray(proofSignals).length) missing.push('one_move_v1.proof_signals');

  const encodedProfileId = encodeURIComponent(profileId || '');
  const premiumRoute = encodedProfileId
    ? `/business-assessment/five-futures?id=${encodedProfileId}&renderer=premium`
    : '/business-assessment/five-futures?renderer=premium';

  return {
    title: 'Five Futures + One Move',
    subtitle: 'Future Consequence Map / Trajectory Field',
    purpose:
      'This visual shows where the business is headed if nothing changes, which better futures are possible, and the One Move most likely to shift the path.',
    route: premiumRoute,
    route_auto: encodedProfileId
      ? `/business-assessment/five-futures?id=${encodedProfileId}&renderer=auto`
      : '/business-assessment/five-futures?renderer=auto',
    renderer_preference: 'premium',
    premium_eligible: premiumEligible,
    legacy_fallback_used_as_success: false,
    missing_premium_fields: premiumEligible ? [] : missing,
    new_five_futures_visual_selected: premiumEligible,
    source: 'stored_five_futures_v1_and_one_move_v1',
    provenance: {
      futures_count: Array.isArray(futures) ? futures.length : 0,
      probability_total: futures?.reduce((sum, f) => sum + (Number(f.probability) || 0), 0) || null,
      one_move_title: oneMove?.title || null,
      one_move_root_constraint_present: Boolean(oneMove?.root_constraint || oneMove?.rootConstraint),
      one_move_recommendation_present: Boolean(oneMove?.recommendation),
      one_move_modeled_shift_present: Boolean(
        oneMove?.probability_shift || oneMove?.probabilityShift || oneMove?.modeled_shift
      ),
      one_move_proof_signals_present: Boolean(asArray(proofSignals).length),
      complete_for_premium: premiumEligible,
    },
    lab_checks: {
      premium_renderer_preferred: true,
      fallback_allowed_only_as_error_boundary: true,
      renderer_auto_selects_premium_when_eligible: true,
    },
  };
}

function deriveVisualDna(output = {}, profileId = '') {
  const encodedProfileId = encodeURIComponent(profileId || '');
  const visualMapRoute = encodedProfileId
    ? `/business-assessment/visual-map?id=${encodedProfileId}`
    : '/business-assessment/visual-map';
  const fiveFuturesOneMove = derivePremiumFuturesEligibility(output, profileId);

  return {
    business_assessment_map: {
      title: 'Business Assessment Map',
      subtitle: 'Business Reality Map / BA DNA',
      purpose:
        'This map shows how the business is currently working: relationships, follow-up, systems, constraints, and the pattern behind the results.',
      route: visualMapRoute,
      data_status: output.business_intelligence_draft ? 'available' : 'unavailable',
      source: 'stored_business_intelligence_draft_and_executive_diagnostic_briefing',
    },
    five_futures_one_move: fiveFuturesOneMove,
  };
}

function deriveFiveFuturesCards(fiveFutures = {}) {
  const futures = fiveFutures.futures || [];
  return futures.map((future) => ({
    key: future.key || future.id,
    label: future.label || future.key,
    title: future.title,
    probability: future.probability,
    status: future.status,
    summary: future.summary || future.short_interpretation,
    short_interpretation: future.short_interpretation,
    behavioral_modifier: asArray(future.behavioral_modifier || future.behavioral_drivers),
    business_drivers: asArray(future.business_drivers),
    confidence: future.confidence,
  }));
}

function deriveOneMoveCard(oneMove = {}) {
  return {
    title: oneMove.title,
    recommendation: oneMove.recommendation,
    why_this_move: oneMove.why_this_move || oneMove.whyThisMove,
    why_now: oneMove.why_now || oneMove.whyNow,
    behavior_fit: oneMove.behavior_fit || oneMove.behaviorFit,
    first_30_days: asArray(oneMove.first_30_days || oneMove.first30Days),
    proof_signals: asArray(oneMove.proof_signals || oneMove.success_indicators || oneMove.successIndicators),
    adoption_risks: asArray(oneMove.adoption_risks || oneMove.adoptionRisks),
    confidence: oneMove.confidence,
  };
}

function deriveModelProvenance(output = {}, assessment = {}) {
  const provenance = output.model_provenance || assessment.model_provenance || {};
  return {
    briefing_lab: {
      model: provenance.briefing?.model || output.executive_diagnostic_briefing_v1?.model || 'stored',
      mission: provenance.briefing?.mission || 'stored_baseline',
      scope: provenance.briefing?.scope || 'executive_diagnostic_briefing',
    },
    five_futures: {
      model: provenance.five_futures?.model || output.five_futures_v1?.model || 'stored',
      scope: provenance.five_futures?.scope || 'stored_five_futures_v1',
    },
    one_move: {
      model: provenance.one_move?.model || output.one_move_v1?.model || 'stored',
      scope: provenance.one_move?.scope || 'stored_one_move_v1',
    },
    business_intelligence_draft: {
      model: provenance.business_intelligence_draft?.model || 'deterministic_intake_fusion',
      scope: provenance.business_intelligence_draft?.scope || 'intake_plus_profile_fusion',
    },
  };
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = textValue(value, '').trim();
    if (text) return text;
  }
  return '';
}

/**
 * Resolve customer/person name from retrieve, assessment, and optional profile context.
 * Falls back to "Business owner" only when no real name field exists in the source.
 */
function extractPersonName(retrieve = {}, assessment = {}, profile = {}) {
  const output = assessment.output || retrieve.output || {};
  const profileContext = assessment.profile_context || retrieve.profile_context || {};
  const inputs = assessment.inputs || retrieve.inputs || {};
  const intake = inputs.intake || assessment.intake || retrieve.intake || {};
  const answers = inputs.answers || assessment.answers || retrieve.answers || {};
  const canonicalProfile =
    retrieve.canonical_profile || profile.canonical_profile || assessment.canonical_profile || {};
  const profileSnapshot =
    retrieve.profile_snapshot || assessment.profile_snapshot || profile.profile_snapshot || {};
  const metadata =
    retrieve.metadata ||
    assessment.metadata ||
    profile.metadata ||
    canonicalProfile.metadata ||
    canonicalProfile.profile_metadata ||
    {};
  const customerProfile = retrieve.customer_profile || profile.customer_profile || {};
  const owner = retrieve.owner || profile.owner || assessment.owner || {};
  const contact = retrieve.contact || profile.contact || assessment.contact || {};
  const preAssessmentIdentity =
    retrieve.pre_assessment_identity || assessment.pre_assessment_identity || {};
  const businessAssessment = retrieve.business_assessment || assessment.business_assessment || {};

  const firstLast = [
    intake.first_name || metadata.first_name || owner.first_name,
    intake.last_name || metadata.last_name || owner.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    firstNonEmptyString(
      profile.person_name,
      profile.name,
      profile.display_name,
      profile.full_name,
      profile.fullName,
      retrieve.person_name,
      retrieve.owner_profile_name,
      retrieve.customer_name,
      retrieve.owner_name,
      retrieve.profile_name,
      assessment.person_name,
      assessment.customer_name,
      assessment.owner_name,
      assessment.profile_name,
      profileContext.owner_profile_name,
      profileContext.person_name,
      profileContext.full_name,
      profileContext.name,
      businessAssessment.owner_name,
      businessAssessment.profile_name,
      output.owner_name,
      output.profile_name,
      output.person_name,
      customerProfile.full_name,
      customerProfile.name,
      customerProfile.person_name,
      canonicalProfile.full_name,
      canonicalProfile.person_name,
      canonicalProfile.name,
      profileSnapshot.full_name,
      profileSnapshot.name,
      profileSnapshot.person_name,
      owner.full_name,
      owner.name,
      contact.name,
      intake.full_name,
      intake.name,
      answers?.full_name?.answer_text,
      answers?.name?.answer_text,
      preAssessmentIdentity.full_name,
      preAssessmentIdentity.name,
      metadata.full_name,
      metadata.person_name,
      metadata.name,
      firstLast
    ) || 'Business owner'
  );
}

function deriveAdvancedSourceRefs(output = {}, assessment = {}, profileId = '') {
  const briefing = output.executive_diagnostic_briefing_v1;
  const bid = output.business_intelligence_draft;
  const futures = output.five_futures_v1;
  const oneMove = output.one_move_v1;

  return {
    executive_diagnostic_briefing: {
      source: briefing?.source || 'stored',
      model: briefing?.model || 'stored',
      generated_at: briefing?.generated_at || null,
      section_count: briefing?.sections?.length || briefing?.section_list?.length || null,
    },
    business_intelligence_draft: {
      version: bid?.version || 'business_intelligence_draft_v1',
      generated_at: bid?.generated_at || null,
    },
    five_futures_v1: {
      version: futures?.version || 'five_futures_v1',
      generated_at: futures?.generated_at || null,
      probability_total: futures?.futures?.reduce((sum, f) => sum + (Number(f.probability) || 0), 0) || null,
    },
    one_move_v1: {
      version: oneMove?.version || 'one_move_v1',
      generated_at: oneMove?.generated_at || null,
    },
    profile_canonical: {
      profile_id: profileId || assessment.owner_profile_id || null,
      assessment_version: assessment.assessment_version || assessment.version || null,
    },
  };
}

function buildFromRetrieve(retrieve = {}, profile = {}) {
  const assessment = retrieve.assessment || retrieve;
  const output = assessment.output || retrieve.output || {};
  const briefing = output.executive_diagnostic_briefing_v1 || retrieve.briefing || null;
  const bid = output.business_intelligence_draft || {};
  const profileContext = assessment.profile_context || retrieve.profile_context || {};
  const profileId =
    retrieve.owner_profile_id ||
    assessment.owner_profile_id ||
    profileContext.owner_profile_id ||
    profile.profile_id ||
    profile.id ||
    retrieve.profileId ||
    '';
  const assessmentId = assessment.assessment_id || retrieve.assessment_id || null;
  const personName = extractPersonName(retrieve, assessment, profile);

  const primaryConstraintSection = findBriefingSection(briefing, 'primary_constraint');
  const behavioralSection = findBriefingSection(briefing, 'behavioral_reality_applied_to_business');
  const currentRealitySection = findBriefingSection(briefing, 'current_business_reality');
  const confidenceEngine = output.confidence_engine || bid.confidence_engine || {};

  const missingFinancial = asArray(
    bid.missing_financial_data || bid.financial_reality?.missing_financial_data || confidenceEngine.missing
  );

  const confidenceSummary = deriveConfidenceSummary(confidenceEngine, {
    confidence_engine_missing: missingFinancial,
  });

  const primaryConstraint = bid.primary_constraint || bid.constraint_analysis?.primary_constraint || {};

  return {
    view_model_version: 'customer_ba_view_model_production_v1',
    person_name: personName,
    profile_id: profileId,
    assessment_id: assessmentId,
    identity: {
      name: personName,
      profile_id: profileId,
      assessment_id: assessmentId,
    },
    person: {
      name: personName,
    },
    status: output.five_futures_v1 && output.one_move_v1 ? 'five_futures_and_one_move_ready' : 'partial',
    primary_constraint: {
      key: primaryConstraint.key || primaryConstraint.constraint_key,
      label: primaryConstraint.label || primaryConstraint.constraint_key,
      score: primaryConstraint.score,
      confidence: primaryConstraint.confidence,
      summary: textValue(primaryConstraint.summary || primaryConstraintSection?.body),
      effect_if_unchanged: textValue(primaryConstraint.effect_if_unchanged),
      symptoms: asArray(primaryConstraint.symptoms || primaryConstraint.evidence),
      root_cause: textValue(primaryConstraint.root_cause),
    },
    confidence_summary: confidenceSummary,
    missing_data: {
      financial: missingFinancial,
      confidence_engine_missing: asArray(confidenceEngine.missing),
      customer_note:
        bid.missing_data_note ||
        confidenceEngine.customer_note ||
        'Some financial and conversion detail may be incomplete. This briefing is an operating diagnostic, not a complete financial model.',
    },
    overview: {
      what_this_assessment_is_really_saying: textValue(
        findBriefingSection(briefing, 'executive_summary')?.body ||
          briefing?.executive_summary ||
          currentRealitySection?.body
      ),
      doctrine_fusion_line: 'Business reality + personality reality + future consequence',
      one_move_teaser: textValue(output.one_move_v1?.title),
      confidence_band: confidenceSummary.band,
    },
    business_reality_summary: {
      stage: textValue(bid.current_stage?.stage || bid.current_stage?.label),
      headline: textValue(currentRealitySection?.title || bid.current_stage?.description),
      leads: textValue(findBriefingSection(briefing, 'lead_generation_reality')?.body),
      database: textValue(findBriefingSection(briefing, 'relationship_database_reality')?.body),
      systems: textValue(findBriefingSection(briefing, 'systems_reality')?.body),
      financial: textValue(findBriefingSection(briefing, 'financial_reality')?.body),
      accountability: textValue(findBriefingSection(briefing, 'accountability_reality')?.body),
      growth_constraint: textValue(primaryConstraint.label || primaryConstraint.constraint_key),
      sections: {
        leads: findBriefingSection(briefing, 'lead_generation_reality'),
        database: findBriefingSection(briefing, 'relationship_database_reality'),
        systems: findBriefingSection(briefing, 'systems_reality'),
        financial: findBriefingSection(briefing, 'financial_reality'),
        accountability: findBriefingSection(briefing, 'accountability_reality'),
      },
    },
    behavioral_reality_summary: {
      profile_type: textValue(bid.behavioral_reality?.profile_type || profile.profile_type),
      top_dimensions: asArray(bid.behavioral_reality?.ranked_dimensions || profile.ranked_dimensions).slice(0, 3),
      low_dimensions: asArray(bid.behavioral_reality?.low_dimensions || profile.low_dimensions).slice(0, 2),
      headline: textValue(behavioralSection?.body || bid.behavior_business_fusion?.fusion_summary),
      helps_business: asArray(bid.behavior_business_fusion?.helps_business || bid.behavioral_reality?.helps_business),
      distorts_business: asArray(
        bid.behavior_business_fusion?.distorts_business || bid.behavioral_reality?.distorts_business
      ),
      behavior_to_business: textValue(behavioralSection?.body),
      section: behavioralSection,
    },
    business_model_alignment_summary: {
      headline: textValue(currentRealitySection?.body || bid.current_stage?.description),
      relationship_asset: textValue(bid.relationship_reality?.lake_health || bid.relationship_asset_strength),
      lead_generation: textValue(bid.lead_generation_reality?.summary),
      crm_follow_up: textValue(bid.lead_conversion_reality?.summary),
      financial_discipline: textValue(bid.financial_reality?.summary),
      systems_accountability: textValue(
        bid.systems_reality?.overall_maturity_score || bid.accountability_reality?.maturity_label
      ),
      section: currentRealitySection,
    },
    constraint_summary: {
      primary: {
        key: primaryConstraint.key || primaryConstraint.constraint_key,
        label: primaryConstraint.label,
        score: primaryConstraint.score,
        confidence: primaryConstraint.confidence,
        summary: textValue(primaryConstraint.summary || primaryConstraintSection?.body),
        effect_if_unchanged: textValue(primaryConstraint.effect_if_unchanged),
        symptoms: asArray(primaryConstraint.symptoms),
        root_cause: textValue(primaryConstraint.root_cause),
      },
      symptoms_vs_root: {
        symptoms: asArray(primaryConstraint.symptoms),
        root_cause: textValue(primaryConstraint.root_cause),
      },
      if_unchanged: textValue(primaryConstraint.effect_if_unchanged),
      section: primaryConstraintSection,
    },
    five_futures_cards: deriveFiveFuturesCards(output.five_futures_v1),
    one_move_card: deriveOneMoveCard(output.one_move_v1),
    visual_dna: deriveVisualDna(output, profileId),
    visual_dna_cards: [
      {
        id: 'ba_map',
        title: 'Business Assessment Map / BA DNA',
        description: 'Visual map of business reality, constraint, and operating surface.',
        safe_route_ref: `/business-assessment/visual-map?id=${profileId}`,
        route: `/business-assessment/visual-map?id=${profileId}`,
      },
      {
        id: 'five_futures_one_move',
        title: 'Five Futures + One Move Visual',
        description: 'Probability-weighted futures map with One Move intervention anchor.',
        safe_route_ref: `/business-assessment/five-futures?id=${profileId}&renderer=premium`,
        route: `/business-assessment/five-futures?id=${profileId}&renderer=premium`,
        premium_eligible: derivePremiumFuturesEligibility(output, profileId).premium_eligible,
        missing_premium_fields: derivePremiumFuturesEligibility(output, profileId).missing_premium_fields,
      },
    ],
    advanced_source_refs: deriveAdvancedSourceRefs(output, assessment, profileId),
    model_provenance: deriveModelProvenance(output, assessment),
    customer_language_v2: retrieve.customer_language_v2 || output.customer_language_v2 || null,
    shell_tabs: BA_SHELL_TABS,
    source_mutation: false,
    meta: {
      labOnly: false,
      productionSafe: true,
      brandLine: 'MORE MindMap / Business Assessment',
      customerLanguageTarget: retrieve.customer_language_v2?.target_technicality ?? 25,
      universalTranslatorRequired: false,
    },
  };
}

function isStaleVisualDnaCard(card) {
  if (!card) return true;
  if (card.status === 'placeholder_mmb19') return true;
  const route = card.route || card.safe_route_ref || '';
  return !route.includes('?id=') && !route.includes('renderer=premium');
}

function buildVisualDnaCardsFromVisualDna(visualDna = {}) {
  const baMap = visualDna.business_assessment_map || {};
  const ffom = visualDna.five_futures_one_move || {};

  return [
    {
      id: 'ba_map',
      title: baMap.title || 'Business Assessment Map',
      subtitle: baMap.subtitle || 'Business Reality Map / BA DNA',
      description: baMap.purpose,
      route: baMap.route,
      safe_route_ref: baMap.route,
      data_status: baMap.data_status || 'unavailable',
      generation_allowed: false,
    },
    {
      id: 'five_futures_one_move',
      title: ffom.title || 'Five Futures + One Move',
      subtitle: ffom.subtitle || 'Future Consequence Map / Trajectory Field',
      description: ffom.purpose,
      route: ffom.route,
      safe_route_ref: ffom.route,
      renderer_preference: ffom.renderer_preference || 'premium',
      premium_eligible: Boolean(ffom.premium_eligible),
      missing_premium_fields: ffom.missing_premium_fields || [],
      legacy_fallback_used_as_success: ffom.legacy_fallback_used_as_success ?? false,
      generation_allowed: false,
    },
  ];
}

function reconcileVisualDna(sources = {}) {
  const profileId = sources.profile_id || '';
  const encodedProfileId = encodeURIComponent(profileId);
  const output = sources.output || sources.assessment?.output || {};
  const derived = deriveVisualDna(output, profileId);

  let visualDna = {
    ...derived,
    ...(sources.visual_dna || {}),
  };

  if (profileId) {
    visualDna = {
      ...visualDna,
      business_assessment_map: {
        ...visualDna.business_assessment_map,
        route: `/business-assessment/visual-map?id=${encodedProfileId}`,
      },
      five_futures_one_move: visualDna.five_futures_one_move
        ? {
            ...visualDna.five_futures_one_move,
            route: `/business-assessment/five-futures?id=${encodedProfileId}&renderer=premium`,
            route_auto: `/business-assessment/five-futures?id=${encodedProfileId}&renderer=auto`,
            renderer_preference: 'premium',
            legacy_fallback_used_as_success:
              visualDna.five_futures_one_move.legacy_fallback_used_as_success ?? false,
          }
        : visualDna.five_futures_one_move,
    };
  }

  const cards = sources.visual_dna_cards || [];
  const needsCardSync =
    !cards.length || cards.some(isStaleVisualDnaCard) || cards.some((card) => card.premium_eligible === undefined);

  return {
    visual_dna: visualDna,
    visual_dna_cards: needsCardSync ? buildVisualDnaCardsFromVisualDna(visualDna) : cards,
  };
}

function finalizeViewModel(sources) {
  const profileId = sources.profile_id || '';
  const reconciled = reconcileVisualDna(sources);
  const visualDna = reconciled.visual_dna || deriveVisualDna({}, profileId);

  return {
    ...sources,
    shell_tabs: sources.shell_tabs || BA_SHELL_TABS,
    visual_dna: visualDna,
    visual_dna_cards: reconciled.visual_dna_cards || buildVisualDnaCardsFromVisualDna(visualDna),
    meta: {
      labOnly: Boolean(sources.meta?.labOnly),
      productionSafe: true,
      missionId: sources.mission_id || sources.meta?.missionId || null,
      brandLine: 'MORE MindMap / Business Assessment',
      customerLanguageTarget: sources.customer_language_v2?.target_technicality ?? 25,
      universalTranslatorRequired: false,
      ...(sources.meta || {}),
    },
  };
}

/**
 * Build a customer BA view model from a BA retrieve object and optional profile context.
 * Also accepts a pre-built customer view model (e.g. lab fixture payload passed through lab route only).
 */
export function buildCustomerBAViewModel(retrieve = {}, profile = null) {
  if (isPrebuiltCustomerViewModel(retrieve) && !retrieve.assessment && !retrieve.output) {
    return finalizeViewModel(retrieve);
  }

  const profileCtx = profile || retrieve.profile || {};
  const built = buildFromRetrieve(retrieve, profileCtx);

  if (!built.person_name && !built.profile_id && !built.assessment_id) {
    throw new Error('buildCustomerBAViewModel: invalid retrieve payload');
  }

  return finalizeViewModel(built);
}