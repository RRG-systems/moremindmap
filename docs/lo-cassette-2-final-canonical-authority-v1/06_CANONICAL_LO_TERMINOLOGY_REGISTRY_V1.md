# Canonical LO Definitions and Terminology Registry V1

Registry ID: `loan-originator-business-event-definitions-v1`  
Status: canonical authority; not runtime implementation authority.

## Customer-facing terms

### Loan Originator / LO

A producing residential mortgage professional who is accountable for creating and/or converting mortgage Opportunities into funded loans within an applicable company/platform model. V1 does not silently extend this term to non-producing operations or corporate leadership roles.

### Opportunity

An identifiable person or household with a plausible current mortgage need who entered the LO's business through a professional/business source, Customer Relationship Network, company/direct channel, or self-generated activity.

Not automatically an Opportunity: a Realtor contact, past customer sitting in a CRM, email recipient, social impression, generic purchased name, or other contact without a meaningful mortgage-need signal.

### Source relationship

A professional/business relationship that may repeatedly create Opportunities. It is not the borrower Opportunity and not automatically productive.

### Opportunity Source Network (OSN)

The professional/business relationships and applicable company/direct/digital channels that repeatedly create mortgage Opportunities. Examples may include Realtor partners, builders, financial professionals, other professional referrals, company/branch opportunities, direct/digital sources, and self-generated activity. Examples do not imply Realtor primacy.

### Customer Relationship Network (CRN)

Past/current borrowers or customers whose continuing relationship can create repeat Purchase, Refinance, or friends/family referral Opportunities. Past-customer referral provenance remains CRN even when the resulting borrower Opportunity enters a funnel.

### Active / engaged / productive

These remain raw, periodized measures under this registry. No universal threshold is silently imposed.

- Active/engaged: the customer-defined, measurable relationship/channel activity within an explicit window.
- Productive: observed attributable Opportunity or funded outcome within an explicit window.

### System

A repeatable, measurable way work happens with at least who, what, how often, how delivered, owner, and measure/outcome. A CRM or other tool is infrastructure, not proof of a system.

## Purpose and funnel terms

### Purchase path

`Opportunity → Application → Qualified/Preapproved → Active Purchase Transaction → Approval → Lock → Close/Fund`

### Refinance path

`Opportunity → Application → Qualified → Active Refinance Loan → Approval → Lock → Close/Fund`

### Application

A customer/company-declared business event recorded under an explicit definition/alias. This registry does not equate TRID, HMDA, LOS, or complete-file meanings without customer/platform definition.

### Qualified / Preapproved

A purpose-applicable aggregate stage recognized by the LO/company under an explicit definition. It is a business-funnel event, not MORE underwriting or credit judgment.

### Active Purchase Transaction

A Purchase opportunity with an active property/transaction context under the declared company definition.

### Active Refinance Loan

A Refinance opportunity actively proceeding as a loan under the declared company definition. Purchase-only property stages are not manufactured.

### Approval / Lock / Close / Fund

Each is a declared aggregate event. `Close/Fund` is the canonical terminal surface label, but the stored definition preserves whether the company uses closing, funding, disbursement, or another completed-event alias. Rescission/table-funding/jurisdiction differences are not silently normalized.

### Conversion / pull-through / fallout / cycle

- Conversion: compatible stage-B ÷ stage-A for the same purpose/cohort/definition.
- Pull-through: compatible later-stage outcome ÷ earlier-stage count for a mature cohort.
- Fallout: explicit non-progression/outcome or compatible residual, never guessed from incompatible counts.
- Cycle: elapsed time between declared events for a compatible cohort; aggregate only.

## Truth and reasoning terms

### Primary business baseline

Trailing 12 months under explicit as-of date, definition, subject, unit, purpose, and cohort basis.

### Current trajectory

Trailing 90 days under compatible evidence. It is directional and may be immature/seasonal; it is not automatically an annual forecast.

### Opportunity sufficiency

Whether compatible current mature Opportunity flow appears sufficient for the governed goal under visible conversion, assumptions, feasibility, and sensitivity.

### Primary constraint

The best-supported current limiter between governed current reality and the stated goal. It is not necessarily the sole cause. No primary constraint is forced.

### Secondary constraint

A supported material limiter or risk that is not currently the highest-leverage bottleneck.

### One Move

What the person can do right now that is most likely to create the greatest positive downstream effects taking them toward a better future.

## Evidence terms

- `OBSERVED`: governed reported/measured customer-specific reality with provenance.
- `DERIVED`: deterministic calculation from compatible observed inputs.
- `MODELED_REQUIREMENT`: calculated requirement for a goal under visible assumptions.
- `BENCHMARK`: external comparison, never customer truth.
- `SCENARIO`: explicit what-if assumption.
- `MISSING`: required truth not known or unsafe to claim.
- `ANSWERED`: customer supplied a governed response.
- `UNANSWERED`: no governed response; not a negative/zero.
- `NOT_APPLICABLE`: explicitly irrelevant under the governed purpose/scope.
- `CONTRADICTORY`: two or more preserved claims cannot all support the same conclusion without clarification.

## Protected namespace distinctions

- BOS `Perspective`: behavioral long-horizon coordinate.
- MVVBP/business `Perspective`: governed current business reality.
- E→P: operating-system maturity, never personality worth or BOS score.
- Operator diagnosis: customer-stated hypothesis, never automatically causal truth.
- Platform capability: business condition/control-owner evidence, never Recruiting authority.
