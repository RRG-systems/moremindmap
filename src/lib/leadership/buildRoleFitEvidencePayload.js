/**
 * Build the request payload for GPT-5.5 DD role-fit evidence interpretation.
 * Client-safe: no secrets, no API keys.
 */

export const ROLE_FIT_EVIDENCE_INTERPRETATION_PATH =
  '/api/leadership/dd-role-fit-evidence-interpretation';

export const GPT_EVIDENCE_AFFECTED_DIMENSIONS = [
  'Recruiting / Growth Drive',
  'Accountability / Follow-through',
  'Agent Support / Service Orientation',
  'Compliance Discipline',
  'Training / Communication',
  'Operational Responsiveness',
  'Partner / Ecosystem Advocacy',
  // Classification only — shares Partner 3% overall allocation; GPT must not assign numeric scores
  'Ancillary Services Capture Potential',
];

/**
 * @param {object} options
 * @param {string} options.evidenceText
 * @param {string} [options.profileId]
 * @param {string} [options.roleModelId]
 * @param {object} [options.deterministicContext]
 * @param {object|null} [options.baselineResult] - optional prior deterministic model for context only
 */
export function buildRoleFitEvidencePayload({
  evidenceText = '',
  profileId = '',
  roleModelId = 'fathom_district_director_v1',
  deterministicContext = {},
  baselineResult = null,
} = {}) {
  const evidence =
    typeof evidenceText === 'string' ? evidenceText.trim() : String(evidenceText ?? '').trim();

  const ctx =
    deterministicContext && typeof deterministicContext === 'object' ? deterministicContext : {};

  const baselineSummary = baselineResult && typeof baselineResult === 'object'
    ? {
        behavioral_fit_percent: baselineResult?.behavioral_fit?.score_percent ?? null,
        overall_fit_percent: baselineResult?.overall?.score_percent ?? null,
        growth_fit_percent:
          baselineResult?.score_stack?.growth?.score_percent ??
          baselineResult?.dimensions?.find?.((d) => d.id === 'recruiting_growth_drive')
            ?.score_percent ??
          null,
      }
    : null;

  return {
    evidence_text: evidence.slice(0, 4000),
    profile_id: String(profileId || '').trim().slice(0, 64),
    role_model_id: String(roleModelId || 'fathom_district_director_v1').slice(0, 80),
    deterministic_context: {
      role_label: ctx.role_label || 'Fathom District Director',
      primary_economic_lever: ctx.primary_economic_lever || 'Recruiting / Growth',
      behavioral_fit_note:
        ctx.behavioral_fit_note ||
        'Behavioral Fit is the BOS-only baseline and must remain visible. GPT must not replace it.',
      available_dimensions: GPT_EVIDENCE_AFFECTED_DIMENSIONS,
      notes: String(ctx.notes || '').slice(0, 1500),
      baseline_summary: baselineSummary,
    },
  };
}

/**
 * Client fetch wrapper for the evidence interpretation route.
 * Returns a normalized result; never throws for network/schema failures.
 */
export async function requestGptEvidenceInterpretation(payload, { timeoutMs = 30000 } = {}) {
  const API = import.meta.env.VITE_API_URL || '';
  const endpoint = ROLE_FIT_EVIDENCE_INTERPRETATION_PATH;
  const url =
    !API || API === '/'
      ? endpoint
      : `${API.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => {
          try {
            controller.abort();
          } catch {
            // ignore
          }
        }, timeoutMs)
      : null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
      signal: controller?.signal,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok || !data?.ok || !data?.interpretation) {
      return {
        ok: false,
        error: data?.error || `http_${res.status}`,
        message:
          data?.message ||
          'Evidence interpretation unavailable. Deterministic fallback applied.',
        fallback_recommended: true,
        data,
      };
    }

    return {
      ok: true,
      interpretation: data.interpretation,
      interpretation_source: data.interpretation_source || 'gpt',
      model_used: data.model_used || null,
      model_source: data.model_source || null,
      interpreted_at: data.interpreted_at || new Date().toISOString(),
      data,
    };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      error: aborted ? 'timeout' : 'network_error',
      message:
        'Evidence interpretation unavailable. Deterministic fallback applied.',
      fallback_recommended: true,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
