import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ExecutiveDiagnosticBriefing from './components/businessAssessment/ExecutiveDiagnosticBriefing.jsx';
import PremiumCustomerBAReport from './components/businessAssessment/PremiumCustomerBAReport.jsx';
import { buildCustomerBAViewModel } from './lib/businessAssessment/buildCustomerBAViewModel.js';
import {
  BA_RETRIEVE_INVALID_ID_MESSAGE,
  BA_RETRIEVE_NOT_FOUND_MESSAGE,
  retrieveBusinessAssessment
} from './lib/businessAssessment/retrieveBusinessAssessment.js';
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

function createProfileGateState() {
  return {
    input: '',
    status: 'idle',
    profile: null,
    error: ''
  };
}

function createMonthlyProfileGateState() {
  return {
    input: '',
    status: 'idle',
    profile: null,
    error: '',
    businessAssessmentStatus: 'idle',
    businessAssessmentId: ''
  };
}

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

function PremiumPreviewHeader({ personName }) {
  return (
    <header className="mb-8 border-b border-white/10 pb-6">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-orange-300/70">
        MORE MindMap Business Assessment
      </p>
      <h1 className="mt-2 text-2xl font-bold text-white">{personName}</h1>
      <div className="mt-5 rounded-xl border border-orange-400/20 bg-orange-500/5 px-4 py-3">
        <p className="text-sm text-white/80">Business reality + personality reality + future consequence</p>
      </div>
    </header>
  );
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
  const [promoCode, setPromoCode] = useState('');
  const [promoState, setPromoState] = useState({ status: 'idle', message: '' });
  const [retrieveId, setRetrieveId] = useState('');
  const [checkoutProfileGate, setCheckoutProfileGate] = useState(createProfileGateState);
  const [monthlyProfileGate, setMonthlyProfileGate] = useState(createMonthlyProfileGateState);
  const [devCodeProfileGate, setDevCodeProfileGate] = useState(createProfileGateState);
  const [assessmentProfile, setAssessmentProfile] = useState(null);
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
  // preview=premium remains supported for focused preview entry; it is no longer required
  // for completed retrieved BA rendering (MMB21E default route promotion).
  const previewPremium = searchParams.get('preview') === 'premium';
  const previewProfileId = (routeProfileId || retrieveId).trim();
  const assessmentOutputComplete = Boolean(
    retrievedAssessment?.output?.executive_diagnostic_briefing_v1 &&
      retrievedAssessment?.output?.five_futures_v1 &&
      retrievedAssessment?.output?.one_move_v1
  );
  // Default completed BA renderer: PremiumCustomerBAReport (not ExecutiveDiagnosticBriefing).
  const showPremiumShell =
    retrieveState.status === 'found' && assessmentOutputComplete;
  const premiumViewModel = useMemo(() => {
    if (!showPremiumShell || !retrieveState.result) return null;
    try {
      return buildCustomerBAViewModel(retrieveState.result);
    } catch {
      return null;
    }
  }, [showPremiumShell, retrieveState.result]);
  const premiumVmBuildFailed = showPremiumShell && premiumViewModel === null;
  const showPremiumResults = Boolean(showPremiumShell && premiumViewModel);
  // Old Executive Diagnostic is intentionally not the default completed customer renderer.
  // Source briefing data remains available via Technical Source / Advanced Source inside premium.
  const showLegacyDiagnosticResults = false;
  const checkoutProfileValidated = Boolean(checkoutProfileGate.profile?.id);
  const monthlyProfileValidated = Boolean(monthlyProfileGate.profile?.id);
  const hasCompletedBusinessAssessment = monthlyProfileGate.businessAssessmentStatus === 'found';
  const devCodeProfileValidated = Boolean(devCodeProfileGate.profile?.id);
  const devCodeAccepted = promoState.status === 'valid' && devCodeProfileValidated;

  async function validateProfileForGate(event, gateType) {
    event.preventDefault();
    const gate =
      gateType === 'monthly'
        ? monthlyProfileGate
        : gateType === 'devCode'
          ? devCodeProfileGate
          : checkoutProfileGate;
    const normalizedGateProfileId = gate.input.trim();

    setFlowStarted(false);
    setSubmitState({ status: 'idle', error: '', result: null });

    if (!normalizedGateProfileId) {
      setProfileGateState(gateType, {
        status: 'error',
        profile: null,
        error: 'Enter your MORE MindMap Profile ID to continue.',
        ...(gateType === 'monthly'
          ? { businessAssessmentStatus: 'idle', businessAssessmentId: '' }
          : {})
      });
      return;
    }

    setProfileGateState(gateType, {
      status: 'validating',
      profile: null,
      error: '',
      ...(gateType === 'monthly'
        ? { businessAssessmentStatus: 'idle', businessAssessmentId: '' }
        : {})
    });

    try {
      const url = buildApiUrl(
        `/api/moremindmap/retrieve-profile?id=${encodeURIComponent(normalizedGateProfileId)}&nocache=1`
      );
      const response = await fetch(url);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.canonical_dossier) {
        setProfileGateState(gateType, {
          status: 'error',
          profile: null,
          error:
            gateType === 'monthly'
              ? 'Profile not found. First complete your Behavior Operating System profile, then take the Business Assessment.'
              : 'First you must complete your Behavior Operating System profile to unlock this action.',
          ...(gateType === 'monthly'
            ? { businessAssessmentStatus: 'idle', businessAssessmentId: '' }
            : {})
        });
        return;
      }

      const profile = extractProfileResult(payload, normalizedGateProfileId);

      if (gateType === 'monthly') {
        setMonthlyProfileGate((current) => ({
          ...current,
          status: 'valid',
          profile,
          error: '',
          businessAssessmentStatus: 'checking',
          businessAssessmentId: ''
        }));
        const completion = await getBusinessAssessmentCompletion(profile.id || normalizedGateProfileId);
        setMonthlyProfileGate((current) => ({
          ...current,
          businessAssessmentStatus: completion.status,
          businessAssessmentId: completion.assessmentId
        }));
        return;
      }

      setProfileGateState(gateType, {
        status: 'valid',
        profile,
        error: ''
      });
    } catch {
      setProfileGateState(gateType, {
        status: 'error',
        profile: null,
        error: 'Profile validation is not available right now. Please try again shortly.',
        ...(gateType === 'monthly'
          ? { businessAssessmentStatus: 'idle', businessAssessmentId: '' }
          : {})
      });
    }
  }

  function beginAssessment() {
    if (!devCodeAccepted) {
      setPromoState({
        status: 'error',
        message: 'First validate your profile, then apply a valid Dev Code to unlock the Business Assessment.'
      });
      return;
    }
    setAssessmentProfile(devCodeProfileGate.profile);
    setFlowStarted(true);
    setCurrentQuestionIndex(0);
    setSubmitState({ status: 'idle', error: '', result: null });
  }

  function resolveCheckoutProfileId(productKey) {
    if (productKey === 'more_monthly_intelligence') {
      return (
        monthlyProfileGate.profile?.id ||
        premiumViewModel?.profile_id ||
        premiumViewModel?.identity?.profile_id ||
        retrievedAssessment?.owner_profile_id ||
        retrievedAssessment?.profile_context?.owner_profile_id ||
        retrieveState.result?.owner_profile_id ||
        submitState.result?.profile_context?.owner_profile_id ||
        submitState.result?.owner_profile_id ||
        assessmentProfile?.id ||
        routeProfileId ||
        ''
      );
    }
    return checkoutProfileGate.profile?.id || '';
  }

  function resolveCheckoutAssessmentId(productKey) {
    if (productKey === 'more_monthly_intelligence') {
      return (
        monthlyProfileGate.businessAssessmentId ||
        premiumViewModel?.assessment_id ||
        premiumViewModel?.identity?.assessment_id ||
        retrievedAssessment?.assessment_id ||
        retrieveState.result?.assessment_id ||
        submitState.result?.assessment?.assessment_id ||
        submitState.result?.assessment_id ||
        ''
      );
    }
    return retrievedAssessment?.assessment_id || submitState.result?.assessment_id || '';
  }

  function hasCompletedAssessmentContext() {
    return Boolean(
      monthlyProfileGate.businessAssessmentStatus === 'found' ||
        premiumViewModel?.assessment_id ||
        retrievedAssessment?.assessment_id ||
        (submitState.status === 'complete' &&
          (submitState.result?.assessment_id || submitState.result?.assessment?.assessment_id))
    );
  }

  async function startProductCheckout(productKey, sourceContext) {
    const profileId = resolveCheckoutProfileId(productKey);
    const assessmentId = resolveCheckoutAssessmentId(productKey);

    if (!profileId) {
      setCheckoutState({ loading: '', error: 'First validate your profile to unlock checkout.' });
      return;
    }

    if (productKey === 'more_monthly_intelligence' && !hasCompletedAssessmentContext()) {
      setCheckoutState({
        loading: '',
        error: 'First you must take the Business Assessment to unlock Monthly Intelligence.'
      });
      return;
    }

    setCheckoutState({ loading: productKey, error: '' });
    try {
      await startStripeCheckout({
        product_key: productKey,
        profile_id: profileId,
        assessment_id: assessmentId,
        source_context: sourceContext
      });
    } catch {
      setCheckoutState({ loading: '', error: 'Payment setup is not available yet.' });
    }
  }

  function validateBusinessAssessmentPromo(event) {
    event.preventDefault();
    const code = promoCode.trim().toUpperCase();

    if (!devCodeProfileValidated) {
      setPromoState({
        status: 'error',
        message: 'First validate your profile before applying a Dev Code.'
      });
      return;
    }

    if (!code) {
      setPromoState({ status: 'error', message: 'Enter a Business Assessment Dev Code.' });
      return;
    }

    if (BUSINESS_ASSESSMENT_PROMO_CODES.has(code)) {
      setPromoState({
        status: 'valid',
        message: `${code} accepted. Business Assessment access unlocked.`
      });
      return;
    }

    setPromoState({ status: 'error', message: 'Dev Code not recognized for Business Assessment.' });
  }

  function setProfileGateState(gateType, patch) {
    if (gateType === 'monthly') {
      setMonthlyProfileGate((current) => ({ ...current, ...patch }));
      return;
    }

    if (gateType === 'devCode') {
      setDevCodeProfileGate((current) => ({ ...current, ...patch }));
      return;
    }

    setCheckoutProfileGate((current) => ({ ...current, ...patch }));
  }

  function updateProfileGateInput(gateType, value) {
    if (gateType === 'monthly') {
      setMonthlyProfileGate((current) => ({
        ...current,
        input: value,
        status: 'idle',
        profile: null,
        error: '',
        businessAssessmentStatus: 'idle',
        businessAssessmentId: ''
      }));
      return;
    }

    if (gateType === 'devCode') {
      setDevCodeProfileGate((current) => ({
        ...current,
        input: value,
        status: 'idle',
        profile: null,
        error: ''
      }));
      setPromoState((current) =>
        current.status === 'valid' ? { status: 'idle', message: '' } : current
      );
      setAssessmentProfile(null);
      return;
    }

    setCheckoutProfileGate((current) => ({
      ...current,
      input: value,
      status: 'idle',
      profile: null,
      error: ''
    }));
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
    const { payload } = await retrieveBusinessAssessment(ownerProfileId, buildApiUrl);
    return payload;
  }

  async function getBusinessAssessmentCompletion(ownerProfileId) {
    const id = String(ownerProfileId || '').trim();
    if (!id) return { status: 'not_found', assessmentId: '' };

    try {
      const payload = await retrieveAssessmentByProfileId(id);
      const assessment = payload?.assessment || null;
      const output = assessment?.output || {};
      const isComplete = Boolean(
        output.business_intelligence_draft &&
          output.executive_diagnostic_briefing_v1 &&
          output.five_futures_v1 &&
          output.one_move_v1
      );

      return {
        status: isComplete ? 'found' : 'not_found',
        assessmentId: isComplete ? assessment.assessment_id || '' : ''
      };
    } catch {
      return { status: 'not_found', assessmentId: '' };
    }
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
    if (!assessmentProfile?.id || !canSubmit) return;
    setSubmitState({ status: 'saving', error: '', result: null });
    setGenerationState({ status: 'idle', phase: '', error: '', assessmentId: null, ownerProfileId: null });
    let savedPayload = null;

    try {
      const response = await fetch(buildApiUrl('/api/business-assessment/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_profile_id: assessmentProfile.id,
          answers
        })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to save assessment intake.');
      }

      savedPayload = payload;
      const ownerProfileId =
        payload.profile_context?.owner_profile_id || assessmentProfile.id;
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
      setRetrieveState({ status: 'error', error: BA_RETRIEVE_INVALID_ID_MESSAGE, result: null });
      return;
    }

    try {
      const { payload } = await retrieveBusinessAssessment(id, buildApiUrl);
      setRetrieveState({ status: 'found', error: '', result: payload });
    } catch (error) {
      const isNotFound = error.code === 'not_found';
      setRetrieveState({
        status: isNotFound ? 'not_found' : 'error',
        error: isNotFound ? '' : error.message || BA_RETRIEVE_NOT_FOUND_MESSAGE,
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
    if (!showPremiumResults) return;
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
  }, [showPremiumResults]);

  function renderProfileValidationForm({ gateType, helperText, accent = 'orange' }) {
    const gate =
      gateType === 'monthly'
        ? monthlyProfileGate
        : gateType === 'devCode'
          ? devCodeProfileGate
          : checkoutProfileGate;
    const focusClass =
      accent === 'cyan'
        ? 'focus:border-cyan-300/60'
        : accent === 'purple'
          ? 'focus:border-purple-300/60'
          : 'focus:border-orange-300/60';
    const buttonClass =
      accent === 'cyan'
        ? 'border border-cyan-200/40 bg-white/[0.06] text-cyan-50 hover:border-cyan-100 hover:bg-cyan-300/10'
        : accent === 'purple'
          ? 'border border-purple-300/35 bg-white/[0.06] text-purple-100 hover:border-purple-200 hover:bg-purple-300/10'
          : 'bg-white text-black hover:bg-orange-100';

    return (
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
          FIRST validate your profile.
        </p>
        <p className="mt-2 text-sm leading-6 text-white/58">{helperText}</p>
        <form className="mt-4 space-y-3" onSubmit={(event) => validateProfileForGate(event, gateType)}>
          <input
            value={gate.input}
            onChange={(event) => updateProfileGateInput(gateType, event.target.value)}
            placeholder="MM-20260531-XXXXXXX"
            className={`w-full rounded-2xl border border-white/10 bg-black/[0.42] px-4 py-3.5 text-sm uppercase tracking-[0.08em] text-white caret-white outline-none placeholder:text-white/32 transition ${focusClass}`}
          />
          <button
            type="submit"
            disabled={gate.status === 'validating'}
            className={`w-full rounded-2xl px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] transition disabled:cursor-wait disabled:opacity-55 ${buttonClass}`}
          >
            {gate.status === 'validating' ? 'Validating...' : 'Validate Profile'}
          </button>
        </form>

        {gate.profile && (
          <div className="mt-4 rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.08] p-4">
            <p className="text-sm font-semibold text-emerald-200">Profile ID validated.</p>
            <p className="mt-2 text-base font-semibold text-white">{gate.profile.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/62">
              {gate.profile.profileType}
            </p>
            {gateType === 'monthly' && gate.businessAssessmentStatus === 'checking' && (
              <p className="mt-2 text-sm text-white/58">Checking Business Assessment completion...</p>
            )}
            {gateType === 'monthly' && gate.businessAssessmentStatus === 'found' && (
              <p className="mt-2 text-sm text-emerald-100">Completed Business Assessment found.</p>
            )}
            {gateType === 'monthly' && gate.businessAssessmentStatus === 'not_found' && (
              <p className="mt-2 text-sm text-white/58">
                Monthly Intelligence requires a completed Business Assessment first.
              </p>
            )}
          </div>
        )}

        {gate.error && (
          <div className="mt-4 whitespace-pre-line rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
            {gate.error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.16),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.13),transparent_30%),linear-gradient(180deg,#050505_0%,#0b0b0d_52%,#000_100%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="mb-12 flex items-center justify-between">
          <Link to="/" className="text-sm font-medium text-white/52 transition hover:text-white">
            ← Back to Home
          </Link>
          <Link
            to="/profile"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-white/80 transition hover:border-orange-400/60 hover:text-orange-200"
          >
            PROFILE
          </Link>
        </nav>

        {previewPremium && !showPremiumResults && (
          <section className="mx-auto w-full max-w-5xl">
            {!previewProfileId && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-6 text-sm leading-6 text-red-100">
                Profile ID is required. Use{' '}
                <span className="font-mono text-red-50">?preview=premium&amp;id=&#123;profile_id&#125;</span>
                {' '}or open{' '}
                <span className="font-mono text-red-50">/business-assessment</span>
                {' '}and retrieve by Profile ID (premium report is the default completed output).
              </div>
            )}

            {previewProfileId && retrieveState.status === 'loading' && (
              <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-8 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/72">Retrieving assessment...</p>
              </div>
            )}

            {previewProfileId && retrieveState.status === 'error' && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-6 text-sm leading-6 text-red-100">
                {retrieveState.error || BA_RETRIEVE_NOT_FOUND_MESSAGE}
              </div>
            )}

            {previewProfileId && retrieveState.status === 'not_found' && (
              <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-6 text-sm text-white/68">
                {BA_RETRIEVE_NOT_FOUND_MESSAGE}
              </div>
            )}

            {previewProfileId &&
              retrieveState.status === 'found' &&
              !assessmentOutputComplete && (
                <div className="rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.08] p-6">
                  <p className="text-sm font-semibold text-cyan-100">Business Assessment found — intelligence incomplete</p>
                  <p className="mt-2 text-sm text-white/78">
                    Assessment ID:{' '}
                    <span className="font-semibold text-white">{retrievedAssessment?.assessment_id}</span>
                  </p>
                  <p className="mt-2 text-sm text-white/62">
                    Complete intelligence generation before the Business Assessment report can open.
                  </p>
                  {retrievedNeedsGeneration && (
                    <button
                      type="button"
                      disabled={generationIsRunning}
                      onClick={generateRetrievedAssessment}
                      className="mt-4 w-full rounded-xl border border-cyan-200/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/10 disabled:cursor-wait disabled:opacity-55"
                    >
                      {generationIsRunning ? generationState.phase || 'Generating...' : 'Generate Business Assessment Intelligence'}
                    </button>
                  )}
                </div>
              )}

            {previewProfileId && premiumVmBuildFailed && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-6 text-sm leading-6 text-red-100">
                Premium report is unavailable for this assessment. The stored data could not be rendered into the
                customer report. This is not shown as a legacy briefing substitute.
              </div>
            )}
          </section>
        )}

        {!previewPremium && premiumVmBuildFailed && (
          <section className="mx-auto mb-6 w-full max-w-5xl">
            <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-6 text-sm leading-6 text-red-100">
              Business Assessment report is unavailable for this assessment. The stored data could not be rendered into the
              customer report. The legacy Executive Diagnostic is not substituted as a success state.
            </div>
          </section>
        )}

        {!flowStarted && !previewPremium && (
          <section className="mx-auto w-full max-w-7xl">
            <div className="text-center">
              <p className="text-4xl font-semibold tracking-[0.12em] text-white md:text-5xl">
                MOREMINDMAP
              </p>
              <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
                See the future your business is creating.
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-white/64 md:text-lg">
                The system identifies where your business is today, where it is headed next, and the
                One Move most likely to change the outcome.
              </p>
            </div>

            <div className="mt-10 grid gap-6 xl:grid-cols-3">
              <section className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#101114] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.4)] md:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_0%,rgba(249,115,22,0.14),transparent_33%),linear-gradient(145deg,rgba(255,255,255,0.075),transparent_46%)]" />
                <div className="relative flex h-full flex-col">
                  <div className="border-b border-white/10 pb-5">
                    <p className="text-xl font-semibold text-white">Business Assessment</p>
                    <div className="mt-4 flex items-end gap-3">
                      <span className="text-5xl font-semibold tracking-tight text-white">$49</span>
                    </div>
                    <p className="mt-5 text-base font-semibold leading-7 text-white">
                      See the future your business is creating.
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      'Executive Business Summary',
                      'Business Operating System Diagnostic',
                      'Five Futures',
                      'One Move',
                      'Business Assessment Map',
                      'Universal Translator',
                      'Retrieval by Profile ID'
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm leading-6 text-white/72">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-200/80" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    {renderProfileValidationForm({
                      gateType: 'checkout',
                      helperText: 'First validate your profile to unlock Business Assessment checkout.',
                      accent: 'orange'
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={!checkoutProfileValidated || checkoutState.loading === 'business_assessment'}
                    onClick={() => startProductCheckout('business_assessment', 'business_assessment_offer')}
                    className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {checkoutState.loading === 'business_assessment' ? 'Opening Checkout...' : 'Start Business Assessment Checkout'}
                  </button>
                  <p className="mt-3 text-xs leading-5 text-white/46">
                    Checkout opens through Stripe. Durable paid access is confirmed after payment processing.
                  </p>
                </div>
              </section>

              <section className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#101114] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.36)] md:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(34,211,238,0.13),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.07),transparent_48%)]" />
                <div className="relative flex h-full flex-col">
                  <div className="border-b border-white/10 pb-5">
                    <p className="text-xl font-semibold text-white">MORE Monthly Intelligence</p>
                    <div className="mt-4 flex items-end gap-3">
                      <span className="text-5xl font-semibold tracking-tight text-white">$23.95</span>
                      <span className="pb-2 text-sm font-medium text-white/45">/month</span>
                    </div>
                    <p className="mt-5 text-base font-semibold leading-7 text-white">
                      You have your map. Now keep it alive.
                    </p>
                    <p className="mt-3 text-sm leading-6 text-white/58">
                      Monthly Intelligence helps MORE MindMap learn from what actually happens, adapt
                      the strategy, and keep your next move aligned with evidence through a
                      self-improving monthly loop.
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      'Track your One Move',
                      'Record what happened',
                      'See what changed',
                      'Avoid overclaiming progress',
                      'Generate an updated strategy draft',
                      'Choose the next best move',
                      'Build evidence over time',
                      'Keep improving as reality changes'
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm leading-6 text-white/72">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200/80" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    {renderProfileValidationForm({
                      gateType: 'monthly',
                      helperText: 'First validate your profile to unlock Monthly Intelligence.',
                      accent: 'cyan'
                    })}
                  </div>

                  {monthlyProfileValidated && monthlyProfileGate.businessAssessmentStatus === 'not_found' && (
                    <p className="mt-4 rounded-2xl border border-orange-300/25 bg-orange-400/[0.08] px-4 py-3 text-sm leading-6 text-orange-100">
                      First you must take the Business Assessment to unlock Monthly Intelligence.
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={
                      !monthlyProfileValidated ||
                      !hasCompletedBusinessAssessment ||
                      checkoutState.loading === 'more_monthly_intelligence'
                    }
                    onClick={() => startProductCheckout('more_monthly_intelligence', 'business_assessment_soft_awareness')}
                    className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/38 bg-white/[0.06] px-5 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {checkoutState.loading === 'more_monthly_intelligence' ? 'Opening Checkout...' : 'Start MORE Monthly Intelligence'}
                  </button>
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/12 bg-[#111216] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35)] md:p-7">
                <div className="border-b border-white/10 pb-5">
                  <p className="text-xl font-semibold text-white">Already have access?</p>
                  <p className="mt-3 text-sm leading-6 text-white/56">
                    Validate a profile, apply a Dev Code, or retrieve a completed Business Assessment.
                  </p>
                </div>

                {checkoutState.error && (
                  <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                    {checkoutState.error}
                  </div>
                )}

                <div className="mt-6 space-y-7">
                  <section>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/42">
                      Start Here / Profile ID Validation
                    </div>
                    <div className="mt-4">
                      {renderProfileValidationForm({
                        gateType: 'devCode',
                        helperText: 'First validate your profile. Profile validation alone does not start the test.',
                        accent: 'purple'
                      })}
                    </div>
                  </section>

                  <section className="border-t border-white/10 pt-7">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/42">
                      Dev Code
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/56">
                      After your profile is validated, apply an approved Dev Code to unlock free Business Assessment access.
                    </p>
                    <form className="mt-4 space-y-3" onSubmit={validateBusinessAssessmentPromo}>
                      <input
                        value={promoCode}
                        onChange={(event) => {
                          setPromoCode(event.target.value);
                          setPromoState({ status: 'idle', message: '' });
                        }}
                        placeholder="Enter Dev Code"
                        className="w-full rounded-2xl border border-white/10 bg-black/[0.42] px-4 py-3.5 text-sm uppercase tracking-[0.08em] text-white caret-white outline-none placeholder:text-white/32 transition focus:border-purple-300/60"
                      />
                      <button
                        type="submit"
                        disabled={!devCodeProfileValidated || !promoCode.trim()}
                        className="w-full rounded-2xl border border-purple-300/35 bg-white/[0.06] px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-purple-100 transition hover:border-purple-200 hover:bg-purple-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Apply Dev Code
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
                    {devCodeAccepted && (
                      <button
                        type="button"
                        onClick={beginAssessment}
                        className="mt-4 w-full rounded-xl border border-emerald-300/40 px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-300/10"
                      >
                        Begin Business Assessment
                      </button>
                    )}
                  </section>

                  <section className="border-t border-white/10 pt-7">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/42">
                      Already completed a Business Assessment?
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/56">
                      Retrieve saved Business Assessment intelligence by Profile ID.
                    </p>
                    <form className="mt-4 space-y-3" onSubmit={retrieveAssessment}>
                      <input
                        value={retrieveId}
                        onChange={(event) => setRetrieveId(event.target.value)}
                        placeholder="Enter Profile ID or Assessment ID"
                        className="w-full rounded-2xl border border-white/10 bg-black/[0.42] px-4 py-3.5 text-sm uppercase tracking-[0.08em] text-white caret-white outline-none placeholder:text-white/32 transition focus:border-cyan-300/60"
                      />
                      <button
                        type="submit"
                        disabled={retrieveState.status === 'loading'}
                        className="w-full rounded-2xl border border-white/14 bg-white/[0.06] px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white/78 transition hover:border-cyan-300/60 hover:text-white disabled:cursor-wait disabled:opacity-45"
                      >
                        {retrieveState.status === 'loading' ? 'Retrieving...' : 'Retrieve'}
                      </button>
                    </form>

                    {retrieveState.status === 'found' && (
                      <div className="mt-4 rounded-2xl border border-cyan-300/30 bg-cyan-400/[0.08] p-4">
                        <p className="text-sm font-semibold text-cyan-100">Business Assessment Found</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {assessmentOutputComplete
                            ? showPremiumResults
                              ? 'Business Assessment report ready'
                              : premiumVmBuildFailed
                                ? 'Business Assessment found — report unavailable'
                                : 'Business Assessment intelligence complete'
                            : retrievedBriefing
                              ? 'Intelligence incomplete — generation still required'
                              : 'Business Assessment intake saved — intelligence not generated yet.'}
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
                            : showPremiumResults
                              ? 'Completed Business Assessment is shown below as the customer report.'
                              : 'This assessment intelligence is complete.'}
                        </p>

                        {retrievedNeedsGeneration && (
                          <button
                            type="button"
                            disabled={generationIsRunning}
                            onClick={generateRetrievedAssessment}
                            className="mt-4 w-full rounded-xl border border-cyan-200/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/10 disabled:cursor-wait disabled:opacity-55"
                          >
                            {generationIsRunning
                              ? generationState.phase || 'Generating...'
                              : 'Generate Business Assessment Intelligence'}
                          </button>
                        )}
                      </div>
                    )}

                    {retrieveState.status === 'not_found' && (
                      <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.04] p-4 text-sm text-white/68">
                        {BA_RETRIEVE_NOT_FOUND_MESSAGE}
                      </div>
                    )}

                    {retrieveState.status === 'error' && (
                      <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                        {retrieveState.error}
                      </div>
                    )}
                  </section>
                </div>
              </section>
            </div>
          </section>
        )}

        <main className={flowStarted ? "mx-auto mt-10 w-full max-w-4xl flex-1" : "hidden"}>
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange-300">
              Business Assessment
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Answer the real business questions.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/56">
              Stay specific. Your answers build the Executive Diagnostic, Five Futures, and One Move.
            </p>
          </div>

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
                        assessmentProfile?.id,
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
        </main>

        {showPremiumResults && (
          <div id="business-assessment-results" className="mx-auto w-full max-w-5xl">
            <PremiumPreviewHeader personName={premiumViewModel.person_name} />
            <PremiumCustomerBAReport
              viewModel={premiumViewModel}
              showLabDebug={false}
              monthlyIntelligenceCheckout={{
                checkoutState,
                onStartCheckout: () =>
                  startProductCheckout(
                    'more_monthly_intelligence',
                    'business_assessment_keep_your_map_alive'
                  ),
              }}
            />
          </div>
        )}

        {/*
          MMB21E: ExecutiveDiagnosticBriefing is intentionally not rendered as the default
          completed customer BA output. Source briefing remains in assessment output and is
          exposed through Technical Source / Advanced Source inside PremiumCustomerBAReport.
          showLegacyDiagnosticResults is reserved and kept false so legacy is never success-default.
        */}
        {showLegacyDiagnosticResults && retrievedBriefing ? (
          <div id="business-assessment-results-legacy" className="mx-auto w-full max-w-5xl">
            <ExecutiveDiagnosticBriefing briefing={retrievedBriefing} assessment={retrievedAssessment} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
