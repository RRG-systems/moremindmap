import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BA_SHELL_TABS, customerLanguageSections } from './buildCustomerBAViewModel.js';

const BADGE_STYLES = {
  Focus: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Business: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Future: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  Confidence: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  Action: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Unavailable: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

function Badge({ type, children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${BADGE_STYLES[type] || BADGE_STYLES.Business}`}>
      {children ?? type}
    </span>
  );
}

function Card({ title, badge, children, className = '' }) {
  return (
    <article className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title ? <h3 className="text-base font-bold text-white">{title}</h3> : null}
        {badge ? <Badge type={badge} /> : null}
      </div>
      {children}
    </article>
  );
}

function OverviewTab({ vm, lang }) {
  const { overview, confidence_summary: cs } = vm;
  const o = lang?.overview;
  return (
    <div className="space-y-4">
      <Card title="What This Assessment Found" badge="Focus">
        <p className="text-sm leading-relaxed text-white/82">
          {o?.what_assessment_found || overview.what_this_assessment_is_really_saying}
        </p>
      </Card>
      <Card title="Why This Matters">
        <p className="text-sm leading-relaxed text-white/82">{o?.why_it_matters}</p>
      </Card>
      <Card title="What To Focus On First" badge="Action">
        <p className="text-sm leading-relaxed text-white/82">{o?.focus_first}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Main Bottleneck">
          <p className="text-sm text-white/75">{o?.primary_bottleneck_plain || vm.primary_constraint?.summary}</p>
        </Card>
        <Card title="Your One Move" badge="Action">
          <p className="text-sm font-semibold text-white">{o?.one_move_plain || overview.one_move_teaser}</p>
        </Card>
        <Card title="How Sure Is This?" badge="Confidence">
          <p className="text-lg font-bold capitalize text-sky-200">{cs.band} ({cs.score}/100)</p>
          <p className="mt-2 text-sm text-white/70">{o?.confidence_plain || cs.headline}</p>
        </Card>
      </div>
      <p className="text-xs text-white/45">{o?.doctrine_plain || overview.doctrine_fusion_line}</p>
    </div>
  );
}

function BusinessRealityTab({ vm, lang }) {
  const br = vm.business_reality_summary;
  const l = lang?.business_reality;
  const items = [
    { label: 'Leads', value: l?.leads || br.sections?.leads?.body || br.leads },
    { label: 'Relationships / Database', value: l?.database || br.sections?.database?.body || br.database },
    { label: 'Systems', value: l?.systems || br.sections?.systems?.body || br.systems },
    { label: 'Financial Reality', value: l?.financial || br.sections?.financial?.body || br.financial },
    { label: 'Accountability', value: l?.accountability || br.sections?.accountability?.body || br.accountability },
  ];
  return (
    <div className="space-y-4">
      <Card title={l?.headline || br.headline} badge="Business">
        <p className="text-xs text-white/50">Stage: {l?.stage_plain || br.stage}</p>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.label} title={item.label}>
            <p className="text-sm leading-relaxed text-white/75">{item.value}</p>
          </Card>
        ))}
      </div>
      <Card title="Missing Information (Shown Honestly)" badge="Confidence">
        <p className="text-sm text-white/70">{l?.missing_data_plain || vm.missing_data.customer_note}</p>
      </Card>
    </div>
  );
}

function BehavioralOSTab({ vm, lang }) {
  const beh = vm.behavioral_reality_summary;
  const l = lang?.behavioral_os;
  const helps = l?.helps_business || beh.helps_business;
  const distorts = l?.gets_in_the_way || beh.distorts_business;
  return (
    <div className="space-y-4">
      <Card title={l?.profile_plain || beh.profile_type} badge="Business">
        <p className="text-sm text-white/75">{l?.headline || beh.headline}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Where Your Style Helps the Business">
          <ul className="list-inside list-disc space-y-1 text-sm text-white/75">
            {helps.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
        <Card title="Where It Gets In The Way">
          <ul className="list-inside list-disc space-y-1 text-sm text-white/75">
            {distorts.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
      </div>
      <Card title="How This Affects Execution">
        <p className="text-sm leading-relaxed text-white/75">{l?.execution_effect || beh.behavior_to_business}</p>
      </Card>
      {l?.dimensions_plain ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card title="Strongest Traits">
            <p className="text-sm text-white/75">{l.dimensions_plain.strongest}</p>
          </Card>
          <Card title="Areas That Need Structure">
            <p className="text-sm text-white/75">{l.dimensions_plain.weakest}</p>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card title="Top Dimensions">
            {beh.top_dimensions.map((d) => (
              <p key={d.label} className="text-sm text-white/80">{d.label}: <span className="font-mono text-emerald-300">{d.score}</span></p>
            ))}
          </Card>
          <Card title="Low Dimensions">
            {beh.low_dimensions.map((d) => (
              <p key={d.label} className="text-sm text-white/80">{d.label}: <span className="font-mono text-amber-300">{d.score}</span></p>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function ModelAlignmentTab({ vm, lang }) {
  const ma = vm.business_model_alignment_summary;
  const l = lang?.model_alignment;
  return (
    <div className="space-y-4">
      <Card title={l?.headline || ma.headline} badge="Business" />
      {l?.healthy_business_needs ? (
        <Card title="What a Healthy Real Estate Business Needs">
          <p className="text-sm text-white/75">{l.healthy_business_needs}</p>
        </Card>
      ) : null}
      {l?.aligned ? (
        <Card title="Where You Are Aligned">
          <ul className="list-inside list-disc text-sm text-white/75">
            {l.aligned.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
      ) : null}
      {l?.thin_or_informal ? (
        <Card title="Where the Business Is Thin or Informal">
          <ul className="list-inside list-disc text-sm text-white/75">
            {l.thin_or_informal.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
      ) : (
        <div className="space-y-3">
          {[
            ['Relationship asset', ma.relationship_asset],
            ['Lead generation', ma.lead_generation],
            ['CRM / follow-up', ma.crm_follow_up],
            ['Financial / P&L', ma.financial_discipline],
            ['Systems / accountability', ma.systems_accountability],
          ].map(([label, value]) => (
            <Card key={label} title={label}>
              <p className="text-sm text-white/75">{value}</p>
            </Card>
          ))}
        </div>
      )}
      {l?.transition_note ? (
        <Card title="Where You Are in the Transition">
          <p className="text-sm text-white/75">{l.transition_note}</p>
        </Card>
      ) : null}
    </div>
  );
}

function ConstraintRealityTab({ vm, lang }) {
  const cs = vm.constraint_summary;
  const l = lang?.constraint_reality;
  return (
    <div className="space-y-4">
      <Card title="The Actual Bottleneck" badge="Focus">
        <p className="text-sm text-white/75">{l?.bottleneck_plain || cs.primary.summary}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Symptoms You May Notice">
          <ul className="list-inside list-disc text-sm text-white/75">
            {(l?.symptoms || cs.symptoms_vs_root.symptoms).map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
        <Card title="Root Problem (Not Just the Symptom)">
          <p className="text-sm text-white/75">{l?.root_problem || cs.symptoms_vs_root.root_cause}</p>
          {l?.symptoms_vs_root ? <p className="mt-3 text-sm text-white/60">{l.symptoms_vs_root}</p> : null}
        </Card>
      </div>
      <Card title="What Happens If This Stays the Same">
        <p className="text-sm text-white/75">{l?.if_unchanged || cs.if_unchanged}</p>
        {l?.trajectory_plain ? <p className="mt-3 text-sm text-white/60">{l.trajectory_plain}</p> : null}
      </Card>
    </div>
  );
}

function ConfidenceRealityTab({ vm, lang }) {
  const cs = vm.confidence_summary;
  const l = lang?.confidence_reality;
  return (
    <div className="space-y-4">
      <Card title={l?.band_plain || `Confidence: ${cs.band} (${cs.score}/100)`} badge="Confidence">
        <p className="text-sm text-white/75">{l?.headline || cs.headline}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="What the System Knows">
          <ul className="list-inside list-disc text-sm text-white/75">
            {(l?.what_system_knows || []).map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
        <Card title="What It Is Inferring">
          <ul className="list-inside list-disc text-sm text-white/75">
            {(l?.what_system_infers || []).map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Card>
      </div>
      <Card title="What Is Missing">
        <ul className="list-inside list-disc text-sm text-white/75">
          {(l?.what_is_missing || vm.missing_data.financial || []).map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="mt-3 text-sm text-white/60">{l?.customer_note || vm.missing_data.customer_note}</p>
      </Card>
      <Card title="Confidence Counts">
        <p className="text-sm text-white/75">
          {l?.counts_plain || `Known: ${cs.known_count} · Observed: ${cs.observed_count} · Inferred: ${cs.inferred_count} · Missing: ${cs.missing_count}`}
        </p>
      </Card>
    </div>
  );
}

function FiveFuturesTab({ vm, lang }) {
  const l = lang?.five_futures;
  const plainCards = l?.cards || [];
  const cardByKey = Object.fromEntries(plainCards.map((c) => [c.key, c]));
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/70">
        {l?.intro || 'These futures are already forming from current business reality and how you work — not five equal menu options.'}
      </p>
      {vm.five_futures_cards.map((fut) => {
        const plain = cardByKey[fut.key];
        return (
          <Card key={fut.key} title={`${plain?.label || fut.label} — ${fut.probability}%`} badge="Future">
            <p className="font-semibold text-white">{plain?.title_plain || fut.title}</p>
            <p className="mt-2 text-sm text-white/75">{plain?.summary_plain || fut.summary}</p>
            {(plain?.personality_effect_plain || fut.behavioral_modifier)?.length ? (
              <div className="mt-3">
                <p className="text-[0.62rem] font-bold uppercase tracking-wider text-violet-300/70">How your personality affects this future</p>
                <ul className="mt-1 list-inside list-disc text-xs text-white/65">
                  {(plain?.personality_effect_plain || fut.behavioral_modifier).map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function OneMoveTab({ vm, lang }) {
  const om = vm.one_move_card;
  const l = lang?.one_move;
  return (
    <div className="space-y-4">
      <Card title={l?.title_plain || om.title} badge="Action">
        <p className="text-sm text-white/75">{l?.what_to_do || om.recommendation}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Why This Move"><p className="text-sm text-white/75">{l?.why_this_move || om.why_this_move}</p></Card>
        <Card title="Why Now"><p className="text-sm text-white/75">{l?.why_now || om.why_now}</p></Card>
      </div>
      <Card title="Why It Fits You">
        <p className="text-sm text-white/75">{l?.why_fits_customer || om.behavior_fit}</p>
      </Card>
      <Card title="First 30 Days">
        <ol className="list-inside list-decimal space-y-1 text-sm text-white/75">
          {(l?.first_30_days || om.first_30_days).map((d) => <li key={d}>{d}</li>)}
        </ol>
      </Card>
      <Card title="Proof That Would Show It Is Working">
        <ul className="list-inside list-disc text-sm text-white/75">
          {(l?.proof_would_show_working || om.proof_signals || []).map((s) => <li key={s}>{s}</li>)}
        </ul>
      </Card>
      <Card title="Risks If You Slip Back">
        <ul className="list-inside list-disc text-sm text-white/70">
          {(l?.adoption_risks_plain || om.adoption_risks).map((r) => <li key={r}>{r}</li>)}
        </ul>
      </Card>
    </div>
  );
}

function appendViewFullscreen(route) {
  if (!route || /[?&]view=(fullscreen|readable|fit)\b/i.test(route)) return route;
  return route.includes('?') ? `${route}&view=fullscreen` : `${route}?view=fullscreen`;
}

function buildPremiumFuturesRoute(profileId, card) {
  const fromCard = card?.route || card?.safe_route_ref;
  if (fromCard?.includes('renderer=premium')) {
    return appendViewFullscreen(fromCard);
  }
  return `/business-assessment/five-futures?id=${encodeURIComponent(profileId)}&renderer=premium&view=fullscreen`;
}

function PremiumUnavailableState({ card, profileId, showLabDebug = false }) {
  const missing = card.missing_premium_fields || [];
  const legacyRoute = `/business-assessment/five-futures?id=${encodeURIComponent(profileId)}&renderer=legacy`;
  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="text-sm font-semibold text-amber-200">Five Futures + One Move unavailable</p>
      <p className="mt-2 text-sm text-white/70">
        This visual needs complete stored assessment data before it can open.
      </p>
      {showLabDebug && missing.length ? (
        <ul className="mt-2 list-inside list-disc text-xs text-white/55">
          {missing.map((field) => <li key={field}>{field}</li>)}
        </ul>
      ) : null}
      {showLabDebug ? (
        <Link to={legacyRoute} className="mt-3 inline-block text-xs text-white/45 underline-offset-2 hover:underline">
          Open legacy route for debugging only →
        </Link>
      ) : null}
    </div>
  );
}

function VisualDNATab({ vm, lang, showLabDebug = false }) {
  const profileId = vm.profile_id || '';
  const visualDna = vm.visual_dna || {};
  const baMap = visualDna.business_assessment_map;
  const ffom = visualDna.five_futures_one_move;
  const cards = vm.visual_dna_cards || [];
  const l = lang?.visual_dna;

  const baMapCard = baMap || cards.find((card) => card.id === 'ba_map');
  const ffomCard = ffom || cards.find((card) => card.id === 'five_futures_one_move');
  const premiumEligible = ffom?.premium_eligible ?? ffomCard?.premium_eligible ?? false;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/70">
        {l?.intro || 'Visual maps help you see the same intelligence in this report. Read-only links — nothing new is generated here.'}
      </p>

      <Card title="Business Assessment Map" badge="Business">
        <p className="mt-2 text-sm text-white/75">{l?.business_assessment_map_plain || baMapCard?.purpose || baMapCard?.description}</p>
        <Link
          to={baMapCard?.route || baMapCard?.safe_route_ref || `/business-assessment/visual-map?id=${profileId}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/15"
        >
          Open Business Assessment Map →
        </Link>
      </Card>

      <Card title="Five Futures + One Move Visual" badge={premiumEligible ? 'Future' : 'Unavailable'}>
        <p className="mt-2 text-sm text-white/75">{l?.five_futures_one_move_plain || ffomCard?.purpose || ffomCard?.description}</p>
        {showLabDebug && l?.premium_status_plain ? (
          <p className="mt-2 text-xs text-white/50">{l.premium_status_plain}</p>
        ) : null}

        {premiumEligible ? (
          <Link
            to={buildPremiumFuturesRoute(profileId, ffomCard)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/15"
          >
            Open Five Futures + One Move
          </Link>
        ) : (
          <PremiumUnavailableState card={ffomCard || ffom || {}} profileId={profileId} showLabDebug={showLabDebug} />
        )}
      </Card>
    </div>
  );
}

function AdvancedSourceTab({ vm, lang }) {
  const prov = vm.model_provenance;
  const refs = vm.advanced_source_refs;
  const l = lang?.advanced_source;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/70">
        {l?.intro || 'Technical source version for transparency. The main report tabs are the readable customer version — no Universal Translator required.'}
      </p>
      <Card title="Model Provenance" badge="Business">
        <div className="space-y-2 text-sm text-white/75">
          <p>Briefing: {prov.briefing_lab.model} ({prov.briefing_lab.scope})</p>
          <p>Five Futures: {prov.five_futures.model} — {prov.five_futures.scope}</p>
          <p>One Move: {prov.one_move.model} — {prov.one_move.scope}</p>
        </div>
      </Card>
      <Card title="Confidence Engine (Technical)">
        <p className="text-sm text-white/75">
          Known: {vm.confidence_summary.known_count} · Observed: {vm.confidence_summary.observed_count} ·
          Inferred: {vm.confidence_summary.inferred_count} · Missing: {vm.confidence_summary.missing_count}
        </p>
      </Card>
      <Card title="Artifact References">
        <div className="space-y-1 text-xs text-white/55">
          <p>Briefing sections: {refs.executive_diagnostic_briefing?.section_count}</p>
          <p>BID version: {refs.business_intelligence_draft?.version}</p>
          <p>Futures probability total: {refs.five_futures_v1?.probability_total}%</p>
        </div>
        {l?.preserved_artifacts ? (
          <ul className="mt-3 list-inside list-disc text-xs text-white/55">
            {l.preserved_artifacts.map((a) => <li key={a}>{a}</li>)}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

const TAB_RENDERERS = {
  overview: OverviewTab,
  'business-reality': BusinessRealityTab,
  'behavioral-os': BehavioralOSTab,
  'model-alignment': ModelAlignmentTab,
  'constraint-reality': ConstraintRealityTab,
  'confidence-reality': ConfidenceRealityTab,
  'five-futures': FiveFuturesTab,
  'one-move': OneMoveTab,
  'visual-dna': VisualDNATab,
  'advanced-source': AdvancedSourceTab,
};

export default function PremiumCustomerBAShell({ viewModel, showLabDebug = false }) {
  const [activeTab, setActiveTab] = useState('overview');
  const tabs = viewModel.shell_tabs || BA_SHELL_TABS;
  const lang = customerLanguageSections(viewModel);
  const TabContent = TAB_RENDERERS[activeTab] || OverviewTab;

  return (
    <section className="space-y-5">
      {showLabDebug && viewModel.customer_language_v2 ? (
        <p className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-white/50">
          Written for regular-person business talk (~{viewModel.customer_language_v2.target_technicality}/100 technical).
          No Universal Translator needed for this report.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'bg-orange-500/25 text-orange-200 border border-orange-400/40'
                : 'border border-white/10 bg-black/20 text-white/50 hover:text-white/75'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <TabContent vm={viewModel} lang={lang} showLabDebug={showLabDebug} />
    </section>
  );
}