import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ExecutiveDiagnosticBriefing from './components/businessAssessment/ExecutiveDiagnosticBriefing.jsx';
import { startStripeCheckout } from './lib/stripeCheckout.js';

const INDUSTRIES = [
  { label: 'Real Estate', disabled: false },
  { label: 'Mortgage (Beta Coming Soon)', disabled: true },
  { label: 'Automotive (Beta Coming Soon)', disabled: true },
  { label: 'Insurance (Beta Coming Soon)', disabled: true },
  { label: 'Financial Services (Beta Coming Soon)', disabled: true },
  { label: 'Professional Services (Beta Coming Soon)', disabled: true },
  { label: 'Other (Beta Coming Soon)', disabled: true }
];

const QUESTIONS = [
  {
    key: 'q1',
    purpose: 'Business Awareness Reality',
    title: 'Do you currently have enough leads and opportunities to achieve your goals?',
    prompt: 'Why or why not?\n\nBe specific.',
    rows: 8
  },
  {
    key: 'q2',
    purpose: 'Desired Future',
    title: 'What are your goals over the next:',
    prompt:
      '• 12 months\n• 24 months\n• 36 months\n\nAnd where would you like your business and life to be in 5–7 years?\n\nBe specific.',
    rows: 10
  },
  {
    key: 'q3',
    purpose: 'Relationship Asset Reality',
    title: 'How many people are currently in your database?',
    prompt:
      'Of those, approximately how many are true relationships?\n\n(True relationships = people who know you and think of you when it is time to buy, sell, or refer.)',
    rows: 8
  },
  {
    key: 'q4',
    purpose: 'Business Generation Behavior',
    title: 'If I asked you to generate business today and meet three new people before the day ended, what would you do?',
    prompt: 'Be specific.',
    rows: 8
  },
  {
    key: 'q5',
    purpose: 'Database Intelligence',
    title: 'Describe your database and follow-up system.',
    prompt:
      'Include:\n\n• CRM\n• database size\n• database organization\n• A+, A, B, C, D segmentation if applicable\n• vendor database if applicable\n• frequency of contact\n• follow-up process\n• strengths\n• weaknesses',
    rows: 12
  },
  {
    key: 'q6',
    purpose: 'Lead Generation Reality',
    title: 'What lead generation activities are you willing to do consistently?',
    prompt: 'What lead generation activities are you unwilling to do?\n\nWhy?',
    rows: 9
  },
  {
    key: 'q7',
    purpose: 'Accountability Reality',
    title: 'Who is holding you accountable?',
    prompt:
      'Describe:\n\n• coach\n• manager\n• team leader\n• spouse\n• accountability partner\n• nobody\n\nHow effective is that accountability?',
    rows: 11
  },
  {
    key: 'q8',
    purpose: 'Systems Reality',
    title: 'Describe your business systems.',
    prompt:
      'Include:\n\n• listing process\n• buyer process\n• lead conversion\n• transaction management\n• recruiting process if applicable\n\nWhat works?\n\nWhat is missing?',
    rows: 12
  },
  {
    key: 'q9',
    purpose: 'Financial Reality',
    title: 'Provide as much business and financial information as you are willing to share.',
    prompt:
      'Examples:\n\n• units closed\n• sales volume\n• average sales price\n• revenue\n• GCI\n• expenses\n• profit\n• marketing spend\n• P&L summaries\n• annual results\n• quarterly results\n• business notes\n• financial observations\n\nThe more information provided, the higher the confidence of the analysis.',
    rows: 18
  },
  {
    key: 'q10',
    purpose: 'Constraint Reality',
    title: 'What do you believe is currently limiting your growth?',
    prompt:
      'What is the biggest problem in the business today?\n\nIf I could wave a magic wand and solve one problem immediately, what would it be?',
    rows: 10
  },
  {
    key: 'q11',
    purpose: 'Team Reality',
    title: 'If you have a team:',
    prompt:
      'Enter team member Profile IDs.\n\nInclude:\n\n• role\n• production level\n• brief notes if helpful\n\nIf you do not have a team, leave blank.',
    rows: 12
  },
  {
    key: 'q12',
    purpose: 'Scaling Reality',
    title: 'Imagine your goals were tripled overnight.',
    prompt: 'What would have to change for that outcome to become possible?\n\nWhat is the first thing that breaks?',
    rows: 10
  }
];

const INITIAL_ANSWERS = QUESTIONS.reduce((acc, question) => {
  acc[question.key] = '';
  return acc;
}, {});

const BUSINESS_ASSESSMENT_PROMO_CODES = new Set(['BA5FREE']);

const GENERATION_STEPS = [
  {
    key: 'business_intelligence_draft',
    label: 'Building Business Intelligence Draft...',
    endpoint: '/api/business-assessment/analyze',
    isComplete: (assessment) => Boolean(assessment?.output?.business_intelligence_draft)
  },
  {
    key: 'executive_diagnostic_briefing',
    label: 'Generating Executive Diagnostic Briefing...',
    endpoint: '/api/business-assessment/generate-briefing',
    isComplete: (assessment) => Boolean(assessment?.output?.executive_diagnostic_briefing_v1)
  },
  {
    key: 'five_futures_and_one_move',
    label: 'Modeling Five Futures and One Move...',
    endpoint: '/api/business-assessment/generate-futures',
    isComplete: (assessment) => Boolean(assessment?.output?.five_futures_v1 && assessment?.output?.one_move_v1)
  }
];

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

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
}

function unwrapCanonical(payload) {
  const dossier = payload?.canonical_dossier || payload?.profile || payload;
  return dossier?.canonical_profile_json || dossier?.canonical_dossier?.canonical_profile_json || dossier;
}

function getRankedDimensions(canonical) {
  return (
    canonical?.rescoring_gpt?.ranked_dimensions ||
    canonical?.rescoring_v1?.ranked_dimensions ||
    canonical?.ranked_dimensions ||
    canonical?.dimension_scores ||
    []
  );
}

function normalizeDimensionName(value) {
  const raw = String(value || '').toLowerCase();
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

function getDimensionLabel(value) {
  const key = normalizeDimensionName(value);
  return DIMENSION_LABELS[key] || value || 'Profile';
}

function deriveProfileType(canonical) {
  const explicit =
    canonical?.profile_type ||
    canonical?.inferred_patterns?.profile_type ||
    canonical?.behavioral_profile?.profile_type ||
    canonical?.render_ready?.profile_dna;

  if (explicit && typeof explicit === 'string') return explicit;

  const ranked = getRankedDimensions(canonical);
  const primary = ranked?.[0]?.dimension || ranked?.[0]?.name || ranked?.[0]?.key;
  const secondary = ranked?.[1]?.dimension || ranked?.[1]?.name || ranked?.[1]?.key;

  if (primary && secondary) return `${getDimensionLabel(primary)} / ${getDimensionLabel(secondary)}`;
  if (primary) return getDimensionLabel(primary);
  return 'MORE MindMap Profile';
}

function extractProfileResult(payload, profileId) {
  const canonical = unwrapCanonical(payload);
  const dossier = payload?.canonical_dossier || {};
  const metadata = canonical?.metadata || canonical?.profile_metadata || {};
  const answers = canonical?.answers || canonical?.assessment_answers || {};
  const name =
    dossier?.person_name ||
    canonical?.person_name ||
    canonical?.full_name ||
    canonical?.name ||
    metadata?.person_name ||
    metadata?.full_name ||
    metadata?.name ||
    answers?.name?.answer_text ||
    answers?.full_name?.answer_text ||
    'Profile Found';

  return {
    id: canonical?.profile_id || payload?.profile_id || profileId,
    name,
    profileType: deriveProfileType(canonical)
  };
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isComplete(answers) {
  return QUESTIONS.every((question) => {
    if (question.key === 'q11') return true;
    return answers[question.key]?.trim().length > 0;
  });
}

export default function BusinessAssessment() {
  const [searchParams] = useSearchParams();
  const [industry, setIndustry] = useState('Real Estate');
  const [profileId, setProfileId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoState, setPromoState] = useState({ status: 'idle', message: '' });
  const [retrieveId, setRetrieveId] = useState('');
  const [profileResult, setProfileResult] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [submitState, setSubmitState] = useState({ status: 'idle', error: '', result: null });
  const [retrieveState, setRetrieveState] = useState({ status: 'idle', error: '', result: null });
  const [checkoutState, setCheckoutState] = useState({ loading: '', error: '' });
  const [generationState, setGenerationState] = useState({
    status: 'idle',
    phase: '',
    error: '',
    assessmentId: null,
    ownerProfileId: null
  });

  const normalizedProfileId = useMemo(() => profileId.trim(), [profileId]);
  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const canSubmit = isComplete(answers);
  const retrievedAssessment = retrieveState.result?.assessment || null;
  const retrievedBriefing = retrievedAssessment?.output?.executive_diagnostic_briefing_v1 || null;
  const retrievedOutput = retrievedAssessment?.output || {};
  const retrievedNeedsGeneration = Boolean(
    retrievedAssessment &&
      (!retrievedOutput.business_intelligence_draft ||
        !retrievedOutput.executive_diagnostic_briefing_v1 ||
        !retrievedOutput.five_futures_v1 ||
        !retrievedOutput.one_move_v1)
  );
  const generationIsRunning = generationState.status === 'running';
  const routeProfileId = searchParams.get('id') || '';

  async function validateProfile(event) {
    event.preventDefault();
    setProfileResult(null);
    setProfileError('');
    setFlowStarted(false);
    setSubmitState({ status: 'idle', error: '', result: null });

    if (!normalizedProfileId) {
      setProfileError('Enter your MORE MindMap Profile ID to continue.');
      return;
    }

    setIsValidating(true);
    try {
      const url = buildApiUrl(
        `/api/moremindmap/retrieve-profile?id=${encodeURIComponent(normalizedProfileId)}&nocache=1`
      );
      const response = await fetch(url);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.canonical_dossier) {
        setProfileError('Profile not found.\nPlease complete your MORE MindMap Profile first.');
        return;
      }

      setProfileResult(extractProfileResult(payload, normalizedProfileId));
    } catch {
      setProfileError('Profile not found.\nPlease complete your MORE MindMap Profile first.');
    } finally {
      setIsValidating(false);
    }
  }

  function beginAssessment() {
    setFlowStarted(true);
    setCurrentQuestionIndex(0);
    setSubmitState({ status: 'idle', error: '', result: null });
  }

  async function startProductCheckout(productKey, sourceContext) {
    setCheckoutState({ loading: productKey, error: '' });
    try {
      await startStripeCheckout({
        product_key: productKey,
        profile_id: profileResult?.id || normalizedProfileId || retrieveId.trim(),
        assessment_id: retrievedAssessment?.assessment_id || submitState.result?.assessment_id || '',
        source_context: sourceContext
      });
    } catch {
      setCheckoutState({ loading: '', error: 'Payment setup is not available yet.' });
    }
  }

  function validateBusinessAssessmentPromo(event) {
    event.preventDefault();
    const code = promoCode.trim().toUpperCase();

    if (!code) {
      setPromoState({ status: 'error', message: 'Enter a Business Assessment promo code.' });
      return;
    }

    if (BUSINESS_ASSESSMENT_PROMO_CODES.has(code)) {
      setPromoState({
        status: 'valid',
        message: `${code} accepted. Business Assessment access unlocked.`
      });
      return;
    }

    setPromoState({ status: 'error', message: 'Promo code not recognized for Business Assessment.' });
  }

  function updateAnswer(value) {
    setAnswers((current) => ({
      ...current,
      [currentQuestion.key]: value
    }));
  }

  function getMissingGenerationSteps(assessment) {
    return GENERATION_STEPS.filter((step) => !step.isComplete(assessment));
  }

  async function postGenerationStep(step, assessmentId) {
    const response = await fetch(buildApiUrl(step.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessment_id: assessmentId })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || payload?.detail || `Unable to complete ${step.label}`);
    }

    return payload;
  }

  async function retrieveAssessmentByProfileId(ownerProfileId) {
    const response = await fetch(
      buildApiUrl(`/api/business-assessment/retrieve?id=${encodeURIComponent(ownerProfileId)}`)
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success || !payload?.found) {
      throw new Error(payload?.error || 'Unable to retrieve completed assessment.');
    }

    return payload;
  }

  async function runGenerationSequence({ assessmentId, ownerProfileId, assessmentRecord }) {
    const normalizedOwnerProfileId = String(ownerProfileId || '').trim();

    if (!assessmentId || !normalizedOwnerProfileId) {
      throw new Error('Assessment ID and owner Profile ID are required for generation.');
    }

    let currentAssessment = assessmentRecord;
    if (!currentAssessment) {
      const currentPayload = await retrieveAssessmentByProfileId(normalizedOwnerProfileId);
      currentAssessment = currentPayload.assessment;
    }

    const missingSteps = getMissingGenerationSteps(currentAssessment);

    setGenerationState({
      status: 'running',
      phase: missingSteps[0]?.label || 'Checking completed intelligence...',
      error: '',
      assessmentId,
      ownerProfileId: normalizedOwnerProfileId
    });

    try {
      for (const step of missingSteps) {
        setGenerationState({
          status: 'running',
          phase: step.label,
          error: '',
          assessmentId,
          ownerProfileId: normalizedOwnerProfileId
        });
        await postGenerationStep(step, assessmentId);
      }

      setGenerationState({
        status: 'running',
        phase: 'Retrieving completed assessment...',
        error: '',
        assessmentId,
        ownerProfileId: normalizedOwnerProfileId
      });

      const completed = await retrieveAssessmentByProfileId(normalizedOwnerProfileId);
      setRetrieveId(normalizedOwnerProfileId);
      setRetrieveState({ status: 'found', error: '', result: completed });
      setGenerationState({
        status: 'complete',
        phase: 'Complete.',
        error: '',
        assessmentId,
        ownerProfileId: normalizedOwnerProfileId
      });

      return completed;
    } catch (error) {
      setGenerationState({
        status: 'error',
        phase: '',
        error:
          error.message ||
          'Your intake was saved, but intelligence generation did not complete. You can retry generation.',
        assessmentId,
        ownerProfileId: normalizedOwnerProfileId
      });
      throw error;
    }
  }

  async function submitAssessment() {
    if (!profileResult || !canSubmit) return;
    setSubmitState({ status: 'saving', error: '', result: null });
    setGenerationState({ status: 'idle', phase: '', error: '', assessmentId: null, ownerProfileId: null });
    let savedPayload = null;

    try {
      const response = await fetch(buildApiUrl('/api/business-assessment/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_profile_id: profileResult.id || normalizedProfileId,
          answers
        })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to save assessment intake.');
      }

      savedPayload = payload;
      const ownerProfileId =
        payload.profile_context?.owner_profile_id || profileResult.id || normalizedProfileId;
      setSubmitState({ status: 'generating', error: '', result: payload });
      const completed = await runGenerationSequence({
        assessmentId: payload.assessment_id,
        ownerProfileId,
        assessmentRecord: null
      });
      setSubmitState({ status: 'complete', error: '', result: completed });
    } catch (error) {
      setSubmitState({
        status: savedPayload ? 'generation_error' : 'error',
        error:
          savedPayload
            ? 'Your intake was saved, but intelligence generation did not complete. You can retry generation.'
            : error.message || 'Unable to save assessment intake.',
        result: savedPayload
      });
    }
  }

  async function generateRetrievedAssessment() {
    if (!retrievedAssessment || generationIsRunning) return;

    try {
      setSubmitState({ status: 'idle', error: '', result: null });
      await runGenerationSequence({
        assessmentId: retrievedAssessment.assessment_id,
        ownerProfileId: retrievedAssessment.owner_profile_id,
        assessmentRecord: retrievedAssessment
      });
    } catch {
      // runGenerationSequence owns the user-facing recovery state.
    }
  }

  async function retrieveAssessment(event, requestedId = retrieveId) {
    event?.preventDefault();
    const id = requestedId.trim();
    setRetrieveState({ status: 'loading', error: '', result: null });

    if (!id) {
      setRetrieveState({ status: 'error', error: 'Enter a Profile ID.', result: null });
      return;
    }

    try {
      const response = await fetch(
        buildApiUrl(`/api/business-assessment/retrieve?id=${encodeURIComponent(id)}`)
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to retrieve assessment.');
      }

      setRetrieveState({ status: payload.found ? 'found' : 'not_found', error: '', result: payload });
    } catch (error) {
      setRetrieveState({
        status: 'error',
        error: error.message || 'Unable to retrieve assessment.',
        result: null
      });
    }
  }

  useEffect(() => {
    if (!routeProfileId) return;
    if (retrieveState.status !== 'idle') return;
    setRetrieveId(routeProfileId);
    retrieveAssessment(null, routeProfileId);
  }, [routeProfileId, retrieveState.status]);

  useEffect(() => {
    if (!retrievedBriefing) return;
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#business-assessment-results') return;
    window.requestAnimationFrame(() => {
      let storedScrollY = null;
      try {
        storedScrollY = window.sessionStorage.getItem('business_assessment_visual_scroll_y');
        window.sessionStorage.removeItem('business_assessment_visual_scroll_y');
      } catch {
        storedScrollY = null;
      }

      const parsedScrollY = storedScrollY ? Number(storedScrollY) : NaN;
      if (Number.isFinite(parsedScrollY) && parsedScrollY > 0) {
        window.scrollTo({ top: parsedScrollY, behavior: 'auto' });
        return;
      }

      document.getElementById('business-assessment-results')?.scrollIntoView({ block: 'start' });
    });
  }, [retrievedBriefing]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.16),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.13),transparent_30%),linear-gradient(180deg,#050505_0%,#0b0b0d_52%,#000_100%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="mb-12 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold tracking-[0.28em] text-orange-300">
            MORE MINDMAP
          </Link>
          <Link
            to="/profile"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-white/80 transition hover:border-orange-400/60 hover:text-orange-200"
          >
            PROFILE
          </Link>
        </nav>

        <main className="grid flex-1 gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <section className="space-y-8">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
                Business Assessment
              </p>
              <h1 className="max-w-4xl text-4xl font-semibold uppercase tracking-[0.08em] text-white sm:text-5xl lg:text-6xl">
                SEE THE FUTURE YOUR BUSINESS IS CREATING.
              </h1>
              <div className="max-w-2xl space-y-4 text-lg leading-8 text-white/72">
                <p>Businesses rarely fail all at once.</p>
                <p>They drift.</p>
                <p>
                  The system identifies where your business is today, where it is headed next, and
                  the One Move most likely to change the outcome.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">
                  Industry
                </h2>
                <select
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="w-full rounded-xl border border-orange-400/30 bg-black/70 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white outline-none transition focus:border-orange-300"
                >
                  {INDUSTRIES.map((option) => (
                    <option key={option.label} value={option.label} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">
                  What You Receive
                </h2>
                <ul className="space-y-2 text-sm text-white/78">
                  {[
                    'Executive Business Summary',
                    'Business Operating System Diagnostic',
                    'Five Futures',
                    'The One Move',
                    'Retrieval By Profile ID'
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="text-orange-300">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="rounded-2xl border border-purple-400/20 bg-purple-400/[0.05] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-purple-200">
                Before You Start
              </h2>
              <div className="space-y-3 text-base leading-7 text-white/76">
                <p>Be honest.</p>
                <p>Be specific.</p>
                <p>The quality of the output depends on the quality of the reality provided.</p>
              </div>
            </section>

            {flowStarted && (
              <section className="rounded-3xl border border-orange-400/25 bg-black/55 p-5 shadow-[0_0_60px_rgba(249,115,22,0.12)] sm:p-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
                      Question {currentQuestionIndex + 1} of {QUESTIONS.length}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/40">
                      {currentQuestion.purpose}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10 sm:w-44">
                    <div
                      className="h-full rounded-full bg-orange-400 transition-all"
                      style={{ width: `${((currentQuestionIndex + 1) / QUESTIONS.length) * 100}%` }}
                    />
                  </div>
                </div>

                <h2 className="text-2xl font-semibold leading-tight text-white">{currentQuestion.title}</h2>
                <p className="mt-4 whitespace-pre-line text-base leading-7 text-white/70">
                  {currentQuestion.prompt}
                </p>
                <textarea
                  value={answers[currentQuestion.key]}
                  onChange={(event) => updateAnswer(event.target.value)}
                  rows={currentQuestion.rows}
                  placeholder="Write the real answer here."
                  className="mt-5 w-full resize-y rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-base leading-7 text-white outline-none placeholder:text-white/30 focus:border-orange-300"
                />

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((index) => Math.max(index - 1, 0))}
                    className="rounded-xl border border-white/14 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white/70 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Previous
                  </button>
                  {currentQuestionIndex < QUESTIONS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentQuestionIndex((index) => Math.min(index + 1, QUESTIONS.length - 1))
                      }
                      className="rounded-xl bg-white px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-orange-200"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canSubmit || submitState.status === 'saving' || submitState.status === 'generating' || generationIsRunning}
                      onClick={submitAssessment}
                      className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {submitState.status === 'saving'
                        ? 'Saving...'
                        : submitState.status === 'generating' || generationIsRunning
                          ? 'Generating...'
                          : 'Submit Assessment'}
                    </button>
                  )}
                </div>

                {!canSubmit && currentQuestionIndex === QUESTIONS.length - 1 && (
                  <p className="mt-4 text-sm text-white/46">
                    Questions 1-10 and 12 need an answer. Question 11 can stay blank if you do not have a team.
                  </p>
                )}

                {(submitState.status === 'generating' || generationIsRunning) && (
                  <div className="mt-5 rounded-2xl border border-orange-300/35 bg-orange-400/[0.08] p-4">
                    <p className="text-sm font-semibold text-orange-100">
                      {submitState.status === 'saving' ? 'Saving intake...' : generationState.phase || 'Preparing intelligence generation...'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/66">
                      Your intake has been saved. The system is now building the Business Intelligence
                      Draft, Executive Diagnostic Briefing, Five Futures, and One Move.
                    </p>
                  </div>
                )}

                {submitState.status === 'complete' && (
                  <div className="mt-5 rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.08] p-4">
                    <p className="text-sm font-semibold text-emerald-200">Business Assessment intelligence complete.</p>
                    <p className="mt-2 text-sm text-white/78">
                      Assessment ID:{' '}
                      <span className="font-semibold text-white">
                        {submitState.result?.assessment?.assessment_id || submitState.result?.assessment_id}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-white/78">Status: five_futures_and_one_move_ready</p>
                    <p className="mt-1 text-sm text-white/62">
                      Executive Diagnostic, Business Assessment Map, Five Futures, and One Move are ready below.
                    </p>
                  </div>
                )}

                {submitState.status === 'error' && (
                  <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                    {submitState.error}
                  </div>
                )}

                {submitState.status === 'generation_error' && (
                  <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                    <p>{submitState.error}</p>
                    <p className="mt-2">
                      Assessment ID:{' '}
                      <span className="font-semibold text-white">{submitState.result?.assessment_id}</span>
                    </p>
                    <button
                      type="button"
                      disabled={generationIsRunning}
                      onClick={() =>
                        runGenerationSequence({
                          assessmentId: submitState.result?.assessment_id,
                          ownerProfileId:
                            submitState.result?.profile_context?.owner_profile_id ||
                            profileResult?.id ||
                            normalizedProfileId,
                          assessmentRecord: null
                        }).then((completed) =>
                          setSubmitState({ status: 'complete', error: '', result: completed })
                        ).catch(() => {})
                      }
                      className="mt-4 rounded-xl border border-red-200/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-red-50 transition hover:border-red-100 hover:bg-red-300/10 disabled:cursor-wait disabled:opacity-55"
                    >
                      Retry Generation
                    </button>
                  </div>
                )}
              </section>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-orange-400/35 bg-gradient-to-br from-orange-500/12 via-white/[0.035] to-purple-500/10 p-6 shadow-[0_0_55px_rgba(249,115,22,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange-300">
                Business Assessment
              </p>
              <div className="mt-4 text-6xl font-semibold tracking-tight text-white">$49</div>
              <p className="mt-4 text-base leading-7 text-white/70">
                See the future your business is creating.
              </p>
              <div className="mt-5 space-y-1 text-lg font-semibold text-white/86">
                <p>Business Assessment</p>
                <p>+</p>
                <p>Five Futures</p>
                <p>+</p>
                <p>One Move</p>
              </div>
              <button
                type="button"
                disabled={checkoutState.loading === 'business_assessment'}
                onClick={() => startProductCheckout('business_assessment', 'business_assessment_offer')}
                className="mt-6 w-full rounded-xl bg-white px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-orange-200 disabled:cursor-wait disabled:opacity-55"
              >
                {checkoutState.loading === 'business_assessment' ? 'Opening Checkout...' : 'Start Business Assessment Checkout'}
              </button>
              <p className="mt-3 text-xs leading-5 text-white/46">
                Checkout opens through Stripe. Durable paid access is confirmed after payment processing.
              </p>
            </section>

            <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.055] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200">
                MORE Monthly Intelligence
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Keep improving over time.</h2>
              <p className="mt-3 text-sm leading-6 text-white/66">
                You have your map. Now keep it alive.
              </p>
              <button
                type="button"
                disabled={checkoutState.loading === 'more_monthly_intelligence'}
                onClick={() => startProductCheckout('more_monthly_intelligence', 'business_assessment_soft_awareness')}
                className="mt-5 w-full rounded-xl border border-cyan-200/40 px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/10 disabled:cursor-wait disabled:opacity-55"
              >
                {checkoutState.loading === 'more_monthly_intelligence' ? 'Opening Checkout...' : 'Start MORE Monthly Intelligence'}
              </button>
            </section>

            {checkoutState.error && (
              <section className="rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                {checkoutState.error}
              </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-white">
                Start Here
              </h2>
              <form className="mt-5 space-y-4" onSubmit={validateProfile}>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                  Enter Your Profile ID
                </label>
                <input
                  value={profileId}
                  onChange={(event) => setProfileId(event.target.value)}
                  placeholder="MM-20260531-XXXXXXX"
                  className="w-full rounded-xl border border-white/12 bg-black/65 px-4 py-3 text-sm uppercase tracking-[0.08em] text-white outline-none transition placeholder:text-white/34 focus:border-orange-300"
                />
                <button
                  type="submit"
                  disabled={isValidating}
                  className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-black transition hover:bg-orange-300 disabled:cursor-wait disabled:opacity-60"
                >
                  {isValidating ? 'Validating...' : 'Validate Profile'}
                </button>
              </form>

              {profileResult && (
                <div className="mt-5 rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.08] p-4">
                  <p className="text-sm font-semibold text-emerald-200">✓ Profile Found</p>
                  <p className="mt-2 text-lg font-semibold text-white">{profileResult.name}</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.16em] text-white/62">
                    {profileResult.profileType}
                  </p>
                  <button
                    type="button"
                    onClick={beginAssessment}
                    className="mt-4 w-full rounded-xl border border-emerald-300/40 px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-300/10"
                  >
                    Begin Business Assessment
                  </button>
                </div>
              )}

              {profileError && (
                <div className="mt-5 whitespace-pre-line rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                  {profileError}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                Have A Promo Code?
              </h2>
              <form className="mt-4 space-y-3" onSubmit={validateBusinessAssessmentPromo}>
                <input
                  value={promoCode}
                  onChange={(event) => {
                    setPromoCode(event.target.value);
                    setPromoState({ status: 'idle', message: '' });
                  }}
                  placeholder="Enter Promo Code"
                  className="w-full rounded-xl border border-white/12 bg-black/60 px-4 py-3 text-sm uppercase tracking-[0.08em] text-white outline-none placeholder:text-white/34 focus:border-purple-300"
                />
                <button
                  type="submit"
                  disabled={!promoCode.trim()}
                  className="w-full rounded-xl border border-purple-300/35 px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-purple-100 transition hover:border-purple-200 hover:bg-purple-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Apply Promo
                </button>
              </form>
              {promoState.message && (
                <p
                  className={`mt-3 rounded-xl border px-4 py-3 text-sm leading-6 ${
                    promoState.status === 'valid'
                      ? 'border-emerald-300/30 bg-emerald-400/[0.08] text-emerald-100'
                      : 'border-red-400/30 bg-red-500/[0.08] text-red-100'
                  }`}
                >
                  {promoState.message}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                Already Completed A Business Assessment?
              </h2>
              <form className="mt-4 space-y-4" onSubmit={retrieveAssessment}>
                <input
                  value={retrieveId}
                  onChange={(event) => setRetrieveId(event.target.value)}
                  placeholder="Enter Profile ID"
                  className="w-full rounded-xl border border-white/12 bg-black/60 px-4 py-3 text-sm uppercase tracking-[0.08em] text-white outline-none placeholder:text-white/34 focus:border-blue-300"
                />
                <button
                  type="submit"
                  disabled={retrieveState.status === 'loading'}
                  className="w-full rounded-xl border border-white/14 px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white/72 transition hover:border-blue-300/60 disabled:cursor-wait disabled:opacity-45"
                >
                  {retrieveState.status === 'loading' ? 'Retrieving...' : 'Retrieve'}
                </button>
              </form>

              {retrieveState.status === 'found' && (
                <div className="mt-5 rounded-2xl border border-blue-300/30 bg-blue-400/[0.08] p-4">
                  <p className="text-sm font-semibold text-blue-100">Business Assessment Found</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {retrievedBriefing
                      ? 'Executive Diagnostic Briefing Ready'
                      : 'Executive Diagnostic Briefing not generated yet.'}
                  </p>
                  <p className="mt-2 text-sm text-white/78">
                    Assessment ID:{' '}
                    <span className="font-semibold text-white">
                      {retrieveState.result.assessment.assessment_id}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-white/78">
                    Created At: {formatDate(retrieveState.result.assessment.created_at)}
                  </p>
                  <p className="mt-1 text-sm text-white/78">
                    Status: {retrieveState.result.assessment.status}
                  </p>
                  <p className="mt-1 text-sm text-white/62">
                    {retrievedNeedsGeneration
                      ? 'This assessment intake is saved and can now complete intelligence generation.'
                      : 'This assessment intelligence is complete.'}
                  </p>

                  {retrievedNeedsGeneration && (
                    <button
                      type="button"
                      disabled={generationIsRunning}
                      onClick={generateRetrievedAssessment}
                      className="mt-4 w-full rounded-xl border border-blue-200/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-50 transition hover:border-blue-100 hover:bg-blue-300/10 disabled:cursor-wait disabled:opacity-55"
                    >
                      {generationIsRunning ? generationState.phase || 'Generating...' : 'Generate Executive Diagnostic'}
                    </button>
                  )}

                  {generationState.status === 'running' &&
                    generationState.assessmentId === retrieveState.result.assessment.assessment_id && (
                      <p className="mt-3 rounded-xl border border-orange-300/25 bg-orange-400/[0.08] px-4 py-3 text-sm leading-6 text-orange-100">
                        {generationState.phase || 'Generating intelligence...'}
                      </p>
                    )}

                  {generationState.status === 'error' &&
                    generationState.assessmentId === retrieveState.result.assessment.assessment_id && (
                      <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-100">
                        Your intake was saved, but intelligence generation did not complete. You can retry generation.
                      </p>
                    )}
                </div>
              )}

              {retrieveState.status === 'not_found' && (
                <div className="mt-5 rounded-2xl border border-white/12 bg-white/[0.04] p-4 text-sm text-white/68">
                  No Business Assessment found for this Profile ID.
                </div>
              )}

              {retrieveState.status === 'error' && (
                <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                  {retrieveState.error}
                </div>
              )}
            </section>
          </aside>
        </main>

        {retrievedBriefing && (
          <div id="business-assessment-results">
            <ExecutiveDiagnosticBriefing briefing={retrievedBriefing} assessment={retrievedAssessment} />
            <section className="mt-10 rounded-[2rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-400/[0.1] via-white/[0.035] to-purple-500/[0.09] p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                MORE Monthly Intelligence
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">
                You have your map.
                <span className="block text-cyan-100">Now keep it alive.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                Your assessment created your current map. Monthly Intelligence helps you keep moving.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  'track your One Move',
                  'record what happened',
                  'see what changed',
                  'avoid overclaiming progress',
                  'generate an updated strategy draft',
                  'choose the next best move'
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/76">
                    {item}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={checkoutState.loading === 'more_monthly_intelligence'}
                onClick={() => startProductCheckout('more_monthly_intelligence', 'business_assessment_result_upgrade')}
                className="mt-7 rounded-xl bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-55"
              >
                {checkoutState.loading === 'more_monthly_intelligence' ? 'Opening Checkout...' : 'Start MORE Monthly Intelligence - $23.95/month'}
              </button>
              <p className="mt-4 text-xs leading-5 text-white/46">
                Checkout starts access verification. Durable paid access requires payment processing confirmation.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
