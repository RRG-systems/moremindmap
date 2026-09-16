# Canonical LO Intake Question Contract V1 — Exact 12 Core + 3 Conditional

Contract ID: `loan-originator-business-assessment-intake-v1`  
Status: canonical customer wording, mission IDs, order, helper copy, and question architecture; not runtime implementation authority.

## Shared semantics

Every screen stores question state, field-level evidence class, provenance, confidence, applicability, definition, period/cohort, subject scope, contradiction links, and missing reason. A screen may be skipped only through the governed rules in the branching registry.

## Core 01 — LO Business + Scope

**Canonical mission ID:** `LO_CORE_01_BUSINESS_SCOPE`

**Customer question:**  
**Which best describes your current role and how you originate residential loans?**

**Helper/example copy:**  
This assessment is for producing residential Loan Originators. Choose all that fit—retail/direct lender, mortgage broker, bank LO, producing team leader; mostly self-generated, company-generated, or blended. If your role is primarily processing, underwriting, operations, secondary markets, or non-producing leadership, this version is not designed for that role.

**Structured fields:** producing status; role type; platform/business model; individual/team/branch subject scope; self/company/blended opportunity model; decision/control scope; explicit customer-confirmed vertical; other residential purpose flags.

**Applicability/branching:** always first for a new/unbound assessment. Non-producing/out-of-scope answer stops the LO path. Exact compatible returning binding may use a concise confirmation summary instead of repeating every field.

**Evidence expectation:** customer-confirmed `OBSERVED` role/scope claims with capture time and binding provenance.

**Downstream:** vertical gate, cassette binding, all evidence applicability, Box 1 eligibility, Business Twin subject scope, privacy/control boundaries.

**Derived without another question:** normalized variant flags and control-owner defaults only where directly implied by selected scope; no business-performance fact.

## Core 02 — Primary Goal

**Canonical mission ID:** `LO_CORE_02_PRIMARY_GOAL`

**Customer question:**  
**What is the main business result you want over the next 12 months?**

**Helper/example copy:**  
For example: funded loans, funded volume, personal/owner business income, or another measurable production result. Include the target and whether it applies to you, your team, or another scope.

**Structured fields:** goal metric; target value; unit/currency; trailing/forward 12-month goal window; subject scope; purpose scope; why-this-goal narrative optional; priority; customer confidence.

**Applicability/branching:** all in-scope producing LOs. An income/economic goal activates Conditional 14. A nonnumeric or undefined goal remains usable narrative but makes sufficiency/backsolve fields `MISSING` until clarified or later supplied.

**Evidence expectation:** customer-stated goal with `OBSERVED` customer-governed provenance; any converted target is `DERIVED` or `MODELED_REQUIREMENT`.

**Downstream:** Box 1 Your Business Now, sufficiency, constraints, Futures, One Move, 1–3–5 Plan, Subscription.

**Derived without another question:** goal period normalization and compatible unit conversions when explicit inputs exist.

## Core 03 — Current Production + Observation Window

**Canonical mission ID:** `LO_CORE_03_PRODUCTION_WINDOWS`

**Customer question:**  
**What did you fund in the last 12 months, and what have you funded in the last 90 days?**

**Helper/example copy:**  
Use loans your business counts as closed/funded. Enter funded units and volume if you know both. If your company defines “funded” differently, tell us which completed event you use.

**Structured fields:** trailing-12-month funded units/volume; trailing-90-day funded units/volume; terminal-event definition/alias; as-of date; subject scope; purpose/source segmentation when known; data source; estimate/precision flag.

**Applicability/branching:** all in-scope producing LOs. Volume, 90-day data, and segmentation are optional subfields; blank never becomes zero. Incompatible scopes remain separate.

**Evidence expectation:** customer-reported or connected-authorized aggregate `OBSERVED` values; pace and change calculations are `DERIVED`.

**Downstream:** Box 1 Your Business Now, 12-month baseline, 90-day trajectory, sufficiency, backsolve, economics, capacity.

**Derived without another question:** 90-day pace comparison, purpose shares, average funded amount, and trend indicators only from compatible definitions/scopes.

## Core 04 — Purchase / Refinance Applicability

**Canonical mission ID:** `LO_CORE_04_PURPOSE_APPLICABILITY`

**Customer question:**  
**How much of your business is Purchase, Refinance, or another residential loan purpose?**

**Helper/example copy:**  
Use the same 12-month funded baseline when possible. Choose Not applicable for paths you do not originate; that is different from zero or unknown.

**Structured fields:** Purchase/Refinance/other applicability; funded counts/volume/shares by purpose; 90-day mix when known; purpose-specific stage applicability; other-purpose description; mixed-cohort separability.

**Applicability/branching:** all in-scope LOs; each purpose path branches independently. Other purposes remain described but outside V1 mechanics unless explicitly supported later.

**Evidence expectation:** `OBSERVED` mix/applicability with customer provenance; calculated shares are `DERIVED`.

**Downstream:** purpose-specific funnel, Box 1 Your Business Now / Your Business Pipeline, conversion/pull-through, backsolve sensitivity, live-research applicability.

**Derived without another question:** shares and purpose totals where component counts are compatible.

## Core 05 — Opportunity Source Network

**Canonical mission ID:** `LO_CORE_05_OPPORTUNITY_SOURCE_NETWORK`

**Customer question:**  
**Which business or professional sources consistently create mortgage opportunities for you?**

**Helper/example copy:**  
Your Opportunity Source Network includes relationships or channels such as Realtor partners, builders, financial professionals, other professional referrals, company/branch opportunities, direct/digital channels, or self-generated activity. A contact is not automatically an opportunity. For each meaningful source, use aggregate numbers only.

**Structured fields per source row:** source ID/label; source type; relationship versus channel; ownership/control; meaningful network size or channel scope; active/engaged raw measure and window; productive raw measure and window; 12-month/90-day opportunities/applications/funded outcomes where known; activity/cadence; concentration share; attribution quality; system link.

**Applicability/branching:** all in-scope LOs. Show only applicable source-row variants; no Realtor primacy. Past-customer referral Opportunities retain CRN provenance and may be cross-referenced here only as an event channel.

**Evidence expectation:** aggregate `OBSERVED` claims with customer/system provenance; productivity and concentration are `DERIVED`; “active” and “productive” remain raw measures unless later thresholds are accepted.

**Downstream:** Box 1 Where Your Business Comes From, opportunity supply, relationship activation, concentration, systems, backsolve feasibility, Futures/Plan/Subscription.

**Derived without another question:** source mix, concentration, productivity, and attributable conversion from compatible rows.

## Core 06 — Customer Relationship Network

**Canonical mission ID:** `LO_CORE_06_CUSTOMER_RELATIONSHIP_NETWORK`

**Customer question:**  
**How is your past and current customer network contributing to repeat, Refinance, and referral business?**

**Helper/example copy:**  
Your Customer Relationship Network means past/current borrowers or customers whose continuing relationship can create a repeat purchase, Refinance, or friends/family referral. Use aggregate counts only—no borrower names or loan files.

**Structured fields:** meaningful aggregate network size/categories; maintained/active raw state and window; 12-month/90-day repeat, Refinance, and referral Opportunities/funded outcomes; relationship-system link; contact/use authority; company data ownership; servicing owner; recapture authority; authority status source/date; unknown/declined reason.

**Applicability/branching:** all in-scope LOs, but network size/outcomes may be `UNANSWERED` or `MISSING`; authority fields appear only at aggregate state level. Never infer authority from CRM possession, origination history, or servicing assumptions.

**Evidence expectation:** aggregate `OBSERVED` claims; rates/shares are `DERIVED`; missing authority remains `MISSING` and blocks outreach/recapture conclusions only.

**Downstream:** Box 1 Where Your Business Comes From, relationship activation, durable demand asset, systems, Subscription context, privacy boundary.

**Derived without another question:** repeat/refi/referral shares and CRN productivity from compatible aggregate evidence.

## Core 07 — Opportunity + Funnel

**Canonical mission ID:** `LO_CORE_07_OPPORTUNITY_FUNNEL`

**Customer question:**  
**Walk us through your opportunity-to-funded pipeline for the last 12 months, and the last 90 days if available.**

**Helper/example copy:**  
An Opportunity is a person or household with a plausible current mortgage need—not every contact or database record. Enter only stages you actually track. Purchase and Refinance paths appear separately when applicable.

**Structured fields:** purpose; shared period/cohort; Opportunity count/definition; Application count/definition; Purchase Qualified/Preapproved; Purchase Active Transaction; Refinance Qualified; Refinance Active Loan; Approval; Lock; Close/Fund; pending/open share; stage data source; definition aliases; cohort maturity; counts by 12 months/90 days.

**Applicability/branching:** all in-scope LOs; only purpose-applicable stages display. `NOT_APPLICABLE`, zero, and missing stay distinct. Counts with incompatible periods/cohorts remain separate and trigger Conditional 15 if material.

**Evidence expectation:** aggregate `OBSERVED` counts; stage conversion/pull-through, fallout residuals, and pace are `DERIVED` only from compatible cohorts.

**Downstream:** Box 1 Your Business Pipeline, sufficiency, constraints, backsolve, Futures, One Move, Plan, Evidence, Subscription.

**Derived without another question:** stage-pair ratios, cumulative conversion, pull-through, open/pending share, and backsolve inputs.

## Core 08 — Relationship Systems

**Canonical mission ID:** `LO_CORE_08_RELATIONSHIP_SYSTEMS`

**Customer question:**  
**What do you consistently do to build and maintain the relationships that create business?**

**Helper/example copy:**  
Separate your Opportunity Source Network from your Customer Relationship Network. A CRM is a tool, not a system. For each real system, tell us who it serves, what happens, how often, how it is delivered, who owns it, and how you know it is working.

**Structured fields per system:** network/audience; purpose; activity/action; cadence/frequency; channel; automation versus personal; relationship depth; segmentation; owner; tool/infrastructure; leading measure; observed outcome; review window; stop/adapt condition; authority/compliance dependency.

**Applicability/branching:** show system rows only for applicable networks. Explicit “no measured system” is `ANSWERED`; blank remains `UNANSWERED`.

**Evidence expectation:** customer-stated `OBSERVED` system behavior; system quality/productivity is `DERIVED` or hypothesis, never inferred from tool ownership.

**Downstream:** Box 1 Your System & Capacity, Relationship Activation, Execution/Systems, E→P translation, Plan/Evidence/Subscription.

**Derived without another question:** cadence/channel/depth/segmentation coverage and automation/personal mix.

## Core 09 — Team + Capacity

**Canonical mission ID:** `LO_CORE_09_TEAM_CAPACITY`

**Customer question:**  
**Who handles the major parts of your business today, and what work is limiting your capacity?**

**Helper/example copy:**  
Consider relationship work, application/preapproval, file coordination, processing/underwriting follow-up, closing, and customer follow-up. Identify owners, handoffs, sustainable load, and any service or quality effect. Do not assume a processor is the answer.

**Structured fields:** solo/team/support state; work-category ownership; handoffs; weekly/monthly load; current utilization; sustainable capacity; overflow/backlog; response/quality/service effect; time allocation; highest-value LO work; leverage/control owner; evidence window.

**Applicability/branching:** all in-scope LOs; role rows adapt to actual structure. No missing support field becomes “solo.”

**Evidence expectation:** aggregate `OBSERVED` workload/ownership; utilization/gap is `DERIVED`; leverage requirement is `MODELED_REQUIREMENT` or `SCENARIO`.

**Downstream:** Box 1 Your System & Capacity, Capacity/Leverage constraint, economics feasibility, One Move, Plan, Subscription.

**Derived without another question:** utilization, capacity gap/surplus, and possible leverage location from compatible evidence; never a predetermined hire sequence.

## Core 10 — Platform / Company Capability

**Canonical mission ID:** `LO_CORE_10_PLATFORM_CAPABILITY`

**Customer question:**  
**What company, platform, product, process, or policy limits materially affect your results?**

**Helper/example copy:**  
For example: product/program fit, pricing, underwriting or operations turn times, technology, lead distribution, geographic reach, or company policy. Choose “none known” if that is your actual answer.

**Structured fields per limit:** category; customer-stated description; affected purpose/stage/goal; business effect; frequency/window; evidence; materiality; control owner (`LO`, `SHARED`, `PLATFORM`, `EXTERNAL`); workaround; authority/date; volatile-current-fact flag.

**Applicability/branching:** all in-scope LOs. “None known” is answered; blank is not none. Current factual claims may require later governed research, not intake expansion.

**Evidence expectation:** customer-stated `OBSERVED` platform experience with attributed provenance; causal/material constraint status remains a governed hypothesis until supported.

**Downstream:** Box 1 Your System & Capacity / What’s Holding You Back, Platform/Capability constraint, control-owner safety, Futures/Plan/Subscription.

**Derived without another question:** control-owner grouping and cross-stage impact summaries; never employer/recruiting recommendation.

## Core 11 — Operator Diagnosis

**Canonical mission ID:** `LO_CORE_11_OPERATOR_DIAGNOSIS`

**Customer question:**  
**What do you believe matters most right now—what is holding the business back, or, if you are on track, what should you protect or build on?**

**Helper/example copy:**  
Tell us what makes you think that. “Nothing material” and “I’m not sure” are valid answers.

**Structured fields:** operator hypothesis type (`CONSTRAINT`, `STRENGTH`, `MOMENTUM`, `OPPORTUNITY`, `EVIDENCE_NEED`, `NONE`, `UNSURE`); description; affected goal/network/stage/system; supporting observations; alternative explanations; control owner; confidence; desired protection/compounding outcome.

**Applicability/branching:** all in-scope LOs. Does not itself activate a primary constraint. A conversion/economics concern may activate Conditional 13/14.

**Evidence expectation:** `OBSERVED` customer-stated hypothesis provenance, never independently observed cause.

**Downstream:** Box 1 What’s Holding You Back, alternative constraint review, Futures, Founder One Move basis, Subscription self-discovery.

**Derived without another question:** hypothesis-to-evidence alignment and unsupported/contradicted flags.

## Core 12 — Accountability / Execution

**Canonical mission ID:** `LO_CORE_12_ACCOUNTABILITY_EXECUTION`

**Customer question:**  
**What commitments or operating priorities are you accountable for right now, and how consistently are they happening?**

**Helper/example copy:**  
For each material priority, include the owner, expected cadence or target, actual execution/results, and what you have learned. This is about execution evidence, not moral judgment.

**Structured fields per priority:** commitment/priority; strategy/system link; owner; target/cadence; actual execution; 90-day result/outcome; evidence source; miss reason; learning; next review date; continuation/change/stop state.

**Applicability/branching:** all in-scope LOs. A true absence of defined commitments may be answered; blank remains unanswered.

**Evidence expectation:** customer-stated `OBSERVED` commitment/execution/outcome; completion rates are `DERIVED`; future targets are `SCENARIO` or plan commitments, not observed reality.

**Downstream:** Box 1 Your System & Capacity, Execution/Systems constraint, accountability→execution→outcome→learning, Plan, Evidence, Personal RSL, Subscription.

**Derived without another question:** execution rate, repeated miss/learning pattern, and strategy-versus-execution hypothesis.

## Conditional 13 — Conversion / Fallout / Cycle

**Canonical mission ID:** `LO_COND_13_CONVERSION_FALLOUT_CYCLE`

**Customer question:**  
**Your numbers show a material drop or delay at [purpose/stage]. What is happening there?**

**Helper/example copy:**  
For example: customer drop-off, incomplete applications, qualification/preapproval, property search, process/approval delays, lock/funding fallout, or cycle-time issues. “Unknown” is valid.

**Structured fields:** trigger evidence IDs; affected purpose/stage pair; displayed derived rate/drop; qualitative reason categories; customer-stated explanation; fallout count where known; cycle/aging measure; affected cohort; control owner; evidence/confidence; materiality; bounded clarification response.

**Activation:** only when compatible funnel evidence shows material conversion/pull-through drop, the LO identifies a conversion/fallout/process/cycle/customer-loss concern, stage counts locate leakage but not why, Purchase/Refi performance differs materially and explanation matters, or one bounded explanation is necessary for responsible constraint determination. Derive first; ask only when explanation is materially useful. Never trigger merely because mortgage businesses have fallout.

**Skip:** do not show when numbers already establish enough explanation, evidence is incompatible/unresolved, no material issue exists, or the mission is evidence-satisfied.

**Evidence expectation:** rates are `DERIVED`; reasons are customer-stated `OBSERVED` hypotheses; benchmarks stay `BENCHMARK`; remedy tests stay `SCENARIO`.

**Downstream:** Box 1 Your Business Pipeline / What’s Holding You Back, Conversion or Pull-Through/Fallout constraint, One Move/Plan/Evidence/Subscription.

## Conditional 14 — Economics

**Canonical mission ID:** `LO_COND_14_ECONOMICS`

**Customer question:**  
**To evaluate your income or economics goal, what are the minimum business numbers we should use?**

**Helper/example copy:**  
Use only what applies—for example compensation/revenue per funded loan, relevant variable cost per loan, fixed business cost, and whether the goal is individual, team, branch, or salary-based. Do not include personal household finances.

**Structured fields:** economic scope; compensation/revenue basis; gross amount per funded or period; variable business cost per funded; relevant fixed business cost; salary/draw/branch distinctions; units/currency; period; observed sustainable capacity; assumption source; uncertainty; sensitivity range.

**Activation:** only when the primary goal is personal/owner income, compensation/economic inputs are required for backsolve, Economics/Business Model may be primary/secondary constraint, production appears sufficient but an economic goal is materially missed, or the LO identifies economics/compensation as a concern.

**Skip:** when economics is not material or compatible governed evidence already satisfies the minimum calculation. Never interrogate personal finances or assume compensation structure.

**Evidence expectation:** supplied business economics are customer-stated `OBSERVED`; calculated contribution/current economics are `DERIVED`; required economics are `MODELED_REQUIREMENT`; alternatives are `SCENARIO`.

**Downstream:** Box 1 Your Business Now / What’s Holding You Back, backsolve, Economics constraint, capacity feasibility, Futures/One Move/Plan/Subscription.

## Conditional 15 — Contradiction Clarification

**Canonical mission ID:** `LO_COND_15_CONTRADICTION_CLARIFICATION`

**Customer question:**  
**These answers do not line up: [claim A] and [claim B]. Which is correct, or are they measuring different things?**

**Helper/example copy:**  
We will make one clarification attempt. If you are not sure, say so—we will preserve the uncertainty rather than average or choose for you.

**Structured fields:** conflicting evidence IDs; conflict type (definition, period, cohort, unit, subject scope, purpose, attribution, duplicate value); bounded explanation; corrected value/definition/scope if supplied; supersession link; customer confirmation; resolution state; provenance; unresolved reason.

**Activation:** one bounded attempt only when a material contradiction would change diagnosis, sufficiency, constraint, or backsolve.

**Skip:** no material contradiction; immaterial conflict; already governed resolution; or prior bounded attempt unresolved. If unresolved, preserve both claims/contradiction and move on.

**Evidence expectation:** original claims remain preserved; a correction becomes new customer-confirmed `OBSERVED` evidence with supersession lineage. Unresolved arithmetic outputs become `MISSING` with contradiction reason.

**Downstream:** evidence integrity, Box 1 contradiction state, abstention, next-evidence request, Business Twin/Subscription provenance.

**Derived without another question:** resolution status and affected-calculation invalidation.
