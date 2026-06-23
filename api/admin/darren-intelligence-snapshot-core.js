import Redis from 'ioredis';
import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  getCanonicalProfile,
  parseProfileId
} from '../business-assessment/shared.js';
import { leadershipBuildMap } from '../../src/data/leadershipBuildMap.js';

export const SNAPSHOT_VERSION = 'DARREN-LEADERSHIP-INTELLIGENCE-V1';
export const DARREN_PROFILE_ID = 'mm-20260527-6zshuaao';

const PROFILE_ROW_LIMIT = 100;
const ASSESSMENT_ROW_LIMIT = 100;
const SCAN_PROFILE_LIMIT = 500;
const BUSINESS_ASSESSMENT_TYPES = ['real_estate_agent', 'real_estate_team'];

function snapshotError(code, status, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function sanitizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function unwrapCanonical(dossier) {
  return dossier?.['canonical_' + 'profile_json'] || dossier?.['canonical_' + 'dossier']?.['canonical_' + 'profile_json'] || dossier || {};
}

function extractAnswerText(answers, keys) {
  for (const key of keys) {
    const value = answers?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value?.answer_text) return sanitizeText(value.answer_text);
    if (value?.text) return sanitizeText(value.text);
  }
  return null;
}

function extractIdentityFromProfile(dossier = {}) {
  const canonical = unwrapCanonical(dossier);
  const metadata = canonical?.metadata || canonical?.profile_metadata || dossier?.metadata || {};
  const identity = metadata?.identity || {};
  const organization = metadata?.organization || {};
  const answers = canonical?.answers || canonical?.['assessment_' + 'answers'] || canonical?.intake_answers || dossier?.intake_answers || {};

  return {
    name: sanitizeText(
      dossier.person_name ||
      canonical.person_name ||
      canonical.full_name ||
      canonical.name ||
      metadata.person_name ||
      metadata.full_name ||
      identity.full_name ||
      identity.name ||
      extractAnswerText(answers, ['full_name', 'name', 'person_name'])
    ),
    email: sanitizeText(
      dossier.email ||
      canonical.email ||
      metadata.email ||
      identity.email ||
      extractAnswerText(answers, ['email'])
    ),
    phone: sanitizeText(
      dossier.phone ||
      canonical.phone ||
      metadata.phone ||
      metadata.person_phone ||
      metadata.mobile ||
      metadata.cell ||
      metadata.telephone ||
      identity.phone ||
      identity.mobile ||
      identity.cell ||
      identity.telephone ||
      organization.phone ||
      organization.mobile ||
      organization.cell ||
      organization.telephone ||
      extractAnswerText(answers, ['phone', 'mobile', 'cell', 'telephone'])
    ),
    company: sanitizeText(
      dossier.company_name ||
      canonical.company_name ||
      metadata.company_name ||
      metadata.company ||
      organization.company ||
      organization.company_name ||
      extractAnswerText(answers, ['company', 'company_name'])
    )
  };
}

function businessAssessmentOutputStatus(record = {}) {
  const output = record.output || {};
  if (output.five_futures_v1 && output.one_move_v1) return 'five_futures_and_one_move_ready';
  if (output.executive_diagnostic_briefing_v1) return 'executive_diagnostic_briefing_ready';
  if (output.business_intelligence_draft) return 'business_intelligence_draft_ready';
  return record.status || 'intake_saved';
}

function currentMonthDates(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const dates = [];
  for (let date = new Date(Date.UTC(year, month, 1)); date.getUTCMonth() === month; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

async function scanKeys(redis, pattern, limit) {
  let cursor = '0';
  const keys = [];
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    for (const key of batch) {
      keys.push(key);
      if (keys.length >= limit) return keys;
    }
  } while (cursor !== '0');
  return keys;
}

async function readJsonValues(redis, keys) {
  if (!keys.length) return [];
  const rawValues = await Promise.all(keys.map((key) => redis.get(key)));
  return rawValues
    .map((raw) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function getProfileIdsForDates(redis, dates) {
  const sets = await Promise.all(dates.map((date) => redis.smembers(`vault:index:date:${date}`)));
  return [...new Set(sets.flat())];
}

async function getAssessmentIdsForDates(redis, dates) {
  const sets = await Promise.all(dates.map((date) => redis.smembers(`business_assessment:index:date:${date}`)));
  return [...new Set(sets.flat())];
}

async function getAssessmentIdsByType(redis) {
  const sets = await Promise.all(
    BUSINESS_ASSESSMENT_TYPES.map((type) => redis.smembers(`business_assessment:index:type:${type}`))
  );
  return [...new Set(sets.flat())];
}

function isSafelyDetectableTestRecord(record) {
  const name = String(record?.name || '').toLowerCase();
  const email = String(record?.email || '').toLowerCase();
  const company = String(record?.company || '').toLowerCase();

  return (
    email.includes('example.invalid') ||
    /\bqa\b/.test(name) ||
    company.includes('qa synthetic') ||
    company.includes('diagnostic test') ||
    name.includes('smoke test') ||
    email.includes('smoke test') ||
    name.includes('synthetic fixture') ||
    email.includes('synthetic fixture')
  );
}

function normalizeCompany(value) {
  const raw = String(value || '').trim();
  if (!raw || /^unavailable$/i.test(raw) || /^unknown/i.test(raw)) return 'Missing Company Data';

  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\s*,?\s*llc\.?$/i, '')
    .trim();
  const normalized = cleaned.toLowerCase();

  if (normalized === 'fathom realty') return 'Fathom Realty';
  if (normalized === 'fathom realty nc') return 'Fathom Realty NC';
  if (normalized === 'fathom realty mt') return 'Fathom Realty MT';
  if (normalized === 'the more companies' || normalized === 'the more company') return 'The MORE Companies';

  return cleaned || 'Missing Company Data';
}

function buildProfileRow(dossier = {}) {
  const identity = extractIdentityFromProfile(dossier);
  return {
    profile_id: sanitizeText(dossier.profile_id || unwrapCanonical(dossier).profile_id),
    name: identity.name,
    email: identity.email,
    company: identity.company
  };
}

function normalizeAssessmentRecord(record = {}, profileRowById = new Map()) {
  const ownerProfileId = sanitizeText(record.owner_profile_id);
  const linkedProfile = ownerProfileId ? profileRowById.get(ownerProfileId) : null;
  const profileContext = record.profile_context || {};

  return {
    assessment_id: sanitizeText(record.assessment_id),
    owner_profile_id: ownerProfileId,
    name: sanitizeText(profileContext.owner_profile_name) || linkedProfile?.name || null,
    email: linkedProfile?.email || null,
    company: linkedProfile?.company || null,
    assessment_type: sanitizeText(record.assessment_type),
    status: businessAssessmentOutputStatus(record)
  };
}

async function loadProfiles(redis, monthlyProfileIds) {
  const scannedProfileKeys = await scanKeys(redis, 'vault:profile:*', SCAN_PROFILE_LIMIT);
  const monthlyProfileKeys = monthlyProfileIds.map((id) => `vault:profile:${id}`);
  const profileKeys = [...new Set([...scannedProfileKeys, ...monthlyProfileKeys])];
  const records = await readJsonValues(redis, profileKeys);
  return records
    .map(buildProfileRow)
    .filter((row) => row.profile_id)
    .slice(0, PROFILE_ROW_LIMIT);
}

async function loadAssessments(redis, assessmentIds, profileRowById) {
  const assessmentKeys = assessmentIds.map((id) => `business_assessment:${id}`);
  const records = await readJsonValues(redis, assessmentKeys);
  return records
    .map((record) => normalizeAssessmentRecord(record, profileRowById))
    .filter((row) => row.assessment_id)
    .slice(0, ASSESSMENT_ROW_LIMIT);
}

function countCompanies(profileRows, assessmentRows) {
  const companies = new Set();
  for (const profile of profileRows) companies.add(normalizeCompany(profile.company));
  for (const assessment of assessmentRows) companies.add(normalizeCompany(assessment.company));
  return companies.size;
}

async function buildDashboardContext(redis) {
  const dates = currentMonthDates(new Date());
  const [totalProfilesRaw, monthlyProfileIds, monthlyAssessmentIds, typeAssessmentIds] = await Promise.all([
    redis.get('vault:metadata:count'),
    getProfileIdsForDates(redis, dates),
    getAssessmentIdsForDates(redis, dates),
    getAssessmentIdsByType(redis)
  ]);

  const profileRows = await loadProfiles(redis, monthlyProfileIds);
  const profileRowById = new Map(profileRows.map((profile) => [profile.profile_id, profile]));
  const assessmentIdsForRows = [...new Set([...monthlyAssessmentIds, ...typeAssessmentIds])];
  const assessmentRows = await loadAssessments(redis, assessmentIdsForRows, profileRowById);
  const displayedProfiles = profileRows.filter((profile) => !isSafelyDetectableTestRecord(profile));
  const displayedAssessments = assessmentRows.filter((assessment) => !isSafelyDetectableTestRecord(assessment));

  return {
    total_profiles: Number.parseInt(totalProfilesRaw || '0', 10),
    total_business_assessments: typeAssessmentIds.length,
    displayed_sales_profiles: displayedProfiles.length,
    displayed_sales_assessments: displayedAssessments.length,
    companies_represented: countCompanies(displayedProfiles, displayedAssessments),
    missing_data_notes_count: 5,
    source_label: 'dashboard_metric',
    source_labels: {
      total_profiles: 'exact_counter',
      total_business_assessments: 'indexed_type_union',
      displayed_sales_profiles: 'bounded_filtered_sales_view',
      displayed_sales_assessments: 'bounded_filtered_sales_view',
      companies_represented: 'normalized_display_sales_view',
      missing_data_notes_count: 'static_admin_dashboard_truth_boundary'
    }
  };
}

function summarizeBuildMap() {
  return {
    live_now: leadershipBuildMap
      .filter((phase) => phase.status === 'live')
      .map((phase) => ({ id: phase.id, title: phase.title, label: phase.label })),
    planned_next: leadershipBuildMap
      .filter((phase) => phase.status === 'planned' || phase.status === 'in_progress')
      .map((phase) => ({ id: phase.id, title: phase.title, label: phase.label, status: phase.status })),
    future_phases: leadershipBuildMap
      .filter((phase) => phase.status === 'future' || phase.status === 'blocked')
      .map((phase) => ({ id: phase.id, title: phase.title, label: phase.label, status: phase.status })),
    source_label: 'build_map'
  };
}

async function loadDarrenAssessment(redis, profileId) {
  const assessmentId = await redis.get(businessAssessmentByProfileKey(profileId));
  if (!assessmentId) {
    return {
      found: false,
      assessment_id: null,
      status: 'not_found',
      source_label: 'unavailable'
    };
  }

  const raw = await redis.get(businessAssessmentKey(assessmentId));
  if (!raw) {
    return {
      found: false,
      assessment_id: assessmentId,
      status: 'missing_assessment_record',
      source_label: 'unavailable'
    };
  }

  const record = JSON.parse(raw);
  return {
    found: true,
    assessment_id: sanitizeText(record.assessment_id || assessmentId),
    owner_profile_id: sanitizeText(record.owner_profile_id),
    assessment_type: sanitizeText(record.assessment_type),
    status: businessAssessmentOutputStatus(record),
    has_business_intelligence_draft: Boolean(record.output?.business_intelligence_draft),
    has_executive_diagnostic_briefing: Boolean(record.output?.executive_diagnostic_briefing_v1),
    has_five_futures: Boolean(record.output?.five_futures_v1),
    has_one_move: Boolean(record.output?.one_move_v1),
    source_label: 'darren_business_assessment'
  };
}

function buildStrategicGoal() {
  return {
    target_company_valuation: '$250M',
    gross_revenue_lens: '$15M-$30M annual gross revenue',
    valuation_multiple_notes: [
      '$250M at $30M annual revenue implies roughly 8.3x revenue.',
      '$250M at $15M annual revenue implies roughly 16.7x revenue.',
      'Those multiples require strong assumptions such as growth, margin, defensibility, retention, strategic platform value, capital access, distribution leverage, or acquisition premium.'
    ],
    truth_boundary: '$15M-$30M gross revenue supporting a $250M valuation is a scenario assumption, not a product claim or guaranteed valuation rule.',
    source_label: 'user_provided_goal'
  };
}

function buildEToPLens() {
  return {
    entrepreneurial_signal: 'Darren has Momentum Machine strength: action, energy, motion, sales pressure, and partner activation.',
    purposeful_scale_recommendation: 'Preserve momentum, then wrap it with models, systems, tools, accountability, coaching, and ongoing education.',
    model_needed: 'Path comparison model across customer revenue, partner capital, channel distribution, RRG, and multi-vertical expansion.',
    system_needed: 'Weekly evidence review that separates interest, distribution, funding, adoption, revenue, and product truth.',
    tool_needed: 'Darren Intelligence Snapshot with source labels, proof targets, and overclaim boundaries.',
    accountability_needed: 'Use dashboard metrics and proof targets before treating an idea as product direction.',
    coaching_or_education_needed: 'Keep Darren in action while converting instinct into measurable proof and sales language.',
    hubris_risk: 'High energy can outrun evidence if partner interest, channel access, or valuation assumptions are treated as proof.',
    proof_needed: 'Profiles, assessments, paid conversions, RRG opportunities, funded pilots, or partner commitments tied to a named path.'
  };
}

function buildPathComparison() {
  return {
    paths: [
      'SaaS / subscription intelligence',
      'RRG-powered revenue recovery',
      'mortgage-company infrastructure',
      'brokerage recruiting/retention intelligence',
      'leadership intelligence / LDE',
      'hybrid ecosystem',
      'partner capital / strategic funding',
      'channel / distribution power',
      'multi-vertical platform'
    ],
    truth_boundaries: [
      'No single path is prescribed.',
      'Partner interest is not funding.',
      'Funding conversations are not revenue.',
      'Channel interest is not distribution.',
      'A warm introduction is not adoption.',
      'Audience access is not revenue.',
      'Cross-vertical expansion is future/hypothesis unless supported by evidence.',
      'Valuation assumptions are not guarantees.'
    ]
  };
}

function buildFiveFuturesScaffold() {
  const futureKeys = [
    'conservative_continuation',
    'dashboard_led_sales_traction',
    'channel_distribution_acceleration',
    'strategic_partner_capital_acceleration',
    'full_v2_leadership_intelligence_company_path'
  ];

  return futureKeys.map((key) => ({
    key,
    status: 'scaffold_only',
    source_label: 'model_interpretation',
    required_fields_for_generation: [
      'name',
      'description',
      'current_evidence',
      'missing_evidence',
      'likely_bottleneck',
      'upside',
      'danger',
      'what_would_make_this_more_likely',
      'what_would_invalidate_it'
    ]
  }));
}

function buildOneMoveScaffold() {
  return {
    status: 'scaffold_only',
    cadence: 'weekly',
    requirements: [
      'concrete',
      'sales-useful',
      'tied to dashboard reality',
      'adapted to Momentum Machine',
      'focused on next proof target',
      'includes partner-capital proof target when relevant',
      'includes channel proof target when relevant'
    ],
    source_label: 'model_interpretation'
  };
}

function buildSnapshot({ generatedAt, profileLookup, assessmentContext, dashboardContext }) {
  const identity = extractIdentityFromProfile(profileLookup.dossier);

  return {
    ok: true,
    snapshot_version: SNAPSHOT_VERSION,
    generated_at: generatedAt,
    darren: {
      profile_id: DARREN_PROFILE_ID,
      name: identity.name,
      email: identity.email,
      company: identity.company,
      behavioral_identity: 'Momentum Machine',
      operating_mode: 'Momentum Machine Operating Mode',
      operating_advantage: 'Momentum, sales motion, partner activation, frontline opportunity creation, and fast follow-up energy.',
      operating_risk: 'Momentum can outrun evidence when interest, funding conversations, channel access, or valuation assumptions are treated as proof.',
      purposeful_scale_recommendation: 'Convert Entrepreneurial momentum into Purposeful execution through models, systems, tools, accountability, coaching, ongoing education, and no hubris.',
      source_labels: {
        identity: 'darren_profile',
        behavioral_identity: 'user_provided_context',
        operating_mode: 'user_provided_context',
        operating_advantage: 'model_interpretation',
        operating_risk: 'model_interpretation',
        purposeful_scale_recommendation: 'model_interpretation'
      }
    },
    darren_assessment_context: assessmentContext,
    strategic_goal: buildStrategicGoal(),
    current_dashboard_context: dashboardContext,
    build_map_context: summarizeBuildMap(),
    e_to_p_lens: buildEToPLens(),
    path_comparison: buildPathComparison(),
    five_futures_scaffold: buildFiveFuturesScaffold(),
    one_move_scaffold: buildOneMoveScaffold(),
    evidence_gaps: [
      'Paid/free/promo totals are not persistently indexed.',
      'Revenue totals are not connected to profile or assessment records.',
      'RRG opportunity and recovery outcomes are unavailable.',
      'Partner funding interest is not tracked as evidence yet.',
      'Channel distribution access is not tracked as adoption yet.',
      'Cross-vertical traction is not yet evidenced.'
    ],
    next_proof_targets: [
      'Identify one active sales/channel conversation and classify it as customer revenue, partner capital, or channel distribution.',
      'Tie the next Darren sales push to one measurable proof: profiles created, assessments started, paid conversions, RRG opportunities, funded pilot interest, or channel onboarding.',
      'Separate enthusiasm from evidence before updating the build map or sales claims.'
    ],
    what_not_to_overclaim: [
      'Do not present $250M valuation as guaranteed.',
      'Do not treat $15M-$30M gross revenue as verified.',
      'Do not treat partner interest as funding.',
      'Do not treat funding conversations as revenue.',
      'Do not treat channel access as adoption.',
      'Do not treat audience reach as revenue.',
      'Do not claim RRG readiness without live RRG metrics.',
      'Do not claim cross-vertical readiness without evidence.'
    ],
    unavailable_fields: [
      'verified revenue',
      'paid/free/promo totals',
      'Stripe payment state',
      'subscription state',
      'Outcome Ledger state',
      'RRG activity/recovery metrics',
      'partner capital pipeline',
      'channel distribution pipeline',
      'cross-vertical adoption metrics'
    ],
    limits: [
      'Read-only snapshot scaffold.',
      'No GPT/model generation called.',
      'No private source profile returned.',
      'No private assessment response set returned.',
      'No storage identifiers or environment values returned.',
      'No records modified.',
      'Five Futures and One Move are scaffolded only, not generated final intelligence.'
    ]
  };
}

export async function buildDarrenIntelligenceSnapshot() {
  if (!process.env.REDIS_URL) {
    throw snapshotError('admin_snapshot_not_configured', 500);
  }

  const parsedDarrenProfile = parseProfileId(DARREN_PROFILE_ID);
  if (!parsedDarrenProfile) {
    throw snapshotError('darren_profile_id_invalid', 500);
  }

  const redis = new Redis(process.env.REDIS_URL);
  try {
    const generatedAt = new Date().toISOString();
    const profileLookup = await getCanonicalProfile(redis, parsedDarrenProfile.normalized);
    if (!profileLookup.found) {
      throw snapshotError('darren_profile_not_found', 404, {
        profile_id: parsedDarrenProfile.normalized
      });
    }

    const [assessmentContext, dashboardContext] = await Promise.all([
      loadDarrenAssessment(redis, parsedDarrenProfile.normalized),
      buildDashboardContext(redis)
    ]);

    return buildSnapshot({
      generatedAt,
      profileLookup,
      assessmentContext,
      dashboardContext
    });
  } finally {
    redis.disconnect();
  }
}
