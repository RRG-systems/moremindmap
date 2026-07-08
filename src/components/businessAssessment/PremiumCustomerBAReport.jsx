import { useState } from 'react';
import {
  BA_SHELL_TABS,
  customerLanguageSections,
} from '../../lib/businessAssessment/buildCustomerBAViewModel.js';
import {
  BACard,
  BACardIfContent,
  CustomerSafeText,
  CustomerSafeListItems,
  sanitizeCustomerMarkdown,
} from './BAReadableSection.jsx';
import BAVisualDNATab from './BAVisualDNATab.jsx';
import BAAdvancedSource from './BAAdvancedSource.jsx';
import BAMonthlyIntelligenceCard from './BAMonthlyIntelligenceCard.jsx';

function textOr(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.filter(Boolean).length) return value;
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function OverviewTab({ vm, lang }) {
  const { overview } = vm;
  const o = lang?.overview;
  const found = textOr(o?.what_assessment_found, overview.what_this_assessment_is_really_saying);
  const why = textOr(o?.why_it_matters, overview.why_this_matters);
  const focus = textOr(o?.focus_first, overview.focus_first);
  const bottleneck = textOr(o?.primary_bottleneck_plain, vm.primary_constraint?.summary);
  const oneMove = textOr(o?.one_move_plain, overview.one_move_teaser, vm.one_move_card?.title);

  return (
    <div className="space-y-4">
      <BACardIfContent title="What This Assessment Found" badge="Focus" content={found}>
        <CustomerSafeText text={found} />
      </BACardIfContent>
      <BACardIfContent title="Why This Matters" content={why}>
        <CustomerSafeText text={why} />
      </BACardIfContent>
      <BACardIfContent title="What To Focus On First" badge="Action" content={focus}>
        <CustomerSafeText text={focus} />
      </BACardIfContent>
      <div className="grid gap-4 md:grid-cols-2">
        <BACardIfContent title="Main Bottleneck" content={bottleneck}>
          <CustomerSafeText text={bottleneck} className="text-sm text-white/75" />
        </BACardIfContent>
        <BACardIfContent title="Your One Move" badge="Action" content={oneMove}>
          <CustomerSafeText text={oneMove} className="text-sm font-semibold text-white" />
          {vm.one_move_card?.recommendation ? (
            <div className="mt-2">
              <CustomerSafeText
                text={vm.one_move_card.recommendation}
                className="text-sm text-white/70"
              />
            </div>
          ) : null}
        </BACardIfContent>
      </div>
      {/* Confidence stays in Technical Source only — not in Overview. */}
      <CustomerSafeText
        text={o?.doctrine_plain || overview.doctrine_fusion_line}
        className="text-xs text-white/45"
      />
    </div>
  );
}

function BusinessRealityTab({ vm, lang }) {
  const br = vm.business_reality_summary;
  const l = lang?.business_reality;
  const items = [
    { label: 'Leads', value: textOr(l?.leads, br.leads) },
    { label: 'Relationships / Database', value: textOr(l?.database, br.database) },
    { label: 'Systems', value: textOr(l?.systems, br.systems) },
    { label: 'Financial Reality', value: textOr(l?.financial, br.financial) },
    { label: 'Accountability', value: textOr(l?.accountability, br.accountability) },
  ].filter((item) => textOr(item.value));

  return (
    <div className="space-y-4">
      <BACardIfContent
        title={sanitizeCustomerMarkdown(l?.headline || br.headline || 'Your Business Today')}
        badge="Business"
        content={l?.headline || br.headline || br.stage}
      >
        {br.stage || l?.stage_plain ? (
          <p className="text-xs text-white/50">
            Stage: {sanitizeCustomerMarkdown(l?.stage_plain || br.stage)}
          </p>
        ) : null}
      </BACardIfContent>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <BACard key={item.label} title={item.label}>
            <CustomerSafeText text={item.value} className="text-sm leading-relaxed text-white/75" />
          </BACard>
        ))}
      </div>
      {/* Missing-data confidence detail stays in Technical Source; short honest note only. */}
      <BACardIfContent
        title="Where Detail Is Still Thin"
        content={textOr(l?.missing_data_plain, vm.missing_data?.customer_note)}
      >
        <CustomerSafeText
          text={textOr(l?.missing_data_plain, vm.missing_data?.customer_note)}
          className="text-sm text-white/70"
        />
      </BACardIfContent>
    </div>
  );
}

function BehavioralOSTab({ vm, lang }) {
  const beh = vm.behavioral_reality_summary;
  const l = lang?.behavioral_os;
  const helps = textOr(l?.helps_business, beh.helps_business);
  const distorts = textOr(l?.gets_in_the_way, beh.distorts_business);
  const strongest = textOr(l?.dimensions_plain?.strongest, (beh.top_plain || []).join(' · '));
  const weakest = textOr(l?.dimensions_plain?.weakest, (beh.low_plain || []).join(' · '));
  const execution = textOr(l?.execution_effect, beh.behavior_to_business);

  return (
    <div className="space-y-4">
      <BACardIfContent
        title={sanitizeCustomerMarkdown(l?.profile_plain || beh.profile_type || 'How You Work')}
        badge="Business"
        content={textOr(l?.headline, beh.headline, l?.profile_plain, beh.profile_type)}
      >
        <CustomerSafeText
          text={textOr(l?.headline, beh.headline)}
          className="text-sm text-white/75"
        />
      </BACardIfContent>
      <div className="grid gap-4 md:grid-cols-2">
        <BACardIfContent title="Where Your Style Helps the Business" content={helps}>
          <CustomerSafeListItems items={Array.isArray(helps) ? helps : [helps]} />
        </BACardIfContent>
        <BACardIfContent title="Where It Gets In The Way" content={distorts}>
          <CustomerSafeListItems items={Array.isArray(distorts) ? distorts : [distorts]} />
        </BACardIfContent>
      </div>
      <BACardIfContent title="How This Affects Execution" content={execution}>
        <CustomerSafeText text={execution} className="text-sm leading-relaxed text-white/75" />
      </BACardIfContent>
      <div className="grid gap-3 sm:grid-cols-2">
        <BACardIfContent title="Strongest Traits" content={strongest}>
          <CustomerSafeText text={strongest} className="text-sm text-white/75" />
        </BACardIfContent>
        <BACardIfContent title="Areas That Need Structure" content={weakest}>
          <CustomerSafeText text={weakest} className="text-sm text-white/75" />
        </BACardIfContent>
      </div>
    </div>
  );
}

function ModelAlignmentTab({ vm, lang }) {
  const ma = vm.business_model_alignment_summary;
  const l = lang?.model_alignment;
  const fitRows = [
    ['Relationship asset', textOr(ma.relationship_asset)],
    ['Lead generation', textOr(ma.lead_generation)],
    ['CRM / follow-up', textOr(ma.crm_follow_up)],
    ['Financial / P&L', textOr(ma.financial_discipline)],
    ['Systems / accountability', textOr(ma.systems_accountability)],
  ].filter(([, value]) => value);

  const aligned = textOr(l?.aligned, ma.aligned_points);
  const thin = textOr(l?.thin_or_informal, ma.thin_points);

  return (
    <div className="space-y-4">
      <BACardIfContent
        title={sanitizeCustomerMarkdown(l?.headline || 'Business Fit') || 'Business Fit'}
        badge="Business"
        content={textOr(l?.headline, ma.headline)}
      >
        <CustomerSafeText text={textOr(l?.headline, ma.headline)} className="text-sm text-white/75" />
      </BACardIfContent>
      <BACardIfContent
        title="What a Healthy Real Estate Business Needs"
        content={l?.healthy_business_needs}
      >
        <CustomerSafeText text={l?.healthy_business_needs} className="text-sm text-white/75" />
      </BACardIfContent>
      <BACardIfContent title="Where You Are Aligned" content={aligned}>
        <CustomerSafeListItems items={Array.isArray(aligned) ? aligned : [aligned]} />
      </BACardIfContent>
      <BACardIfContent title="Where the Business Is Thin or Informal" content={thin}>
        {Array.isArray(thin) ? (
          <CustomerSafeListItems items={thin} />
        ) : (
          <CustomerSafeText text={thin} className="text-sm text-white/75" />
        )}
      </BACardIfContent>
      {!aligned && !thin && fitRows.length ? (
        <div className="space-y-3">
          {fitRows.map(([label, value]) => (
            <BACard key={label} title={label}>
              <CustomerSafeText text={value} className="text-sm text-white/75" />
            </BACard>
          ))}
        </div>
      ) : null}
      <BACardIfContent title="Where You Are in the Transition" content={textOr(l?.transition_note, ma.transition_note)}>
        <CustomerSafeText
          text={textOr(l?.transition_note, ma.transition_note)}
          className="text-sm text-white/75"
        />
      </BACardIfContent>
    </div>
  );
}

function ConstraintRealityTab({ vm, lang }) {
  const cs = vm.constraint_summary;
  const l = lang?.constraint_reality;
  const bottleneck = textOr(l?.bottleneck_plain, cs.primary.summary);
  const symptoms = textOr(l?.symptoms, cs.symptoms_vs_root.symptoms);
  const root = textOr(l?.root_problem, cs.symptoms_vs_root.root_cause);
  const ifUnchanged = textOr(l?.if_unchanged, cs.if_unchanged);

  return (
    <div className="space-y-4">
      <BACardIfContent title="The Actual Bottleneck" badge="Focus" content={bottleneck}>
        <CustomerSafeText text={bottleneck} className="text-sm text-white/75" />
      </BACardIfContent>
      <div className="grid gap-4 md:grid-cols-2">
        <BACardIfContent title="Symptoms You May Notice" content={symptoms}>
          <CustomerSafeListItems
            items={Array.isArray(symptoms) ? symptoms : [symptoms]}
          />
        </BACardIfContent>
        <BACardIfContent title="Root Problem (Not Just the Symptom)" content={root}>
          <CustomerSafeText text={root} className="text-sm text-white/75" />
          {l?.symptoms_vs_root ? (
            <div className="mt-3">
              <CustomerSafeText text={l.symptoms_vs_root} className="text-sm text-white/60" />
            </div>
          ) : null}
        </BACardIfContent>
      </div>
      <BACardIfContent title="What Happens If This Stays the Same" content={ifUnchanged}>
        <CustomerSafeText text={ifUnchanged} className="text-sm text-white/75" />
        {l?.trajectory_plain ? (
          <div className="mt-3">
            <CustomerSafeText text={l.trajectory_plain} className="text-sm text-white/60" />
          </div>
        ) : null}
      </BACardIfContent>
    </div>
  );
}

function KeepYourMapAliveTab({ monthlyIntelligenceCheckout }) {
  return (
    <BAMonthlyIntelligenceCard
      checkoutState={monthlyIntelligenceCheckout?.checkoutState}
      onStartCheckout={monthlyIntelligenceCheckout?.onStartCheckout}
    />
  );
}

function FiveFuturesTab({ vm, lang }) {
  const l = lang?.five_futures;
  const plainCards = l?.cards || [];
  const cardByKey = Object.fromEntries(plainCards.map((c) => [c.key, c]));
  return (
    <div className="space-y-4">
      <CustomerSafeText
        text={
          l?.intro ||
          'These futures are already forming from current business reality and how you work — not five equal menu options.'
        }
        className="text-sm leading-relaxed text-white/70"
      />
      {vm.five_futures_cards.map((fut) => {
        const plain = cardByKey[fut.key];
        return (
          <BACard
            key={fut.key}
            title={`${sanitizeCustomerMarkdown(plain?.label || fut.label)} — ${fut.probability}%`}
            badge="Future"
          >
            <CustomerSafeText
              text={plain?.title_plain || fut.title}
              className="font-semibold text-white"
            />
            <div className="mt-2">
              <CustomerSafeText
                text={plain?.summary_plain || fut.summary}
                className="text-sm text-white/75"
              />
            </div>
            {(plain?.personality_effect_plain || fut.behavioral_modifier)?.length ? (
              <div className="mt-3">
                <p className="text-[0.62rem] font-bold uppercase tracking-wider text-violet-300/70">
                  How your personality affects this future
                </p>
                <div className="mt-1">
                  <CustomerSafeListItems
                    items={plain?.personality_effect_plain || fut.behavioral_modifier}
                    className="list-inside list-disc text-xs text-white/65"
                  />
                </div>
              </div>
            ) : null}
          </BACard>
        );
      })}
    </div>
  );
}

function OneMoveTab({ vm, lang }) {
  const om = vm.one_move_card;
  const l = lang?.one_move;
  const title = textOr(l?.title_plain, om.title);
  const what = textOr(l?.what_to_do, om.recommendation);
  const whyMove = textOr(l?.why_this_move, om.why_this_move);
  const whyNow = textOr(l?.why_now, om.why_now);
  const fits = textOr(l?.why_fits_you, l?.why_fits_owner, om.behavior_fit);
  const first30 = textOr(l?.first_30_days, om.first_30_days);
  const proof = textOr(l?.proof_would_show_working, om.proof_signals);
  const risks = textOr(l?.adoption_risks_plain, om.adoption_risks);

  return (
    <div className="space-y-4">
      <BACardIfContent title={sanitizeCustomerMarkdown(title) || 'Your One Move'} badge="Action" content={what || title}>
        <CustomerSafeText text={what} className="text-sm text-white/75" />
      </BACardIfContent>
      <div className="grid gap-4 md:grid-cols-2">
        <BACardIfContent title="Why This Move" content={whyMove}>
          <CustomerSafeText text={whyMove} className="text-sm text-white/75" />
        </BACardIfContent>
        <BACardIfContent title="Why Now" content={whyNow}>
          <CustomerSafeText text={whyNow} className="text-sm text-white/75" />
        </BACardIfContent>
      </div>
      <BACardIfContent title="Why It Fits You" content={fits}>
        <CustomerSafeText text={fits} className="text-sm text-white/75" />
      </BACardIfContent>
      <BACardIfContent title="First 30 Days" content={first30}>
        <ol className="list-inside list-decimal space-y-1 text-sm text-white/75">
          {(Array.isArray(first30) ? first30 : [first30]).filter(Boolean).map((d) => (
            <li key={d}>{sanitizeCustomerMarkdown(d)}</li>
          ))}
        </ol>
      </BACardIfContent>
      <BACardIfContent title="Proof That Would Show It Is Working" content={proof}>
        <CustomerSafeListItems items={Array.isArray(proof) ? proof : [proof]} />
      </BACardIfContent>
      <BACardIfContent title="Risks If You Slip Back" content={risks}>
        <CustomerSafeListItems
          items={Array.isArray(risks) ? risks : [risks]}
          className="list-inside list-disc text-sm text-white/70"
        />
      </BACardIfContent>
    </div>
  );
}

const TAB_RENDERERS = {
  overview: OverviewTab,
  'business-reality': BusinessRealityTab,
  'behavioral-os': BehavioralOSTab,
  'model-alignment': ModelAlignmentTab,
  'constraint-reality': ConstraintRealityTab,
  'keep-map-alive': KeepYourMapAliveTab,
  'five-futures': FiveFuturesTab,
  'one-move': OneMoveTab,
  'visual-dna': BAVisualDNATab,
  'advanced-source': BAAdvancedSource,
};

const NEXT_STEP_TAB_ID = 'keep-map-alive';

function tabButtonClassName(isActive, isNextStep) {
  if (isActive) {
    return isNextStep
      ? 'bg-orange-500/28 text-orange-100 border border-orange-400/50 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
      : 'bg-orange-500/25 text-orange-200 border border-orange-400/40';
  }
  if (isNextStep) {
    return 'border border-cyan-300/30 bg-cyan-400/[0.07] text-cyan-50/85 hover:text-cyan-50 hover:border-cyan-300/45';
  }
  return 'border border-white/10 bg-black/20 text-white/50 hover:text-white/75';
}

export default function PremiumCustomerBAReport({
  viewModel,
  showLabDebug = false,
  monthlyIntelligenceCheckout = null,
}) {
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
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isNextStep = tab.id === NEXT_STEP_TAB_ID;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider transition-colors ${tabButtonClassName(
                isActive,
                isNextStep
              )}`}
            >
              <span className="truncate">{tab.label}</span>
              {isNextStep ? (
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] ${
                    isActive
                      ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100'
                      : 'border-orange-300/40 bg-orange-400/15 text-orange-100/90'
                  }`}
                >
                  Next Step
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <TabContent
        vm={viewModel}
        lang={lang}
        showLabDebug={showLabDebug}
        monthlyIntelligenceCheckout={monthlyIntelligenceCheckout}
      />
    </section>
  );
}
