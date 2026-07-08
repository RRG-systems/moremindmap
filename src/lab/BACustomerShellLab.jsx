import { Link, useSearchParams } from 'react-router-dom';
import PremiumCustomerBAReport from '../components/businessAssessment/PremiumCustomerBAReport.jsx';
import { buildCustomerBAViewModel } from '../lib/businessAssessment/buildCustomerBAViewModel.js';
import tammyFixtureV2 from './fixtures/tammyBaCustomerViewModelV2.json';

const vm = buildCustomerBAViewModel({
  ...tammyFixtureV2,
  meta: { ...tammyFixtureV2.meta, labOnly: true },
});

function isLabDebugMode(searchParams) {
  const preview = searchParams.get('preview');
  if (preview === 'debug') return true;
  if (preview === 'live') return false;
  if (searchParams.get('debug') === 'true') return true;
  return false;
}

function LivePreviewHeader({ personName }) {
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

function LabDebugHeader({ personName, profileId, assessmentId, status }) {
  return (
    <header className="mb-8 border-b border-white/10 pb-6">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-orange-300/70">
        MMB21A Lab · Production-Safe BA Shell Review
      </p>
      <h1 className="mt-2 text-2xl font-bold text-white">Premium Customer BA Shell</h1>
      <p className="mt-2 text-sm text-white/55">
        {personName} · {profileId} · {assessmentId}
      </p>
      <p className="mt-1 text-xs text-white/40">Internal lab route · not production /business-assessment</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <Link to="/visual-lab" className="text-orange-300/80 underline-offset-2 hover:underline">
          ← Visual Lab
        </Link>
        <span className="text-white/35">Status: {status}</span>
        <span className="text-white/35">Components: production-safe</span>
      </div>
    </header>
  );
}

export default function BACustomerShellLab() {
  const [searchParams] = useSearchParams();
  const showLabDebug = isLabDebugMode(searchParams);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        {!showLabDebug ? (
          <Link
            to="/visual-lab"
            className="mb-6 inline-block text-xs text-white/35 underline-offset-2 transition-colors hover:text-white/55 hover:underline"
          >
            ← Back
          </Link>
        ) : null}

        {showLabDebug ? (
          <LabDebugHeader
            personName={vm.person_name}
            profileId={vm.profile_id}
            assessmentId={vm.assessment_id}
            status={vm.status}
          />
        ) : (
          <LivePreviewHeader personName={vm.person_name} />
        )}

        <PremiumCustomerBAReport viewModel={vm} showLabDebug={showLabDebug} />

        {showLabDebug ? (
          <footer className="mt-10 border-t border-white/8 pt-6 text-xs text-white/40">
            <p>
              Lab-only · Customer language ~25/100 technical · No Universal Translator · No Redis writes · No
              canonical mutation · Production-safe components from src/components/businessAssessment and
              src/lib/businessAssessment
            </p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}