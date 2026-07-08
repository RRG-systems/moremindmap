import { BACard } from './BAReadableSection.jsx';

const CTA_CLASS =
  'mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold';

function ensureAbsoluteRoute(route) {
  if (!route) return '/';
  return route.startsWith('/') ? route : `/${route}`;
}

function buildVisualMapRoute(profileId, card) {
  const fromCard = card?.route || card?.safe_route_ref;
  if (fromCard) return ensureAbsoluteRoute(fromCard);
  return profileId
    ? `/business-assessment/visual-map?id=${encodeURIComponent(profileId)}`
    : '/business-assessment/visual-map';
}

function appendViewFullscreen(route) {
  if (!route || /[?&]view=(fullscreen|readable|fit)\b/i.test(route)) return route;
  return route.includes('?') ? `${route}&view=fullscreen` : `${route}?view=fullscreen`;
}

function buildPremiumRoute(profileId, card) {
  const fromCard = card?.route || card?.safe_route_ref;
  if (fromCard?.includes('renderer=premium')) {
    return appendViewFullscreen(ensureAbsoluteRoute(fromCard));
  }
  return profileId
    ? `/business-assessment/five-futures?id=${encodeURIComponent(profileId)}&renderer=premium&view=fullscreen`
    : '/business-assessment/five-futures?renderer=premium&view=fullscreen';
}

function VisualDnaCtaLink({ href, className, children }) {
  return (
    <a href={ensureAbsoluteRoute(href)} className={className}>
      {children}
    </a>
  );
}

const BA_MAP_EXPLANATION =
  'This map shows how the business is currently working: relationships, follow-up, systems, constraints, and the pattern behind the results.';

const FFOM_EXPLANATION =
  'This visual shows where the business is headed if nothing changes, which better futures are possible, and the One Move most likely to shift the path.';

function PremiumUnavailableState({ card, profileId, showLabDebug = false }) {
  const missing = card?.missing_premium_fields || [];
  const legacyRoute = profileId
    ? `/business-assessment/five-futures?id=${encodeURIComponent(profileId)}&renderer=legacy`
    : '/business-assessment/five-futures?renderer=legacy';

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="text-sm font-semibold text-amber-200">Five Futures + One Move unavailable</p>
      <p className="mt-2 text-sm text-white/70">
        This visual needs complete stored assessment data before it can open. The report does not show an older
        visual as if it were the current one.
      </p>
      {showLabDebug && missing.length ? (
        <ul className="mt-2 list-inside list-disc text-xs text-white/55">
          {missing.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      ) : null}
      {showLabDebug ? (
        <a href={ensureAbsoluteRoute(legacyRoute)} className="mt-3 inline-block text-xs text-white/45 underline-offset-2 hover:underline">
          Open legacy route for debugging only →
        </a>
      ) : null}
    </div>
  );
}

function VisualDnaLabStatus({ ffom, showLabDebug }) {
  if (!showLabDebug) return null;

  const missing = ffom?.missing_premium_fields || [];
  const premiumEligible = Boolean(ffom?.premium_eligible);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-white/55">
      <p className="font-semibold uppercase tracking-wider text-white/45">Lab visual status</p>
      <ul className="mt-2 space-y-1">
        <li>Premium eligible: {premiumEligible ? 'yes' : 'no'}</li>
        <li>Renderer: premium</li>
        <li>Missing fields: {missing.length ? missing.join(', ') : 'none'}</li>
        <li>Legacy fallback accepted: no</li>
      </ul>
    </div>
  );
}

export default function BAVisualDNATab({ vm, lang, showLabDebug = false }) {
  const profileId = vm.profile_id || '';
  const visualDna = vm.visual_dna || {};
  const baMap = visualDna.business_assessment_map;
  const ffom = visualDna.five_futures_one_move;
  const cards = vm.visual_dna_cards || [];
  const l = lang?.visual_dna;

  const baMapCard = baMap || cards.find((card) => card.id === 'ba_map');
  const ffomCard = ffom || cards.find((card) => card.id === 'five_futures_one_move');
  const premiumEligible = Boolean(ffom?.premium_eligible ?? ffomCard?.premium_eligible);
  const legacyUsedAsSuccess = ffom?.legacy_fallback_used_as_success ?? ffomCard?.legacy_fallback_used_as_success;
  const missingPremiumFields = ffom?.missing_premium_fields ?? ffomCard?.missing_premium_fields ?? [];
  const baMapStatus = baMapCard?.data_status || (baMapCard?.route ? 'available' : 'unavailable');
  const baMapAvailable = baMapStatus === 'available' || Boolean(baMapCard?.route || baMapCard?.safe_route_ref);

  const visualMapRoute = buildVisualMapRoute(profileId, baMapCard);
  const premiumRoute = buildPremiumRoute(profileId, ffomCard);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/70">
        {l?.intro ||
          'Visual maps help you see the same intelligence in this report. Read-only links — nothing new is generated here.'}
      </p>

      <VisualDnaLabStatus ffom={ffom || ffomCard} showLabDebug={showLabDebug} />

      <BACard title="Business Assessment Map" badge={baMapAvailable ? 'Business' : 'Unavailable'}>
        <p className="mt-2 text-sm text-white/75">
          {l?.business_assessment_map_plain || baMapCard?.purpose || baMapCard?.description || BA_MAP_EXPLANATION}
        </p>
        {baMapAvailable ? (
          <VisualDnaCtaLink
            href={visualMapRoute}
            className={`${CTA_CLASS} border-orange-400/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/15`}
          >
            Open Business Assessment Map
          </VisualDnaCtaLink>
        ) : (
          <p className="mt-4 text-sm text-white/55">Business Assessment Map is not available for this profile yet.</p>
        )}
      </BACard>

      <BACard title="Five Futures + One Move" badge={premiumEligible ? 'Future' : 'Unavailable'}>
        <p className="mt-2 text-sm text-white/75">
          {l?.five_futures_one_move_plain || ffomCard?.purpose || ffomCard?.description || FFOM_EXPLANATION}
        </p>

        {showLabDebug && l?.premium_status_plain ? (
          <p className="mt-2 text-xs text-white/50">{l.premium_status_plain}</p>
        ) : null}

        {showLabDebug && legacyUsedAsSuccess ? (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm font-semibold text-red-200">Legacy fallback detected — not treated as success</p>
            <p className="mt-2 text-sm text-white/70">
              Premium eligibility failed. Use the honest unavailable state below instead of accepting legacy output.
            </p>
          </div>
        ) : null}

        {premiumEligible ? (
          <VisualDnaCtaLink
            href={premiumRoute}
            className={`${CTA_CLASS} border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15`}
          >
            Open Five Futures + One Move
          </VisualDnaCtaLink>
        ) : (
          <PremiumUnavailableState card={ffomCard || ffom || {}} profileId={profileId} showLabDebug={showLabDebug} />
        )}
      </BACard>
    </div>
  );
}