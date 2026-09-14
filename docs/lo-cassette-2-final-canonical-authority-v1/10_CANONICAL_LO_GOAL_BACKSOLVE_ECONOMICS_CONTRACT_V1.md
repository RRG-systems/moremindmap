# Canonical LO Goal, Backsolve, and Economics Contract V1

Authority ID: `loan-originator-goal-backsolve-economics-v1`

## Governing sequence

`chosen goal → required funded/business outcome → required mature funnel → required Applications → required Opportunities → supported source/customer-network activity where evidence permits → feasibility against systems/capacity/platform/economics`

Goal evidence precedes opportunity-sufficiency arithmetic.

## Supported goals

| Goal type | Required minimum | Conditional Economics |
| --- | --- | --- |
| funded units | target units, forward 12 months, subject/purpose scope | no, unless economics otherwise material |
| funded volume | target volume, forward 12 months, scope; average amount only if converting to units | no, unless economics otherwise material |
| personal/owner business income | target currency, economic scope, applicable business-economic inputs | yes |
| other measurable production result | explicit metric/unit/window/scope and governed conversion relationship | only when economics needed |
| narrative-only | customer goal retained; numeric backsolve unavailable | no automatic Economics screen |

## Calculation doctrine

1. Prefer compatible customer `OBSERVED` mature-cohort rates.
2. Deterministic calculations from observed inputs are `DERIVED`.
3. Goal requirements are `MODELED_REQUIREMENT` with formula, assumptions, period, cohort, sensitivity, and feasibility.
4. Missing rates may be explored only as labeled `SCENARIO` or compatible `BENCHMARK`; neither becomes customer truth.
5. Purchase and Refinance use separate rates where mechanics differ.
6. Do not backsolve through incompatible completed-window and entered-window counts.
7. Round discrete unit requirements upward and preserve unrounded calculation.
8. Do not translate required Opportunities into source-contact activity without governed source productivity evidence.

## Canonical formulas

### Funded-unit goal

`required_funded_units = goal_funded_units`

For each compatible stage pair from funded backward:

`required_prior_stage = ceil(required_later_stage / supported_stage_rate)`

### Funded-volume goal

If only volume is required, keep required volume as the modeled outcome. Convert volume to units only when a compatible observed/scenario average funded amount is explicit:

`required_units = ceil(goal_volume / average_funded_amount)`

### Income/economic goal

Only under explicit individual/team/branch/salary economic scope:

`contribution_per_funded = gross_business_amount_per_funded - variable_business_cost_per_funded`

`required_funded_units = ceil((target_business_income + relevant_fixed_business_cost) / contribution_per_funded)`

If the compensation model is salary/draw/branch or otherwise incompatible, use the applicable declared model or abstain. Personal household finances are excluded.

### Opportunity requirement

`required_opportunities = ceil(required_funded_units / supported_opportunity_to_funded_rate)`

If stage-level rates are supported, also show where the requirement changes and run sensitivity.

## 12-month baseline + 90-day trajectory

- 12-month baseline supports primary current-state comparison.
- 90-day evidence may yield a `DERIVED` current pace or change indicator only when definitions/scopes/cohorts are compatible.
- A 90-day annualized pace is not an observed annual outcome and must carry seasonality/maturity caveat.
- If 90-day trajectory conflicts materially with the 12-month baseline, preserve both; do not average them.

## Opportunity-sufficiency decision

Opportunity flow is sufficient only when the modeled requirement and governed current mature flow are comparable, with sensitivity and feasibility visible.

- Current < required range → Opportunity Gap.
- Current ≥ required range → test conversion, pull-through, systems, capacity, platform, economics, concentration, execution, and evidence before calling for scale.
- Incompatible/missing requirement or flow → Insufficient Evidence.

## Economics conditional screen

Show only when the authorization's exact trigger is met. Ask minimum business economics. Never assume compensation structure, request personal financial life, or freeze volatile compensation policy as universal authority.

## Feasibility gates

Before projecting higher required activity/production as responsible:

- test sustainable capacity and service/quality effects;
- test platform capability/control owner;
- test purpose/source concentration;
- test economic contribution and fixed/variable scope where relevant;
- label unsupported assumptions and alternatives;
- do not turn modeled requirement into a performance judgment.

## Customer communication

Display the result as an estimate under explicit assumptions, not precision theater. Make the best-supported baseline, rate sensitivity, and missing input visible. Box 1 may show a concise result; full formula/provenance remains available to Business Twin/Subscription/Evidence.
