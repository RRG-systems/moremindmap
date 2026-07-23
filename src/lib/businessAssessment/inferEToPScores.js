import { deriveRelationshipStructureEvidence } from '../businessEngine/relationshipEvidence.js';

const PILLAR_KEYS = ['models', 'systems', 'tools', 'accountability', 'education'];

function lower(value) {
  return String(value || '').toLowerCase();
}

function compact(items) {
  return [...new Set(items.filter(Boolean))];
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 4;
  return Math.max(1, Math.min(10, Math.round(numeric)));
}

function confidenceFor(evidence, mixed = false) {
  if (evidence.length >= 4 && !mixed) return 'high';
  if (evidence.length >= 2) return 'moderate';
  return 'low';
}

function labelForScore(score, labels) {
  if (score <= 3) return labels.low;
  if (score <= 6) return labels.mid;
  if (score <= 8) return labels.high;
  return labels.scale;
}

function evidenceText(evidence) {
  return compact(evidence).slice(0, 4);
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function answerText(answers, ...keys) {
  return keys.map((key) => answers?.[key] || '').join('\n\n');
}

function parseStatedAccountabilityScore(q7) {
  const match = String(q7 || '').match(/(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*10/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(10, parsed)) : null;
}

function buildContext(record) {
  const assessment = record?.assessment || record?.business_assessment || record || {};
  const output = assessment.output || {};
  const answers = assessment.inputs?.answers || {};
  const draft = output.business_intelligence_draft || {};
  const briefing = output.executive_diagnostic_briefing_v1 || {};
  const futures = output.five_futures_v1 || {};
  const oneMove = output.one_move_v1 || {};
  const allAnswers = Object.values(answers).join('\n\n');
  const relationshipStructure = deriveRelationshipStructureEvidence({
    q3: answers.q3,
    q5: answers.q5,
  });

  return {
    assessment,
    output,
    answers,
    draft,
    briefing,
    futures,
    oneMove,
    relationshipStructure,
    // Current pillar scores must not be inflated by future recommendations or
    // One Move language. Score only the persisted current-state intake.
    all: lower(allAnswers),
    q1: lower(answers.q1),
    q2: lower(answers.q2),
    q3: lower(answers.q3),
    q4: lower(answers.q4),
    q5: lower(answers.q5),
    q6: lower(answers.q6),
    q7: lower(answers.q7),
    q8: lower(answers.q8),
    q9: lower(answers.q9),
    q10: lower(answers.q10),
    q11: lower(answers.q11),
    q12: lower(answers.q12),
  };
}

function inferModels(ctx) {
  let score = 4;
  const evidence = [];
  const cautions = [];

  if (hasAny(ctx.q3, [/true relationship/, /\b338\b/])) {
    score += 1;
    evidence.push('Distinguishes total contacts from true relationships.');
  }

  if (ctx.relationshipStructure.segmentation_status === 'present') {
    score += 1;
    evidence.push('Segments relationship quality into explicit tiers.');
  }

  if (hasAny(ctx.q2 + ctx.q9, [/12[-\s]?month/, /24[-\s]?month/, /36[-\s]?month/, /\b24 units\b/, /\b36 units\b/, /\b50 units\b/])) {
    score += 1;
    evidence.push('Connects goals to unit targets and multi-year business path.');
  }

  if (hasAny(ctx.q9, [/\$?4,?000,?000|\$?4m/, /\$?134,?000|gci/, /\$?72,?000|net income/, /expenses/, /lead source breakdown/])) {
    score += 1;
    evidence.push('Provides production, GCI, net income, expense, and lead source detail.');
  }

  if (hasAny(ctx.q1 + ctx.q10 + ctx.q12, [/predictable lead flow/, /weekly operating rhythm/, /inspectable/, /first thing that breaks/, /structure/])) {
    score += 1;
    evidence.push('Self-diagnosis connects growth limits to operating rhythm and scale breakpoints.');
  }

  if (hasAny(ctx.q1 + ctx.q10, [/need more leads/]) && !hasAny(ctx.all, [/follow-up/, /conversion/, /database activation/])) {
    score -= 1;
    cautions.push('Lead shortage may be treated as the only issue without conversion or database evidence.');
  }

  if (!hasAny(ctx.q9, [/gci|net income|profit|expenses|p&l|volume|units/])) {
    score -= 1;
    cautions.push('Financial math is thin, so model confidence is limited.');
  }

  if (hasAny(ctx.q10 + ctx.q12, [/not inspectable|from my head|memory|structure breaks|weekly operating rhythm/])) {
    score = Math.min(score, 8);
    cautions.push('Business model awareness is strong, but it has not yet become a transferable operating model.');
  }

  score = clampScore(score);
  return {
    score,
    confidence: confidenceFor(evidence, cautions.length > 0),
    label: labelForScore(score, {
      low: 'Goal not yet connected to business math',
      mid: 'Understands pieces, but model is incomplete',
      high: 'Understands relationship-income model',
      scale: 'Business model is transferable and inspectable',
    }),
    evidence: evidenceText(evidence),
    caution: cautions[0] || (score >= 7 ? 'Model awareness is stronger than the current operating system.' : 'Needs validation against actual weekly behavior.'),
  };
}

function inferSystems(ctx) {
  let score = 4;
  const evidence = [];
  const cautions = [];

  if (ctx.relationshipStructure.crm_status === 'present') {
    score += 1;
    evidence.push('CRM exists and is named as part of the business infrastructure.');
  } else if (ctx.relationshipStructure.crm_status === 'absent') {
    evidence.push('The intake explicitly says an active CRM is not in use.');
    cautions.push('A named CRM concept is not evidence that a working system exists.');
  }

  if (ctx.relationshipStructure.segmentation_status === 'present') {
    score += 1;
    evidence.push('Relationship segmentation exists at least in rough form.');
  }

  if (hasAny(ctx.q8, [/listing checklist|pricing process|mls checklist|transaction coordinator|checklists/])) {
    score += 1;
    evidence.push('Some listing and transaction process pieces are already present.');
  }

  if (hasAny(ctx.q5 + ctx.q8 + ctx.q12, [/not as consistently/, /inconsistent/, /depends on my mood|depends on my memory|memory/, /no weekly database review/, /no clear follow-up sequence/, /not a full operating system/, /first thing that breaks is structure/])) {
    score -= 3;
    evidence.push('Follow-up, database review, conversion, and scale rhythm remain memory-based or inconsistent.');
    cautions.push('Pieces exist, but the system is not yet inspectable or repeatable.');
  }

  if (!hasAny(ctx.all, [/35\+ touch|weekly database review|written lead follow-up sequence|next-action standard|scorecard/])) {
    score -= 1;
    cautions.push('No evidence of a durable weekly database or follow-up cadence.');
  }

  score = clampScore(score);
  return {
    score,
    confidence: confidenceFor(evidence, true),
    label: labelForScore(score, {
      low: 'No consistent database operating rhythm',
      mid: 'Pieces exist, but system is not inspectable',
      high: 'Repeatable operating rhythm emerging',
      scale: 'Systems are transferable and scalable',
    }),
    evidence: evidenceText(evidence),
    caution: cautions[0] || 'Confirm whether documented processes survive busy weeks.',
  };
}

function inferTools(ctx) {
  let score = 4;
  const evidence = [];
  const cautions = [];
  const crmStatus = ctx.relationshipStructure.crm_status;
  const crmExplicitlyAbsent = crmStatus === 'absent';
  const technologyPresent =
    crmStatus === 'present' ||
    hasAny(ctx.q5 + ctx.q8 + ctx.q9, [/spreadsheet|software|technology/]);
  const technologyTrap =
    technologyPresent &&
    hasAny(ctx.q5 + ctx.q8 + ctx.q10, [/not as consistently|inconsistent|depends on my mood|depends on my memory|no weekly|random|not as an operating tool/]);

  if (crmStatus === 'present') {
    score += 2;
    evidence.push('Follow Up Boss / CRM exists as a tool layer.');
  } else if (crmExplicitlyAbsent) {
    evidence.push('The intake explicitly says an active CRM is not in use.');
    cautions.push('A named CRM concept is not evidence that a working tool layer exists.');
  }

  if (hasAny(ctx.q9, [/spreadsheet|financial tracking|software|crm|technology/])) {
    score += 1;
    evidence.push('Financial and technology tools are present in parts of the business.');
  }

  if (hasAny(ctx.q8, [/transaction coordinator|checklists|website|software/])) {
    score += 1;
    evidence.push('Some operational tools support transaction and marketing work.');
  }

  if (technologyTrap) {
    score -= 3;
    evidence.push('Technology Trap detected: tools exist but are not reliably creating weekly sales behavior.');
    cautions.push('Tools score should stay moderate because CRM ownership is not the same as execution.');
  }

  if (!hasAny(ctx.all, [/next action|task discipline|automation|monthly p&l|weekly crm review|appointment/])) {
    score -= 1;
    cautions.push('Limited evidence that tools drive appointments, referrals, or financial review.');
  }

  score = clampScore(score);
  const toolLabels = crmExplicitlyAbsent
    ? {
        low: 'No active CRM tool layer',
        mid: 'Spreadsheet or partial tools are not driving behavior',
        high: 'Partial tools support execution',
        scale: 'Tools create inspectable sales behavior',
      }
    : crmStatus === 'present'
      ? {
          low: 'Tools are not driving behavior',
          mid: 'CRM exists but is not driving behavior',
          high: 'Tools support execution',
          scale: 'Tools create inspectable sales behavior',
        }
      : {
          low: 'Tool layer is missing or unverified',
          mid: 'Tool layer is incomplete or unverified',
          high: 'Available tools support execution',
          scale: 'Tools create inspectable sales behavior',
        };
  return {
    score,
    confidence: confidenceFor(evidence, technologyTrap),
    label: labelForScore(score, toolLabels),
    evidence: evidenceText(evidence),
    caution: cautions[0] || 'Validate whether tools create conversations and appointments.',
  };
}

function inferAccountability(ctx) {
  let score = 4;
  const evidence = [];
  const cautions = [];
  const statedScore = parseStatedAccountabilityScore(ctx.q7);

  if (statedScore !== null) {
    score = statedScore;
    evidence.push(`Self-rated accountability at ${statedScore}/10.`);
  }

  if (hasAny(ctx.q7, [/no formal coach|broker checks in occasionally|spouse asks|agent friends|not really business accountability/])) {
    evidence.push('Accountability is informal and conversational rather than operational.');
  }

  if (hasAny(ctx.q7 + ctx.q10, [/no one is looking|weekly activity|database touches|appointments|follow-up|pipeline|financials|scorecard/])) {
    evidence.push('No weekly inspection of activity, database touches, pipeline, follow-up, or financials.');
  }

  if (hasAny(ctx.q12, [/follow-up/, /calendar/, /client service consistency/])) {
    evidence.push('Tripled-goal stress test indicates follow-up and bandwidth would break first.');
  }

  if (!hasAny(ctx.q7, [/weekly scorecard|reviews actual activity|inspect|cadence|scoreboard/])) {
    cautions.push('No evidence that leading indicators are inspected every week.');
  }

  score = clampScore(score);
  return {
    score,
    confidence: confidenceFor(evidence, true),
    label: labelForScore(score, {
      low: 'No weekly inspection of lead-generation activity',
      mid: 'Helpful conversations, weak inspection',
      high: 'Scoreboarded accountability emerging',
      scale: 'Accountability operates as a management system',
    }),
    evidence: evidenceText(evidence),
    caution: cautions[0] || 'Accountability quality depends on whether missed commitments trigger correction.',
  };
}

function inferEducation(ctx) {
  let score = 4;
  const evidence = [];
  const cautions = [];

  if (hasAny(ctx.q6, [/relationship-based|community-based|does not fit|lead generation model that fits/])) {
    score += 1;
    evidence.push('Understands that lead generation strategy must fit actual behavior.');
  }

  if (hasAny(ctx.q3 + ctx.q5, [/true relationships|database is not fully organized|relationship database/])) {
    score += 1;
    evidence.push('Shows awareness that database quality and true relationships matter.');
  }

  if (
    ctx.relationshipStructure.segmentation_status === 'present' ||
    ctx.relationshipStructure.vendor_database_present
  ) {
    evidence.push('Names relationship tiers or vendor structure as part of the operating model.');
  }

  if (hasAny(ctx.q10 + ctx.q12, [/not effort|structure|inspectable weekly system|stop running the business from my head|run it from a system/])) {
    score += 2;
    evidence.push('Names the real learning gap: moving from memory and effort into an operating system.');
  }

  if (hasAny(ctx.q9, [/marketing spend is not clearly tied to roi|do not review financials monthly|financial discipline/])) {
    evidence.push('Recognizes financial operating discipline as a missing skill area.');
  }

  if (hasAny(ctx.q5 + ctx.q8, [/not as consistently|weak|random|no clear follow-up sequence|not as an operating tool/])) {
    score -= 1;
    cautions.push('Awareness is stronger than execution; education has not become operating rhythm.');
  }

  if (countMatches(ctx.all, [/generic|coaching seminar|wish/i]) > 1 && !hasAny(ctx.all, [/specific|units|gci|database|relationship/])) {
    score -= 1;
    cautions.push('Some language may be aspirational without enough operating evidence.');
  }

  score = clampScore(score);
  return {
    score,
    confidence: confidenceFor(evidence, cautions.length > 0),
    label: labelForScore(score, {
      low: 'Needs database and follow-up model education',
      mid: 'Understands pieces, missing execution model',
      high: 'Strong awareness, needs operational training',
      scale: 'Learning is converting into transferable practice',
    }),
    evidence: evidenceText(evidence),
    caution: cautions[0] || 'Next test is whether understanding converts into weekly execution.',
  };
}

function overallStage(pillars) {
  const scores = PILLAR_KEYS.map((key) => pillars[key].score);
  const score = clampScore(scores.reduce((sum, item) => sum + item, 0) / scores.length);
  let label = 'Entrepreneurial';
  let interpretation = 'The business is mostly memory-based, personality-dependent, and hard to inspect.';

  if (score >= 9) {
    label = 'Scalable Purposeful';
    interpretation = 'The business appears transferable, inspectable, and capable of scaling beyond personal memory.';
  } else if (score >= 7) {
    label = 'Purposeful';
    interpretation = 'The business has a mostly repeatable operating system, with remaining scale gaps to close.';
  } else if (score >= 4) {
    label = 'Transitional';
    interpretation = 'The business understands important pieces, but execution is not yet consistently systemized.';
  }

  return { label, score, interpretation };
}

export function inferEToPScores(record) {
  const ctx = buildContext(record);
  const inferred = {
    models: inferModels(ctx),
    systems: inferSystems(ctx),
    tools: inferTools(ctx),
    accountability: inferAccountability(ctx),
    education: inferEducation(ctx),
  };
  const pillars = Object.fromEntries(
    Object.entries(inferred).map(([key, pillar]) => {
      const individualizedEvidence = evidenceText(pillar.evidence).length > 0;
      return [
        key,
        {
          ...pillar,
          source_type: 'deterministic_normalized',
          fallback_used: !individualizedEvidence,
          fallback_reason: individualizedEvidence
            ? null
            : 'pillar_evidence_unavailable_using_explicit_absence_baseline',
        },
      ];
    })
  );

  return {
    ...pillars,
    overall_stage: overallStage(pillars),
  };
}
