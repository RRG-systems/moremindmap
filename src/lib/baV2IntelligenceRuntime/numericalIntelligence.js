function invariant(condition, code, message) {
  if (!condition) {
    const error = new Error(message)
    error.name = 'BaV2NumericalIntegrityError'
    error.code = code
    throw error
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

export const NUMERICAL_CLASSES = deepFreeze({
  OBSERVED_REPORTED: 'Direct governed customer evidence',
  DETERMINISTICALLY_DERIVED: 'Arithmetic derived only from governed facts',
  MODELED_REQUIREMENT: 'Goal-supporting target from governed vertical doctrine',
  COACHING_STANDARD: 'Founder coaching standard or cassette heuristic',
  MODELED_RANGE: 'Scenario range from explicit assumptions',
  UNKNOWN_MISSING: 'A decision-relevant current number that is not yet known',
})

export const GENERATIVE_BUSINESS_INTELLIGENCE_DOCTRINE = deepFreeze({
  doctrine_id: 'more-generative-business-intelligence-doctrine-v1',
  version: '1.0.0',
  principle: 'NUMBERS ORIENT. CLICKS EXPLAIN.',
  cassette_components: ['TERRITORIES', 'DIAGNOSTIC_LENSES', 'BUSINESS_RELATIONSHIPS_MODELS'],
  class_preservation_required: true,
  forward_and_backward_reasoning_required: true,
  current_vs_required_comparison_required: true,
  provider_execution_required: false,
})

const AUTHORITY = deepFreeze({
  goal: ['RE-01', 'RE-06', 'RE-12', 'BA_V2_RUN_3_CRITICAL_ADDENDUM'],
  relationship: ['RE-02', 'RE-03', 'RE-04', 'BA_V2_RUN_3_CRITICAL_ADDENDUM'],
  pipeline: ['RE-06', 'BA_V2_RUN_3_CRITICAL_ADDENDUM'],
  execution: ['RE-12', 'BA_V2_RUN_3_CRITICAL_ADDENDUM'],
})

function record({ id, label, value, numericalClass, temporalStatus, sourceFacts = [], formula = null, assumptions = [], authority, confidence, derivable = false, explanation }) {
  invariant(NUMERICAL_CLASSES[numericalClass], 'NUMERICAL_CLASS_INVALID', `${id} has an unsupported numerical class.`)
  invariant(id && label && value !== undefined && temporalStatus && authority?.length && confidence && explanation, 'NUMERICAL_LINEAGE_INCOMPLETE', `${id} is missing numerical lineage.`)
  return {
    numerical_id: id,
    customer_label: label,
    value: String(value),
    numerical_class: numericalClass,
    temporal_status: temporalStatus,
    source_facts: sourceFacts,
    formula,
    assumptions,
    model_identity: numericalClass === 'OBSERVED_REPORTED' ? 'GOVERNED_CUSTOMER_EVIDENCE' : numericalClass === 'DETERMINISTICALLY_DERIVED' ? 'DETERMINISTIC_ARITHMETIC' : numericalClass === 'UNKNOWN_MISSING' ? 'INTELLIGENT_MISSINGNESS' : 'REAL_ESTATE_DIRECTIONAL_OPERATING_MODEL_V1',
    applicable_conditions: assumptions.length ? assumptions : ['Applies only within the stated current, goal, benchmark, or scenario scope.'],
    vertical_authority_refs: authority,
    governing_lens_refs: authority.includes('RE-02') || authority.includes('RE-03') || authority.includes('RE-04')
      ? ['RE-DL-03', 'RE-DL-04']
      : authority.includes('RE-06') ? ['RE-DL-01', 'RE-DL-04'] : ['RE-DL-01', 'RE-DL-02'],
    confidence,
    counterevidence: numericalClass === 'MODELED_REQUIREMENT' || numericalClass === 'COACHING_STANDARD' || numericalClass === 'MODELED_RANGE' ? ['A different market, stage, source mix, conversion ability, capacity state, execution quality, or governed model may produce a different value.'] : [],
    related_business_variables: authority.includes('RE-02') || authority.includes('RE-03') || authority.includes('RE-04') ? ['relationships', 'conversations', 'opportunities', 'qualification', 'relationship system'] : authority.includes('RE-06') ? ['opportunities', 'appointments', 'pipeline', 'closings', 'conversion'] : ['goal', 'operating capacity', 'purposeful execution'],
    mind_change_conditions: ['Update or retire this number when its source evidence, assumptions, applicable conditions, model selection, or directly measured current state changes.'],
    may_participate_in_further_derivation: derivable,
    customer_safe_explanation: explanation,
  }
}

function measurement(id, label, why, target = null, currentValue = null) {
  if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
    return record({
      id,
      label,
      value: currentValue,
      numericalClass: 'OBSERVED_REPORTED',
      temporalStatus: 'CURRENT_REPORTED',
      sourceFacts: [`Governed customer-reported ${label.toLowerCase()}`],
      authority: AUTHORITY.pipeline,
      confidence: 'HIGH_FOR_REPORTED_SCOPE',
      explanation: why,
    })
  }
  return record({
    id,
    label,
    value: 'Not yet measured',
    numericalClass: 'UNKNOWN_MISSING',
    temporalStatus: 'CURRENT_UNKNOWN',
    formula: null,
    assumptions: target ? [`A separate ${target} may orient measurement but is not current performance.`] : [],
    authority: AUTHORITY.pipeline,
    confidence: 'HIGH_MISSINGNESS_CONFIDENCE',
    explanation: why,
  })
}

export function buildRealEstateGoalBacksolveModel({
  monthlyClosingGoal,
  combinedSoiContacts,
  attributedShareEstimate,
  believedTopOfMind,
  workdaysPerYear = 200,
  subjectName = 'The operator',
  relationshipAssetTarget = 500,
  relationshipSourceShare = 1,
  liveContactFloor = 5,
  liveContactBenchmark = 20,
  current = {},
}) {
  invariant(Number.isFinite(monthlyClosingGoal) && monthlyClosingGoal > 0, 'GOAL_BACKSOLVE_GOAL_REQUIRED', 'A positive monthly closing goal is required.')
  invariant(Number.isFinite(combinedSoiContacts) && combinedSoiContacts > 0, 'GOAL_BACKSOLVE_RELATIONSHIP_BASE_REQUIRED', 'A governed combined SOI count is required.')
  invariant(Number.isFinite(attributedShareEstimate) && attributedShareEstimate > 0 && attributedShareEstimate < 1, 'GOAL_BACKSOLVE_SHARE_REQUIRED', 'A bounded attribution estimate is required.')
  invariant(Number.isFinite(believedTopOfMind) && believedTopOfMind > 0, 'GOAL_BACKSOLVE_MINDSHARE_REQUIRED', 'A governed mindshare estimate is required.')
  invariant(Number.isFinite(relationshipAssetTarget) && relationshipAssetTarget > 0, 'GOAL_BACKSOLVE_RELATIONSHIP_TARGET_REQUIRED', 'A positive relationship target model is required.')
  invariant(Number.isFinite(relationshipSourceShare) && relationshipSourceShare > 0 && relationshipSourceShare <= 1, 'GOAL_BACKSOLVE_SOURCE_SHARE_REQUIRED', 'Relationship source share must be greater than zero and no more than one.')

  const annualClosingsGoal = monthlyClosingGoal * 12
  const attributedContactsEstimate = Math.round(combinedSoiContacts * attributedShareEstimate)
  const liveConversationsPerClosing = 60
  const annualLiveConversations = Math.round(annualClosingsGoal * liveConversationsPerClosing * relationshipSourceShare)
  const dailyGoalPace = annualLiveConversations / workdaysPerYear
  const dailyGoalPaceLow = Math.max(1, Math.floor(dailyGoalPace))
  const dailyGoalPaceHigh = Math.max(dailyGoalPaceLow + 1, Math.ceil(dailyGoalPace))
  const listingTargetLow = Math.max(2, Math.round(monthlyClosingGoal * 2))
  const listingTargetHigh = Math.max(listingTargetLow + 1, Math.ceil(monthlyClosingGoal * 2.5))
  const buyerTargetLow = listingTargetLow
  const buyerTargetHigh = listingTargetHigh
  const combinedPipelineLow = listingTargetLow + buyerTargetLow
  const combinedPipelineHigh = listingTargetHigh + buyerTargetHigh
  const winningDaysPerYear = 4 * 3 * 8
  const annualRelationshipAddsLow = 2 * winningDaysPerYear
  const annualRelationshipAddsHigh = 3 * winningDaysPerYear
  const modeledReachLow = attributedContactsEstimate + annualRelationshipAddsLow
  const modeledReachHigh = attributedContactsEstimate + annualRelationshipAddsHigh
  const sharePercent = Math.round(attributedShareEstimate * 100)
  const personPossessive = subjectName.endsWith('s') ? `${subjectName}’` : `${subjectName}’s`
  const currentPipelineParts = [
    Number.isFinite(current.activeListings) ? `${current.activeListings} active listings` : null,
    Number.isFinite(current.activeBuyers) ? `${current.activeBuyers} active buyers` : null,
  ].filter(Boolean)
  const currentPipelineCount = Number.isFinite(current.activePipeline)
    ? current.activePipeline
    : Number.isFinite(current.activeListings) && Number.isFinite(current.activeBuyers)
      ? current.activeListings + current.activeBuyers
      : null
  const relationshipCurrent = `${combinedSoiContacts} combined contacts; approximately ${attributedContactsEstimate} attributed to ${subjectName}; roughly ${believedTopOfMind} believed top-of-mind; verified true-relationship count unknown`
  const pipelineCurrent = currentPipelineParts.length
    ? `${currentPipelineParts.join(' and ')}${Number.isFinite(currentPipelineCount) ? `; ${currentPipelineCount} combined` : ''}`
    : Number.isFinite(currentPipelineCount)
      ? `${currentPipelineCount} active opportunities reported; listing/buyer mix not yet separated`
      : 'Active listing and buyer pipeline not yet measured'
  const liveContactCurrent = Number.isFinite(current.liveContactsPerDay)
    ? `${current.liveContactsPerDay} live relationship conversations reported per workday`
    : 'Current live relationship conversations per workday not yet measured'

  const numericalRecords = [
    record({ id: 'combined-soi-current', label: 'Combined SOI', value: combinedSoiContacts, numericalClass: 'OBSERVED_REPORTED', temporalStatus: 'CURRENT_REPORTED', sourceFacts: ['Governed customer-reported combined SOI count'], authority: AUTHORITY.relationship, confidence: 'HIGH_FOR_REPORTED_SCOPE', derivable: true, explanation: 'A reported contact count—not a verified true-relationship count.' }),
    record({ id: 'attributed-contacts-estimate', label: `${subjectName}-attributed contacts`, value: `~${attributedContactsEstimate}`, numericalClass: 'DETERMINISTICALLY_DERIVED', temporalStatus: 'CURRENT_ESTIMATE', sourceFacts: [`Combined SOI ${combinedSoiContacts}`, `Approximately ${sharePercent}% attributed to ${subjectName}`], formula: `${combinedSoiContacts} × ${attributedShareEstimate} ≈ ${attributedContactsEstimate}`, assumptions: [`The reported share is treated as a directional ${sharePercent}% estimate, not an exact share or verified split.`, 'Contacts are not true relationships.'], authority: AUTHORITY.relationship, confidence: 'MODERATE_DIRECTIONAL', derivable: true, explanation: `About ${attributedContactsEstimate} contacts are directionally attributable to ${subjectName}; this is an estimate, not an exact verified count.` }),
    record({ id: 'top-of-mind-current', label: 'Believed top-of-mind', value: `~${believedTopOfMind}`, numericalClass: 'OBSERVED_REPORTED', temporalStatus: 'CURRENT_BELIEF', sourceFacts: ['Governed customer-reported mindshare estimate'], assumptions: ['Belief is not behavioral verification.'], authority: AUTHORITY.relationship, confidence: 'MODERATE_REPORTED_BELIEF', explanation: `Roughly ${believedTopOfMind} relationships are believed top-of-mind; actual response and referral behavior are not yet verified.` }),
    record({ id: 'monthly-closing-goal', label: 'Monthly closing goal', value: `${monthlyClosingGoal} / month`, numericalClass: 'OBSERVED_REPORTED', temporalStatus: 'DESIRED_REPORTED', sourceFacts: [`Governed stated goal of ${monthlyClosingGoal} closings per month`], assumptions: ['A desired outcome is not current production or a forecast.'], authority: AUTHORITY.goal, confidence: 'HIGH_FOR_STATED_GOAL', derivable: true, explanation: `${subjectName} stated a near-term goal of ${monthlyClosingGoal} closings per month.` }),
    record({ id: 'annual-closing-goal', label: 'Annual closing goal', value: annualClosingsGoal, numericalClass: 'DETERMINISTICALLY_DERIVED', temporalStatus: 'GOAL_DERIVED', sourceFacts: [`Stated goal ${monthlyClosingGoal} closings per month`], formula: `${monthlyClosingGoal} × 12 = ${annualClosingsGoal}`, authority: AUTHORITY.goal, confidence: 'HIGH_ARITHMETIC', derivable: true, explanation: `The stated monthly goal equals ${annualClosingsGoal} closings across twelve months; it is a goal, not a forecast.` }),
    record({ id: 'relationship-asset-target', label: 'Qualified relationship asset', value: `~${relationshipAssetTarget}`, numericalClass: 'MODELED_REQUIREMENT', temporalStatus: 'GOAL_SUPPORTING_TARGET', sourceFacts: [`Annual closing goal ${annualClosingsGoal}`, `Relationship-source share assumption ${Math.round(relationshipSourceShare * 100)}%`], assumptions: ['Portfolio quality, qualification, attrition, source mix, conversion, market, and capacity remain material.', `The target is not ${personPossessive} current database.`], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A directional ${relationshipAssetTarget}-relationship model that can orient qualification and system design; it does not claim that the asset guarantees the goal.` }),
    record({ id: 'qualified-adds-winning-day', label: 'New qualified relationships', value: '2–3 / winning day', numericalClass: 'COACHING_STANDARD', temporalStatus: 'OPERATING_STANDARD', assumptions: ['Adding names is not the goal; each relationship must be developed and qualified.', 'The right pace varies by stage, source, market, and capacity.'], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A developing-agent coaching standard for purposeful qualified relationship growth—not ${personPossessive} current observed activity.` }),
    record({ id: 'relationship-additions-year', label: 'Modeled annual relationship additions', value: `${annualRelationshipAddsLow}–${annualRelationshipAddsHigh}`, numericalClass: 'MODELED_RANGE', temporalStatus: 'EXECUTION_CAPACITY_SCENARIO', sourceFacts: ['2–3 new qualified relationships per winning day'], formula: `2–3 × 4 winning days/week × 3 winning weeks/month × 8 winning months/year = ${annualRelationshipAddsLow}–${annualRelationshipAddsHigh}`, assumptions: ['Qualification is required.', 'Attrition and cleanup are excluded.', 'Winning cadence is execution capacity, not a future guarantee.'], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `Executing the modeled winning cadence creates capacity for roughly ${annualRelationshipAddsLow}–${annualRelationshipAddsHigh} qualified additions over a year.` }),
    record({ id: 'relationship-reach-scenario', label: 'Directional contact-asset reach', value: `~${modeledReachLow}–${modeledReachHigh}`, numericalClass: 'MODELED_RANGE', temporalStatus: 'SCENARIO_NOT_FORECAST', sourceFacts: [`Attributed-contact estimate ~${attributedContactsEstimate}`, `Modeled additions ${annualRelationshipAddsLow}–${annualRelationshipAddsHigh}`], formula: `${attributedContactsEstimate} + ${annualRelationshipAddsLow}–${annualRelationshipAddsHigh} = ${modeledReachLow}–${modeledReachHigh}`, assumptions: ['Contacts must still be qualified.', 'Attrition, cleanup, duplication, and execution variance are not modeled.', `This is not a prediction of ${personPossessive} future database.`], authority: AUTHORITY.relationship, confidence: 'LOW_TO_MODERATE_SCENARIO', explanation: `The cadence could create a directional contact-asset reach of roughly ${modeledReachLow}–${modeledReachHigh}, before qualification, cleanup, and attrition.` }),
    record({ id: 'live-contact-floor', label: 'Initial live-contact floor', value: `~${liveContactFloor} / day`, numericalClass: 'COACHING_STANDARD', temporalStatus: 'OPERATING_STANDARD', authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A starting operating standard for live database conversations—not ${personPossessive} observed current behavior.` }),
    record({ id: 'live-contact-goal-pace', label: 'Goal-supporting live-contact pace', value: `~${dailyGoalPaceLow}–${dailyGoalPaceHigh} / day`, numericalClass: 'MODELED_REQUIREMENT', temporalStatus: 'GOAL_SUPPORTING_TARGET', sourceFacts: [`Annual goal ${annualClosingsGoal}`, `Relationship-source share ${Math.round(relationshipSourceShare * 100)}%`, `Directional model ${liveConversationsPerClosing} live conversations per relationship-sourced closing`, `${workdaysPerYear} workdays`], formula: `${annualClosingsGoal} × ${relationshipSourceShare} × ${liveConversationsPerClosing} ÷ ${workdaysPerYear} = ${dailyGoalPace.toFixed(1)} per day`, assumptions: ['Approximately 1 referral per 10 live conversations.', 'Approximately 5–6 referrals or opportunities per closable transaction.', 'Uses a directional combined 60:1 relationship-source model.', 'Actual source mix and conversion may differ.'], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `The goal and stated source mix backsolve to ${dailyGoalPace.toFixed(1)} live conversations per workday, shown as a practical range of about ${dailyGoalPaceLow}–${dailyGoalPaceHigh}.` }),
    record({ id: 'live-contact-benchmark', label: 'Top-agent live-contact reference', value: `~${liveContactBenchmark} / day`, numericalClass: 'COACHING_STANDARD', temporalStatus: 'BENCHMARK_NOT_REQUIREMENT', authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A high-output reference point, not ${personPossessive} requirement or observed behavior.` }),
    record({ id: 'annual-live-conversations', label: 'Modeled annual live conversations', value: annualLiveConversations.toLocaleString('en-US'), numericalClass: 'MODELED_REQUIREMENT', temporalStatus: 'GOAL_SUPPORTING_TARGET', sourceFacts: [`Annual goal ${annualClosingsGoal}`, `Relationship-source share ${Math.round(relationshipSourceShare * 100)}%`, `Conservative heuristic ${liveConversationsPerClosing}:1`], formula: `${annualClosingsGoal} × ${relationshipSourceShare} × ${liveConversationsPerClosing} = ${annualLiveConversations.toLocaleString('en-US')}`, assumptions: ['Directional combined referral/conversion heuristic.', 'Not all sources or conversations convert equally.'], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: 'A modeled relationship-conversation requirement used to make the stated goal operational—not a count of current activity.' }),
    record({ id: 'active-listing-target', label: 'Active listing pipeline', value: `~${listingTargetLow}–${listingTargetHigh}`, numericalClass: 'MODELED_REQUIREMENT', temporalStatus: 'GOAL_SUPPORTING_TARGET', sourceFacts: [`Monthly goal ${monthlyClosingGoal}`], formula: `${monthlyClosingGoal} × 2–2.5 = ${listingTargetLow}–${listingTargetHigh}`, assumptions: ['Pipeline velocity, fallout, market, and conversion differ.'], authority: AUTHORITY.pipeline, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A goal-supporting active-listing range; ${personPossessive} current listing pipeline stays separate.` }),
    record({ id: 'active-buyer-target', label: 'Active buyer pipeline', value: `~${buyerTargetLow}–${buyerTargetHigh}`, numericalClass: 'MODELED_REQUIREMENT', temporalStatus: 'GOAL_SUPPORTING_TARGET', sourceFacts: [`Monthly goal ${monthlyClosingGoal}`], formula: `${monthlyClosingGoal} × 2–2.5 = ${buyerTargetLow}–${buyerTargetHigh}`, assumptions: ['Pipeline velocity, fallout, market, and conversion differ.'], authority: AUTHORITY.pipeline, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A goal-supporting active-buyer range; ${personPossessive} current buyer pipeline stays separate.` }),
    record({ id: 'combined-pipeline-target', label: 'Combined active pipeline', value: `~${combinedPipelineLow}–${combinedPipelineHigh}`, numericalClass: 'MODELED_REQUIREMENT', temporalStatus: 'GOAL_SUPPORTING_TARGET', sourceFacts: [`Active listing target ${listingTargetLow}–${listingTargetHigh}`, `Active buyer target ${buyerTargetLow}–${buyerTargetHigh}`], formula: `${listingTargetLow}–${listingTargetHigh} + ${buyerTargetLow}–${buyerTargetHigh} = ${combinedPipelineLow}–${combinedPipelineHigh}`, assumptions: ['Mix and stage velocity may change the useful range.'], authority: AUTHORITY.pipeline, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A directional active-opportunity range supporting ${monthlyClosingGoal} closings per month; current pipeline remains a separate reported state.` }),
    record({ id: 'short-term-mindshare', label: 'Short-term mindshare sequence', value: '6×6 / 8×8', numericalClass: 'COACHING_STANDARD', temporalStatus: 'SYSTEM_STANDARD', assumptions: ['Choose one sequence based on relationship and operating context.', 'Include roughly two live voice or face contacts and a qualification objective.'], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `Six contacts in about six weeks or eight in about eight weeks is a governed short-term nurture pattern—not proof that ${subjectName} currently runs it.` }),
    record({ id: 'long-term-touch-floor', label: 'Long-term relationship cadence', value: '35+ / year', numericalClass: 'COACHING_STANDARD', temporalStatus: 'SYSTEM_STANDARD', assumptions: ['Touches span multiple channels and are not all phone calls.', 'Live and face-to-face contact carry different value from passive marketing.'], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: 'A directional annual relationship-maintenance floor across meaningful mixed channels.' }),
    record({ id: 'long-term-touch-range', label: 'Robust relationship cadence', value: '40–55 / year', numericalClass: 'MODELED_RANGE', temporalStatus: 'SYSTEM_SCENARIO', assumptions: ['Channel mix and relationship tier determine the right cadence.'], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: 'A robust mixed-touch range for system design, not a universal law.' }),
    record({ id: 'modeled-portfolio-touches', label: `Modeled annual system touches at ${relationshipAssetTarget}`, value: `${(relationshipAssetTarget * 35).toLocaleString('en-US')}–${(relationshipAssetTarget * 55).toLocaleString('en-US')}`, numericalClass: 'MODELED_RANGE', temporalStatus: 'PORTFOLIO_SCENARIO', sourceFacts: [`Modeled ${relationshipAssetTarget}-person qualified relationship asset`, '35+ floor and 40–55 robust range'], formula: `${relationshipAssetTarget} × 35–55 = ${(relationshipAssetTarget * 35).toLocaleString('en-US')}–${(relationshipAssetTarget * 55).toLocaleString('en-US')}`, assumptions: ['These are multi-channel system touches—not phone calls.', `A ${relationshipAssetTarget}-person asset is a target model, not current fact.`], authority: AUTHORITY.relationship, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: 'A capacity model for a mature multi-channel relationship system; it exposes operating scale without prescribing that every touch be a call.' }),
    record({ id: 'lead-generation-time', label: 'Mature lead-generation block', value: '~2–3 hours / day', numericalClass: 'COACHING_STANDARD', temporalStatus: 'OPERATING_STANDARD', authority: AUTHORITY.execution, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: `A mature coaching model for protected lead generation before noon—not ${personPossessive} observed calendar.` }),
    record({ id: 'follow-up-time', label: 'Follow-up block', value: '~90 minutes / day', numericalClass: 'COACHING_STANDARD', temporalStatus: 'OPERATING_STANDARD', authority: AUTHORITY.execution, confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL', explanation: 'A coaching reference for protected follow-up time, subject to stage, capacity, and source mix.' }),
    measurement('current-live-contacts', 'Current live contacts / day', 'This reveals whether the relationship asset is actively creating conversations.', `~${dailyGoalPaceLow}–${dailyGoalPaceHigh} goal-supporting pace`, current.liveContactsPerDay),
    measurement('current-qualified-adds', 'Current qualified relationships / day', 'This shows whether new names are becoming relationships that belong in the long-term system.', '2–3 modeled winning-day standard', current.qualifiedAddsPerDay),
    measurement('current-appointments', 'Current appointments / week', 'This separates weak opportunity, follow-up leakage, qualification, and conversion.', null, current.appointmentsPerWeek),
    measurement('current-active-listings', 'Current active listings', 'This shows the listing-side inventory supporting near-term closings.', `~${listingTargetLow}–${listingTargetHigh} goal-supporting target`, current.activeListings),
    measurement('current-active-buyers', 'Current active buyers', 'This shows the buyer-side inventory supporting near-term closings.', `~${buyerTargetLow}–${buyerTargetHigh} goal-supporting target`, current.activeBuyers),
    measurement('current-active-pipeline', 'Current active pipeline', 'This compares present transaction inventory with the business required by the stated closing goal.', `~${combinedPipelineLow}–${combinedPipelineHigh} combined goal-supporting target`, current.activePipeline),
    measurement('current-conversion', 'Current stage conversion', 'This tells the map where opportunity is converting or leaking.', null, current.stageConversion),
  ]

  const model = {
    contract_id: 'more-real-estate-goal-backsolve-runtime-v1',
    contract_version: '1.0.0',
    doctrine_binding: GENERATIVE_BUSINESS_INTELLIGENCE_DOCTRINE,
    numerical_classes: NUMERICAL_CLASSES,
    business_relationship_models: [
      {
        relationship_model_id: 're-relationship-opportunity-production-chain-v1',
        governing_lens_refs: ['RE-DL-01', 'RE-DL-03', 'RE-DL-04'],
        variables: ['qualified relationships', 'live conversations', 'referrals or opportunities', 'appointments', 'clients', 'active pipeline', 'closings', 'economics'],
        relationship_types: ['DIRECTIONAL', 'RANGE_BASED', 'STAGE_DEPENDENT', 'CONDITIONAL'],
        rule: 'Reason both forward from governed current capacity and backward from a governed goal. Do not imply a fixed universal linear equation.',
        missing_input_requirements: ['current relationship qualification', 'current activity', 'source-stage flow', 'conversion', 'pipeline', 'market and capacity context'],
      },
      {
        relationship_model_id: 're-relationship-asset-growth-system-v1',
        governing_lens_refs: ['RE-DL-02', 'RE-DL-03'],
        variables: ['new people', 'short-term nurture', 'qualification', 'long-term relationship system', 'attrition and cleanup', 'relationship asset'],
        relationship_types: ['DIRECTIONAL', 'CADENCE_BASED', 'CONDITIONAL'],
        rule: 'Names become an asset only through development, qualification, graduation, maintenance, and cleanup.',
        missing_input_requirements: ['current nurture population', 'qualification outcomes', 'graduation', 'attrition and cleanup'],
      },
      {
        relationship_model_id: 're-purposeful-execution-chain-v1',
        governing_lens_refs: ['RE-DL-02'],
        variables: ['models', 'systems', 'tools', 'accountability', 'coaching', 'ongoing education', 'repeatability'],
        relationship_types: ['CONDITIONAL', 'MATURITY_DEPENDENT', 'CAPACITY_BOUNDED'],
        rule: 'Numerical targets become useful only when a purposeful operating model assigns system, tool, ownership, inspection, coaching, and learning responsibilities.',
        missing_input_requirements: ['current ownership', 'inspection cadence', 'tool adoption', 'capability and capacity'],
      },
    ],
    goal_backsolve_models: [{
      model_id: 're-closing-goal-to-operating-system-v1',
      target_outcome: `${monthlyClosingGoal} closings per month`,
      required_upstream_state: ['active pipeline', 'appointments and opportunities', 'live conversations', 'qualified relationships', 'relationship asset', 'daily activity', 'short-term and long-term systems', 'accountability'],
      formula_chain: [`${monthlyClosingGoal} × 12 = ${annualClosingsGoal} annual closings`, `${annualClosingsGoal} × ${relationshipSourceShare} relationship-source share × ${liveConversationsPerClosing} = ${annualLiveConversations} live conversations`, `${annualLiveConversations} ÷ ${workdaysPerYear} = ${dailyGoalPace.toFixed(1)} live conversations per workday`],
      assumptions: ['Founder heuristics are directional models, not calibrated predictions.', 'Current source, conversion, pipeline, financial, market, and capacity evidence remain incomplete.'],
      heuristic_authority_refs: [...AUTHORITY.goal, ...AUTHORITY.relationship, ...AUTHORITY.pipeline, ...AUTHORITY.execution],
      confidence: 'FOUNDER_HEURISTIC_DIRECTIONAL',
      applicable_business_stage: 'Relationship-led residential real-estate business with an explicit closing goal; interpretation remains stage- and capacity-dependent.',
      stop_conditions: ['Do not treat targets as current facts.', 'Stop derivation when required source facts are missing or contradictory.', 'Do not infer true relationships from contact count.', 'Do not imply calibrated probability or guaranteed outcome.'],
      missing_inputs: [
        !Number.isFinite(currentPipelineCount) ? 'Current active pipeline' : null,
        !Number.isFinite(current.appointmentsPerWeek) ? 'Current weekly opportunities and appointments' : null,
        current.stageConversion === undefined || current.stageConversion === null ? 'Current stage conversion' : null,
        'Behaviorally verified true relationships',
        !Number.isFinite(current.liveContactsPerDay) ? 'Current live-contact cadence' : null,
        'Current capacity and source economics',
      ].filter(Boolean),
      output_numerical_classes: ['DETERMINISTICALLY_DERIVED', 'MODELED_REQUIREMENT', 'COACHING_STANDARD', 'MODELED_RANGE', 'UNKNOWN_MISSING'],
      customer_safe_explanation: 'The model reasons backward from the stated goal so targets become measurable, while keeping present facts, operating standards, and scenarios visibly separate.',
    }],
    current_required_comparisons: [
      {
        comparison_id: 'relationship-asset-current-v-required-v1',
        current: relationshipCurrent,
        required: `Directional mature model around ${relationshipAssetTarget} qualified relationships`,
        gap: 'Cannot be calculated honestly until current relationships are qualified; raw contacts and true relationships are not interchangeable.',
        next_measurement_question: `How many ${subjectName}-attributed contacts currently meet the qualification standard for the long-term relationship system?`,
      },
      {
        comparison_id: 'pipeline-current-v-required-v1',
        current: pipelineCurrent,
        required: `Directional model around ${listingTargetLow}–${listingTargetHigh} active listings plus ${buyerTargetLow}–${buyerTargetHigh} active buyers, about ${combinedPipelineLow}–${combinedPipelineHigh} combined`,
        gap: Number.isFinite(currentPipelineCount)
          ? `Reported combined pipeline is ${currentPipelineCount}; compare with the directional ${combinedPipelineLow}–${combinedPipelineHigh} range only after stage definition, velocity, fallout, and conversion are inspected.`
          : 'Unknown until current active listings and buyers are counted under a governed stage definition.',
        next_measurement_question: 'How many active listings and active buyers are in the pipeline right now?',
      },
      {
        comparison_id: 'live-contact-current-v-required-v1',
        current: liveContactCurrent,
        required: `Goal-supporting directional pace around ${dailyGoalPaceLow}–${dailyGoalPaceHigh} per workday under the source-mix model`,
        gap: Number.isFinite(current.liveContactsPerDay)
          ? `Reported cadence is ${current.liveContactsPerDay} per workday; interpret the difference from ${dailyGoalPaceLow}–${dailyGoalPaceHigh} through actual source-stage conversion and capacity.`
          : 'Unknown until current live-contact cadence and actual source-stage conversion are measured.',
        next_measurement_question: 'What is the current average number of live database conversations per workday?',
      },
    ],
    model_conflicts: [{
      conflict_id: 're-live-conversations-per-closing-range-v1',
      model_values: ['approximately 50 conversations per closing', 'approximately 60 conversations per closing'],
      preserved_range: 'approximately 50–60',
      orientation_choice: 'Use the conservative 60:1 edge for the displayed goal-supporting pace while retaining the full model range and its assumptions.',
      prohibition: 'Do not present either ratio as calibrated conversion or universal law.',
    }],
    derived_measurement_questions: [
      'How many active listings and active buyers are in the pipeline right now?',
      'What is the current average number of live database conversations per workday?',
      'How many new qualified relationships enter short-term nurture per winning day and week?',
      'How many qualification conversations, graduations, deferrals, and cleanup removals occur?',
      'Where do referrals and opportunities convert or leak between appointment, agreement, pipeline, and closing?',
    ],
    frontier_extension_contract: {
      purpose: 'Permit additional useful quantitative intelligence without requiring every formula to be founder-authored.',
      allowed_when: ['derivation starts from governed evidence or an identified scenario', 'cassette business relationship supports the reasoning', 'assumptions are explicit', 'numerical lineage is complete', 'the numerical class survives projection', 'the result is not presented as observed current reality'],
      prominence_factors: ['goal relevance', 'constraint relationship', 'explanatory power', 'actionability', 'confidence', 'customer recognition', 'vertical importance'],
      prohibition: 'A frontier-derived quantity may orient diagnosis; it may not silently overwrite current state, become calibrated prediction, or harden a conditional heuristic into universal truth.',
      execution_boundary: 'No provider call is used in this deterministic runtime. Only explicit governed inputs and deterministic example derivations are materialized; the extension contract remains available for a future authorized frontier reasoning stage.',
      run3_execution: 'No provider call is used. Only explicit governed inputs and deterministic example derivations are materialized.',
    },
    numerical_records: numericalRecords,
    runtime_boundary: 'Lenses generate the questions; the cassette provides relationships; evidence provides the starting state; the goal provides the desired state. Models orient reasoning and measurement without overwriting governed current state, choosing strategy from one number, or promising outcomes.',
  }
  return deepFreeze(model)
}
