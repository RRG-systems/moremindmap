const DRAFT_VERSION = 'business_intelligence_draft_v1';

const DIMENSION_LABELS = {
  vector: 'Command',
  velocity: 'Tempo',
  signal: 'Signal',
  fidelity: 'Precision',
  framework: 'Structure',
  flex: 'Adaptability',
  leverage: 'Leverage',
  horizon: 'Perspective'
};

const TRAJECTORY_BY_CONSTRAINT = {
  database_constraint: 'relationship_asset_ceiling',
  relationship_quality_constraint: 'relationship_asset_ceiling',
  lead_generation_constraint: 'lead_generation_shortage',
  lead_conversion_constraint: 'conversion_leakage',
  follow_up_constraint: 'conversion_leakage',
  systems_constraint: 'systems_drag',
  accountability_constraint: 'accountability_drift',
  financial_constraint: 'financial_blindness',
  team_structure_constraint: 'team_leverage_bottleneck',
  leadership_constraint: 'team_leverage_bottleneck',
  role_fit_constraint: 'behavior_business_mismatch',
  market_reality_constraint: 'goal_fantasy_risk'
};

function text(value) {
  return String(value || '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function answer(assessmentRecord, key) {
  return text(assessmentRecord?.inputs?.answers?.[key]);
}

function words(value) {
  return lower(value).split(/[^a-z0-9$.,+-]+/).filter(Boolean);
}

function hasAny(value, terms) {
  const haystack = lower(value);
  return terms.some((term) => haystack.includes(term));
}

function extractNumbers(value) {
  const matches = text(value).match(/\$?\d[\d,]*(?:\.\d+)?\s*(?:k|m|million|thousand)?/gi) || [];
  return matches.map((match) => match.trim());
}

function specificityScore(value) {
  const body = text(value);
  const count = words(body).length;
  const numbers = extractNumbers(body).length;
  if (count >= 80 || numbers >= 4) return 3;
  if (count >= 35 || numbers >= 2) return 2;
  if (count >= 12 || numbers >= 1) return 1;
  return 0;
}

function maturityFromText(value, systemTerms = []) {
  const body = lower(value);
  let score = 0;
  const evidence = [];
  if (hasAny(body, systemTerms)) {
    score += 1;
    evidence.push('mentions relevant system area');
  }
  if (hasAny(body, ['process', 'system', 'crm', 'cadence', 'follow-up', 'follow up', 'checklist', 'standard'])) {
    score += 1;
    evidence.push('mentions process/tooling language');
  }
  if (hasAny(body, ['consistent', 'weekly', 'daily', 'monthly', 'segmentation', 'a+', 'a, b, c', 'tracked'])) {
    score += 1;
    evidence.push('mentions repeatable cadence or segmentation');
  }
  if (hasAny(body, ['inspect', 'accountability', 'scorecard', 'review', 'measure', 'dashboard'])) {
    score += 1;
    evidence.push('mentions inspection or measurement');
  }
  if (hasAny(body, ['missing', 'weak', 'inconsistent', 'not', 'none', 'informal', 'memory'])) {
    score -= 1;
    evidence.push('mentions gaps or informality');
  }
  return {
    score: Math.max(0, Math.min(5, score)),
    evidence
  };
}

function unwrapCanonical(canonicalProfile) {
  return (
    canonicalProfile?.canonical_profile_json ||
    canonicalProfile?.canonical_dossier?.canonical_profile_json ||
    canonicalProfile?.canonical_dossier ||
    canonicalProfile ||
    {}
  );
}

function normalizeDimensionName(value) {
  const raw = lower(value);
  if (raw.includes('vector') || raw.includes('command')) return 'vector';
  if (raw.includes('velocity') || raw.includes('tempo')) return 'velocity';
  if (raw.includes('signal')) return 'signal';
  if (raw.includes('fidelity') || raw.includes('precision')) return 'fidelity';
  if (raw.includes('framework') || raw.includes('structure')) return 'framework';
  if (raw.includes('flex') || raw.includes('adapt')) return 'flex';
  if (raw.includes('leverage')) return 'leverage';
  if (raw.includes('horizon') || raw.includes('perspective')) return 'horizon';
  return raw;
}

function dimensionLabel(value) {
  const key = normalizeDimensionName(value);
  return DIMENSION_LABELS[key] || text(value) || 'Profile';
}

function rankedDimensions(canonical) {
  const ranked =
    canonical?.rescoring_gpt?.ranked_dimensions ||
    canonical?.rescoring_v1?.ranked_dimensions ||
    canonical?.ranked_dimensions ||
    canonical?.dimension_scores ||
    [];

  if (!Array.isArray(ranked)) return [];
  return ranked.map((item) => {
    const dimension = item.dimension || item.name || item.key || item.label;
    const value =
      item.display_score ??
      item.gpt_rescored_score ??
      item.support_adjusted_score ??
      item.raw_score ??
      item.score ??
      null;
    return {
      dimension: normalizeDimensionName(dimension),
      label: dimensionLabel(dimension),
      score: typeof value === 'number' ? value : Number(value),
      evidence_count: item.evidence_count ?? item.contributing_answer_count ?? null,
      confidence: item.confidence ?? null,
      intensity_band: item.intensity_band ?? null
    };
  });
}

function extractBehavioralReality(canonicalProfile) {
  const canonical = unwrapCanonical(canonicalProfile);
  const ranked = rankedDimensions(canonical);
  const renderReady = canonical?.render_ready || {};
  const dna =
    canonical?.behavioral_dna_interpretation ||
    canonical?.behavioral_dna ||
    canonical?.profile_dna ||
    {};

  const explicitProfileType =
    canonical?.profile_type ||
    canonical?.inferred_patterns?.profile_type ||
    canonical?.behavioral_profile?.profile_type ||
    renderReady?.profile_dna ||
    null;

  const primary = ranked[0] || null;
  const secondary = ranked[1] || null;

  return {
    profile_type:
      explicitProfileType ||
      (primary && secondary ? `${primary.label} / ${secondary.label}` : primary?.label || 'unknown'),
    ranked_dimensions: ranked,
    primary_engine: dna.primary_engine || renderReady.profile_dna || primary?.label || null,
    natural_advantage: dna.natural_advantage || canonical?.natural_advantage || null,
    natural_risk: dna.natural_risk || canonical?.natural_risk || null,
    pressure_pattern:
      dna.pressure_pattern ||
      renderReady.command_clarity ||
      canonical?.pressure_mechanics?.summary ||
      canonical?.stress_patterns?.summary ||
      null,
    role_fit: dna.role_fit_signals || canonical?.role_fit_analysis || canonical?.role_fit || null,
    wrong_seat_risk: dna.wrong_seat_risk || canonical?.wrong_seat_risk || null,
    source_shape: {
      has_canonical_profile_json: Boolean(canonicalProfile?.canonical_profile_json),
      has_rescoring_gpt: Boolean(canonical?.rescoring_gpt),
      ranked_dimension_count: ranked.length
    }
  };
}

function inferAgentStage(answers, assessmentType, model) {
  const q2 = answers.q2;
  const q8 = answers.q8;
  const q9 = answers.q9;
  const q11 = answers.q11;
  const q12 = answers.q12;
  const hasTeam = assessmentType === 'real_estate_team' || text(q11).length > 0;
  const financialNumbers = extractNumbers(q9).length;
  const systemsSpecific = specificityScore(q8);
  const scaleStress = hasAny(q12, ['break', 'bandwidth', 'delegate', 'systems', 'team', 'capacity']);

  let stage = hasTeam ? 'team_ready_agent' : 'inconsistent_producer';
  if (hasTeam && hasAny(q11, ['role', 'production', 'team'])) stage = 'team_ready_agent';
  else if (financialNumbers >= 4 && systemsSpecific >= 2 && scaleStress) stage = 'leverage_ready_agent';
  else if (financialNumbers >= 3 && systemsSpecific >= 2) stage = 'stable_solo_producer';
  else if (hasAny(q2, ['triple', 'scale', 'team', 'freedom']) && systemsSpecific <= 1) stage = 'overextended_agent';
  else if (hasAny(q1, ['not enough', 'no', 'inconsistent']) || hasAny(q6, ['unwilling', 'avoid'])) stage = 'inconsistent_producer';

  const stageDoc = (model?.agent_stage_model || []).find((item) => item.stage === stage);
  return {
    stage,
    label: stage.replace(/_/g, ' '),
    description: stageDoc?.description || null,
    likely_constraints: stageDoc?.likely_constraints || [],
    likely_one_move_categories: stageDoc?.likely_one_move_categories || []
  };
}

function buildBusinessReality(assessmentRecord, model) {
  const answers = assessmentRecord?.inputs?.answers || {};
  const assessmentType =
    assessmentRecord?.assessment_type || (text(answers.q11).length ? 'real_estate_team' : 'real_estate_agent');
  const stage = inferAgentStage(answers, assessmentType, model);
  const goalSpecificity = specificityScore(answers.q2);
  const financialSpecificity = specificityScore(answers.q9);
  const databaseSpecificity = specificityScore(answers.q3);

  return {
    assessment_type: assessmentType,
    current_stage: stage,
    goal_clarity: {
      score: goalSpecificity,
      evidence: answers.q2 ? ['q2 provided'] : ['q2 missing']
    },
    current_production_reality: {
      financial_detail_score: financialSpecificity,
      extracted_numbers: extractNumbers(answers.q9),
      evidence: answers.q9 ? ['q9 financial reality provided'] : ['q9 missing']
    },
    growth_ambition: {
      signal: hasAny(answers.q2 + ' ' + answers.q12, ['triple', 'scale', 'grow', 'freedom', 'team'])
        ? 'high'
        : goalSpecificity > 0
          ? 'present'
          : 'unclear',
      evidence: ['q2', 'q12'].filter((key) => text(answers[key]))
    },
    business_maturity: {
      stage: stage.stage,
      systems_specificity_score: specificityScore(answers.q8),
      accountability_specificity_score: specificityScore(answers.q7)
    },
    obvious_mismatches: [
      ...(goalSpecificity >= 2 && databaseSpecificity === 0
        ? ['Stated goals have weak database/relationship evidence.']
        : []),
      ...(goalSpecificity >= 2 && financialSpecificity === 0
        ? ['Stated goals have weak financial evidence.']
        : []),
      ...(hasAny(answers.q12, ['team', 'delegate', 'scale']) && specificityScore(answers.q8) <= 1
        ? ['Scaling ambition appears ahead of visible systems maturity.']
        : [])
    ]
  };
}

function buildBehaviorBusinessFusion(behavioralReality, assessmentRecord, model) {
  const answers = assessmentRecord?.inputs?.answers || {};
  const dims = behavioralReality.ranked_dimensions || [];
  const topKeys = dims.slice(0, 3).map((dim) => dim.dimension);
  const lowKeys = dims.slice(-2).map((dim) => dim.dimension);
  const rules = [];

  const weakSystems = specificityScore(`${answers.q5} ${answers.q8}`) <= 1 || hasAny(`${answers.q5} ${answers.q8}`, ['missing', 'weak', 'inconsistent', 'memory']);
  const weakFollowUp = hasAny(`${answers.q5} ${answers.q8}`, ['no follow', 'inconsistent', 'missing', 'weak']) || !hasAny(`${answers.q5} ${answers.q8}`, ['follow']);
  const weakAccountability = hasAny(answers.q7, ['nobody', 'no one', 'none', 'not']) || specificityScore(answers.q7) <= 1;
  const lowLeadGen = hasAny(answers.q6, ['unwilling', 'avoid', 'hate', 'not']) || hasAny(answers.q1, ['not enough']);
  const longGoals = specificityScore(answers.q2) >= 1;

  if (topKeys.includes('vector') && weakSystems) rules.push('Command + weak systems');
  if (topKeys.includes('velocity') && weakFollowUp) rules.push('Tempo + weak follow-up');
  if (topKeys.includes('signal') && weakAccountability) rules.push('Signal + weak accountability');
  if (topKeys.includes('fidelity') && lowLeadGen) rules.push('Precision + low lead generation');
  if (topKeys.includes('framework') && hasAny(`${answers.q1} ${answers.q12}`, ['change', 'adapt', 'shift'])) rules.push('Structure + low flexibility');
  if (hasAny(`${answers.q3} ${answers.q5}`, ['relationship', 'sphere', 'database']) && weakSystems) rules.push('Relationship builder + weak database systems');
  if (topKeys.includes('leverage') && weakAccountability) rules.push('High leverage + low accountability');
  if ((lowKeys.includes('horizon') || !topKeys.includes('horizon')) && longGoals) rules.push('Low horizon + long-term planning weakness');

  const matchedRules = (model?.behavior_fusion_rules || []).filter((rule) => rules.includes(rule.pattern));
  return {
    fusion_summary:
      matchedRules.map((rule) => rule.interpretation).join(' ') ||
      'Behavior profile and business intake are present, but no strong fusion pattern is yet dominant.',
    strengths: [
      ...topKeys.slice(0, 3).map((key) => `${DIMENSION_LABELS[key] || key} can support business execution when paired with visible systems.`),
      ...(specificityScore(answers.q2) >= 2 ? ['Goals are specific enough to begin testing business reality against desired future.'] : [])
    ],
    risks: matchedRules.map((rule) => rule.interpretation),
    likely_business_effects: matchedRules.flatMap((rule) => rule.likely_constraints || []),
    evidence: {
      top_dimensions: dims.slice(0, 3),
      low_dimensions: dims.slice(-2),
      matched_patterns: rules,
      source_questions: ['q2', 'q5', 'q6', 'q7', 'q8', 'q12']
    }
  };
}

function buildRelationshipReality(assessmentRecord) {
  const q3 = answer(assessmentRecord, 'q3');
  const q5 = answer(assessmentRecord, 'q5');
  const combined = `${q3} ${q5}`;
  const numbers = extractNumbers(q3);
  const segmentationPresent = hasAny(combined, ['a+', ' a ', ' b ', ' c ', ' d ', 'segmentation', 'segment']);
  const vendorPresent = hasAny(combined, ['vendor']);
  const databaseMentioned = hasAny(combined, ['database', 'crm', 'contacts', 'people', 'relationships']);
  const trueRelationshipsMentioned = hasAny(combined, ['true relationship', 'relationships']);

  return {
    database_size_mentions: numbers,
    true_relationship_count_mentioned: trueRelationshipsMentioned,
    segmentation_present: segmentationPresent,
    vendor_database_present: vendorPresent,
    relationship_asset_strength:
      databaseMentioned && segmentationPresent ? 'moderate_to_strong' : databaseMentioned ? 'unclear_or_understructured' : 'weak_evidence',
    lake_health:
      segmentationPresent && trueRelationshipsMentioned ? 'organized_lake_signal' : trueRelationshipsMentioned ? 'relationship_asset_present' : 'unclear',
    possible_false_database_confidence:
      numbers.length > 0 && !segmentationPresent ? 'possible_large_list_without_relationship_structure' : null,
    evidence: { q3, q5 }
  };
}

function buildLeadGenerationReality(assessmentRecord) {
  const q1 = answer(assessmentRecord, 'q1');
  const q4 = answer(assessmentRecord, 'q4');
  const q6 = answer(assessmentRecord, 'q6');
  const combined = `${q1} ${q4} ${q6}`;
  const enoughLeadsBelief = hasAny(q1, ['yes', 'enough']) && !hasAny(q1, ['not enough', 'no']);
  const notEnoughLeads = hasAny(q1, ['not enough', 'no', 'lack', 'need more']);
  const unwilling = hasAny(q6, ['unwilling', 'avoid', 'hate', 'not willing', 'refuse']);
  const sourceDiversity = [
    'sphere',
    'referral',
    'open house',
    'cold',
    'social',
    'video',
    'mail',
    'network',
    'database'
  ].filter((source) => combined.includes(source));

  return {
    believes_enough_leads: enoughLeadsBelief,
    lead_shortage_signal: notEnoughLeads,
    stated_generation_behaviors: text(q4),
    willingness_signal: unwilling ? 'resistance_present' : specificityScore(q6) > 0 ? 'willingness_described' : 'unclear',
    consistency_risk: unwilling || specificityScore(q4) <= 1 ? 'elevated' : 'moderate',
    lead_source_diversity: sourceDiversity,
    lead_generation_constraint_probability:
      notEnoughLeads || unwilling || sourceDiversity.length <= 1 ? 'elevated' : 'moderate',
    evidence: { q1, q4, q6 }
  };
}

function buildLeadConversionReality(assessmentRecord) {
  const q1 = answer(assessmentRecord, 'q1');
  const q5 = answer(assessmentRecord, 'q5');
  const q8 = answer(assessmentRecord, 'q8');
  const q9 = answer(assessmentRecord, 'q9');
  const combined = `${q1} ${q5} ${q8} ${q9}`;
  const followUpStrong = hasAny(combined, ['follow-up', 'follow up']) && hasAny(combined, ['consistent', 'cadence', 'crm', 'process']);
  const followUpWeak = hasAny(combined, ['weak', 'inconsistent', 'missing', 'none']) || !hasAny(combined, ['follow']);
  const speedClues = hasAny(combined, ['speed', 'quick', 'immediate', 'response', 'respond']);
  const conversionClues = hasAny(combined, ['conversion', 'appointment', 'pipeline', 'lead']);

  return {
    follow_up_system_strength: followUpStrong ? 'visible' : followUpWeak ? 'weak_or_missing' : 'unclear',
    speed_or_responsiveness_clues: speedClues,
    conversion_discipline: conversionClues && followUpStrong ? 'moderate' : conversionClues ? 'unclear' : 'weak_evidence',
    likely_issue: followUpWeak ? 'conversion_leakage_possible' : hasAny(q1, ['not enough']) ? 'lead_shortage_possible' : 'unclear',
    evidence: { q1, q5, q8, q9 }
  };
}

function buildSystemsReality(assessmentRecord) {
  const q5 = answer(assessmentRecord, 'q5');
  const q8 = answer(assessmentRecord, 'q8');
  const q11 = answer(assessmentRecord, 'q11');
  const combined = `${q5} ${q8}`;
  return {
    database_system: maturityFromText(q5, ['crm', 'database', 'segmentation']),
    listing_system: maturityFromText(q8, ['listing']),
    buyer_system: maturityFromText(q8, ['buyer']),
    lead_conversion_system: maturityFromText(combined, ['lead conversion', 'conversion', 'follow']),
    transaction_system: maturityFromText(q8, ['transaction']),
    financial_tracking_system: maturityFromText(answer(assessmentRecord, 'q9'), ['p&l', 'profit', 'expenses', 'gci']),
    recruiting_system_if_team: q11 ? maturityFromText(`${q8} ${q11}`, ['recruiting', 'role', 'team']) : { score: null, evidence: ['no team answer provided'] },
    accountability_rhythm: maturityFromText(answer(assessmentRecord, 'q7'), ['accountability', 'coach', 'manager', 'weekly', 'review']),
    overall_maturity_score: null
  };
}

function finalizeSystemsReality(systemsReality) {
  const scores = Object.values(systemsReality)
    .map((item) => item?.score)
    .filter((score) => typeof score === 'number');
  return {
    ...systemsReality,
    overall_maturity_score: scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
      : 0
  };
}

function buildAccountabilityReality(assessmentRecord) {
  const q7 = answer(assessmentRecord, 'q7');
  let score = 0;
  const signals = [];
  if (hasAny(q7, ['nobody', 'no one', 'none'])) {
    signals.push('no accountability signal');
  } else if (q7) {
    score += 1;
    signals.push('accountability source described');
  }
  if (hasAny(q7, ['coach', 'manager', 'team leader', 'partner'])) {
    score += 1;
    signals.push('external or leadership accountability source');
  }
  if (hasAny(q7, ['weekly', 'daily', 'cadence', 'regular', 'meeting'])) {
    score += 1;
    signals.push('cadence signal');
  }
  if (hasAny(q7, ['inspect', 'review', 'scorecard', 'track', 'measure'])) {
    score += 1;
    signals.push('inspection signal');
  }
  if (hasAny(q7, ['effective', 'works', 'strong'])) {
    score += 1;
    signals.push('effectiveness signal');
  }
  return {
    maturity_score: Math.max(0, Math.min(5, score)),
    maturity_label: ['none', 'informal', 'sporadic', 'consistent', 'behavior_linked', 'operating_system'][Math.max(0, Math.min(5, score))],
    accountability_source: q7,
    inspection_vs_encouragement: hasAny(q7, ['inspect', 'track', 'measure', 'scorecard']) ? 'inspection_present' : 'mostly_encouragement_or_unclear',
    evidence: signals
  };
}

function buildFinancialReality(assessmentRecord) {
  const q9 = answer(assessmentRecord, 'q9');
  const terms = {
    units: hasAny(q9, ['unit', 'closed']),
    volume: hasAny(q9, ['volume', 'sales volume']),
    average_sales_price: hasAny(q9, ['average sales price', 'asp']),
    gci: hasAny(q9, ['gci']),
    expenses: hasAny(q9, ['expense']),
    profit: hasAny(q9, ['profit', 'net income']),
    marketing_spend: hasAny(q9, ['marketing spend', 'ad spend', 'spend']),
    p_and_l: hasAny(q9, ['p&l', 'p/l', 'profit and loss']),
    team_overhead: hasAny(q9, ['team overhead', 'payroll', 'salary']),
    net_income: hasAny(q9, ['net income'])
  };
  const missing = Object.keys(terms).filter((key) => !terms[key]);
  return {
    extracted_numbers: extractNumbers(q9),
    fields_detected: terms,
    financial_clarity:
      extractNumbers(q9).length >= 4 && missing.length <= 5
        ? 'moderate_to_high'
        : extractNumbers(q9).length >= 2
          ? 'moderate'
          : q9
            ? 'low_detail'
            : 'missing',
    missing_financial_data: missing,
    missing_financials_as_evidence: missing.length >= 6,
    evidence: { q9 }
  };
}

function buildTeamReality(assessmentRecord) {
  const q11 = answer(assessmentRecord, 'q11');
  const assessmentType = assessmentRecord?.assessment_type || (q11 ? 'real_estate_team' : 'real_estate_agent');
  return {
    assessment_type: assessmentType,
    solo_or_team: assessmentType === 'real_estate_team' ? 'team_exists_or_team_signal_present' : 'solo_agent',
    team_profile_ids: assessmentRecord?.inputs?.team_profile_ids || [],
    roles_mentioned: hasAny(q11, ['role', 'assistant', 'agent', 'isa', 'tc', 'admin', 'ops']),
    production_notes_present: hasAny(q11, ['production', 'units', 'volume', 'gci']),
    team_dependency_risk:
      assessmentType === 'real_estate_team' && !hasAny(q11, ['role', 'accountability', 'production'])
        ? 'elevated'
        : assessmentType === 'real_estate_team'
          ? 'needs_future_team_intelligence'
          : 'not_applicable',
    leadership_or_leverage_clues: hasAny(q11, ['leader', 'owner', 'delegate', 'role', 'production']),
    future_work_note: 'Team profile IDs are stored, but team dossier intelligence is not fetched in Sprint 3B.',
    evidence: { q11 }
  };
}

function buildContradictionAnalysis(assessmentRecord, relationshipReality, leadGenerationReality, systemsReality, accountabilityReality, financialReality, teamReality) {
  const answers = assessmentRecord?.inputs?.answers || {};
  const contradictions = [];
  if (leadGenerationReality.believes_enough_leads && leadGenerationReality.lead_generation_constraint_probability === 'elevated') {
    contradictions.push({
      key: 'enough_leads_but_generation_weak',
      description: 'Says enough leads/opportunities may exist, but generation behavior or source diversity appears weak.',
      source_questions: ['q1', 'q4', 'q6']
    });
  }
  if (specificityScore(answers.q2) >= 2 && relationshipReality.relationship_asset_strength === 'weak_evidence') {
    contradictions.push({
      key: 'big_goals_weak_relationship_evidence',
      description: 'Goals are specific or ambitious, but database/relationship evidence is weak.',
      source_questions: ['q2', 'q3', 'q5']
    });
  }
  if (hasAny(`${answers.q5} ${answers.q8}`, ['system', 'process', 'crm']) && systemsReality.overall_maturity_score <= 1.5) {
    contradictions.push({
      key: 'systems_claim_without_process_detail',
      description: 'Systems are referenced, but repeatable process evidence is thin.',
      source_questions: ['q5', 'q8']
    });
  }
  if (teamReality.assessment_type === 'real_estate_team' && accountabilityReality.maturity_score <= 2) {
    contradictions.push({
      key: 'team_without_strong_accountability',
      description: 'Team signal exists, but accountability maturity appears low.',
      source_questions: ['q7', 'q11']
    });
  }
  if (hasAny(answers.q6, ['unwilling', 'not willing', 'avoid']) && specificityScore(answers.q2) >= 2) {
    contradictions.push({
      key: 'growth_goals_but_generation_resistance',
      description: 'Growth ambition may exceed willingness to perform required generation behavior.',
      source_questions: ['q2', 'q6']
    });
  }
  if (financialReality.extracted_numbers.length >= 2 && financialReality.missing_financials_as_evidence) {
    contradictions.push({
      key: 'production_numbers_without_financial_clarity',
      description: 'Some production data exists, but full financial clarity appears incomplete.',
      source_questions: ['q9']
    });
  }
  if (hasAny(answers.q12, ['break', 'systems', 'accountability', 'database']) && systemsReality.overall_maturity_score <= 2) {
    contradictions.push({
      key: 'tripled_goal_breaks_existing_operating_layer',
      description: 'Scaling answer points to a break in systems/accountability/database capacity.',
      source_questions: ['q8', 'q12']
    });
  }
  return {
    count: contradictions.length,
    contradictions
  };
}

function buildConstraintAnalysis(assessmentRecord, behavioralReality, model, realities) {
  const answers = assessmentRecord?.inputs?.answers || {};
  const framework = model?.constraint_detection_framework || {};
  const constraints = Object.entries(framework).map(([constraintKey, config]) => {
    let score = 0;
    const evidence = [];
    const sourceQuestions = config.evidence_questions || [];
    const answerText = sourceQuestions.map((key) => answers[key]).join(' ');

    for (const signal of config.signals || []) {
      const tokens = lower(signal).split(/[^a-z0-9]+/).filter((token) => token.length > 3);
      if (tokens.some((token) => lower(answerText).includes(token))) {
        score += 1;
        evidence.push(`signal:${signal}`);
      }
    }

    if (constraintKey === 'database_constraint' && realities.relationship_reality.relationship_asset_strength !== 'moderate_to_strong') score += 2;
    if (constraintKey === 'relationship_quality_constraint' && realities.relationship_reality.possible_false_database_confidence) score += 2;
    if (constraintKey === 'lead_generation_constraint' && realities.lead_generation_reality.lead_generation_constraint_probability === 'elevated') score += 2;
    if (constraintKey === 'lead_conversion_constraint' && realities.lead_conversion_reality.likely_issue === 'conversion_leakage_possible') score += 2;
    if (constraintKey === 'follow_up_constraint' && realities.lead_conversion_reality.follow_up_system_strength === 'weak_or_missing') score += 2;
    if (constraintKey === 'systems_constraint' && realities.systems_reality.overall_maturity_score <= 2) score += 2;
    if (constraintKey === 'accountability_constraint' && realities.accountability_reality.maturity_score <= 2) score += 2;
    if (constraintKey === 'financial_constraint' && realities.financial_reality.financial_clarity === 'missing') score += 2;
    if (constraintKey === 'team_structure_constraint' && realities.team_reality.team_dependency_risk === 'elevated') score += 2;
    if (constraintKey === 'leadership_constraint' && hasAny(answers.q12, ['leader', 'owner', 'bandwidth', 'delegate'])) score += 2;
    if (constraintKey === 'role_fit_constraint' && behavioralReality.wrong_seat_risk) score += 1;
    if (constraintKey === 'market_reality_constraint' && realities.business_reality.obvious_mismatches.length) score += 2;

    const behaviorModifiers = [];
    for (const modifier of config.behavior_patterns_that_worsen || []) {
      const topLabels = (behavioralReality.ranked_dimensions || []).slice(0, 3).map((dim) => lower(dim.label));
      if (topLabels.some((label) => lower(modifier).includes(label))) behaviorModifiers.push(modifier);
    }
    score += Math.min(2, behaviorModifiers.length);

    return {
      constraint_key: constraintKey,
      label: config.label,
      score,
      confidence: score >= 5 ? 'high' : score >= 3 ? 'moderate' : score >= 1 ? 'low' : 'thin',
      evidence,
      source_questions: sourceQuestions,
      behavior_modifiers: behaviorModifiers,
      likely_effect_if_unchanged: config.likely_future_if_unchanged,
      likely_one_move_categories: config.likely_one_move_categories || []
    };
  }).sort((a, b) => b.score - a.score);

  return {
    ranked_constraints: constraints,
    primary_constraint: constraints[0] || null
  };
}

function buildConfidenceEngine(assessmentRecord, behavioralReality, realities, contradictionAnalysis) {
  const answers = assessmentRecord?.inputs?.answers || {};
  const known = [];
  const observed = [];
  const inferred = [];
  const assumed = [];
  const missing = [];

  if (behavioralReality.source_shape?.ranked_dimension_count) known.push('behavioral_profile_ranked_dimensions');
  else missing.push('behavioral_profile_ranked_dimensions');

  for (const key of Object.keys(answers)) {
    const score = specificityScore(answers[key]);
    if (score >= 2) known.push(`${key}_specific`);
    else if (score === 1) observed.push(`${key}_present_but_thin`);
    else if (key !== 'q11') missing.push(`${key}_missing_or_vague`);
  }

  if (realities.financial_reality.financial_clarity === 'moderate_to_high') known.push('financial_detail');
  else missing.push('complete_financial_detail');

  if (realities.relationship_reality.database_size_mentions.length) known.push('database_numbers');
  else missing.push('database_numbers');

  if (contradictionAnalysis.count) inferred.push('contradictions_detected');
  if (!assessmentRecord?.inputs?.team_profile_ids?.length && assessmentRecord?.assessment_type === 'real_estate_team') {
    assumed.push('team_exists_without_profile_id_detail');
  }

  let score = 35;
  score += Math.min(20, known.length * 3);
  score += Math.min(15, observed.length * 2);
  score += behavioralReality.source_shape?.ranked_dimension_count ? 10 : -10;
  score += realities.financial_reality.extracted_numbers.length >= 3 ? 10 : -8;
  score += realities.relationship_reality.database_size_mentions.length ? 8 : -6;
  score += contradictionAnalysis.count >= 3 ? -8 : 0;
  score -= Math.min(18, missing.length * 2);
  score = Math.max(0, Math.min(100, score));

  return {
    known,
    observed,
    inferred,
    assumed,
    missing,
    confidence_score: score,
    confidence_band: score >= 75 ? 'high' : score >= 55 ? 'moderate' : score >= 35 ? 'low' : 'thin'
  };
}

function buildMissingData(assessmentRecord, financialReality, relationshipReality) {
  const answers = assessmentRecord?.inputs?.answers || {};
  const missing = [];
  for (let i = 1; i <= 12; i += 1) {
    const key = `q${i}`;
    if (key !== 'q11' && !text(answers[key])) missing.push(key);
  }
  if (!relationshipReality.database_size_mentions.length) missing.push('specific_database_or_relationship_count');
  if (financialReality.missing_financial_data.length) missing.push(...financialReality.missing_financial_data.map((field) => `financial_${field}`));
  return [...new Set(missing)];
}

function chooseTrajectorySignal(primaryConstraint) {
  return {
    signal: TRAJECTORY_BY_CONSTRAINT[primaryConstraint?.constraint_key] || 'behavior_business_mismatch',
    source_constraint: primaryConstraint?.constraint_key || null,
    label: primaryConstraint?.label || null
  };
}

export function buildBusinessIntelligenceDraft({
  assessmentRecord,
  canonicalProfile,
  realEstateBusinessModel
}) {
  if (!assessmentRecord || typeof assessmentRecord !== 'object') {
    throw new Error('assessmentRecord is required');
  }

  const model = realEstateBusinessModel || {};
  const generatedAt = new Date().toISOString();
  const behavioralReality = extractBehavioralReality(canonicalProfile || {});
  const businessReality = buildBusinessReality(assessmentRecord, model);
  const relationshipReality = buildRelationshipReality(assessmentRecord);
  const leadGenerationReality = buildLeadGenerationReality(assessmentRecord);
  const leadConversionReality = buildLeadConversionReality(assessmentRecord);
  const systemsReality = finalizeSystemsReality(buildSystemsReality(assessmentRecord));
  const accountabilityReality = buildAccountabilityReality(assessmentRecord);
  const financialReality = buildFinancialReality(assessmentRecord);
  const teamReality = buildTeamReality(assessmentRecord);
  const behaviorBusinessFusion = buildBehaviorBusinessFusion(behavioralReality, assessmentRecord, model);

  const realities = {
    business_reality: businessReality,
    relationship_reality: relationshipReality,
    lead_generation_reality: leadGenerationReality,
    lead_conversion_reality: leadConversionReality,
    systems_reality: systemsReality,
    accountability_reality: accountabilityReality,
    financial_reality: financialReality,
    team_reality: teamReality
  };
  const contradictionAnalysis = buildContradictionAnalysis(
    assessmentRecord,
    relationshipReality,
    leadGenerationReality,
    systemsReality,
    accountabilityReality,
    financialReality,
    teamReality
  );
  const constraintAnalysis = buildConstraintAnalysis(assessmentRecord, behavioralReality, model, {
    ...realities,
    business_reality: businessReality
  });
  const confidenceEngine = buildConfidenceEngine(assessmentRecord, behavioralReality, realities, contradictionAnalysis);
  const currentTrajectorySignal = chooseTrajectorySignal(constraintAnalysis.primary_constraint);
  const missingData = buildMissingData(assessmentRecord, financialReality, relationshipReality);

  return {
    version: DRAFT_VERSION,
    generated_at: generatedAt,
    owner_profile_id: assessmentRecord.owner_profile_id || assessmentRecord.profile_context?.owner_profile_id || null,
    assessment_id: assessmentRecord.assessment_id || null,
    business_reality: businessReality,
    behavioral_reality: behavioralReality,
    behavior_business_fusion: behaviorBusinessFusion,
    relationship_reality: relationshipReality,
    lead_generation_reality: leadGenerationReality,
    lead_conversion_reality: leadConversionReality,
    systems_reality: systemsReality,
    accountability_reality: accountabilityReality,
    financial_reality: financialReality,
    team_reality: teamReality,
    contradiction_analysis: contradictionAnalysis,
    constraint_analysis: constraintAnalysis,
    confidence_engine: confidenceEngine,
    current_trajectory_signal: currentTrajectorySignal,
    missing_data: missingData,
    assumptions: [
      'Sprint 3B uses deterministic structured reasoning only.',
      'Team member profile IDs are stored but not fetched for team intelligence in this sprint.',
      'Financial parsing is evidence-oriented and intentionally avoids exact financial modeling.'
    ],
    debug_trace: {
      model_id: model?.metadata?.model_id || null,
      source_doc: model?.metadata?.source_doc || null,
      answer_keys_present: Object.keys(assessmentRecord?.inputs?.answers || {}),
      ranked_dimension_count: behavioralReality.ranked_dimensions.length,
      primary_constraint: constraintAnalysis.primary_constraint?.constraint_key || null
    }
  };
}

export default buildBusinessIntelligenceDraft;
