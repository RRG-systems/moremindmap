export const REAL_ESTATE_BUSINESS_MODEL_METADATA = {
  model_id: 'real_estate_business_model_v1',
  version: '1.0.0',
  source_doc: 'docs/REAL_ESTATE_BUSINESS_MODEL_V1.md',
  purpose:
    'App-readable operating doctrine for interpreting real estate business assessment intake, behavioral profile context, constraints, confidence, future inputs, and One Move inputs.',
  created_for: 'MORE MindMap Business Assessment V1'
};

export const CORE_DOCTRINE = {
  equations: [
    {
      label: 'Reality + Behavior = Future',
      meaning:
        'The business is already producing a future through current facts, habits, systems, financial reality, accountability, and behavioral patterns.'
    },
    {
      label: 'Business Reality + Behavioral Reality = Future Business Trajectory',
      meaning:
        'Business facts explain what is happening; behavioral profile explains why the same business plan is adopted, resisted, distorted, or sustained differently by each operator.'
    },
    {
      label: 'E -> P',
      meaning:
        'The business must move from entrepreneurial effort and personal memory into purposeful models, systems, tools, accountability, coaching, and ongoing education.'
    }
  ],
  concepts: {
    lake: {
      label: 'The Lake',
      definition:
        'The agent or team relationship asset: the people who know, trust, remember, refer, repeat, or can be reactivated into opportunity.',
      rule: 'A business without a healthy lake becomes dependent on constant new-lead pressure.'
    },
    database_as_primary_asset: {
      label: 'Database as primary business asset',
      definition:
        'The database is not a contact list. It is the operating asset that stores relationship trust, timing, visibility, referral capacity, and reactivation potential.'
    },
    thirty_five_touch_doctrine: {
      label: '35+ meaningful touch doctrine',
      definition:
        'Strong relationship businesses maintain high-frequency meaningful contact so relationships do not decay into forgotten contacts.',
      standard: '35+ annual touches is a field doctrine benchmark, not an exact law.'
    },
    one_move_principle: {
      label: 'One Move principle',
      definition:
        'Do not prescribe many actions. Identify the highest-leverage intervention most likely to change the business trajectory.'
    }
  }
};

export const E_TO_P_FRAMEWORK = {
  entrepreneurial_mode_traits: [
    'personal effort carries the business',
    'memory substitutes for process',
    'urgency substitutes for model clarity',
    'revenue can rise while reliability stays weak',
    'leader solves too much directly',
    'business works when the owner is involved and degrades when they are absent'
  ],
  purposeful_mode_pillars: {
    models: 'Clear operating models define how the business creates, converts, serves, and scales opportunity.',
    systems: 'Repeatable systems reduce reliance on memory and mood.',
    tools: 'CRM, financial, transaction, accountability, and communication tools support execution without becoming the strategy.',
    accountability: 'Execution is inspected, corrected, and reinforced on a visible cadence.',
    coaching: 'External or internal coaching helps translate intention into inspected behavior.',
    ongoing_education: 'Skill and market adaptation continue after initial success.'
  },
  stage_markers: [
    {
      stage: 'e_mode',
      label: 'Entrepreneurial mode',
      markers: ['high personal effort', 'weak process capture', 'reactive problem solving', 'unclear leverage model']
    },
    {
      stage: 'transition',
      label: 'E -> P transition',
      markers: ['some systems exist', 'follow-through is uneven', 'leader still translates too much', 'accountability is inconsistent']
    },
    {
      stage: 'p_mode',
      label: 'Purposeful mode',
      markers: ['models are visible', 'systems are inspected', 'tools support process', 'leader judgment becomes transferable']
    }
  ]
};

export const DATABASE_RELATIONSHIP_MODEL = {
  true_relationship_definition:
    'A true relationship is someone who knows the agent or team and thinks of them when it is time to buy, sell, or refer.',
  database_vs_relationship_distinction: {
    database: 'Names and contact records that can be organized, segmented, touched, and measured.',
    relationship: 'A living trust asset with memory, relevance, timing, and referral potential.'
  },
  relationship_categories: [
    'past_clients',
    'sphere',
    'referral_partners',
    'vendors',
    'community_connections',
    'open_house_relationships',
    'online_leads_with_relationship_potential',
    'cold_contacts_not_yet_relationships'
  ],
  relationship_decay_stages: [
    { stage: 0, label: 'active_trust', signal: 'recent meaningful contact and clear mindshare' },
    { stage: 1, label: 'warm_but_unmanaged', signal: 'relationship exists but contact rhythm is inconsistent' },
    { stage: 2, label: 'recognition_without_recall', signal: 'person may know the agent but not think of them in time' },
    { stage: 3, label: 'stale_contact', signal: 'record exists but relationship value has decayed' },
    { stage: 4, label: 'lost_asset', signal: 'database record no longer represents usable opportunity' }
  ],
  thirty_five_touch_doctrine: {
    label: '35+ meaningful touches',
    usage: 'Use as a relationship-maintenance benchmark and confidence signal, not a rigid mathematical law.',
    weak_signal: 'low frequency, generic touches, or no visible contact rhythm',
    strong_signal: 'high frequency, relevant, human, segmented, and sustained contact'
  },
  segmentation: {
    a_plus: 'Highest trust and highest likely repeat/referral capacity.',
    a: 'Strong relationships with meaningful referral or transaction potential.',
    b: 'Known relationships needing consistent nurturing.',
    c: 'Weak or emerging relationships that need more relevance and contact.',
    d: 'Low-quality or cold records with little current relationship value.'
  },
  vendor_database_logic:
    'Vendor relationships can become a business-generation asset when they are organized, touched, and integrated into referral/relationship strategy.',
  health_indicators: {
    strong: [
      'clear count of true relationships',
      'segmentation exists',
      'contact frequency is visible',
      'past clients are actively touched',
      'referral partners are maintained',
      'reactivation opportunities are known'
    ],
    weak: [
      'large contact count with low relationship clarity',
      'no segmentation',
      'irregular follow-up',
      'CRM as storage only',
      'unclear past-client rhythm',
      'no vendor or referral partner strategy'
    ]
  },
  directional_database_economics: {
    note: 'Working heuristics for directional reasoning, not exact laws.',
    examples: [
      { true_relationships: 250, approximate_business_value: 125000 },
      { true_relationships: 500, approximate_business_value: 250000 },
      { true_relationships: 1000, approximate_business_value: 500000 },
      { true_relationships: 2000, approximate_business_value: 1000000 }
    ]
  }
};

export const LEAD_GENERATION_MODEL = {
  sources: [
    {
      source: 'sphere',
      strengths: ['trust-based', 'high conversion potential', 'compounds over time'],
      risks: ['relationship decay', 'under-contact', 'false confidence from knowing many people'],
      good_fit: ['relationship builders', 'high Signal', 'consistent follow-up operators'],
      weak_fit: ['agents avoiding contact', 'weak database discipline']
    },
    {
      source: 'referrals',
      strengths: ['borrowed trust', 'high intent', 'lower acquisition cost'],
      risks: ['uninspected partner base', 'weak reciprocity', 'inconsistent ask'],
      good_fit: ['trust builders', 'community-oriented agents', 'strong service operators'],
      weak_fit: ['low service consistency', 'poor follow-through']
    },
    {
      source: 'open_houses',
      strengths: ['live conversations', 'local market contact', 'low-cost opportunity creation'],
      risks: ['poor capture', 'no follow-up', 'low conversion discipline'],
      good_fit: ['high social stamina', 'newer agents', 'agents needing relationship creation'],
      weak_fit: ['agents unwilling to follow up quickly']
    },
    {
      source: 'cold_calling',
      strengths: ['direct activity', 'fast feedback', 'controllable volume'],
      risks: ['avoidance', 'burnout', 'poor scripts', 'weak persistence'],
      good_fit: ['high Tempo', 'high Command', 'high rejection tolerance'],
      weak_fit: ['low outbound tolerance', 'low accountability']
    },
    {
      source: 'geo_farming',
      strengths: ['market presence', 'local authority', 'compounding visibility'],
      risks: ['long time horizon', 'inconsistent touch plan', 'underfunding'],
      good_fit: ['long-term discipline', 'community presence', 'consistent marketers'],
      weak_fit: ['low Horizon', 'impatient operators', 'weak follow-through']
    },
    {
      source: 'online_leads',
      strengths: ['scalable volume', 'measurable funnel', 'fast demand capture'],
      risks: ['lead addiction', 'low conversion', 'high spend without profit clarity'],
      good_fit: ['fast response teams', 'strong follow-up systems', 'conversion-focused operators'],
      weak_fit: ['slow response', 'weak CRM discipline', 'profit-blind operators']
    },
    {
      source: 'social_media',
      strengths: ['visibility', 'trust warming', 'low-cost content distribution'],
      risks: ['vanity activity', 'inconsistent message', 'no conversion path'],
      good_fit: ['consistent communicators', 'relationship-driven brands'],
      weak_fit: ['agents substituting posting for conversations']
    },
    {
      source: 'video',
      strengths: ['authority building', 'personality transfer', 'trust at scale'],
      risks: ['production avoidance', 'inconsistent cadence', 'no audience strategy'],
      good_fit: ['clear communicators', 'educators', 'market interpreters'],
      weak_fit: ['agents unwilling to publish consistently']
    },
    {
      source: 'direct_mail',
      strengths: ['geographic repetition', 'brand recall', 'listing presence'],
      risks: ['cost without tracking', 'generic messaging', 'weak follow-up integration'],
      good_fit: ['geo farmers', 'listing-focused agents', 'consistent budget owners'],
      weak_fit: ['profit-blind spenders', 'short time horizon']
    },
    {
      source: 'community',
      strengths: ['local trust', 'relationship density', 'referral proximity'],
      risks: ['activity without capture', 'unmeasured networking', 'slow compounding'],
      good_fit: ['service-minded agents', 'relationship builders'],
      weak_fit: ['agents who do not convert contact into database process']
    },
    {
      source: 'networking',
      strengths: ['partner creation', 'visibility', 'trust expansion'],
      risks: ['random meetings', 'no follow-up', 'weak partner logic'],
      good_fit: ['high Signal', 'high social initiative', 'referral strategists'],
      weak_fit: ['agents who collect contacts without maintaining them']
    },
    {
      source: 'database_reactivation',
      strengths: ['recovers hidden revenue', 'low acquisition cost', 'relationship-aligned'],
      risks: ['stale data', 'awkward outreach', 'no segmentation'],
      good_fit: ['large neglected databases', 'relationship-rich agents', 'disciplined follow-up operators'],
      weak_fit: ['small database', 'unwillingness to contact past relationships']
    }
  ]
};

export const LEAD_CONVERSION_FOLLOW_UP_MODEL = {
  speed_to_lead_principle:
    'Response speed matters most when lead intent is active, but speed without persistence and relevance still leaks pipeline.',
  follow_up_persistence:
    'Conversion improves when follow-up continues beyond the first attempt and moves people toward appointment, agreement, and next action.',
  pipeline_decay:
    'Every unworked lead, delayed response, vague next step, or forgotten follow-up reduces future opportunity.',
  constraint_signals: [
    'slow response',
    'few follow-up attempts',
    'no next-step standard',
    'low appointment conversion',
    'leads marked dead too early',
    'no long-term nurture',
    'unclear pipeline stages',
    'paid leads without profitability visibility'
  ],
  minimum_system_standards: [
    'lead source captured',
    'response standard defined',
    'follow-up cadence defined',
    'appointment objective clear',
    'pipeline stage visible',
    'long-term nurture exists',
    'conversion metrics reviewed',
    'ownership assigned'
  ]
};

export const SYSTEMS_MODEL = {
  required_systems: [
    'listing_system',
    'buyer_system',
    'database_system',
    'lead_conversion_system',
    'transaction_management_system',
    'financial_tracking_system',
    'recruiting_system_if_team',
    'accountability_rhythm',
    'relationship_maintenance_system'
  ],
  maturity_stages: [
    { stage: 0, label: 'absent', description: 'No reliable system; work happens from memory or urgency.' },
    { stage: 1, label: 'informal', description: 'Process exists in the owner’s head but is not captured or inspected.' },
    { stage: 2, label: 'documented_lightly', description: 'Some steps are written or tool-based but inconsistently used.' },
    { stage: 3, label: 'repeatable', description: 'Core process is visible, repeatable, and usable by others.' },
    { stage: 4, label: 'inspected', description: 'System use is measured, coached, and corrected.' },
    { stage: 5, label: 'optimized', description: 'System improves based on results, feedback, and role clarity.' }
  ]
};

export const ACCOUNTABILITY_MODEL = {
  maturity_stages: [
    { stage: 0, label: 'none', description: 'No one inspects execution.' },
    { stage: 1, label: 'emotional_or_informal', description: 'Accountability is encouragement, pressure, or guilt without inspection.' },
    { stage: 2, label: 'sporadic', description: 'Some check-ins happen but cadence and consequences are unclear.' },
    { stage: 3, label: 'consistent', description: 'Activity and outcomes are reviewed on a visible rhythm.' },
    { stage: 4, label: 'behavior_linked', description: 'Accountability connects goals to specific behaviors and corrections.' },
    { stage: 5, label: 'operating_system', description: 'Inspection, feedback, coaching, and standards are built into the business.' }
  ]
};

export const FINANCIAL_REALITY_MODEL = {
  interpretation_fields: [
    'units',
    'volume',
    'average_sales_price',
    'gci',
    'expenses',
    'profit',
    'marketing_spend',
    'p_and_l',
    'team_overhead',
    'net_income'
  ],
  missing_financials_as_evidence:
    'Missing financials are not neutral. They indicate low financial visibility and reduce confidence in growth, profitability, and investment recommendations.',
  interpretation_rules: [
    'Separate production from profit.',
    'Separate revenue growth from expense growth.',
    'Treat marketing spend without conversion data as a risk signal.',
    'Treat team overhead without productivity visibility as a leverage-risk signal.',
    'Use missing numbers to lower confidence, not to invent precision.'
  ]
};

export const AGENT_STAGE_MODEL = [
  {
    stage: 'early_stage_agent',
    description: 'Still building skill, database, habits, and repeatable opportunity creation.',
    primary_risks: ['activity inconsistency', 'small relationship asset', 'low conversion skill'],
    likely_constraints: ['lead_generation_constraint', 'relationship_quality_constraint', 'accountability_constraint'],
    likely_one_move_categories: ['build_database', 'install_accountability', 'create_daily_generation_rhythm']
  },
  {
    stage: 'inconsistent_producer',
    description: 'Can produce, but results swing because activity, follow-up, or accountability are unstable.',
    primary_risks: ['pipeline gaps', 'reactive work', 'goal fantasy'],
    likely_constraints: ['follow_up_constraint', 'accountability_constraint', 'systems_constraint'],
    likely_one_move_categories: ['standardize_follow_up', 'inspect_weekly_activity', 'clarify_pipeline']
  },
  {
    stage: 'stable_solo_producer',
    description: 'Has a working solo business with some repeatability but may still depend heavily on personal effort.',
    primary_risks: ['owner dependency', 'underdeveloped systems', 'profit blindness'],
    likely_constraints: ['systems_constraint', 'financial_constraint', 'database_constraint'],
    likely_one_move_categories: ['document_core_system', 'clean_database', 'build_financial_review']
  },
  {
    stage: 'high_producing_solo_agent',
    description: 'Strong production, often with increasing stress from personal involvement and delivery load.',
    primary_risks: ['overextension', 'service inconsistency', 'missed leverage'],
    likely_constraints: ['leadership_constraint', 'systems_constraint', 'role_fit_constraint'],
    likely_one_move_categories: ['transfer_judgment', 'hire_support', 'narrow_highest_value_role']
  },
  {
    stage: 'leverage_ready_agent',
    description: 'Production supports leverage, but the model must be clear before adding people or spend.',
    primary_risks: ['hiring before clarity', 'delegating chaos', 'margin compression'],
    likely_constraints: ['systems_constraint', 'financial_constraint', 'team_structure_constraint'],
    likely_one_move_categories: ['define_model_before_hiring', 'install_role_scorecards', 'protect_profit']
  },
  {
    stage: 'team_ready_agent',
    description: 'Business has enough opportunity, systems, and economic visibility to begin or expand team structure.',
    primary_risks: ['leader dependency', 'unclear lead distribution', 'low agent productivity'],
    likely_constraints: ['team_structure_constraint', 'leadership_constraint', 'accountability_constraint'],
    likely_one_move_categories: ['build_team_operating_model', 'install_agent_accountability', 'clarify_lead_rules']
  },
  {
    stage: 'stalled_agent',
    description: 'Business has plateaued because current behavior and business structure are already producing the same result.',
    primary_risks: ['repeating old model', 'avoidance', 'uninspected constraint'],
    likely_constraints: ['behavior_business_mismatch', 'accountability_constraint', 'market_reality_constraint'],
    likely_one_move_categories: ['identify_primary_constraint', 'change_generation_method', 'increase_inspection']
  },
  {
    stage: 'overextended_agent',
    description: 'Production demands exceed the agent’s current systems, support, or role design.',
    primary_risks: ['burnout', 'client experience degradation', 'growth turning into fragility'],
    likely_constraints: ['systems_constraint', 'leadership_constraint', 'role_fit_constraint'],
    likely_one_move_categories: ['stop_owning_low_value_work', 'build_support_system', 'transfer_execution']
  }
];

export const TEAM_STAGE_MODEL = {
  healthy_team_definition:
    'A healthy real estate team is not a high-producing agent surrounded by helpers. It has role clarity, recruiting logic, agent productivity standards, lead distribution rules, accountability cadence, database ownership rules, transaction reliability, and profitability visibility.',
  dimensions: [
    'team_leader_dependency',
    'role_clarity',
    'recruiting',
    'agent_productivity',
    'database_ownership',
    'lead_distribution',
    'profitability',
    'leadership_bottleneck',
    'wrong_seat_risk'
  ],
  risk_rules: [
    'If the leader resolves every ambiguity, the team is learning the leader instead of learning a system.',
    'If leads are distributed without accountability, opportunity becomes entitlement.',
    'If roles are unclear, people interpret success differently.',
    'If profitability is invisible, team growth can make the business weaker.'
  ]
};

export const FAILURE_MODES = [
  'not_enough_relationships',
  'false_database_confidence',
  'lead_addiction',
  'poor_follow_up',
  'no_crm_discipline',
  'no_accountability',
  'inconsistent_lead_generation',
  'weak_systems',
  'unclear_goals',
  'profit_blindness',
  'overbuilding_team_before_systems',
  'hiring_before_model_clarity',
  'goal_fantasy_unsupported_by_business_reality',
  'behavior_business_mismatch'
];

export const CONSTRAINT_DETECTION_FRAMEWORK = {
  database_constraint: {
    label: 'Database Constraint',
    description: 'The database is too small, too disorganized, too stale, or too unclear to support the desired future.',
    signals: ['unknown database size', 'no segmentation', 'large list with few true relationships', 'low contact rhythm'],
    evidence_questions: ['q3', 'q5', 'q9'],
    behavior_patterns_that_worsen: ['avoidance of organization', 'low Structure', 'overconfidence in memory'],
    likely_future_if_unchanged: 'Growth depends on constant new opportunity because the relationship asset does not compound.',
    likely_one_move_categories: ['clean_database', 'segment_relationships', 'reactivate_lake']
  },
  relationship_quality_constraint: {
    label: 'Relationship Quality Constraint',
    description: 'The person knows people, but not enough people know, remember, trust, or refer them at the needed level.',
    signals: ['unclear true relationship count', 'weak referral flow', 'low meaningful touch cadence'],
    evidence_questions: ['q3', 'q4', 'q5'],
    behavior_patterns_that_worsen: ['transaction-only contact', 'low Signal', 'low follow-through'],
    likely_future_if_unchanged: 'Relationship value decays and the business must buy or chase more demand.',
    likely_one_move_categories: ['increase_meaningful_touches', 'build_referral_cadence']
  },
  lead_generation_constraint: {
    label: 'Lead Generation Constraint',
    description: 'The business does not create enough new opportunity through consistent behavior or reliable source strategy.',
    signals: ['insufficient leads', 'unwillingness to perform generation activities', 'no daily/weekly rhythm'],
    evidence_questions: ['q1', 'q4', 'q6'],
    behavior_patterns_that_worsen: ['low Tempo', 'avoidance', 'uninspected activity'],
    likely_future_if_unchanged: 'Pipeline gaps continue and goals remain unsupported by activity.',
    likely_one_move_categories: ['choose_generation_lane', 'install_generation_rhythm', 'inspect_activity']
  },
  lead_conversion_constraint: {
    label: 'Lead Conversion Constraint',
    description: 'Opportunity exists but does not turn into appointments, agreements, or closings reliably.',
    signals: ['many leads but weak results', 'poor appointment conversion', 'weak scripts/process'],
    evidence_questions: ['q1', 'q4', 'q8', 'q9'],
    behavior_patterns_that_worsen: ['slow response', 'low persistence', 'low Precision in follow-up'],
    likely_future_if_unchanged: 'The business keeps needing more leads to compensate for conversion leakage.',
    likely_one_move_categories: ['tighten_conversion_process', 'track_pipeline_stages', 'train_appointment_skill']
  },
  follow_up_constraint: {
    label: 'Follow-Up Constraint',
    description: 'The business loses opportunity after first contact because persistence, cadence, and next steps are weak.',
    signals: ['no follow-up process', 'CRM not used', 'no nurture cadence', 'forgotten leads'],
    evidence_questions: ['q5', 'q6', 'q8'],
    behavior_patterns_that_worsen: ['high Tempo with low Structure', 'low accountability', 'novelty chasing'],
    likely_future_if_unchanged: 'Pipeline decay hides inside the business and revenue leaks silently.',
    likely_one_move_categories: ['install_follow_up_standard', 'create_nurture_cadence']
  },
  systems_constraint: {
    label: 'Systems Constraint',
    description: 'The business runs through memory, effort, and owner involvement instead of visible repeatable systems.',
    signals: ['missing process', 'unclear listing/buyer/transaction standards', 'work depends on owner'],
    evidence_questions: ['q5', 'q8', 'q12'],
    behavior_patterns_that_worsen: ['Command with weak systems', 'low Structure', 'improvisation under pressure'],
    likely_future_if_unchanged: 'Growth creates rework, confusion, and owner dependency.',
    likely_one_move_categories: ['document_core_system', 'transfer_judgment', 'install_operating_cadence']
  },
  accountability_constraint: {
    label: 'Accountability Constraint',
    description: 'Execution is not inspected strongly enough for goals to become behavior.',
    signals: ['nobody accountable', 'weak coaching cadence', 'no consequence or correction loop'],
    evidence_questions: ['q7', 'q10', 'q12'],
    behavior_patterns_that_worsen: ['high autonomy', 'low Structure', 'goal fantasy'],
    likely_future_if_unchanged: 'Intentions remain high while behavior stays inconsistent.',
    likely_one_move_categories: ['install_weekly_accountability', 'define_activity_scorecard']
  },
  financial_constraint: {
    label: 'Financial Constraint',
    description: 'The business lacks financial visibility or economics strong enough to support the desired next stage.',
    signals: ['missing P&L', 'unknown profit', 'high spend without ROI', 'team overhead unclear'],
    evidence_questions: ['q9', 'q10', 'q12'],
    behavior_patterns_that_worsen: ['growth bias without financial review', 'low Precision', 'profit blindness'],
    likely_future_if_unchanged: 'Revenue can grow while profit, cash flow, or leverage quality deteriorates.',
    likely_one_move_categories: ['build_financial_dashboard', 'review_profit_by_source', 'protect_margin']
  },
  team_structure_constraint: {
    label: 'Team Structure Constraint',
    description: 'Team roles, lead rules, productivity standards, or ownership are unclear.',
    signals: ['unclear roles', 'low agent productivity', 'lead distribution complaints', 'leader remains hub'],
    evidence_questions: ['q8', 'q11', 'q12'],
    behavior_patterns_that_worsen: ['leader rescues ambiguity', 'weak accountability', 'hiring before model clarity'],
    likely_future_if_unchanged: 'The team gets more expensive without becoming more scalable.',
    likely_one_move_categories: ['clarify_roles', 'install_agent_scorecards', 'define_lead_distribution_rules']
  },
  leadership_constraint: {
    label: 'Leadership Constraint',
    description: 'The leader’s judgment, pace, or ambiguity resolution is the limiting transfer point.',
    signals: ['everyone waits on leader', 'decisions route through owner', 'leader bandwidth is the first break'],
    evidence_questions: ['q7', 'q8', 'q11', 'q12'],
    behavior_patterns_that_worsen: ['high Command', 'high Adaptability without codification', 'low delegation'],
    likely_future_if_unchanged: 'Growth depends too heavily on the leader’s personal judgment.',
    likely_one_move_categories: ['transfer_judgment', 'stop_owning_function', 'build_operator_layer']
  },
  role_fit_constraint: {
    label: 'Role Fit Constraint',
    description: 'The operator is spending too much time in work that does not match their highest-value contribution.',
    signals: ['energy drain', 'wrong-seat tasks', 'leader doing low-leverage work'],
    evidence_questions: ['q6', 'q7', 'q8', 'q12'],
    behavior_patterns_that_worsen: ['poor delegation', 'identity tied to control', 'unwillingness to hire'],
    likely_future_if_unchanged: 'The operator becomes the ceiling instead of the multiplier.',
    likely_one_move_categories: ['narrow_role', 'delegate_function', 'hire_operator']
  },
  market_reality_constraint: {
    label: 'Market Reality Constraint',
    description: 'Goals are not grounded in market conditions, source economics, capacity, or timing.',
    signals: ['goals disconnected from lead math', 'no market plan', 'unproven assumptions'],
    evidence_questions: ['q1', 'q2', 'q9', 'q12'],
    behavior_patterns_that_worsen: ['low Horizon', 'overconfidence', 'avoidance of numbers'],
    likely_future_if_unchanged: 'The business continues pursuing a future its current model does not support.',
    likely_one_move_categories: ['ground_goal_math', 'choose_market_strategy', 'test_assumptions']
  }
};

export const QUESTION_INTERPRETATION_MAP = {
  q1: {
    primary_reality_revealed: 'Business Awareness Reality',
    signals_to_extract: ['lead sufficiency', 'opportunity clarity', 'self-awareness'],
    contradictions_to_detect: ['claims enough leads but weak revenue', 'claims not enough leads but weak follow-up'],
    possible_constraints: ['lead_generation_constraint', 'lead_conversion_constraint', 'follow_up_constraint'],
    behavior_modifiers: ['Command may overstate control', 'Signal may notice quality problems'],
    confidence_effects: ['specific source detail raises confidence', 'vague yes/no lowers confidence']
  },
  q2: {
    primary_reality_revealed: 'Desired Future',
    signals_to_extract: ['goal specificity', 'time horizon', 'life-business alignment'],
    contradictions_to_detect: ['large goals without activity/system/financial support'],
    possible_constraints: ['market_reality_constraint', 'financial_constraint', 'systems_constraint'],
    behavior_modifiers: ['low Horizon may weaken long-term planning', 'high Command may overreach without model'],
    confidence_effects: ['specific staged goals raise confidence', 'fantasy language lowers confidence']
  },
  q3: {
    primary_reality_revealed: 'Relationship Asset Reality',
    signals_to_extract: ['database size', 'true relationship count', 'relationship quality'],
    contradictions_to_detect: ['large database with few true relationships'],
    possible_constraints: ['database_constraint', 'relationship_quality_constraint'],
    behavior_modifiers: ['high Signal may maintain relationship quality', 'low Structure may leave asset disorganized'],
    confidence_effects: ['counts and definitions raise confidence', 'unknown counts lower confidence']
  },
  q4: {
    primary_reality_revealed: 'Business Generation Behavior',
    signals_to_extract: ['default generation behavior', 'willingness to initiate', 'specificity'],
    contradictions_to_detect: ['says wants growth but has no same-day generation behavior'],
    possible_constraints: ['lead_generation_constraint', 'relationship_quality_constraint'],
    behavior_modifiers: ['high Tempo may act quickly', 'low Signal may skip relationship nuance'],
    confidence_effects: ['actionable sequence raises confidence', 'generic answer lowers confidence']
  },
  q5: {
    primary_reality_revealed: 'Database Intelligence',
    signals_to_extract: ['CRM use', 'segmentation', 'frequency', 'follow-up process', 'database weakness'],
    contradictions_to_detect: ['has CRM but no contact rhythm', 'knows database but no segmentation'],
    possible_constraints: ['database_constraint', 'follow_up_constraint', 'systems_constraint'],
    behavior_modifiers: ['low Structure worsens CRM discipline', 'Precision can support data cleanliness'],
    confidence_effects: ['system details raise confidence', 'CRM name only lowers confidence']
  },
  q6: {
    primary_reality_revealed: 'Lead Generation Reality',
    signals_to_extract: ['willing activities', 'unwilling activities', 'behavioral resistance'],
    contradictions_to_detect: ['goals require activity the person refuses'],
    possible_constraints: ['lead_generation_constraint', 'role_fit_constraint'],
    behavior_modifiers: ['behavior fit affects adoption probability'],
    confidence_effects: ['honest unwillingness raises confidence', 'performative answer lowers confidence']
  },
  q7: {
    primary_reality_revealed: 'Accountability Reality',
    signals_to_extract: ['who inspects', 'cadence', 'effectiveness', 'consequence'],
    contradictions_to_detect: ['big goals with no accountability'],
    possible_constraints: ['accountability_constraint', 'leadership_constraint'],
    behavior_modifiers: ['high autonomy may resist inspection', 'Structure may respond to cadence'],
    confidence_effects: ['clear inspection pattern raises confidence', 'encouragement-only lowers confidence']
  },
  q8: {
    primary_reality_revealed: 'Systems Reality',
    signals_to_extract: ['listing process', 'buyer process', 'conversion', 'transaction management', 'recruiting'],
    contradictions_to_detect: ['growth goals with missing delivery systems'],
    possible_constraints: ['systems_constraint', 'team_structure_constraint', 'lead_conversion_constraint'],
    behavior_modifiers: ['Command may carry system gaps personally', 'low Structure worsens transfer'],
    confidence_effects: ['specific system maturity raises confidence', 'process names without detail lower confidence']
  },
  q9: {
    primary_reality_revealed: 'Financial Reality',
    signals_to_extract: ['units', 'volume', 'ASP', 'GCI', 'expenses', 'profit', 'spend', 'P&L'],
    contradictions_to_detect: ['revenue focus without profit visibility', 'team goals without overhead clarity'],
    possible_constraints: ['financial_constraint', 'market_reality_constraint'],
    behavior_modifiers: ['Precision may increase financial clarity', 'high growth bias may ignore margin'],
    confidence_effects: ['specific numbers raise confidence strongly', 'missing financials lower confidence']
  },
  q10: {
    primary_reality_revealed: 'Constraint Reality',
    signals_to_extract: ['perceived bottleneck', 'magic wand problem', 'self-diagnosis'],
    contradictions_to_detect: ['stated constraint differs from evidence pattern'],
    possible_constraints: Object.keys(CONSTRAINT_DETECTION_FRAMEWORK),
    behavior_modifiers: ['self-awareness and profile pattern alter interpretation'],
    confidence_effects: ['specific constraint raises confidence', 'generic overwhelm lowers confidence']
  },
  q11: {
    primary_reality_revealed: 'Team Reality',
    signals_to_extract: ['team exists', 'roles', 'profile IDs', 'production level', 'notes'],
    contradictions_to_detect: ['team exists but no role clarity', 'leader owns all ambiguity'],
    possible_constraints: ['team_structure_constraint', 'leadership_constraint', 'role_fit_constraint'],
    behavior_modifiers: ['leader profile may amplify delegation or control issues'],
    confidence_effects: ['profile IDs and roles raise confidence', 'blank indicates solo agent unless other evidence contradicts']
  },
  q12: {
    primary_reality_revealed: 'Scaling Reality',
    signals_to_extract: ['first break', 'capacity constraint', 'future bottleneck'],
    contradictions_to_detect: ['tripled goal with no system/people/financial change'],
    possible_constraints: ['systems_constraint', 'leadership_constraint', 'financial_constraint', 'team_structure_constraint'],
    behavior_modifiers: ['future bottleneck depends on behavioral adoption and role fit'],
    confidence_effects: ['specific first-break answer raises confidence', 'aspirational answer lowers confidence']
  }
};

export const BEHAVIOR_FUSION_RULES = [
  {
    pattern: 'Command + weak systems',
    interpretation: 'Direction can create progress, but business becomes leader-dependent when judgment is not transferred.',
    likely_constraints: ['systems_constraint', 'leadership_constraint']
  },
  {
    pattern: 'Tempo + weak follow-up',
    interpretation: 'Speed creates activity but may leave pipeline decay behind if follow-up is not inspected.',
    likely_constraints: ['follow_up_constraint', 'lead_conversion_constraint']
  },
  {
    pattern: 'Signal + weak accountability',
    interpretation: 'The operator may read people and context well but still fail to convert awareness into inspected behavior.',
    likely_constraints: ['accountability_constraint']
  },
  {
    pattern: 'Precision + low lead generation',
    interpretation: 'Quality standards may protect trust but can become avoidance if opportunity creation is too low.',
    likely_constraints: ['lead_generation_constraint', 'role_fit_constraint']
  },
  {
    pattern: 'Structure + low flexibility',
    interpretation: 'Process discipline supports reliability but can resist changing market or relationship conditions.',
    likely_constraints: ['market_reality_constraint', 'lead_generation_constraint']
  },
  {
    pattern: 'Relationship builder + weak database systems',
    interpretation: 'Trust exists but does not compound because relationships are not captured, segmented, and touched reliably.',
    likely_constraints: ['database_constraint', 'relationship_quality_constraint']
  },
  {
    pattern: 'High leverage + low accountability',
    interpretation: 'The person may think in leverage but not inspect the behaviors that make leverage real.',
    likely_constraints: ['accountability_constraint', 'systems_constraint']
  },
  {
    pattern: 'Low horizon + long-term planning weakness',
    interpretation: 'Near-term execution can dominate while the business underbuilds the future model.',
    likely_constraints: ['market_reality_constraint', 'financial_constraint']
  }
];

export const CONFIDENCE_ENGINE_RULES = {
  evidence_categories: {
    known: 'Directly provided, specific, and concrete evidence.',
    observed: 'Clear pattern visible across multiple answers or profile data.',
    inferred: 'Reasonable conclusion from available signals, but not directly stated.',
    assumed: 'Working hypothesis used only when needed and clearly lower confidence.',
    missing: 'Data absent; should reduce confidence and avoid false precision.'
  },
  raises_confidence: [
    'specific numbers',
    'clear examples',
    'consistent answers across questions',
    'financial detail',
    'database counts and segmentation',
    'profile IDs for team members',
    'specific systems and cadence',
    'clear statement of first break under scale'
  ],
  lowers_confidence: [
    'vague answers',
    'missing financials',
    'unsupported goals',
    'contradictions between desired future and business reality',
    'no database clarity',
    'no accountability detail',
    'generic self-assessment without examples'
  ]
};

export const FIVE_FUTURES_INPUT_MODEL = {
  note: 'Defines structured inputs only. Does not generate Five Futures.',
  required_inputs: [
    'current_trajectory',
    'desired_trajectory',
    'relationship_asset',
    'financial_history',
    'systems_maturity',
    'accountability_maturity',
    'behavior_profile',
    'primary_constraint',
    'market_reality',
    'team_reality',
    'confidence_layer'
  ]
};

export const ONE_MOVE_SELECTION_MODEL = {
  note: 'Defines categories and scoring factors only. Does not generate One Move.',
  categories: [
    'build_database',
    'reactivate_lake',
    'standardize_follow_up',
    'install_accountability',
    'document_core_system',
    'transfer_judgment',
    'protect_profit',
    'clarify_team_model',
    'hire_operator',
    'delegate_function',
    'narrow_highest_value_role',
    'ground_goal_math',
    'choose_generation_lane'
  ],
  scoring_factors: [
    'constraint_leverage',
    'evidence_confidence',
    'behavior_adoption_probability',
    'financial_impact',
    'time_to_feedback',
    'simplicity',
    'reversibility',
    'value_of_information'
  ]
};

export const REAL_ESTATE_BUSINESS_MODEL_V1 = {
  metadata: REAL_ESTATE_BUSINESS_MODEL_METADATA,
  core_doctrine: CORE_DOCTRINE,
  e_to_p_framework: E_TO_P_FRAMEWORK,
  database_relationship_model: DATABASE_RELATIONSHIP_MODEL,
  lead_generation_model: LEAD_GENERATION_MODEL,
  lead_conversion_follow_up_model: LEAD_CONVERSION_FOLLOW_UP_MODEL,
  systems_model: SYSTEMS_MODEL,
  accountability_model: ACCOUNTABILITY_MODEL,
  financial_reality_model: FINANCIAL_REALITY_MODEL,
  agent_stage_model: AGENT_STAGE_MODEL,
  team_stage_model: TEAM_STAGE_MODEL,
  failure_modes: FAILURE_MODES,
  constraint_detection_framework: CONSTRAINT_DETECTION_FRAMEWORK,
  question_interpretation_map: QUESTION_INTERPRETATION_MAP,
  behavior_fusion_rules: BEHAVIOR_FUSION_RULES,
  confidence_engine_rules: CONFIDENCE_ENGINE_RULES,
  five_futures_input_model: FIVE_FUTURES_INPUT_MODEL,
  one_move_selection_model: ONE_MOVE_SELECTION_MODEL
};

export default REAL_ESTATE_BUSINESS_MODEL_V1;
