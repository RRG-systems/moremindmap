import { useState } from 'react';
import {
  BA_SHELL_TABS,
  customerLanguageSections,
} from '../../lib/businessAssessment/buildCustomerBAViewModel.js';
import {
  BACard,
  CustomerSafeText,
  CustomerSafeListItems,
  sanitizeCustomerMarkdown,
} from './BAReadableSection.jsx';
import BAVisualDNATab from './BAVisualDNATab.jsx';
import BAAdvancedSource from './BAAdvancedSource.jsx';
import BAMonthlyIntelligenceCard from './BAMonthlyIntelligenceCard.jsx';

function OverviewTab({ vm, lang }) {
  const { overview, confidence_summary: cs } = vm;
  const o = lang?.overview;
  return (
    <div className="space-y-4">
      <BACard title="What This Assessment Found" badge="Focus">
        <CustomerSafeText
          text={o?.what_assessment_found || overview.what_this_assessment_is_really_saying}
        />
      </BACard>
      <BACard title="Why This Matters">
        <CustomerSafeText text={o?.why_it_matters} />
      </BACard>
      <BACard title="What To Focus On First" badge="Action">
        <CustomerSafeText text={o?.focus_first} />
      </BACard>
      <div className="grid gap-4 md:grid-cols-3">
        <BACard title="Main Bottleneck">
          <CustomerSafeText
            text={o?.primary_bottleneck_plain || vm.primary_constraint?.summary}
            className="text-sm text-white/75"
          />
        </BACard>
        <BACard title="Your One Move" badge="Action">
          <CustomerSafeText
            text={o?.one_move_plain || overview.one_move_teaser}
            className="text-sm font-semibold text-white"
          />
        </BACard>
        <BACard title="How Sure Is This?" badge="Confidence">
          <p className="text-lg font-bold capitalize text-sky-200">
            {cs.band} ({cs.score}/100)
          </p>
          <div className="mt-2">
            <CustomerSafeText
              text={o?.confidence_plain || cs.headline}
              className="text-sm text-white/70"
            />
          </div>
        </BACard>
      </div>
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
    { label: 'Leads', value: l?.leads || br.sections?.leads?.body || br.leads },
    { label: 'Relationships / Database', value: l?.database || br.sections?.database?.body || br.database },
    { label: 'Systems', value: l?.systems || br.sections?.systems?.body || br.systems },
    { label: 'Financial Reality', value: l?.financial || br.sections?.financial?.body || br.financial },
    { label: 'Accountability', value: l?.accountability || br.sections?.accountability?.body || br.accountability },
  ];
  return (
    <div className="space-y-4">
      <BACard title={sanitizeCustomerMarkdown(l?.headline || br.headline)} badge="Business">
        <p className="text-xs text-white/50">
          Stage: {sanitizeCustomerMarkdown(l?.stage_plain || br.stage)}
        </p>
      </BACard>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <BACard key={item.label} title={item.label}>
            <CustomerSafeText text={item.value} className="text-sm leading-relaxed text-white/75" />
          </BACard>
        ))}
      </div>
      <BACard title="Missing Information (Shown Honestly)" badge="Confidence">
        <CustomerSafeText
          text={l?.missing_data_plain || vm.missing_data.customer_note}
          className="text-sm text-white/70"
        />
      </BACard>
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
      <BACard title={sanitizeCustomerMarkdown(l?.profile_plain || beh.profile_type)} badge="Business">
        <CustomerSafeText text={l?.headline || beh.headline} className="text-sm text-white/75" />
      </BACard>
      <div className="grid gap-4 md:grid-cols-2">
        <BACard title="Where Your Style Helps the Business">
          <CustomerSafeListItems items={helps} />
        </BACard>
        <BACard title="Where It Gets In The Way">
          <CustomerSafeListItems items={distorts} />
        </BACard>
      </div>
      <BACard title="How This Affects Execution">
        <CustomerSafeText
          text={l?.execution_effect || beh.behavior_to_business}
          className="text-sm leading-relaxed text-white/75"
        />
      </BACard>
      {l?.dimensions_plain ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <BACard title="Strongest Traits">
            <CustomerSafeText text={l.dimensions_plain.strongest} className="text-sm text-white/75" />
          </BACard>
          <BACard title="Areas That Need Structure">
            <CustomerSafeText text={l.dimensions_plain.weakest} className="text-sm text-white/75" />
          </BACard>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <BACard title="Top Dimensions">
            {beh.top_dimensions.map((d) => (
              <p key={d.label} className="text-sm text-white/80">
                {sanitizeCustomerMarkdown(d.label)}:{' '}
                <span className="font-mono text-emerald-300">{d.score}</span>
              </p>
            ))}
          </BACard>
          <BACard title="Low Dimensions">
            {beh.low_dimensions.map((d) => (
              <p key={d.label} className="text-sm text-white/80">
                {sanitizeCustomerMarkdown(d.label)}:{' '}
                <span className="font-mono text-amber-300">{d.score}</span>
              </p>
            ))}
          </BACard>
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
      <BACard title={sanitizeCustomerMarkdown(l?.headline || ma.headline)} badge="Business" />
      {l?.healthy_business_needs ? (
        <BACard title="What a Healthy Real Estate Business Needs">
          <CustomerSafeText text={l.healthy_business_needs} className="text-sm text-white/75" />
        </BACard>
      ) : null}
      {l?.aligned ? (
        <BACard title="Where You Are Aligned">
          <CustomerSafeListItems items={l.aligned} />
        </BACard>
      ) : null}
      {l?.thin_or_informal ? (
        <BACard title="Where the Business Is Thin or Informal">
          <CustomerSafeListItems items={l.thin_or_informal} />
        </BACard>
      ) : (
        <div className="space-y-3">
          {[
            ['Relationship asset', ma.relationship_asset],
            ['Lead generation', ma.lead_generation],
            ['CRM / follow-up', ma.crm_follow_up],
            ['Financial / P&L', ma.financial_discipline],
            ['Systems / accountability', ma.systems_accountability],
          ].map(([label, value]) => (
            <BACard key={label} title={label}>
              <CustomerSafeText text={value} className="text-sm text-white/75" />
            </BACard>
          ))}
        </div>
      )}
      {l?.transition_note ? (
        <BACard title="Where You Are in the Transition">
          <CustomerSafeText text={l.transition_note} className="text-sm text-white/75" />
        </BACard>
      ) : null}
    </div>
  );
}

function ConstraintRealityTab({ vm, lang }) {
  const cs = vm.constraint_summary;
  const l = lang?.constraint_reality;
  return (
    <div className="space-y-4">
      <BACard title="The Actual Bottleneck" badge="Focus">
        <CustomerSafeText
          text={l?.bottleneck_plain || cs.primary.summary}
          className="text-sm text-white/75"
        />
      </BACard>
      <div className="grid gap-4 md:grid-cols-2">
        <BACard title="Symptoms You May Notice">
          <CustomerSafeListItems items={l?.symptoms || cs.symptoms_vs_root.symptoms} />
        </BACard>
        <BACard title="Root Problem (Not Just the Symptom)">
          <CustomerSafeText
            text={l?.root_problem || cs.symptoms_vs_root.root_cause}
            className="text-sm text-white/75"
          />
          {l?.symptoms_vs_root ? (
            <div className="mt-3">
              <CustomerSafeText text={l.symptoms_vs_root} className="text-sm text-white/60" />
            </div>
          ) : null}
        </BACard>
      </div>
      <BACard title="What Happens If This Stays the Same">
        <CustomerSafeText text={l?.if_unchanged || cs.if_unchanged} className="text-sm text-white/75" />
        {l?.trajectory_plain ? (
          <div className="mt-3">
            <CustomerSafeText text={l.trajectory_plain} className="text-sm text-white/60" />
          </div>
        ) : null}
      </BACard>
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
  return (
    <div className="space-y-4">
      <BACard title={sanitizeCustomerMarkdown(l?.title_plain || om.title)} badge="Action">
        <CustomerSafeText text={l?.what_to_do || om.recommendation} className="text-sm text-white/75" />
      </BACard>
      <div className="grid gap-4 md:grid-cols-2">
        <BACard title="Why This Move">
          <CustomerSafeText text={l?.why_this_move || om.why_this_move} className="text-sm text-white/75" />
        </BACard>
        <BACard title="Why Now">
          <CustomerSafeText text={l?.why_now || om.why_now} className="text-sm text-white/75" />
        </BACard>
      </div>
      <BACard title="Why It Fits You">
        <CustomerSafeText
          text={l?.why_fits_you || l?.why_fits_owner || om.behavior_fit}
          className="text-sm text-white/75"
        />
      </BACard>
      <BACard title="First 30 Days">
        <ol className="list-inside list-decimal space-y-1 text-sm text-white/75">
          {(l?.first_30_days || om.first_30_days).map((d) => (
            <li key={d}>{sanitizeCustomerMarkdown(d)}</li>
          ))}
        </ol>
      </BACard>
      <BACard title="Proof That Would Show It Is Working">
        <CustomerSafeListItems items={l?.proof_would_show_working || om.proof_signals || []} />
      </BACard>
      <BACard title="Risks If You Slip Back">
        <CustomerSafeListItems
          items={l?.adoption_risks_plain || om.adoption_risks}
          className="list-inside list-disc text-sm text-white/70"
        />
      </BACard>
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
