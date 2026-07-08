/**
 * Production-safe Customer BA view model builder.
 * Technical BA = source of truth. Customer BA = readable comprehension layer.
 * No fixtures, no hardcoded profile IDs, no API/Redis/OpenAI calls, no input mutation.
 */

import { normalizeBusinessVisualArtifactData } from './normalizeBusinessVisualArtifactData.js';
import { hasPremiumFiveFuturesData } from '../../components/businessAssessment/BusinessAssessmentFiveFuturesPremium.jsx';
import {
  customerDisplayLabel,
  simplifyCustomerCopy,
  mapLabelsForCustomer,
  relationshipAssetCustomerLine,
  systemsMaturityCustomerLine,
  formatDimensionForCustomer,
  unavailableCustomerNote,
  hasRenderableContent,
} from './customerPresentationHelpers.js';

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
    confidenceEngine.missing ||
      confidenceEngine.missing_data ||
      missingData.confidence_engine_missing ||
      missingData.financial
  );
  const score = confidenceEngine.score ?? confidenceEngine.confidence_score ?? null;
  const band = confidenceEngine.band || confidenceEngine.confidence_band || 'unknown';
  const knownLabels = mapLabelsForCustomer(known, { technical: true });
  const observedLabels = mapLabelsForCustomer(observed, { technical: true });
  const inferredLabels = mapLabelsForCustomer(inferred, { technical: true });
  const missingLabels = mapLabelsForCustomer(missing, { technical: true });

  return {
    band,
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    known_count: known.length,
    observed_count: observed.length,
    inferred_count: inferred.length,
    missing_count: missing.length,
    known_raw: known,
    observed_raw: observed,
    inferred_raw: inferred,
    missing_raw: missing,
    known_labels: knownLabels,
    observed_labels: observedLabels,
    inferred_labels: inferredLabels,
    missing_labels: missingLabels,
    what_system_knows: knownLabels.length
      ? knownLabels
      : observedLabels.length
        ? observedLabels
        : [],
    what_system_infers: inferredLabels,
    headline:
      confidenceEngine.headline ||
      confidenceEngine.summary ||
      `${band} confidence — evidence mix includes known, observed, inferred, and missing fields.`,
  };
}

function resolvePrimaryConstraint(bid = {}, primaryConstraintSection = null) {
  const ranked = asArray(bid.constraint_analysis?.ranked_constraints);
  const fromRanked = ranked[0] || null;
  const direct =
    bid.primary_constraint ||
    bid.constraint_analysis?.primary_constraint ||
    fromRanked ||
    {};

  const evidence = asArray(direct.evidence || direct.symptoms);
  const customerSymptoms = mapLabelsForCustomer(
    evidence.map((item) => String(item).replace(/^signal:\s*/i, '')),
    { technical: false }
  ).map((item) => simplifyCustomerCopy(item));

  const label =
    customerDisplayLabel(direct.label || direct.constraint_key || direct.key, { technical: false }) ||
    textValue(direct.label || direct.constraint_key);

  const summarySource = textValue(
    direct.summary || primaryConstraintSection?.body || direct.likely_effect_if_unchanged
  );
  const effectSource = textValue(
    direct.effect_if_unchanged || direct.likely_effect_if_unchanged
  );
  const rootSource = textValue(
    direct.root_cause ||
      (label
        ? `The deeper issue is not effort. It is the missing simple system behind ${label.toLowerCase()}.`
        : '')
  );

  return {
    key: direct.key || direct.constraint_key || null,
    label,
    score: direct.score,
    confidence: direct.confidence,
    summary: simplifyCustomerCopy(summarySource),
    effect_if_unchanged: simplifyCustomerCopy(effectSource),
    symptoms: customerSymptoms.length
      ? customerSymptoms
      : label
        ? [
            'Work still depends too much on the owner',
            'Process is informal or incomplete',
            'Growth increases rework and confusion',
          ]
        : [],
    root_cause: simplifyCustomerCopy(rootSource),
    source_questions_technical: asArray(direct.source_questions),
  };
}

function deriveBehavioralDimensions(behavioralReality = {}, profile = {}) {
  const ranked = asArray(behavioralReality.ranked_dimensions || profile.ranked_dimensions);
  const explicitLow = asArray(behavioralReality.low_dimensions || profile.low_dimensions);
  const sorted = [...ranked].sort((a, b) => Number(a?.score ?? 0) - Number(b?.score ?? 0));
  const top = ranked.slice(0, 3);
  const low = explicitLow.length
    ? explicitLow.slice(0, 3)
    : sorted.slice(0, 2);

  return {
    top_dimensions: top,
    low_dimensions: low,
    top_plain: top.map(formatDimensionForCustomer).filter(Boolean),
    low_plain: low.map(formatDimensionForCustomer).filter(Boolean),
  };
}

function deriveHelpsAndDistorts(bid = {}, behavioralSectionBody = '') {
  const fusion = bid.behavior_business_fusion || {};
  const helps = asArray(
    fusion.helps_business || fusion.strengths || bid.behavioral_reality?.helps_business
  );
  const distorts = asArray(
    fusion.distorts_business || fusion.risks || bid.behavioral_reality?.distorts_business
  );

  const helpsClean = mapLabelsForCustomer(helps, { technical: false }).map(simplifyCustomerCopy);
  const distortsClean = mapLabelsForCustomer(distorts, { technical: false }).map(simplifyCustomerCopy);

  // If fusion only has technical trait names, still keep simplified lines.
  return {
    helps_business: helpsClean,
    distorts_business: distortsClean,
    fusion_summary: simplifyCustomerCopy(textValue(fusion.fusion_summary || behavioralSectionBody)),
  };
}

function deriveLeadGenerationCustomerLine(leadGen = {}, briefingBody = '') {
  const direct = textValue(leadGen.summary || leadGen.stated_generation_behaviors);
  if (direct) return simplifyCustomerCopy(direct);
  if (briefingBody) return simplifyCustomerCopy(briefingBody);
  if (leadGen.lead_shortage_signal) {
    return 'Lead flow looks thinner than needed for the stated goals. Generation still depends too much on personal effort and ad-hoc outreach.';
  }
  return '';
}

function deriveCrmCustomerLine(crm = {}, briefingBody = '') {
  const direct = textValue(crm.summary || crm.follow_up_system_strength);
  if (crm.follow_up_system_strength && /unclear|weak|informal/i.test(String(crm.follow_up_system_strength))) {
    return 'Follow-up and conversion still look informal. There is relationship skill, but not a clear CRM rhythm that runs without personal memory.';
  }
  if (direct && !/^[a-z0-9_]+$/i.test(direct)) return simplifyCustomerCopy(direct);
  if (briefingBody) return simplifyCustomerCopy(briefingBody);
  if (crm.likely_issue) {
    return simplifyCustomerCopy(
      customerDisplayLabel(crm.likely_issue, { technical: false }) || String(crm.likely_issue)
    );
  }
  return '';
}

function deriveFinancialCustomerLine(financial = {}, briefingBody = '') {
  const direct = textValue(financial.summary);
  if (direct) return simplifyCustomerCopy(direct);
  if (briefingBody) return simplifyCustomerCopy(briefingBody);
  const missing = asArray(financial.missing_financial_data);
  if (missing.length) {
    return 'Some production history is present, but key profit, expense, and marketing numbers are still missing. Financial clarity is incomplete.';
  }
  if (financial.financial_clarity) {
    return `Financial clarity looks ${String(financial.financial_clarity).replace(/_/g, ' ')}.`;
  }
  return '';
}

function deriveSystemsAccountabilityLine(bid = {}, briefingBody = '') {
  const score = bid.systems_reality?.overall_maturity_score;
  const maturityLine = systemsMaturityCustomerLine(score);
  if (maturityLine) return maturityLine;
  const label = bid.accountability_reality?.maturity_label;
  if (label) return simplifyCustomerCopy(customerDisplayLabel(label) || String(label));
  if (briefingBody) return simplifyCustomerCopy(briefingBody);
  return '';
}

/**
 * Build presentation-only customer language sections when stored customer_language_v2 is absent.
 * Derived from existing BID/briefing fields; never invents metrics.
 */
function buildPresentationCustomerLanguage(vmCore = {}) {
  const person = vmCore.person_name || 'This owner';
  const constraint = vmCore.primary_constraint || {};
  const overview = vmCore.overview || {};
  const oneMove = vmCore.one_move_card || {};
  const constraintSummary = vmCore.constraint_summary || {};
  const behavioral = vmCore.behavioral_reality_summary || {};
  const model = vmCore.business_model_alignment_summary || {};
  const confidence = vmCore.confidence_summary || {};

  const bottleneck =
    constraint.summary ||
    simplifyCustomerCopy(constraintSummary.primary?.summary) ||
    `${person}'s main bottleneck is that too much of the business still depends on personal effort, memory, and reacting in the moment.`;

  const whyItMatters =
    simplifyCustomerCopy(constraint.effect_if_unchanged) ||
    'This matters because growth without simple systems usually creates more rework, more owner dependency, and less consistent results.';

  const focusFirst =
    simplifyCustomerCopy(oneMove.recommendation || oneMove.title || overview.one_move_teaser) ||
    'Focus first on the main bottleneck above — not on adding more random activity.';

  const oneMovePlain =
    simplifyCustomerCopy(oneMove.title || overview.one_move_teaser || oneMove.recommendation) ||
    focusFirst;

  return {
    target_technicality: 25,
    presentation_derived: true,
    sections: {
      overview: {
        what_assessment_found: simplifyCustomerCopy(overview.what_this_assessment_is_really_saying),
        why_it_matters: whyItMatters,
        focus_first: focusFirst,
        primary_bottleneck_plain: bottleneck,
        one_move_plain: oneMovePlain,
        doctrine_plain: overview.doctrine_fusion_line,
      },
      business_reality: {
        headline: simplifyCustomerCopy(vmCore.business_reality_summary?.headline),
        stage_plain: simplifyCustomerCopy(
          customerDisplayLabel(vmCore.business_reality_summary?.stage) ||
            vmCore.business_reality_summary?.stage
        ),
        leads: simplifyCustomerCopy(vmCore.business_reality_summary?.leads),
        database: simplifyCustomerCopy(vmCore.business_reality_summary?.database),
        systems: simplifyCustomerCopy(vmCore.business_reality_summary?.systems),
        financial: simplifyCustomerCopy(vmCore.business_reality_summary?.financial),
        accountability: simplifyCustomerCopy(vmCore.business_reality_summary?.accountability),
        missing_data_plain: simplifyCustomerCopy(vmCore.missing_data?.customer_note),
      },
      behavioral_os: {
        profile_plain: simplifyCustomerCopy(behavioral.profile_type),
        headline: simplifyCustomerCopy(behavioral.headline),
        helps_business: asArray(behavioral.helps_business),
        gets_in_the_way: asArray(behavioral.distorts_business),
        execution_effect: simplifyCustomerCopy(behavioral.behavior_to_business),
        dimensions_plain: {
          strongest: asArray(behavioral.top_plain).join(' · '),
          weakest: asArray(behavioral.low_plain).join(' · '),
        },
      },
      model_alignment: {
        headline: simplifyCustomerCopy(model.headline),
        healthy_business_needs:
          'A healthy real estate business needs consistent lead flow, a living database, simple follow-up systems, financial clarity, and weekly accountability — not just talent and effort.',
        aligned: asArray(model.aligned_points),
        thin_or_informal: asArray(model.thin_points),
        transition_note: simplifyCustomerCopy(model.transition_note),
      },
      constraint_reality: {
        bottleneck_plain: bottleneck,
        symptoms: asArray(constraintSummary.symptoms_vs_root?.symptoms),
        root_problem: simplifyCustomerCopy(constraintSummary.symptoms_vs_root?.root_cause),
        if_unchanged: simplifyCustomerCopy(constraintSummary.if_unchanged),
      },
      one_move: {
        title_plain: simplifyCustomerCopy(oneMove.title),
        what_to_do: simplifyCustomerCopy(oneMove.recommendation),
        why_this_move: simplifyCustomerCopy(oneMove.why_this_move),
        why_now: simplifyCustomerCopy(oneMove.why_now),
        why_fits_you: simplifyCustomerCopy(oneMove.behavior_fit),
        first_30_days: asArray(oneMove.first_30_days).map(simplifyCustomerCopy),
        proof_would_show_working: asArray(oneMove.proof_signals).map(simplifyCustomerCopy),
        adoption_risks_plain: asArray(oneMove.adoption_risks).map(simplifyCustomerCopy),
      },
      advanced_source: {
        intro:
          'Technical source version for transparency. The main report tabs are the readable customer version.',
      },
      confidence_reality: {
        band_plain: `Confidence: ${confidence.band || 'unknown'}${
          Number.isFinite(confidence.score) ? ` (${confidence.score}/100)` : ''
        }`,
        headline: simplifyCustomerCopy(confidence.headline),
        what_system_knows: asArray(confidence.what_system_knows),
        what_system_infers: asArray(confidence.what_system_infers),
        what_is_missing: asArray(confidence.missing_labels || confidence.missing_raw),
        counts_plain: `Known: ${confidence.known_count || 0} · Observed: ${
          confidence.observed_count || 0
        } · Inferred: ${confidence.inferred_count || 0} · Missing: ${confidence.missing_count || 0}`,
        customer_note: simplifyCustomerCopy(vmCore.missing_data?.customer_note),
      },
    },
  };
}

function mergeCustomerLanguage(stored, presentation) {
  if (!stored || typeof stored !== 'object') return presentation;
  const storedSections = stored.sections || {};
  const presentationSections = presentation?.sections || {};
  const mergedSections = { ...presentationSections };

  for (const [key, value] of Object.entries(storedSections)) {
    if (!value || typeof value !== 'object') {
      mergedSections[key] = value;
      continue;
    }
    mergedSections[key] = {
      ...(presentationSections[key] || {}),
      ...value,
    };
    // Fill empty stored fields from presentation so empty cards do not render blank.
    for (const [field, pVal] of Object.entries(presentationSections[key] || {})) {
      if (!hasRenderableContent(mergedSections[key][field]) && hasRenderableContent(pVal)) {
        mergedSections[key][field] = pVal;
      } else if (typeof mergedSections[key][field] === 'string') {
        mergedSections[key][field] = simplifyCustomerCopy(mergedSections[key][field]);
      } else if (Array.isArray(mergedSections[key][field])) {
        mergedSections[key][field] = mapLabelsForCustomer(mergedSections[key][field], {
          technical: key === 'confidence_reality' || key === 'advanced_source',
        }).map((item) =>
          key === 'confidence_reality' || key === 'advanced_source' ? item : simplifyCustomerCopy(item)
        );
      }
    }
  }

  return {
    ...presentation,
    ...stored,
    target_technicality: stored.target_technicality ?? presentation?.target_technicality ?? 25,
    sections: mergedSections,
    presentation_derived: Boolean(presentation?.presentation_derived) && !stored.sections,
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
  const executiveReadout =
    findBriefingSection(briefing, 'executive_readout') ||
    findBriefingSection(briefing, 'executive_summary');
  const trajectorySection = findBriefingSection(briefing, 'current_trajectory_signal');
  const leadGenSection = findBriefingSection(briefing, 'lead_generation_reality');
  const crmSection = findBriefingSection(briefing, 'lead_conversion_follow_up_reality');
  const systemsSection = findBriefingSection(briefing, 'systems_reality');
  const financialSection = findBriefingSection(briefing, 'financial_reality');
  const accountabilitySection = findBriefingSection(briefing, 'accountability_reality');
  const databaseSection = findBriefingSection(briefing, 'relationship_database_reality');
  const confidenceEngine = output.confidence_engine || bid.confidence_engine || {};

  const missingFinancialRaw = asArray(
    bid.missing_financial_data ||
      bid.financial_reality?.missing_financial_data ||
      bid.missing_data ||
      []
  );
  const missingFinancialLabels = mapLabelsForCustomer(missingFinancialRaw, { technical: true });

  const confidenceSummary = deriveConfidenceSummary(confidenceEngine, {
    confidence_engine_missing: asArray(confidenceEngine.missing),
    financial: missingFinancialRaw,
  });

  const primaryConstraint = resolvePrimaryConstraint(bid, primaryConstraintSection);
  const dimensions = deriveBehavioralDimensions(bid.behavioral_reality || {}, profile);
  const helpsDistorts = deriveHelpsAndDistorts(bid, behavioralSection?.body);

  const relationshipAsset = relationshipAssetCustomerLine(
    bid.relationship_reality?.lake_health ||
      bid.relationship_reality?.relationship_asset_strength ||
      bid.relationship_asset_strength
  );
  const leadGeneration = deriveLeadGenerationCustomerLine(
    bid.lead_generation_reality || {},
    leadGenSection?.body
  );
  const crmFollowUp = deriveCrmCustomerLine(bid.lead_conversion_reality || {}, crmSection?.body);
  const financialDiscipline = deriveFinancialCustomerLine(
    bid.financial_reality || {},
    financialSection?.body
  );
  const systemsAccountability = deriveSystemsAccountabilityLine(bid, systemsSection?.body);

  const alignedPoints = [];
  const thinPoints = [];
  if (relationshipAsset) {
    alignedPoints.push(relationshipAsset);
  }
  if (leadGeneration) thinPoints.push(`Lead generation: ${leadGeneration}`);
  if (crmFollowUp) thinPoints.push(`CRM / follow-up: ${crmFollowUp}`);
  if (financialDiscipline) thinPoints.push(`Financial / P&L: ${financialDiscipline}`);
  if (systemsAccountability) thinPoints.push(`Systems / accountability: ${systemsAccountability}`);

  const businessStage = textValue(
    bid.business_reality?.operating_mode ||
      bid.current_stage?.stage ||
      bid.current_stage?.label ||
      bid.business_reality?.producer_type
  );

  const oneMoveCard = deriveOneMoveCard(output.one_move_v1);
  // Soften one-move text at presentation layer only.
  const oneMoveCardCustomer = {
    ...oneMoveCard,
    title: simplifyCustomerCopy(oneMoveCard.title),
    recommendation: simplifyCustomerCopy(oneMoveCard.recommendation),
    why_this_move: simplifyCustomerCopy(oneMoveCard.why_this_move),
    why_now: simplifyCustomerCopy(oneMoveCard.why_now),
    behavior_fit: simplifyCustomerCopy(oneMoveCard.behavior_fit),
    first_30_days: asArray(oneMoveCard.first_30_days).map(simplifyCustomerCopy),
    proof_signals: asArray(oneMoveCard.proof_signals).map(simplifyCustomerCopy),
    adoption_risks: asArray(oneMoveCard.adoption_risks).map(simplifyCustomerCopy),
  };

  const vmCore = {
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
    primary_constraint: primaryConstraint,
    confidence_summary: confidenceSummary,
    missing_data: {
      financial: missingFinancialRaw,
      financial_labels: missingFinancialLabels,
      confidence_engine_missing: asArray(confidenceEngine.missing),
      confidence_engine_missing_labels: mapLabelsForCustomer(asArray(confidenceEngine.missing), {
        technical: true,
      }),
      customer_note:
        bid.missing_data_note ||
        confidenceEngine.customer_note ||
        'Some financial and conversion detail may be incomplete. This briefing is an operating diagnostic, not a complete financial model.',
    },
    overview: {
      what_this_assessment_is_really_saying: simplifyCustomerCopy(
        textValue(
          executiveReadout?.body ||
            findBriefingSection(briefing, 'executive_summary')?.body ||
            briefing?.executive_summary ||
            currentRealitySection?.body
        )
      ),
      doctrine_fusion_line: 'Business reality + personality reality + future consequence',
      one_move_teaser: simplifyCustomerCopy(textValue(output.one_move_v1?.title)),
      confidence_band: confidenceSummary.band,
      why_this_matters: simplifyCustomerCopy(
        primaryConstraint.effect_if_unchanged || trajectorySection?.body
      ),
      focus_first: simplifyCustomerCopy(
        textValue(output.one_move_v1?.recommendation || output.one_move_v1?.title)
      ),
    },
    business_reality_summary: {
      stage: customerDisplayLabel(businessStage) || simplifyCustomerCopy(businessStage),
      headline: simplifyCustomerCopy(
        textValue(currentRealitySection?.title || bid.current_stage?.description || executiveReadout?.title)
      ),
      leads: simplifyCustomerCopy(textValue(leadGenSection?.body)),
      database: simplifyCustomerCopy(textValue(databaseSection?.body)),
      systems: simplifyCustomerCopy(textValue(systemsSection?.body)),
      financial: simplifyCustomerCopy(textValue(financialSection?.body)),
      accountability: simplifyCustomerCopy(textValue(accountabilitySection?.body)),
      growth_constraint: primaryConstraint.label,
      sections: {
        leads: leadGenSection,
        database: databaseSection,
        systems: systemsSection,
        financial: financialSection,
        accountability: accountabilitySection,
      },
    },
    behavioral_reality_summary: {
      profile_type: simplifyCustomerCopy(
        textValue(bid.behavioral_reality?.profile_type || profile.profile_type)
      ),
      top_dimensions: dimensions.top_dimensions,
      low_dimensions: dimensions.low_dimensions,
      top_plain: dimensions.top_plain,
      low_plain: dimensions.low_plain,
      headline: simplifyCustomerCopy(
        textValue(helpsDistorts.fusion_summary || behavioralSection?.body)
      ),
      helps_business: helpsDistorts.helps_business,
      distorts_business: helpsDistorts.distorts_business,
      behavior_to_business: simplifyCustomerCopy(textValue(behavioralSection?.body)),
      section: behavioralSection,
    },
    business_model_alignment_summary: {
      headline: simplifyCustomerCopy(
        textValue(currentRealitySection?.body || bid.current_stage?.description)
      ),
      relationship_asset: relationshipAsset,
      lead_generation: leadGeneration || unavailableCustomerNote('Lead generation'),
      crm_follow_up: crmFollowUp || unavailableCustomerNote('CRM / follow-up'),
      financial_discipline: financialDiscipline || unavailableCustomerNote('Financial / P&L detail'),
      systems_accountability: systemsAccountability,
      aligned_points: alignedPoints,
      thin_points: thinPoints,
      transition_note: simplifyCustomerCopy(
        textValue(
          bid.business_reality?.transition_note ||
            trajectorySection?.body ||
            'The business is still transitioning from personal production toward a more system-supported model.'
        )
      ),
      // Raw briefing section is technical-source material; do not surface on customer fit cards.
      section_key: currentRealitySection?.key || currentRealitySection?.id || null,
    },
    constraint_summary: {
      primary: {
        key: primaryConstraint.key,
        label: primaryConstraint.label,
        score: primaryConstraint.score,
        confidence: primaryConstraint.confidence,
        summary: primaryConstraint.summary,
        effect_if_unchanged: primaryConstraint.effect_if_unchanged,
        symptoms: primaryConstraint.symptoms,
        root_cause: primaryConstraint.root_cause,
      },
      symptoms_vs_root: {
        symptoms: primaryConstraint.symptoms,
        root_cause: primaryConstraint.root_cause,
      },
      if_unchanged: primaryConstraint.effect_if_unchanged,
      section: primaryConstraintSection,
    },
    five_futures_cards: deriveFiveFuturesCards(output.five_futures_v1).map((card) => ({
      ...card,
      title: simplifyCustomerCopy(card.title),
      summary: simplifyCustomerCopy(card.summary),
      short_interpretation: simplifyCustomerCopy(card.short_interpretation),
      behavioral_modifier: asArray(card.behavioral_modifier).map(simplifyCustomerCopy),
    })),
    one_move_card: oneMoveCardCustomer,
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
    shell_tabs: BA_SHELL_TABS,
    source_mutation: false,
    meta: {
      labOnly: false,
      productionSafe: true,
      brandLine: 'MORE MindMap / Business Assessment',
      customerLanguageTarget: 25,
      universalTranslatorRequired: false,
    },
  };

  const storedLanguage = retrieve.customer_language_v2 || output.customer_language_v2 || null;
  const presentationLanguage = buildPresentationCustomerLanguage(vmCore);
  vmCore.customer_language_v2 = mergeCustomerLanguage(storedLanguage, presentationLanguage);
  vmCore.meta.customerLanguageTarget =
    vmCore.customer_language_v2?.target_technicality ?? 25;

  return vmCore;
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