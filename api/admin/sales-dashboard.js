import Redis from 'ioredis';

const DASHBOARD_VERSION = 'MM-ADMIN-V1';
const DEFAULT_ADMIN_CODE = 'MOREADMIN26';
const PROFILE_ROW_LIMIT = 100;
const ASSESSMENT_ROW_LIMIT = 100;
const SCAN_PROFILE_LIMIT = 500;
const BUSINESS_ASSESSMENT_TYPES = ['real_estate_agent', 'real_estate_team'];

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Code');
}

function configuredAdminCode() {
  return process.env.MOREMINDMAP_ADMIN_DASHBOARD_CODE || DEFAULT_ADMIN_CODE;
}

function getProvidedAdminCode(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return (
    req.headers['x-admin-code'] ||
    req.query?.admin_code ||
    req.query?.code ||
    ''
  ).toString().trim();
}

function sanitizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function unwrapCanonical(dossier) {
  return dossier?.canonical_profile_json || dossier?.canonical_dossier?.canonical_profile_json || dossier || {};
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
  const answers = canonical?.answers || canonical?.assessment_answers || canonical?.intake_answers || dossier?.intake_answers || {};

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
    ),
    role: sanitizeText(
      organization.role_title ||
      metadata.role_title ||
      metadata.title ||
      canonical.role_title ||
      extractAnswerText(answers, ['role_title', 'title', 'role'])
    )
  };
}

function profileCompletionStatus(dossier = {}) {
  const canonical = unwrapCanonical(dossier);
  if (dossier.canonical_profile_json || canonical?.profile_id || canonical?.metadata) return 'canonical_dossier_saved';
  return 'profile_record_saved';
}

function buildProfileRow(dossier = {}) {
  const identity = extractIdentityFromProfile(dossier);
  return {
    profile_id: sanitizeText(dossier.profile_id || unwrapCanonical(dossier).profile_id),
    name: identity.name,
    email: identity.email,
    phone: identity.phone,
    company: identity.company,
    role: identity.role,
    created_at: sanitizeText(dossier.created_at || unwrapCanonical(dossier).created_at),
    source: 'vault_profile_summary',
    completion_status: profileCompletionStatus(dossier)
  };
}

function businessAssessmentOutputStatus(record = {}) {
  const output = record.output || {};
  if (output.five_futures_v1 && output.one_move_v1) return 'five_futures_and_one_move_ready';
  if (output.executive_diagnostic_briefing_v1) return 'executive_diagnostic_briefing_ready';
  if (output.business_intelligence_draft) return 'business_intelligence_draft_ready';
  return record.status || 'intake_saved';
}

function profileIdFromBusinessAssessmentByProfileKey(key) {
  const prefix = 'business_assessment_by_profile:';
  if (!key.startsWith(prefix)) return null;
  return key.slice(prefix.length);
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
    phone: linkedProfile?.phone || null,
    company: linkedProfile?.company || null,
    assessment_type: sanitizeText(record.assessment_type),
    created_at: sanitizeText(record.created_at),
    updated_at: sanitizeText(record.updated_at),
    status: businessAssessmentOutputStatus(record)
  };
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

async function loadProfiles(redis, monthlyProfileIds) {
  const scannedProfileKeys = await scanKeys(redis, 'vault:profile:*', SCAN_PROFILE_LIMIT);
  const monthlyProfileKeys = monthlyProfileIds.map((id) => `vault:profile:${id}`);
  const profileKeys = [...new Set([...scannedProfileKeys, ...monthlyProfileKeys])];
  const records = await readJsonValues(redis, profileKeys);
  const rows = records
    .map(buildProfileRow)
    .filter((row) => row.profile_id)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return rows.slice(0, PROFILE_ROW_LIMIT);
}

async function loadAssessments(redis, assessmentIds, profileRowById) {
  const assessmentKeys = assessmentIds.map((id) => `business_assessment:${id}`);
  const records = await readJsonValues(redis, assessmentKeys);
  return records
    .map((record) => normalizeAssessmentRecord(record, profileRowById))
    .filter((row) => row.assessment_id)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, ASSESSMENT_ROW_LIMIT);
}

async function inferLatestProfileAssessments(redis) {
  const byProfileKeys = await scanKeys(redis, 'business_assessment_by_profile:*', 1000);
  const values = await Promise.all(byProfileKeys.map((key) => redis.get(key)));
  return byProfileKeys
    .map((key, index) => ({
      profile_id: profileIdFromBusinessAssessmentByProfileKey(key),
      assessment_id: sanitizeText(values[index])
    }))
    .filter((entry) => entry.profile_id && entry.assessment_id);
}

function buildCompanyRows(profileRows, assessmentRows) {
  const companies = new Map();
  for (const profile of profileRows) {
    const company = profile.company || 'Unavailable';
    if (!companies.has(company)) {
      companies.set(company, { company, profile_count: 0, assessment_count: 0 });
    }
    companies.get(company).profile_count += 1;
  }
  for (const assessment of assessmentRows) {
    const company = assessment.company || 'Unavailable';
    if (!companies.has(company)) {
      companies.set(company, { company, profile_count: 0, assessment_count: 0 });
    }
    companies.get(company).assessment_count += 1;
  }
  return [...companies.values()]
    .sort((a, b) => b.profile_count + b.assessment_count - (a.profile_count + a.assessment_count))
    .slice(0, 100);
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_dashboard_access_denied' });
  }

  if (!process.env.REDIS_URL) {
    return res.status(500).json({ ok: false, error: 'admin_dashboard_not_configured' });
  }

  const redis = new Redis(process.env.REDIS_URL);
  try {
    const generatedAt = new Date().toISOString();
    const dates = currentMonthDates(new Date());
    const [totalProfilesRaw, monthlyProfileIds, monthlyAssessmentIds, typeAssessmentIds, latestProfileAssessments] =
      await Promise.all([
        redis.get('vault:metadata:count'),
        getProfileIdsForDates(redis, dates),
        getAssessmentIdsForDates(redis, dates),
        getAssessmentIdsByType(redis),
        inferLatestProfileAssessments(redis)
      ]);

    const profiles = await loadProfiles(redis, monthlyProfileIds);
    const profileRowById = new Map(profiles.map((profile) => [profile.profile_id, profile]));
    const assessmentIdsForRows = [...new Set([...monthlyAssessmentIds, ...typeAssessmentIds])];
    const businessAssessments = await loadAssessments(redis, assessmentIdsForRows, profileRowById);
    const companies = buildCompanyRows(profiles, businessAssessments);

    const exactTypeIndexedTotal = typeAssessmentIds.length;
    const missingDataNotes = [
      'Paid/free/promo totals are unavailable until access source fields are persistently indexed.',
      'Revenue totals are unavailable until durable payment records are connected to profile or assessment records.',
      'Business Assessment total is exact only for current indexed assessment types: real_estate_agent and real_estate_team.',
      'Business Assessment table is limited to indexed assessment IDs and excludes raw answers by design.',
      'Profile table is bounded to recent scanned vault records plus this-month indexed records.'
    ];

    return res.status(200).json({
      ok: true,
      dashboard_version: DASHBOARD_VERSION,
      generated_at: generatedAt,
      source_labels: {
        total_profiles: 'exact_counter',
        total_business_assessments: 'indexed_type_union',
        profiles_this_month: 'indexed_date_union',
        business_assessments_this_month: 'indexed_date_union',
        paid_free_promo_status: 'unavailable_not_persistently_indexed',
        profiles: 'sanitized_vault_profile_summary',
        business_assessments: 'sanitized_business_assessment_summary',
        companies: 'derived_from_returned_profile_and_assessment_rows'
      },
      summary: {
        total_profiles: Number.parseInt(totalProfilesRaw || '0', 10),
        total_business_assessments: exactTypeIndexedTotal,
        profiles_this_month: monthlyProfileIds.length,
        business_assessments_this_month: monthlyAssessmentIds.length,
        paid_free_promo_status: {
          status: 'unavailable',
          note: 'Paid/free/promo totals are unavailable until access source fields are persistently indexed.'
        }
      },
      profiles,
      business_assessments: businessAssessments,
      companies,
      latest_profile_assessment_links_count: latestProfileAssessments.length,
      missing_data_notes: missingDataNotes,
      limits: [
        `profiles limited to ${PROFILE_ROW_LIMIT} rows`,
        `business_assessments limited to ${ASSESSMENT_ROW_LIMIT} rows`,
        'raw canonical dossiers excluded',
        'raw assessment answers excluded',
        'Redis keys and environment values excluded',
        'read-only endpoint; no records are modified'
      ]
    });
  } catch (error) {
    console.error('[ADMIN SALES DASHBOARD] Error:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'admin_sales_dashboard_failed'
    });
  } finally {
    redis.disconnect();
  }
}
