import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BusinessArtifactViewer, {
  BUSINESS_ARTIFACT_WIDTH,
} from './components/businessAssessment/BusinessArtifactViewer.jsx';
import BusinessEngineVisualV2, {
  BUSINESS_ENGINE_VISUAL_V2_HEIGHT,
  BUSINESS_ENGINE_VISUAL_V2_WIDTH,
} from './components/businessAssessment/BusinessEngineVisualV2.jsx';
import MakeYourMapAlivePanel from './components/businessAssessment/MakeYourMapAlivePanel.jsx';
import { normalizeBusinessVisualArtifactData } from './lib/businessAssessment/normalizeBusinessVisualArtifactData.js';
import { projectBusinessEngineVisualV2 } from './lib/businessEngine/projectBusinessEngineVisualV2.js';
import { loadBusinessAssessmentVisualRecord } from './lab/loadBusinessAssessmentVisualRecord.js';
import { startStripeCheckout } from './lib/stripeCheckout.js';
import {
  buildMonthlyIntelligenceCheckoutPayload,
  CTA_PAYMENT_SETUP_MESSAGE,
  CTA_PROFILE_REQUIRED_MESSAGE,
} from './lib/stripe/subscriptionConversionIngress.js';

const MAP_CANVAS_WIDTH = BUSINESS_ENGINE_VISUAL_V2_WIDTH || BUSINESS_ARTIFACT_WIDTH;
const MAP_CANVAS_HEIGHT = BUSINESS_ENGINE_VISUAL_V2_HEIGHT;

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
}

function resolveReturnTo(searchParams, profileId) {
  const requestedReturnTo = searchParams.get('returnTo') || '';
  if (requestedReturnTo.startsWith('/business-assessment')) return requestedReturnTo;
  const encodedProfileId = encodeURIComponent(profileId || '');
  return encodedProfileId
    ? `/business-assessment?id=${encodedProfileId}#business-assessment-results`
    : '/business-assessment';
}

function ArtifactShell({ children, title, profileId, returnTo }) {
  const navigate = useNavigate();

  function closeArtifact() {
    let storedReturnTo = '';
    try {
      storedReturnTo = window.sessionStorage.getItem('business_assessment_visual_return_url') || '';
      window.sessionStorage.removeItem('business_assessment_visual_return_url');
    } catch {
      storedReturnTo = '';
    }

    const hasAssessmentResultHistory =
      storedReturnTo === returnTo && Number(window.history.state?.idx || 0) > 0;

    if (hasAssessmentResultHistory) {
      navigate(-1);
      return;
    }

    navigate(returnTo || '/business-assessment', { replace: true });
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(249,115,22,0.18),transparent_31%),radial-gradient(circle_at_75%_15%,rgba(6,182,212,0.12),transparent_32%),radial-gradient(circle_at_50%_84%,rgba(168,85,247,0.13),transparent_34%),linear-gradient(180deg,#030303_0%,#09090b_56%,#000_100%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4">
        <nav className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={closeArtifact}
            className="text-left text-xs font-semibold uppercase tracking-[0.28em] text-orange-300 transition hover:text-orange-100"
          >
            Close / Business Assessment
          </button>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            {profileId || 'Profile ID'} / {title}
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}

function LoadingState({ profileId, returnTo }) {
  return (
    <ArtifactShell profileId={profileId} returnTo={returnTo} title="Business Engine Diagnostic">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-white/70">Loading...</div>
    </ArtifactShell>
  );
}

function ErrorState({ profileId, message, returnTo }) {
  return (
    <ArtifactShell profileId={profileId} returnTo={returnTo} title="Business Engine Diagnostic">
      <div className="rounded-3xl border border-red-400/30 bg-red-500/[0.08] p-8 text-red-100">
        {message}
      </div>
    </ArtifactShell>
  );
}

/**
 * BA Visual Map route — renders Business Engine Visual V2 from the canonical contract.
 * Legacy BusinessMapCanvas layout retired; projection remains via normalizeBusinessVisualArtifactData
 * → buildBusinessEngineContract → projectBusinessEngineVisualV2.
 *
 * Responsive doctrine:
 * - Engine canvas remains fixed 1672 design composition, fit-scaled.
 * - MAKE YOUR MAP ALIVE renders as unscaledFooter so tablet/mobile reflow natively.
 */
export default function BusinessAssessmentVisualMap() {
  const [searchParams] = useSearchParams();
  const profileId = searchParams.get('id') || '';
  const returnTo = resolveReturnTo(searchParams, profileId);
  const [state, setState] = useState({ status: 'loading', error: '', record: null });
  const [checkoutState, setCheckoutState] = useState({ loading: '', error: '' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!profileId) {
        setState({ status: 'error', error: 'Profile ID is required.', record: null });
        return;
      }
      const result = await loadBusinessAssessmentVisualRecord(profileId, buildApiUrl);
      if (cancelled) return;
      if (result.record) {
        setState({ status: 'ready', error: '', record: result.record });
        return;
      }
      setState({ status: 'error', error: result.error || 'Unable to load visual artifact.', record: null });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const data = useMemo(() => normalizeBusinessVisualArtifactData(state.record), [state.record]);

  const identityDefaults = useMemo(
    () => ({
      owner_name: data?.ownerName || null,
      owner_profile_type: data?.ownerProfileType || null,
      profile_id: data?.profileId || null,
      assessment_type: data?.assessmentType || null,
    }),
    [data]
  );

  // Single projection shared by engine canvas + conversion footer temporal meta.
  const viewModel = useMemo(() => {
    if (!data?.businessEngineContract) return null;
    return projectBusinessEngineVisualV2(data.businessEngineContract, {
      identity: identityDefaults,
    });
  }, [data, identityDefaults]);

  const temporalMeta = useMemo(() => {
    if (!viewModel) return null;
    return {
      last_updated: viewModel.temporal?.last_updated,
      snapshot_label: viewModel.structural?.snapshot_label || 'Assessment Snapshot',
      last_updated_label: viewModel.structural?.last_updated_label || 'Last Updated',
    };
  }, [viewModel]);

  async function startMapAliveCheckout() {
    const resolved = buildMonthlyIntelligenceCheckoutPayload({
      profileId: data?.profileId || profileId,
      assessmentId: data?.assessmentId || '',
    });

    if (!resolved.ok) {
      setCheckoutState({ loading: '', error: CTA_PROFILE_REQUIRED_MESSAGE });
      return;
    }

    setCheckoutState({ loading: resolved.payload.product_key, error: '' });
    try {
      // Canonical Stripe ingress — existing create-checkout-session product key.
      await startStripeCheckout(resolved.payload);
    } catch {
      setCheckoutState({ loading: '', error: CTA_PAYMENT_SETUP_MESSAGE });
    }
  }

  if (state.status === 'loading') return <LoadingState profileId={profileId} returnTo={returnTo} />;
  if (state.status === 'error') return <ErrorState profileId={profileId} returnTo={returnTo} message={state.error} />;

  if (!data.hasMap) {
    return (
      <ErrorState
        profileId={profileId}
        returnTo={returnTo}
        message="Business Assessment Map is not ready yet. Generate the diagnostic briefing first."
      />
    );
  }

  return (
    <ArtifactShell profileId={data.profileId} returnTo={returnTo} title="Business Engine Diagnostic">
      <BusinessArtifactViewer
        width={MAP_CANVAS_WIDTH}
        height={MAP_CANVAS_HEIGHT}
        unscaledFooter={
          <MakeYourMapAlivePanel
            checkoutState={checkoutState}
            onStartCheckout={startMapAliveCheckout}
            temporalMeta={temporalMeta}
          />
        }
      >
        <BusinessEngineVisualV2
          viewModel={viewModel}
          data={data}
          contract={data.businessEngineContract}
          includeConversionPanel={false}
        />
      </BusinessArtifactViewer>
    </ArtifactShell>
  );
}
