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
import { enterCanonicalNewBaAfterIntake } from './lib/businessAssessment/canonicalNewBaSubmission.js';
import {
  ORDINARY_CUSTOMER_ENTRY_UNAVAILABLE_MESSAGE,
  normalizeOrdinaryCustomerProfileId,
  resolveOrdinaryBaEntry,
} from './lib/customerEntry/ordinaryCustomerEntryRouting.js';
import { createCheckoutIdempotencyKey, startStripeCheckout } from './lib/stripeCheckout.js';
import {
  BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE,
  BA_VERTICAL_CUSTOMER_SAFE_UNAVAILABLE_MESSAGE,
  PRODUCTION_BA_CASSETTE_REGISTRY,
  REAL_ESTATE_INTAKE_QUESTIONS,
  buildCustomerConfirmedSelection,
  suggestVerticalFromIndustry,
} from './lib/baVerticalCassettesV1/index.js';
import { renewStoredPublicStartToken } from './lib/publicProductStartSession.js';
import {
  openRecruitingBoundBa,
  resolveRecruitingBaLanding,
} from './lib/recruitingV1/continuation.js';

const QUESTIONS = REAL_ESTATE_INTAKE_QUESTIONS;
const SUPPORTED_VERTICALS = PRODUCTION_BA_CASSETTE_REGISTRY.listSupported();

const INITIAL_ANSWERS = QUESTIONS.reduce((acc, question) => {
  acc[question.key] = '';
  return acc;
}, {});

const INITIAL_QUESTION_STATES = QUESTIONS.reduce((acc, question) => {
  acc[question.key] = 'UNANSWERED';
  return acc;
}, {});

// Complimentary authority is server-owned by publicSiteAirlockV1. No active
// capability value or digest may be shipped in this client bundle.
const BUSINESS_ASSESSMENT_PROMO_CODES = new Set();

function publicStartToken() {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem('more.public.start_token.v1') || '';
}

function publicStartHeaders(headers = {}) {
  const token = publicStartToken();
  return token ? { ...headers, 'X-MORE-Start-Token': token } : headers;
}

function createProfileGateState() {
  return {
    input: '',
    status: 'idle',
    profile: null,
    error: '',
    verticalSelection: createVerticalSelectionState(),
    businessAssessmentStatus: 'idle',
    businessAssessmentId: ''
  };
}

function createMonthlyProfileGateState() {
  return {
    input: '',
    status: 'idle',
    profile: null,
    error: '',
    verticalSelection: createVerticalSelectionState(),
    businessAssessmentStatus: 'idle',
    businessAssessmentId: ''
  };
}

function createVerticalSelectionState() {
  return {
    selectedVerticalId: '',
    confirmedSelection: null,
    suggestionStatus: 'NONE',
    suggestionLabel: '',
    message: BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE,
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

function buildApiUrl(path, forceSameOrigin = false) {
  if (forceSameOrigin) return path;
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

  const organization =
    canonical?.metadata?.organization ||
    canonical?.profile_metadata?.organization ||
    canonical?.organization ||
    dossier?.metadata?.organization ||
    {};
  const industry =
    organization?.industry ||
    canonical?.industry ||
    canonical?.business_industry ||
    '';

  return {
    id: canonical?.profile_id || payload?.profile_id || profileId,
    name,
    profileType: deriveProfileType(canonical),
    industry: typeof industry === 'string' ? industry.trim() : '',
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

export default function BusinessAssessment() {
  const checkoutIdempotencyKeys = useMemo(() => Object.freeze({
    business_assessment: createCheckoutIdempotencyKey('ba-checkout'),
    more_monthly_intelligence: createCheckoutIdempotencyKey('subscription-checkout'),
  }), []);
  const [searchParams] = useSearchParams();
  const recruitingMode = searchParams.get('recruiting') === '1';
  const [publicStartStatus, setPublicStartStatus] = useState(() => (
    !recruitingMode && publicStartToken() ? 'checking' : 'idle'
  ));
  const [promoCode, setPromoCode] = useState('');
  const [promoState, setPromoState] = useState({ status: 'idle', message: '' });
  const [retrieveId, setRetrieveId] = useState('');
  const [checkoutProfileGate, setCheckoutProfileGate] = useState(createProfileGateState);
  const [monthlyProfileGate, setMonthlyProfileGate] = useState(createMonthlyProfileGateState);
  const [devCodeProfileGate, setDevCodeProfileGate] = useState(createProfileGateState);
  const [recruitingProfileGate, setRecruitingProfileGate] = useState(createProfileGateState);
  const [recruitingLandingState, setRecruitingLandingState] = useState({
    status: recruitingMode ? 'loading' : 'idle',
    progressState: '',
    error: '',
  });
  const [assessmentProfile, setAssessmentProfile] = useState(null);
  const [flowStarted, setFlowStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [questionStates, setQuestionStates] = useState(INITIAL_QUESTION_STATES);
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
  const canSubmit = Boolean(normalizeOrdinaryCustomerProfileId(assessmentProfile?.id))
    && Boolean(assessmentProfile?.verticalSelection);
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

  function verticalStateForProfile(profile) {
    const suggestion = suggestVerticalFromIndustry(profile?.industry);
    if (suggestion.status === 'SUPPORTED_SUGGESTION') {
      return {
        ...createVerticalSelectionState(),
        selectedVerticalId: suggestion.vertical_id,
        suggestionStatus: suggestion.status,
        suggestionLabel: suggestion.label,
        message: `${suggestion.label} was suggested from your Profile. Confirm it before continuing.`,
      };
    }
    if (suggestion.status === 'UNSUPPORTED_SUGGESTION') {
      return {
        ...createVerticalSelectionState(),
        suggestionStatus: suggestion.status,
        suggestionLabel: suggestion.label,
        message: BA_VERTICAL_CUSTOMER_SAFE_UNAVAILABLE_MESSAGE,
      };
    }
    return createVerticalSelectionState();
  }

  useEffect(() => {
    if (!recruitingMode) return;
    const controller = new AbortController();
    let cancelled = false;
    setRecruitingProfileGate((current) => ({ ...current, status: 'validating', error: '' }));
    setRecruitingLandingState({ status: 'loading', progressState: '', error: '' });

    async function enterRecruitingBusinessAssessment() {
      try {
        const response = await fetch('/api/recruiting/runtime?view=invite_session', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok !== true || !payload?.continuation) {
          throw new Error('RECRUITING_BA_CONTINUATION_UNAVAILABLE');
        }

        const landing = resolveRecruitingBaLanding(payload.continuation);
        if (cancelled) return;
        setRecruitingProfileGate({
          ...createProfileGateState(),
          status: 'valid',
          profile: {
            id: landing.profile_id,
            name: 'Invited recruit',
            profileType: 'Verified MORE Profile',
            industry: '',
          },
        });

        if (landing.mode === 'BEGIN_NEW_BA') {
          setRecruitingLandingState({
            status: 'ready_to_begin',
            progressState: landing.progress_state,
            error: '',
          });
          return;
        }

        setRecruitingLandingState({
          status: 'opening_bound',
          progressState: landing.progress_state,
          error: '',
        });
        const opened = await openRecruitingBoundBa({
          continuation: payload.continuation,
          retrieveBoundAssessment: async (assessmentId) => {
            const retrieved = await retrieveBusinessAssessment(
              assessmentId,
              (path) => buildApiUrl(path, true),
              {
                credentials: 'same-origin',
                cache: 'no-store',
                signal: controller.signal,
              },
            );
            return retrieved.payload;
          },
          resolveCurrentBa: (profileId) => resolveOrdinaryBaEntry(
            profileId,
            (url, options) => fetch(url, { ...options, signal: controller.signal }),
          ),
          navigate: (destination) => {
            if (!cancelled) window.location.assign(destination);
          },
        });
        if (cancelled || opened.status === 'OPENING_CURRENT_BA') return;
        setRetrieveId(opened.landing.assessment_id);
        setRetrieveState({ status: 'found', error: '', result: opened.payload });
        setRecruitingLandingState({
          status: 'recovered_bound',
          progressState: opened.landing.progress_state,
          error: '',
        });
      } catch (error) {
        if (cancelled || error?.name === 'AbortError') return;
        const recoveredPayload = error?.recovered_payload;
        if (recoveredPayload?.assessment && error?.landing) {
          setRetrieveId(error.landing.assessment_id);
          setRetrieveState({ status: 'found', error: '', result: recoveredPayload });
        }
        const requiresBos = error?.message === 'RECRUITING_BA_PROFILE_BINDING_REQUIRED';
        const message = requiresBos
          ? 'Complete your invited MORE Profile before beginning the optional Business Assessment.'
          : 'We could not open the saved Business Assessment right now. Nothing was replaced; return to your private continuation and try again.';
        setRecruitingProfileGate((current) => ({ ...current, status: 'error', error: message }));
        setRecruitingLandingState({
          status: recoveredPayload?.assessment ? 'bound_unavailable' : 'error',
          progressState: error?.landing?.progress_state || '',
          error: message,
        });
      }
    }

    void enterRecruitingBusinessAssessment();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [recruitingMode]);

  useEffect(() => {
    if (recruitingMode) return;
    const token = publicStartToken();
    if (!token) {
      setPublicStartStatus('idle');
      return;
    }
    let cancelled = false;

    async function enterPublicBusinessAssessment() {
      setPublicStartStatus('checking');
      try {
        const refreshed = await renewStoredPublicStartToken().catch(() => token);
        const response = await fetch(buildApiUrl('/api/public-v1/product-start', true), {
          method: 'POST',
          headers: publicStartHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'same-origin',
          body: JSON.stringify({ start_token: refreshed }),
        });
        const payload = await response.json().catch(() => null);
        const profileId = normalizeOrdinaryCustomerProfileId(payload?.profile_id);
        if (!response.ok
          || payload?.ok !== true
          || payload?.product_key !== 'business_assessment'
          || !profileId
          || !payload?.vertical_binding?.binding_sha256) {
          throw new Error('public_business_assessment_start_unavailable');
        }
        const registration = PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical(
          payload.vertical_binding.vertical_id,
        );
        if (registration.cassette_id !== payload.vertical_binding.cassette_id
          || registration.cassette_version !== payload.vertical_binding.cassette_version) {
          throw new Error('public_business_assessment_vertical_binding_mismatch');
        }
        const verticalSelection = buildCustomerConfirmedSelection(registration);
        if (cancelled) return;
        setAssessmentProfile({
          id: profileId,
          name: 'Verified MORE Profile',
          profileType: 'Verified MORE Profile',
          industry: '',
          verticalSelection,
        });
        setFlowStarted(true);
        setCurrentQuestionIndex(0);
        setAnswers({ ...INITIAL_ANSWERS });
        setQuestionStates({ ...INITIAL_QUESTION_STATES });
        setSubmitState({ status: 'idle', error: '', result: null });
        setPublicStartStatus('ready');
      } catch {
        if (!cancelled) setPublicStartStatus('unavailable');
      }
    }

    void enterPublicBusinessAssessment();
    return () => {
      cancelled = true;
    };
  }, [recruitingMode]);

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
        verticalSelection: createVerticalSelectionState(),
        businessAssessmentStatus: 'idle',
        businessAssessmentId: '',
      });
      return;
    }

    setProfileGateState(gateType, {
      status: 'validating',
      profile: null,
      error: '',
      verticalSelection: createVerticalSelectionState(),
      businessAssessmentStatus: 'idle',
      businessAssessmentId: '',
    });

    try {
      const url = buildApiUrl(
        `/api/moremindmap/retrieve-profile?id=${encodeURIComponent(normalizedGateProfileId)}&nocache=1`
      );
      const response = await fetch(url, { headers: publicStartHeaders(), cache: 'no-store' });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.canonical_dossier) {
        setProfileGateState(gateType, {
          status: 'error',
          profile: null,
          error:
            gateType === 'monthly'
              ? 'Profile not found. First complete your Behavior Operating System profile, then take the Business Assessment.'
              : 'First you must complete your Behavior Operating System profile to unlock this action.',
          verticalSelection: createVerticalSelectionState(),
          businessAssessmentStatus: 'idle',
          businessAssessmentId: '',
        });
        return;
      }

      const profile = extractProfileResult(payload, normalizedGateProfileId);
      const verticalSelection = verticalStateForProfile(profile);

      if (gateType === 'monthly') {
        setMonthlyProfileGate((current) => ({
          ...current,
          status: 'valid',
          profile,
          error: '',
          verticalSelection,
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
        error: '',
        verticalSelection,
        businessAssessmentStatus: 'checking',
        businessAssessmentId: '',
      });
      const completion = await getBusinessAssessmentCompletion(profile.id || normalizedGateProfileId);
      setProfileGateState(gateType, {
        businessAssessmentStatus: completion.status,
        businessAssessmentId: completion.assessmentId,
      });
    } catch {
      setProfileGateState(gateType, {
        status: 'error',
        profile: null,
        error: 'Profile validation is not available right now. Please try again shortly.',
        verticalSelection: createVerticalSelectionState(),
        businessAssessmentStatus: 'idle',
        businessAssessmentId: '',
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
    if (!devCodeProfileGate.verticalSelection?.confirmedSelection) {
      setPromoState({ status: 'error', message: BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE });
      return;
    }
    if (devCodeProfileGate.businessAssessmentStatus === 'found') {
      retrieveAssessment(null, devCodeProfileGate.profile.id);
      return;
    }
    setAssessmentProfile({
      ...devCodeProfileGate.profile,
      verticalSelection: devCodeProfileGate.verticalSelection.confirmedSelection,
    });
    setFlowStarted(true);
    setCurrentQuestionIndex(0);
    setAnswers({ ...INITIAL_ANSWERS });
    setQuestionStates({ ...INITIAL_QUESTION_STATES });
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

    if (productKey === 'business_assessment'
      && !checkoutProfileGate.verticalSelection?.confirmedSelection) {
      setCheckoutState({ loading: '', error: BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE });
      return;
    }

    if (productKey === 'business_assessment'
      && checkoutProfileGate.businessAssessmentStatus === 'found') {
      retrieveAssessment(null, checkoutProfileGate.profile.id);
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
        source_context: sourceContext,
        ...(productKey === 'business_assessment'
          ? { vertical_selection: checkoutProfileGate.verticalSelection.confirmedSelection }
          : {}),
      }, { idempotencyKey: checkoutIdempotencyKeys[productKey] });
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

    if (gateType === 'recruiting') {
      setRecruitingProfileGate((current) => ({ ...current, ...patch }));
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
        verticalSelection: createVerticalSelectionState(),
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
        error: '',
        verticalSelection: createVerticalSelectionState(),
        businessAssessmentStatus: 'idle',
        businessAssessmentId: '',
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
      error: '',
      verticalSelection: createVerticalSelectionState(),
      businessAssessmentStatus: 'idle',
      businessAssessmentId: '',
    }));
  }

  function gateStateForType(gateType) {
    if (gateType === 'devCode') return devCodeProfileGate;
    if (gateType === 'recruiting') return recruitingProfileGate;
    return checkoutProfileGate;
  }

  function updateVerticalSelection(gateType, verticalId) {
    const gate = gateStateForType(gateType);
    setProfileGateState(gateType, {
      verticalSelection: {
        ...gate.verticalSelection,
        selectedVerticalId: verticalId,
        confirmedSelection: null,
        message: BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE,
      },
    });
  }

  function confirmVerticalSelection(gateType) {
    const gate = gateStateForType(gateType);
    try {
      const registration = PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical(
        gate.verticalSelection?.selectedVerticalId,
      );
      setProfileGateState(gateType, {
        verticalSelection: {
          ...gate.verticalSelection,
          confirmedSelection: buildCustomerConfirmedSelection(registration),
          message: `${registration.vertical_label} confirmed. You can continue.`,
        },
      });
    } catch {
      setProfileGateState(gateType, {
        verticalSelection: {
          ...gate.verticalSelection,
          confirmedSelection: null,
          message: BA_VERTICAL_CUSTOMER_SAFE_UNAVAILABLE_MESSAGE,
        },
      });
    }
  }

  function beginRecruitingAssessment() {
    const confirmedSelection = recruitingProfileGate.verticalSelection?.confirmedSelection;
    if (!recruitingProfileGate.profile?.id || !confirmedSelection) {
      setSubmitState({
        status: 'error',
        error: BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE,
        result: null,
      });
      return;
    }
    setAssessmentProfile({
      ...recruitingProfileGate.profile,
      verticalSelection: confirmedSelection,
    });
    setFlowStarted(true);
    setCurrentQuestionIndex(0);
    setAnswers({ ...INITIAL_ANSWERS });
    setQuestionStates({ ...INITIAL_QUESTION_STATES });
    setSubmitState({ status: 'idle', error: '', result: null });
  }

  function updateAnswer(value) {
    const key = currentQuestion.key;
    setAnswers((current) => ({
      ...current,
      [key]: value
    }));
    setQuestionStates((current) => ({
      ...current,
      [key]: value.trim() ? 'ANSWERED' : current[key] === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'UNANSWERED',
    }));
  }

  function toggleNotApplicable() {
    const key = currentQuestion.key;
    const nextState = questionStates[key] === 'NOT_APPLICABLE' ? 'UNANSWERED' : 'NOT_APPLICABLE';
    setQuestionStates((current) => ({ ...current, [key]: nextState }));
    if (nextState === 'NOT_APPLICABLE') {
      setAnswers((current) => ({ ...current, [key]: '' }));
    }
  }

  function getMissingGenerationSteps(assessment) {
    return GENERATION_STEPS.filter((step) => !step.isComplete(assessment));
  }

  async function postGenerationStep(step, assessmentId) {
    const response = await fetch(buildApiUrl(step.endpoint, recruitingMode), {
      method: 'POST',
      headers: publicStartHeaders({ 'Content-Type': 'application/json' }),
      credentials: recruitingMode ? 'same-origin' : 'omit',
      body: JSON.stringify({ assessment_id: assessmentId })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || payload?.detail || `Unable to complete ${step.label}`);
    }

    return payload;
  }

  async function retrieveAssessmentByProfileId(ownerProfileId) {
    const { payload } = await retrieveBusinessAssessment(
      ownerProfileId,
      (path) => buildApiUrl(path, recruitingMode),
      { headers: publicStartHeaders(), credentials: 'same-origin' },
    );
    return payload;
  }

  async function getBusinessAssessmentCompletion(ownerProfileId) {
    const id = String(ownerProfileId || '').trim();
    if (!id) return { status: 'not_found', assessmentId: '' };

    try {
      const canonical = await resolveOrdinaryBaEntry(id);
      if (canonical.status === 'current') {
        return { status: 'found', assessmentId: '' };
      }
      if (canonical.status !== 'governed_fallback') {
        return { status: 'not_found', assessmentId: '' };
      }
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
      if (!recruitingMode && publicStartToken()) await renewStoredPublicStartToken();
      const response = await fetch(buildApiUrl('/api/business-assessment/start', recruitingMode), {
        method: 'POST',
        headers: publicStartHeaders({ 'Content-Type': 'application/json' }),
        credentials: recruitingMode ? 'same-origin' : 'omit',
        body: JSON.stringify({
          owner_profile_id: assessmentProfile.id,
          vertical_selection: assessmentProfile.verticalSelection,
          answers,
          question_states: questionStates,
          recruiting_mode: recruitingMode ? 'accepted_invitation' : undefined,
        })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Unable to save assessment intake.');
      }

      savedPayload = payload;
      const ownerProfileId =
        payload.profile_context?.owner_profile_id || assessmentProfile.id;
      setSubmitState({ status: 'routing', error: '', result: payload });
      await enterCanonicalNewBaAfterIntake({ profileId: ownerProfileId });
    } catch (error) {
      setSubmitState({
        status: savedPayload ? 'generation_error' : 'error',
        error:
          savedPayload
            ? 'Your intake was saved, but your governed Business Twin could not be opened yet. You can retry without resubmitting your answers.'
            : error.message || 'Unable to save assessment intake.',
        result: savedPayload
      });
    }
  }

  async function retryCanonicalGeneration() {
    const ownerProfileId =
      submitState.result?.profile_context?.owner_profile_id || assessmentProfile?.id;
    setSubmitState((current) => ({ ...current, status: 'routing', error: '' }));
    try {
      await enterCanonicalNewBaAfterIntake({ profileId: ownerProfileId });
    } catch {
      setSubmitState((current) => ({
        ...current,
        status: 'generation_error',
        error: 'Your governed Business Twin could not be opened yet. Your saved answers remain unchanged.',
      }));
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
      const routeProfile = normalizeOrdinaryCustomerProfileId(id);
      if (routeProfile) {
        const currentBa = await resolveOrdinaryBaEntry(routeProfile);
        if (currentBa.status === 'current') {
          window.location.assign(currentBa.destination);
          return;
        }
        if (currentBa.status !== 'governed_fallback') {
          setRetrieveState({
            status: 'error',
            error: ORDINARY_CUSTOMER_ENTRY_UNAVAILABLE_MESSAGE,
            result: null,
          });
          return;
        }
      }

      const { payload } = await retrieveBusinessAssessment(id, buildApiUrl, {
        headers: publicStartHeaders(),
      });

      if (!routeProfile) {
        const ownerProfileId =
          payload?.owner_profile_id || payload?.assessment?.owner_profile_id || '';
        const normalizedOwnerProfileId = normalizeOrdinaryCustomerProfileId(ownerProfileId);
        if (normalizedOwnerProfileId) {
          const currentBa = await resolveOrdinaryBaEntry(normalizedOwnerProfileId);
          if (currentBa.status === 'current') {
            window.location.assign(currentBa.destination);
            return;
          }
          if (currentBa.status !== 'governed_fallback') {
            setRetrieveState({
              status: 'error',
              error: ORDINARY_CUSTOMER_ENTRY_UNAVAILABLE_MESSAGE,
              result: null,
            });
            return;
          }
        }
      }

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
    // Route bootstrap intentionally fires once per route/status transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function renderVerticalSelectionGate(gateType, gate) {
    if (gateType === 'monthly') return null;
    if (gate.businessAssessmentStatus === 'checking') {
      return <p className="mt-3 text-sm text-white/58">Checking for an existing Business Twin...</p>;
    }
    if (gate.businessAssessmentStatus === 'found') {
      return (
        <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/[0.08] p-3">
          <p className="text-sm text-cyan-50">
            Your completed Business Assessment is already compatible. You do not need to select a vertical or begin again.
          </p>
          <button
            type="button"
            onClick={() => retrieveAssessment(null, gate.profile.id)}
            className="mt-3 w-full rounded-xl border border-cyan-200/40 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-cyan-50"
            data-testid={`${gateType}-open-existing-business-twin`}
          >
            Open Your Business Twin
          </button>
        </div>
      );
    }
    return (
      <div className="mt-4 border-t border-white/10 pt-4" data-testid={`${gateType}-vertical-gate`}>
        <label
          htmlFor={`${gateType}-vertical-selection`}
          className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72"
        >
          Confirm your business type
        </label>
        <select
          id={`${gateType}-vertical-selection`}
          value={gate.verticalSelection?.selectedVerticalId || ''}
          onChange={(event) => updateVerticalSelection(gateType, event.target.value)}
          className="mt-3 w-full rounded-xl border border-white/14 bg-black/70 px-3 py-3 text-sm text-white outline-none focus:border-orange-300"
          aria-describedby={`${gateType}-vertical-message`}
        >
          <option value="">Select a supported business type</option>
          {SUPPORTED_VERTICALS.map((registration) => (
            <option key={registration.vertical_id} value={registration.vertical_id}>
              {registration.vertical_label}
            </option>
          ))}
        </select>
        {gate.verticalSelection?.suggestionStatus === 'SUPPORTED_SUGGESTION'
          && !gate.verticalSelection?.confirmedSelection && (
          <p className="mt-2 text-xs leading-5 text-white/52">
            Suggested from your Profile: {gate.verticalSelection.suggestionLabel}. A suggestion is not confirmation.
          </p>
        )}
        {gate.verticalSelection?.suggestionStatus === 'UNSUPPORTED_SUGGESTION' && (
          <p className="mt-2 text-xs leading-5 text-orange-100">
            Your Profile lists {gate.verticalSelection.suggestionLabel}. That business type is not yet supported.
          </p>
        )}
        <button
          type="button"
          disabled={!gate.verticalSelection?.selectedVerticalId || Boolean(gate.verticalSelection?.confirmedSelection)}
          onClick={() => confirmVerticalSelection(gateType)}
          className="mt-3 w-full rounded-xl border border-emerald-300/35 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid={`${gateType}-confirm-vertical`}
        >
          {gate.verticalSelection?.confirmedSelection ? 'Business Type Confirmed' : 'Confirm Business Type'}
        </button>
        <p
          id={`${gateType}-vertical-message`}
          className={`mt-2 text-xs leading-5 ${gate.verticalSelection?.confirmedSelection ? 'text-emerald-100' : 'text-white/52'}`}
          aria-live="polite"
        >
          {gate.verticalSelection?.message}
        </p>
      </div>
    );
  }

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
            {renderVerticalSelectionGate(gateType, gate)}
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

        {!flowStarted && !previewPremium && recruitingMode && (
          <section className="mx-auto w-full max-w-xl">
            <div className="rounded-[2rem] border border-orange-300/25 bg-[#101114] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.4)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
                Optional Business Assessment
              </p>
              {['loading', 'opening_bound'].includes(recruitingLandingState.status) && (
                <>
                  <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                    {recruitingLandingState.status === 'opening_bound'
                      ? recruitingLandingState.progressState === 'BOTH_COMPLETE'
                        ? 'Opening your completed Business Assessment…'
                        : 'Returning to your saved Business Assessment…'
                      : 'Checking your private progress…'}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-white/62" role="status">
                    The accepted invitation is verifying the exact saved Assessment and MORE Profile before anything opens.
                  </p>
                </>
              )}

              {['recovered_bound', 'bound_unavailable'].includes(recruitingLandingState.status) && retrieveState.result?.assessment && (
                <>
                  <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                    {retrievedNeedsGeneration
                      ? 'Your saved Business Assessment is ready to continue.'
                      : 'Your completed Business Assessment is open below.'}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    This is the same Assessment and MORE Profile held by your accepted invitation. A new intake was not started.
                  </p>
                  <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] p-4">
                    <p className="text-sm font-semibold text-emerald-100">Saved Assessment verified.</p>
                    <p className="mt-2 text-xs text-white/58">
                      Assessment ID: <span className="font-mono text-white/78">{retrieveState.result.assessment.assessment_id}</span>
                    </p>
                    {retrievedNeedsGeneration && recruitingLandingState.status === 'recovered_bound' && (
                      <button
                        type="button"
                        disabled={generationIsRunning}
                        onClick={generateRetrievedAssessment}
                        className="mt-4 w-full rounded-xl border border-emerald-200/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-emerald-50 transition hover:border-emerald-100 hover:bg-emerald-300/10 disabled:cursor-wait disabled:opacity-55"
                        data-testid="recruiting-resume-bound-business-assessment"
                      >
                        {generationIsRunning
                          ? generationState.phase || 'Continuing...'
                          : 'Continue the saved Business Assessment'}
                      </button>
                    )}
                  </div>
                  {recruitingLandingState.error && (
                    <p className="mt-4 text-sm leading-6 text-orange-100" role="alert">
                      {recruitingLandingState.error}
                    </p>
                  )}
                </>
              )}

              {recruitingLandingState.status === 'error' && (
                <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                  {recruitingLandingState.error || recruitingProfileGate.error}
                </div>
              )}

              {recruitingLandingState.status === 'ready_to_begin' && (
                <>
                  <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                    Confirm your business type before beginning.
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    Your invitation identifies the correct MORE Profile. Business type remains a separate customer-confirmed choice.
                  </p>
                </>
              )}
              {recruitingLandingState.status === 'ready_to_begin' && recruitingProfileGate.profile && (
                <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] p-4">
                  <p className="text-sm font-semibold text-emerald-100">Invitation and MORE Profile validated.</p>
                  {renderVerticalSelectionGate('recruiting', recruitingProfileGate)}
                </div>
              )}
              {recruitingLandingState.status === 'ready_to_begin' && recruitingProfileGate.profile && (
                <button
                  type="button"
                  disabled={!recruitingProfileGate.verticalSelection?.confirmedSelection}
                  onClick={beginRecruitingAssessment}
                  className="mt-6 w-full rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid="recruiting-begin-business-assessment"
                >
                  Begin Business Assessment
                </button>
              )}
            </div>
          </section>
        )}

        {!flowStarted && !previewPremium && !recruitingMode && publicStartStatus === 'checking' && (
          <section className="mx-auto w-full max-w-xl">
            <div className="rounded-[2rem] border border-white/12 bg-[#101114] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
                Business Assessment Access
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                Preparing your assessment...
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/62">
                We are verifying the Profile and business type bound to this access.
              </p>
            </div>
          </section>
        )}

        {!flowStarted && !previewPremium && !recruitingMode && publicStartStatus !== 'checking' && (
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
                    disabled={
                      !checkoutProfileValidated ||
                      !checkoutProfileGate.verticalSelection?.confirmedSelection ||
                      checkoutProfileGate.businessAssessmentStatus === 'found' ||
                      checkoutState.loading === 'business_assessment'
                    }
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
                      <span className="text-5xl font-semibold tracking-tight text-white">$38.95</span>
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
                    {devCodeAccepted && devCodeProfileGate.businessAssessmentStatus !== 'found' && (
                      <button
                        type="button"
                        onClick={beginAssessment}
                        disabled={
                          !devCodeProfileGate.verticalSelection?.confirmedSelection ||
                          devCodeProfileGate.businessAssessmentStatus === 'checking'
                        }
                        className="mt-4 w-full rounded-xl border border-emerald-300/40 px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-emerald-100 transition hover:border-emerald-200 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40"
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
              Stay specific where you can. Your governed evidence builds your Whole Business Model,
              Five Futures, One Move, Plan, and Evidence experience.
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
              disabled={questionStates[currentQuestion.key] === 'NOT_APPLICABLE'}
              rows={currentQuestion.rows}
              placeholder={questionStates[currentQuestion.key] === 'NOT_APPLICABLE' ? 'Marked not applicable.' : 'Write the real answer here, or leave it blank if you do not know yet.'}
              className="mt-5 w-full resize-y rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-base leading-7 text-white outline-none placeholder:text-white/30 focus:border-orange-300"
            />
            <button
              type="button"
              aria-pressed={questionStates[currentQuestion.key] === 'NOT_APPLICABLE'}
              onClick={toggleNotApplicable}
              className="mt-3 rounded-lg border border-white/14 px-3 py-2 text-xs font-semibold text-white/62 transition hover:border-white/30 hover:text-white"
            >
              {questionStates[currentQuestion.key] === 'NOT_APPLICABLE' ? 'Marked not applicable — undo' : 'This question is not applicable'}
            </button>
            <p className="mt-3 text-sm leading-6 text-white/46">
              Unanswered or not-applicable items remain visible as missing evidence. They do not invalidate your assessment.
            </p>

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
                  disabled={!canSubmit || submitState.status === 'saving' || submitState.status === 'routing' || generationIsRunning}
                  onClick={submitAssessment}
                  className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {submitState.status === 'saving'
                    ? 'Saving...'
                    : submitState.status === 'routing' || generationIsRunning
                      ? 'Opening Business Twin...'
                      : 'Submit Assessment'}
                </button>
              )}
            </div>

            {!canSubmit && currentQuestionIndex === QUESTIONS.length - 1 && (
              <p className="mt-4 text-sm text-white/46">
                A validated Profile identity and supported Business Assessment route are required. Business-evidence answers may remain missing.
              </p>
            )}

            {(submitState.status === 'routing' || generationIsRunning) && (
              <div className="mt-5 rounded-2xl border border-orange-300/35 bg-orange-400/[0.08] p-4">
                <p className="text-sm font-semibold text-orange-100">
                  {generationIsRunning ? generationState.phase : 'Opening your governed Business Twin...'}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/66">
                  Your intake has been saved. New BA is reading your governed evidence, compatible New BOS,
                  Whole Business Model, Five Futures, and One Move through the canonical path.
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
                  disabled={submitState.status === 'routing'}
                  onClick={retryCanonicalGeneration}
                  className="mt-4 rounded-xl border border-red-200/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-red-50 transition hover:border-red-100 hover:bg-red-300/10 disabled:cursor-wait disabled:opacity-55"
                >
                  Retry New BA
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
