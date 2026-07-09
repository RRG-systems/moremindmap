/**
 * Leadership Role Fit Lab — District Director Fit V1H
 *
 * Flow:
 * 1. Access code gate (FATHOMDD26) via Leadership Portal or inline
 * 2. Role Fit Lab shell with District Director Fit selected
 * 3. Paste BOS Profile ID → retrieve → DD role-fit dashboard
 * 4. Optional free-text evidence → GPT-5.5 interpretation (server) → deterministic bounded scoring
 * 5. Apply Evidence & Recalculate uses the same intelligence path as Analyze
 *
 * Read-only. No profile mutation. No Redis writes. No client-side API keys.
 * If GPT is unavailable, deterministic keyword parser is the honest fallback.
 *
 * Parent owns:
 * - profileId, evidenceText, retrievedProfilePayload
 * - gptEvidenceInterpretation, analysisResult, resultEpoch
 * - loading / errors / fallback status
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RoleFitAccessGate, {
  ROLE_FIT_ACCESS_CODE,
  ROLE_FIT_CODE_SESSION_KEY,
  hasRoleFitAccess,
  clearRoleFitAccess,
} from './components/leadership/RoleFitAccessGate.jsx';
import RoleFitDashboard from './components/leadership/RoleFitDashboard.jsx';
import { buildDistrictDirectorFit } from './lib/leadership/buildDistrictDirectorFit.js';
import {
  buildRoleFitEvidencePayload,
  requestGptEvidenceInterpretation,
} from './lib/leadership/buildRoleFitEvidencePayload.js';
import { listRoleModels } from './lib/leadership/roleModels/index.js';
import { PERFORMANCE_EVIDENCE_UI_EXAMPLES } from './lib/leadership/roleFitScoring.js';

const PROFILE_ID_PATTERN = /^m{2}-\d{8}-[a-z0-9]{6,12}$/i;

/** Placeholder / help examples for Known Performance Evidence — no competitor brand names. */
const EVIDENCE_PLACEHOLDER = PERFORMANCE_EVIDENCE_UI_EXAMPLES.join('\n');

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', available: false },
  { id: 'role_fit_lab', label: 'Role Fit Lab', available: true, active: true },
  { id: 'dd_fit', label: 'District Director Fit', available: true, active: true },
  { id: 'team_leader', label: 'Team Leader Fit', available: false },
  { id: 'regional', label: 'Regional Director Fit', available: false },
  { id: 'recruiter', label: 'Recruiter Fit', available: false },
  { id: 'custom', label: 'Custom Role Fit', available: false },
  { id: 'team_intel', label: 'Team Intelligence', available: false },
  { id: 'bos', label: 'BOS Profiles', available: false },
  { id: 'maps', label: 'Leadership Maps', available: false },
  { id: 'reports', label: 'Reports', available: false },
  { id: 'admin', label: 'Admin Center', available: false },
];

function buildApiUrl(baseUrl, endpoint) {
  if (baseUrl === '/' || baseUrl === '' || !baseUrl) {
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  }
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

async function retrieveBosProfile(profileId) {
  const API = import.meta.env.VITE_API_URL || '';
  const path = `/api/moremindmap/retrieve-profile?id=${encodeURIComponent(profileId)}`;
  const url = buildApiUrl(API, path);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (res.status === 404) {
    const err = new Error("We couldn't find that profile. Please check the ID and try again.");
    err.status = 404;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(payload?.error || 'Failed to retrieve profile');
    err.status = res.status;
    throw err;
  }

  if (!payload?.canonical_dossier && !payload?.profile_id) {
    const err = new Error('Invalid profile data returned from retrieval.');
    err.status = 422;
    throw err;
  }

  return payload;
}

/**
 * Build a brand-new dashboard model from profile + evidence + optional GPT interpretation.
 * Always returns a new object identity (fresh analyzed_at inside buildDistrictDirectorFit).
 */
function buildFreshRoleFitResult({
  profilePayload,
  profileId,
  evidenceText,
  gptEvidenceInterpretation = null,
  forceDeterministicEvidence = false,
  evidenceInterpretationSource = null,
  evidenceFallbackMessage = null,
  gptModelUsed = null,
}) {
  const evidence = typeof evidenceText === 'string' ? evidenceText : String(evidenceText ?? '');
  return buildDistrictDirectorFit({
    profilePayload,
    profileId: profilePayload?.profile_id || profileId,
    performanceEvidence: evidence,
    gptEvidenceInterpretation,
    forceDeterministicEvidence,
    evidenceInterpretationSource,
    evidenceFallbackMessage,
    gptModelUsed,
  });
}

/**
 * Resolve free-text evidence via GPT-5.5 server route; fall back to deterministic parser.
 * Never throws. Never exposes secrets.
 */
async function resolveEvidenceIntelligence({ evidenceText, profileId, baselineResult = null }) {
  const evidence =
    typeof evidenceText === 'string' ? evidenceText.trim() : String(evidenceText ?? '').trim();

  if (!evidence) {
    return {
      gptEvidenceInterpretation: null,
      evidenceInterpretationSource: 'none',
      evidenceFallbackMessage: null,
      gptModelUsed: null,
      forceDeterministicEvidence: false,
    };
  }

  const payload = buildRoleFitEvidencePayload({
    evidenceText: evidence,
    profileId,
    roleModelId: 'fathom_district_director_v1',
    baselineResult,
  });

  const gptResult = await requestGptEvidenceInterpretation(payload, { timeoutMs: 32000 });

  if (gptResult?.ok && gptResult.interpretation) {
    return {
      gptEvidenceInterpretation: gptResult.interpretation,
      evidenceInterpretationSource: 'gpt',
      evidenceFallbackMessage: null,
      gptModelUsed: gptResult.model_used || null,
      forceDeterministicEvidence: false,
    };
  }

  return {
    gptEvidenceInterpretation: null,
    evidenceInterpretationSource: 'deterministic_fallback',
    evidenceFallbackMessage:
      gptResult?.message ||
      'Evidence interpretation unavailable. Deterministic fallback applied.',
    gptModelUsed: null,
    forceDeterministicEvidence: true,
  };
}

export default function LeadershipRoleFitLab() {
  const [accessReady, setAccessReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessCodeLabel, setAccessCodeLabel] = useState(ROLE_FIT_ACCESS_CODE);

  // Parent-owned analysis state (single source of truth — 1F force reanalysis model)
  const [profileId, setProfileId] = useState('');
  /** Local-only Known Performance Evidence — never persisted to Redis/profile. */
  const [evidenceText, setEvidenceText] = useState('');
  const [retrievedProfilePayload, setRetrievedProfilePayload] = useState(null);
  /** Profile ID that retrievedProfilePayload was loaded for — reuse only when IDs match. */
  const [retrievedProfileId, setRetrievedProfileId] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  /** Evidence string that was last applied into analysisResult. */
  const [lastAppliedEvidence, setLastAppliedEvidence] = useState(null);
  const [evidenceAppliedAt, setEvidenceAppliedAt] = useState(null);
  /** Last GPT interpretation object (null when none / fallback). */
  const [gptEvidenceInterpretation, setGptEvidenceInterpretation] = useState(null);
  const [evidenceInterpretationSource, setEvidenceInterpretationSource] = useState(null);
  const [evidenceFallbackMessage, setEvidenceFallbackMessage] = useState(null);
  /** Bumps on every successful analysis so RoleFitDashboard remounts with a fresh key. */
  const [resultEpoch, setResultEpoch] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const ok = hasRoleFitAccess();
    setHasAccess(ok);
    try {
      const code = sessionStorage.getItem(ROLE_FIT_CODE_SESSION_KEY);
      if (code) setAccessCodeLabel(code);
    } catch {
      // ignore
    }
    setAccessReady(true);
  }, []);

  const registeredModels = useMemo(() => listRoleModels(), []);

  const resetAnalysisState = useCallback(() => {
    setEvidenceText('');
    setRetrievedProfilePayload(null);
    setRetrievedProfileId('');
    setAnalysisResult(null);
    setLoading(false);
    setError('');
    setStatus('idle');
    setLastAppliedEvidence(null);
    setEvidenceAppliedAt(null);
    setGptEvidenceInterpretation(null);
    setEvidenceInterpretationSource(null);
    setEvidenceFallbackMessage(null);
    setResultEpoch(0);
  }, []);

  const handleUnlock = () => {
    setHasAccess(true);
    setAccessCodeLabel(ROLE_FIT_ACCESS_CODE);
  };

  const handleLock = () => {
    clearRoleFitAccess();
    setHasAccess(false);
    setProfileId('');
    resetAnalysisState();
  };

  const handleNewAnalysis = () => {
    setProfileId('');
    resetAnalysisState();
  };

  const handleExportReport = () => {
    // V1 export: browser print / Save as PDF. No server PDF libs. No package deps.
    if (typeof window === 'undefined' || typeof window.print !== 'function') {
      window?.alert?.('Print is not available in this environment.');
      return;
    }
    if (status !== 'ready' || !analysisResult) {
      window.alert('Run a role-fit analysis first, then use Export Report to print or save as PDF.');
      return;
    }
    try {
      window.print();
    } catch {
      window.alert('Could not open the print dialog. Try your browser File → Print menu.');
    }
  };

  /**
   * Single analysis runner used by BOTH Analyze and Apply Evidence & Recalculate.
   *
   * - Reads current Profile ID and current evidence text (args preferred; state fallback)
   * - Retrieves or reuses profile payload safely
   * - Interprets free-text evidence via GPT-5.5 (server) when present
   * - Falls back to deterministic keyword parser if GPT unavailable
   * - Rebuilds DD role-fit result from scratch (fresh object)
   * - Replaces dashboard state and increments resultEpoch
   * - Never relies on cached result scores or memoized dashboard model
   */
  const runRoleFitAnalysis = useCallback(
    async ({
      profileId: profileIdArg,
      evidenceText: evidenceTextArg,
      forceRefreshProfile = false,
    } = {}) => {
      const id = String(profileIdArg ?? profileId ?? '')
        .trim();
      const evidence =
        typeof evidenceTextArg === 'string'
          ? evidenceTextArg
          : typeof evidenceText === 'string'
            ? evidenceText
            : String(evidenceTextArg ?? evidenceText ?? '');

      if (!id) {
        setStatus('error');
        setError('Please enter a BOS Profile ID.');
        setLoading(false);
        setAnalysisResult(null);
        return { ok: false, reason: 'missing_profile_id' };
      }
      if (!PROFILE_ID_PATTERN.test(id)) {
        setStatus('error');
        setError('Please enter a valid Profile ID (format: mm-YYYYMMDD-xxxxxxxx).');
        setLoading(false);
        setAnalysisResult(null);
        return { ok: false, reason: 'invalid_profile_id' };
      }

      // Keep controlled evidence state aligned with what this run will apply.
      setEvidenceText(evidence);
      setLoading(true);
      setStatus('loading');
      setError('');

      let payload = null;
      const canReusePayload =
        !forceRefreshProfile &&
        retrievedProfilePayload &&
        typeof retrievedProfilePayload === 'object' &&
        retrievedProfileId === id;

      if (canReusePayload) {
        payload = retrievedProfilePayload;
      } else if (!forceRefreshProfile && !retrievedProfilePayload) {
        setLoading(false);
        setStatus('error');
        setError('Run Analyze first to load a profile, then apply evidence.');
        return { ok: false, reason: 'missing_payload' };
      } else {
        // Clear prior result so UI cannot show stale scores during re-analyze.
        setAnalysisResult(null);
        try {
          payload = await retrieveBosProfile(id);
          setRetrievedProfilePayload(payload);
          setRetrievedProfileId(id);
        } catch (err) {
          setLoading(false);
          setStatus('error');
          setError(err?.message || 'Failed to retrieve profile.');
          setAnalysisResult(null);
          setRetrievedProfilePayload(null);
          setRetrievedProfileId('');
          setLastAppliedEvidence(null);
          setEvidenceAppliedAt(null);
          setGptEvidenceInterpretation(null);
          setEvidenceInterpretationSource(null);
          setEvidenceFallbackMessage(null);
          return { ok: false, reason: 'retrieve_failed' };
        }
      }

      if (!payload) {
        setLoading(false);
        setStatus('error');
        setError('Run Analyze first to load a profile, then apply evidence.');
        return { ok: false, reason: 'missing_payload' };
      }

      // Intelligence path: GPT evidence interpretation → deterministic bounded scoring
      // (same path for Analyze and Apply Evidence & Recalculate).
      let intelligence;
      try {
        intelligence = await resolveEvidenceIntelligence({
          evidenceText: evidence,
          profileId: id,
          baselineResult: analysisResult,
        });
      } catch {
        intelligence = {
          gptEvidenceInterpretation: null,
          evidenceInterpretationSource: 'deterministic_fallback',
          evidenceFallbackMessage:
            'Evidence interpretation unavailable. Deterministic fallback applied.',
          gptModelUsed: null,
          forceDeterministicEvidence: true,
        };
      }

      // Always rebuild from scratch — never reuse prior analysisResult scores.
      const model = buildFreshRoleFitResult({
        profilePayload: payload,
        profileId: id,
        evidenceText: evidence,
        gptEvidenceInterpretation: intelligence.gptEvidenceInterpretation,
        forceDeterministicEvidence: intelligence.forceDeterministicEvidence,
        evidenceInterpretationSource: intelligence.evidenceInterpretationSource,
        evidenceFallbackMessage: intelligence.evidenceFallbackMessage,
        gptModelUsed: intelligence.gptModelUsed,
      });

      const appliedAt = new Date().toISOString();

      if (!model?.ok) {
        setLoading(false);
        setStatus('error');
        setError(model?.error || 'Could not build role fit analysis.');
        setAnalysisResult(null);
        setLastAppliedEvidence(null);
        setEvidenceAppliedAt(null);
        setGptEvidenceInterpretation(null);
        setEvidenceInterpretationSource(null);
        setEvidenceFallbackMessage(null);
        return { ok: false, reason: 'build_failed' };
      }

      // Replace all visible analysis state in one logical commit path.
      setAnalysisResult(model);
      setRetrievedProfilePayload(payload);
      setRetrievedProfileId(id);
      setLastAppliedEvidence(evidence);
      setEvidenceAppliedAt(appliedAt);
      setGptEvidenceInterpretation(intelligence.gptEvidenceInterpretation);
      setEvidenceInterpretationSource(intelligence.evidenceInterpretationSource);
      setEvidenceFallbackMessage(intelligence.evidenceFallbackMessage);
      setResultEpoch((epoch) => (Number(epoch) || 0) + 1);
      setLoading(false);
      setError('');
      setStatus('ready');

      return {
        ok: true,
        model,
        evidenceText: evidence,
        profileId: id,
        appliedAt,
        reusedProfile: Boolean(canReusePayload),
        evidenceInterpretationSource: intelligence.evidenceInterpretationSource,
        gptUsed: intelligence.evidenceInterpretationSource === 'gpt',
      };
    },
    [profileId, evidenceText, retrievedProfilePayload, retrievedProfileId, analysisResult],
  );

  const handleEvidenceChange = (event) => {
    const value = event?.target?.value ?? '';
    setEvidenceText(value);
  };

  /** Analyze: force profile retrieve + rebuild from current evidence. */
  const handleAnalyze = async (event) => {
    event?.preventDefault?.();
    await runRoleFitAnalysis({
      profileId,
      evidenceText,
      forceRefreshProfile: true,
    });
  };

  /**
   * Apply Evidence & Recalculate: same runner as Analyze.
   * Reuses retrieved profile payload; always rebuilds result from current evidence.
   */
  const handleApplyEvidenceAndRecalculate = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    await runRoleFitAnalysis({
      profileId,
      evidenceText,
      forceRefreshProfile: false,
    });
  };

  const evidenceChangedSinceApply =
    status === 'ready' &&
    lastAppliedEvidence !== null &&
    evidenceText !== lastAppliedEvidence;

  const canApplyEvidence =
    Boolean(retrievedProfilePayload) && status !== 'loading' && !loading;

  if (!accessReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090f] text-white/50">
        Loading Leadership Portal…
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#07090f] text-white">
        <LabBackground />
        <header className="relative z-10 border-b border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <Link to="/" className="text-lg font-semibold tracking-wide">
              MoreMindMap
            </Link>
            <Link
              to="/leadership"
              className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Leadership Portal
            </Link>
          </div>
        </header>
        <main className="relative z-10 mx-auto flex min-h-[calc(100vh-82px)] max-w-7xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl">
            <div className="mb-8 text-center">
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-100">
                MMM Leadership Portal
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight">Role Fit Lab</h1>
              <p className="mt-3 text-white/55">District Director Role Fit requires an access code.</p>
            </div>
            <RoleFitAccessGate onUnlocked={handleUnlock} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="role-fit-lab relative min-h-screen bg-[#07090f] text-white">
      <LabBackground />

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={[
            'role-fit-no-print fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-[#0a0d16]/95 backdrop-blur-xl transition-transform lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="flex h-full flex-col px-5 py-6">
            <div className="px-2">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                MMM Leadership Portal
              </div>
              <div className="mt-3 text-lg font-semibold tracking-tight">Role Fit Lab</div>
              <div className="mt-3 inline-flex rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-orange-100">
                Access Code: {accessCodeLabel}
              </div>
            </div>

            <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive = item.active;
                const base =
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition';
                if (!item.available) {
                  return (
                    <div
                      key={item.id}
                      className={`${base} cursor-not-allowed text-white/28`}
                      title="Coming soon"
                    >
                      <span>{item.label}</span>
                      <span className="text-[0.6rem] uppercase tracking-[0.14em] text-white/20">Soon</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={item.id}
                    className={`${base} ${
                      isActive
                        ? 'border border-cyan-300/25 bg-cyan-400/10 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.08)]'
                        : 'text-white/65 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <div className="px-2 text-[0.6rem] uppercase tracking-[0.16em] text-white/30">
                Models: {registeredModels.length} registered
              </div>
              <button
                type="button"
                onClick={handleLock}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white/55 transition hover:bg-white/8 hover:text-white"
              >
                Lock / Exit
              </button>
              <Link
                to="/leadership"
                className="block w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/8 hover:text-white"
              >
                ← Leadership Portal
              </Link>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="role-fit-no-print fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-black/25 backdrop-blur-md">
            <div className="flex flex-col gap-4 px-5 py-5 md:px-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/70 lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                  >
                    Menu
                  </button>
                  <div className="text-xs text-white/40">
                    Role Fit Lab <span className="text-white/25">›</span>{' '}
                    <span className="text-cyan-100/80">District Director Fit</span>
                  </div>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                  District Director Role Fit Dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                  AI-powered role fit analysis based on Fathom DD Agreement &amp; BOS Profile
                  <span className="text-white/35">
                    {' '}
                    — free-text evidence interpreted through an intelligence layer + deterministic
                    scoring guardrail.
                  </span>
                </p>
              </div>
              <div className="role-fit-no-print flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleNewAnalysis}
                  className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
                >
                  New Analysis
                </button>
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/18"
                >
                  Export Report
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
            {/* Profile ID input */}
            <section className="role-fit-no-print mb-8 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-md md:p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/40">
                    Profile Retrieval
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-white">Drop a BOS Profile ID</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Read-only profile lookup. No profile data is mutated.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAnalyze} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  placeholder="mm-YYYYMMDD-xxxxxxxx"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-black/50 px-5 py-3.5 font-mono text-sm text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                />
                <button
                  type="submit"
                  disabled={loading || status === 'loading'}
                  className="rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading || status === 'loading' ? 'Analyzing…' : 'Analyze'}
                </button>
              </form>

              <div className="mt-5">
                <label
                  htmlFor="role-fit-performance-evidence"
                  className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/40"
                >
                  Known Performance Evidence
                </label>
                <p className="mt-1.5 text-xs leading-5 text-white/45">
                  Optional free-text. Local session only — not saved to the profile or Redis. The
                  intelligence layer interprets normal language evidence; deterministic code applies
                  bounded score adjustments. Behavioral Fit stays the BOS baseline.
                </p>
                <p className="mt-1 text-[0.7rem] leading-5 text-white/35">
                  Examples: number 1 recruiter at Fathom · top 10% recruiter · below recruiting
                  standards for the last 3 years by 10% · watch list · compliance document review
                  delays · great recruiter but slow agent response times.
                </p>
                <textarea
                  id="role-fit-performance-evidence"
                  name="performanceEvidence"
                  value={evidenceText}
                  onChange={handleEvidenceChange}
                  rows={4}
                  placeholder={EVIDENCE_PLACEHOLDER}
                  className="mt-3 w-full resize-y rounded-2xl border border-white/12 bg-black/50 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyEvidenceAndRecalculate}
                    disabled={!canApplyEvidence}
                    data-testid="role-fit-apply-evidence-recalculate"
                    className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Apply Evidence &amp; Recalculate
                  </button>
                  <span className="text-[0.7rem] text-white/35">
                    {retrievedProfilePayload
                      ? 'Updates the role-fit estimate using the evidence above.'
                      : 'Run Analyze first, then apply evidence to refine the estimate.'}
                  </span>
                </div>
                {evidenceChangedSinceApply && (
                  <div
                    className="mt-2 text-[0.75rem] leading-5 text-amber-100/85"
                    data-testid="role-fit-evidence-changed-hint"
                  >
                    Evidence changed. Apply recalculation to update scores.
                  </div>
                )}
                {status === 'ready' && evidenceAppliedAt && !evidenceChangedSinceApply && (
                  <div
                    className="mt-2 text-[0.7rem] leading-5 text-cyan-100/70"
                    data-testid="role-fit-evidence-applied-status"
                  >
                    Evidence applied:{' '}
                    {new Date(evidenceAppliedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                    {analysisResult?.performance_evidence?.interpretation_label
                      ? ` · ${analysisResult.performance_evidence.interpretation_label}`
                      : evidenceInterpretationSource === 'gpt'
                        ? ' · intelligence layer'
                        : evidenceInterpretationSource === 'deterministic_fallback'
                          ? ' · interpreted'
                          : ''}
                    {analysisResult?.performance_evidence?.classification
                      ? ` · ${String(analysisResult.performance_evidence.classification)}`
                      : ''}
                    {analysisResult?.overall?.score_percent != null
                      ? ` · Overall ${Math.round(Number(analysisResult.overall.score_percent))}%`
                      : ''}
                  </div>
                )}
                {status === 'ready' &&
                  (evidenceFallbackMessage ||
                    analysisResult?.performance_evidence?.fallback_message) && (
                    <div
                      className="mt-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-[0.72rem] leading-5 text-amber-50/90"
                      data-testid="role-fit-evidence-fallback-banner"
                    >
                      {evidenceFallbackMessage ||
                        analysisResult?.performance_evidence?.fallback_message}
                    </div>
                  )}
              </div>

              {(loading || status === 'loading') && (
                <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                  {evidenceText?.trim()
                    ? 'Retrieving profile, interpreting evidence, and computing District Director role fit…'
                    : 'Retrieving BOS profile and computing District Director role fit…'}
                </div>
              )}

              {status === 'error' && error && (
                <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              {status === 'idle' && (
                <div className="mt-4 text-xs text-white/35">
                  Local test IDs (examples): mm-20260708-2uajy2x1 · mm-20260708-39r8j0vd · mm-20260708-dsst020z · mm-20260708-bqccs6wf
                </div>
              )}
            </section>

            {status === 'ready' && analysisResult && (
              <div className="role-fit-print-content">
                <RoleFitDashboard
                  key={`role-fit-result-${resultEpoch || 0}-${analysisResult.analyzed_at || 'na'}`}
                  model={analysisResult}
                />
              </div>
            )}

            {status === 'idle' && (
              <div className="role-fit-no-print">
                <EmptyLabState />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function EmptyLabState() {
  return (
    <section className="rounded-[1.75rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
        DD
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">Ready for District Director Fit</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/50">
        Paste a BOS Profile ID above to compare against the Fathom District Director v1 role model
        (locked weights, contract interpretation, deterministic scoring).
      </p>
    </section>
  );
}

function LabBackground() {
  return (
    <div className="role-fit-no-print pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_78%_22%,rgba(167,139,250,0.12),transparent_26%),radial-gradient(circle_at_55%_85%,rgba(251,146,60,0.08),transparent_30%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />
    </div>
  );
}
