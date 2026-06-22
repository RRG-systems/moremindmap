const DEFAULT_TIMEOUT_MS = 3500;

function configuredEndpoint() {
  // Configure one of these backend env vars with the Formspree form endpoint.
  return (
    process.env.FORMSPREE_DARREN_NOTIFICATION_ENDPOINT ||
    process.env.MOREMINDMAP_NOTIFICATION_FORMSPREE_ENDPOINT ||
    process.env.FORMSPREE_NOTIFICATION_ENDPOINT ||
    process.env.FORMSPREE_ENDPOINT ||
    ''
  ).trim();
}

function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export function extractNotificationIdentityFromDossier(dossier = {}) {
  const canonical = dossier?.canonical_profile_json || dossier?.canonical_dossier?.canonical_profile_json || dossier;
  const metadata = canonical?.metadata || canonical?.profile_metadata || {};
  const answers = canonical?.answers || canonical?.assessment_answers || {};

  return {
    full_name:
      dossier?.person_name ||
      canonical?.person_name ||
      canonical?.full_name ||
      canonical?.name ||
      metadata?.person_name ||
      metadata?.full_name ||
      metadata?.name ||
      answers?.name?.answer_text ||
      answers?.full_name?.answer_text ||
      '',
    email:
      dossier?.email ||
      canonical?.email ||
      metadata?.email ||
      answers?.email?.answer_text ||
      '',
    company:
      dossier?.company_name ||
      canonical?.company_name ||
      metadata?.company_name ||
      metadata?.company ||
      ''
  };
}

export async function sendFormspreeNotification(payload, options = {}) {
  const endpoint = configuredEndpoint();
  if (!endpoint) {
    return { attempted: false, skipped: true, reason: 'formspree_endpoint_not_configured' };
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(compactPayload(payload)),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        attempted: true,
        sent: false,
        status: response.status,
        reason: 'formspree_non_2xx_response'
      };
    }

    return { attempted: true, sent: true, status: response.status };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      reason: error?.name === 'AbortError' ? 'formspree_notification_timeout' : 'formspree_notification_failed'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildBehaviorProfileNotification({
  profileId,
  jobId,
  fullName,
  email,
  company,
  status = 'canonical_profile_saved',
  timestamp = new Date().toISOString(),
  source = 'behavior_profile'
} = {}) {
  return compactPayload({
    _subject: 'New MORE MindMap Behavior Profile Completed',
    notification_type: 'behavior_profile_completed',
    full_name: safeString(fullName),
    email: safeString(email),
    company: safeString(company),
    profile_id: safeString(profileId),
    job_id: safeString(jobId),
    status: safeString(status),
    timestamp,
    source,
    retrieval_note: profileId ? `Retrieve profile by Profile ID: ${profileId}` : 'Profile ID unavailable'
  });
}

export function buildBusinessAssessmentNotification({
  assessmentId,
  ownerProfileId,
  fullName,
  email,
  company,
  assessmentType,
  status = 'intake_saved',
  timestamp = new Date().toISOString(),
  source = 'business_assessment'
} = {}) {
  return compactPayload({
    _subject: 'New MORE MindMap Business Assessment Completed',
    notification_type: 'business_assessment_completed',
    full_name: safeString(fullName),
    email: safeString(email),
    company: safeString(company),
    profile_id: safeString(ownerProfileId),
    assessment_id: safeString(assessmentId),
    assessment_type: safeString(assessmentType),
    status: safeString(status),
    timestamp,
    source,
    retrieval_note: ownerProfileId ? `Retrieve Business Assessment by Profile ID: ${ownerProfileId}` : 'Profile ID unavailable'
  });
}
