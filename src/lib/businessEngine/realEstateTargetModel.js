/**
 * Canonical real-estate target model.
 *
 * Implements MORE real-estate doctrine from REAL_ESTATE_BUSINESS_MODEL_V1 §5.1:
 * directional relationship economics (working heuristic, not law).
 *
 * 250 True Relationships ≈ $125,000 annual income
 * 500 True Relationships ≈ $250,000 annual income
 * 1,000 True Relationships ≈ $500,000 annual income
 * 2,000 True Relationships ≈ $1,000,000 annual income
 *
 * Implied ratio: 1 true relationship ≈ $500 annual income potential.
 * Always modeled_not_guaranteed.
 */

import { makeProvenance } from './intelligenceField.js';
import { isGoalAvailable } from './goalIntelligence.js';

/** Doctrine: income potential per true relationship (USD / year). */
export const INCOME_PER_TRUE_RELATIONSHIP = 500;

/** Canonical table from REAL_ESTATE_BUSINESS_MODEL_V1 §5.1 */
export const TRUE_RELATIONSHIP_INCOME_TABLE = Object.freeze([
  { true_relationships: 250, annual_income: 125000 },
  { true_relationships: 500, annual_income: 250000 },
  { true_relationships: 1000, annual_income: 500000 },
  { true_relationships: 2000, annual_income: 1000000 },
]);

/**
 * Round relationship targets to avoid unsupported precision.
 * Keeps whole numbers; prefers multiples of 25 above 100.
 */
export function boundRelationshipTarget(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (raw < 50) return Math.round(raw);
  if (raw < 200) return Math.round(raw / 5) * 5;
  if (raw < 1000) return Math.round(raw / 25) * 25;
  return Math.round(raw / 50) * 50;
}

/**
 * Map income/GCI → target true relationships using doctrine ratio,
 * snapping to table anchors when within 5% of a known row.
 */
export function targetTrueRelationshipsFromIncome(income) {
  if (!Number.isFinite(income) || income <= 0) return null;
  for (const row of TRUE_RELATIONSHIP_INCOME_TABLE) {
    const delta = Math.abs(row.annual_income - income) / row.annual_income;
    if (delta <= 0.05) {
      return {
        value: row.true_relationships,
        calculation_basis: 'doctrine_table_anchor',
        table_row: row,
        raw: income / INCOME_PER_TRUE_RELATIONSHIP,
      };
    }
  }
  const raw = income / INCOME_PER_TRUE_RELATIONSHIP;
  const value = boundRelationshipTarget(raw);
  return {
    value,
    calculation_basis: 'income_per_true_relationship_ratio',
    table_row: null,
    raw,
  };
}

export function incomeFromTrueRelationships(count) {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count * INCOME_PER_TRUE_RELATIONSHIP;
}

function metricNumber(metric) {
  if (Number.isFinite(metric)) return metric;
  if (metric && typeof metric === 'object') {
    if (Number.isFinite(metric.value)) return metric.value;
    if (metric.range && Number.isFinite(metric.low) && Number.isFinite(metric.high)) {
      return (metric.low + metric.high) / 2;
    }
  }
  return null;
}

function emptyTarget(overrides = {}) {
  return {
    target_true_relationships: null,
    target_total_contacts: null,
    target_income: null,
    target_gci: null,
    target_production: null,
    target_units: null,
    target_operating_capacity: null,
    calculation_basis: null,
    assumptions: [],
    confidence: null,
    evidence_sources: [],
    provenance: makeProvenance({
      source_artifact: 'real_estate_target_model',
      source_path: 'honest_absence',
      source_rank: 5,
      notes: 'No target model inputs',
    }),
    modeled_not_guaranteed: true,
    goal_source: 'unavailable',
    fallback_used: true,
    fallback_reason: 'no_goal_or_relationship_target_evidence',
    ...overrides,
  };
}

/**
 * Build canonical real-estate target model from goal intelligence + metrics.
 */
export function buildRealEstateTargetModel({
  goal = null,
  metrics = {},
  answers = {},
  lastUpdated = null,
} = {}) {
  const assumptions = [
    'Directional relationship economics from MORE real-estate doctrine',
    `Approximately $${INCOME_PER_TRUE_RELATIONSHIP} annual income potential per true relationship`,
    'Assumes competent conversion, market relevance, and relationship quality — not a guarantee',
  ];
  const evidence = [];

  // 1) Explicit true-relationship / relationship-base target from metrics or goal
  const explicitTarget = metrics.relationshipTarget;
  const explicitN = metricNumber(explicitTarget);
  if (Number.isFinite(explicitN) && explicitN >= 10) {
    const isRange =
      explicitTarget &&
      typeof explicitTarget === 'object' &&
      explicitTarget.range &&
      Number.isFinite(explicitTarget.low) &&
      Number.isFinite(explicitTarget.high);

    // Prefer income-derived when income goal is clean AND explicit target looks like total-db
    // only if income goal exists and no "true relationship" language — keep explicit when present.
    let target_income = null;
    let target_gci = null;
    if (isGoalAvailable(goal) && (goal.goal_type === 'annual_income' || goal.goal_type === 'gci')) {
      if (goal.goal_type === 'gci') target_gci = goal.goal_value;
      else target_income = goal.goal_value;
      evidence.push(...(goal.evidence_sources || []));
    } else {
      target_income = incomeFromTrueRelationships(explicitN);
    }

    evidence.push({
      artifact: 'business_assessment_intake',
      path: 'answers.q2|relationship target language',
      value: isRange
        ? `${explicitTarget.low}–${explicitTarget.high}`
        : String(Math.round(explicitN)),
    });

    return {
      target_true_relationships: isRange
        ? {
            value: explicitN,
            low: explicitTarget.low,
            high: explicitTarget.high,
            range: true,
            estimated: Boolean(explicitTarget.estimated),
            unit: 'true_relationships',
            source: explicitTarget.source || 'Extracted',
          }
        : {
            value: boundRelationshipTarget(explicitN) || Math.round(explicitN),
            estimated: Boolean(explicitTarget?.estimated),
            unit: 'true_relationships',
            source: explicitTarget?.source || 'Extracted',
          },
      target_total_contacts: null,
      target_income: Number.isFinite(target_income)
        ? { value: target_income, estimated: true, unit: 'usd', source: 'modeled' }
        : null,
      target_gci: Number.isFinite(target_gci)
        ? { value: target_gci, estimated: false, unit: 'usd', source: goal?.goal_source || 'declared' }
        : null,
      target_production:
        isGoalAvailable(goal) && goal.goal_type === 'production'
          ? { value: goal.goal_value, estimated: false, unit: 'usd', source: 'declared' }
          : null,
      target_units:
        isGoalAvailable(goal) && goal.goal_type === 'units'
          ? { value: goal.goal_value, estimated: false, unit: 'units', source: 'declared' }
          : null,
      target_operating_capacity: null,
      calculation_basis: 'explicit_relationship_or_database_target',
      assumptions,
      confidence: goal?.goal_confidence || 'medium',
      evidence_sources: evidence,
      provenance: makeProvenance({
        source_artifact: 'real_estate_target_model',
        source_path: 'explicit_relationship_target',
        source_rank: 1,
        notes: 'Declared relationship/database target from assessment',
      }),
      modeled_not_guaranteed: true,
      goal_source: goal?.goal_source || 'declared',
      fallback_used: false,
      fallback_reason: null,
      last_updated: lastUpdated,
    };
  }

  // 2) Income / GCI goal → doctrine true relationships
  if (
    isGoalAvailable(goal) &&
    (goal.goal_type === 'annual_income' || goal.goal_type === 'gci')
  ) {
    const mapped = targetTrueRelationshipsFromIncome(goal.goal_value);
    if (mapped?.value) {
      evidence.push(...(goal.evidence_sources || []));
      return {
        target_true_relationships: {
          value: mapped.value,
          estimated: true,
          unit: 'true_relationships',
          source: goal.goal_source === 'declared' ? 'goal_doctrine_model' : 'inferred_goal_doctrine_model',
          display_prefix: '~',
        },
        target_total_contacts: null,
        target_income:
          goal.goal_type === 'annual_income'
            ? { value: goal.goal_value, estimated: false, unit: 'usd', source: goal.goal_source }
            : {
                value: goal.goal_value,
                estimated: true,
                unit: 'usd',
                source: 'gci_used_as_income_proxy',
              },
        target_gci:
          goal.goal_type === 'gci'
            ? { value: goal.goal_value, estimated: false, unit: 'usd', source: goal.goal_source }
            : null,
        target_production: null,
        target_units: null,
        target_operating_capacity: null,
        calculation_basis: mapped.calculation_basis,
        assumptions: assumptions.concat([
          `Goal ${goal.goal_summary || goal.goal_value} → ~${mapped.value} true relationships`,
        ]),
        confidence: goal.goal_confidence || 'medium',
        evidence_sources: evidence,
        provenance: makeProvenance({
          source_artifact: 'real_estate_target_model',
          source_path: 'goal_income_to_true_relationships',
          source_rank: 2,
          notes: 'Doctrine ratio / table; modeled not guaranteed',
        }),
        modeled_not_guaranteed: true,
        goal_source: goal.goal_source,
        fallback_used: goal.goal_source !== 'declared',
        fallback_reason:
          goal.goal_source !== 'declared' ? 'target_from_inferred_goal' : null,
        last_updated: lastUpdated,
      };
    }
  }

  // 3) Production goal → bounded income proxy only when conversion evidence exists
  if (isGoalAvailable(goal) && goal.goal_type === 'production') {
    // Without commission rate, do not invent GCI. Provide production target only;
    // relationship target remains unavailable unless ASP/commission evidence exists.
    const aspMatch = String(answers.q9 || '').match(
      /average\s+sells?\s+price\s*\$?\s*([\d,.]+)/i
    );
    const asp = aspMatch ? Number(String(aspMatch[1]).replace(/,/g, '')) : null;
    // Optional bounded path: if volume goal and ASP known, units = volume/ASP;
    // still do not invent income without commission — relationship target unavailable.
    void asp;
    return {
      ...emptyTarget({
        target_production: {
          value: goal.goal_value,
          estimated: false,
          unit: 'usd',
          source: goal.goal_source,
        },
        calculation_basis: 'production_goal_without_safe_relationship_conversion',
        assumptions: assumptions.concat([
          'Production goal present; true-relationship target not invented without income/GCI or commission evidence',
        ]),
        confidence: 'low',
        evidence_sources: goal.evidence_sources || [],
        provenance: makeProvenance({
          source_artifact: 'real_estate_target_model',
          source_path: 'production_goal_bounded',
          source_rank: 3,
          notes: 'No unsupported precision on relationship target',
        }),
        goal_source: goal.goal_source,
        fallback_used: true,
        fallback_reason: 'production_goal_lacks_safe_relationship_conversion',
        last_updated: lastUpdated,
      }),
    };
  }

  // 4) Units goal → bounded; relationship target only with strong economic evidence
  if (isGoalAvailable(goal) && goal.goal_type === 'units') {
    return {
      ...emptyTarget({
        target_units: {
          value: goal.goal_value,
          estimated: false,
          unit: 'units',
          source: goal.goal_source,
        },
        calculation_basis: 'units_goal_without_safe_relationship_conversion',
        assumptions: assumptions.concat([
          'Units goal present; true-relationship target not invented without income/GCI linkage',
        ]),
        confidence: 'low',
        evidence_sources: goal.evidence_sources || [],
        provenance: makeProvenance({
          source_artifact: 'real_estate_target_model',
          source_path: 'units_goal_bounded',
          source_rank: 3,
          notes: 'Avoid false precision from units alone',
        }),
        goal_source: goal.goal_source,
        fallback_used: true,
        fallback_reason: 'units_goal_lacks_safe_relationship_conversion',
        last_updated: lastUpdated,
      }),
    };
  }

  // 5) Relationship-base goal type from goal intelligence
  if (isGoalAvailable(goal) && goal.goal_type === 'relationship_base') {
    const value = boundRelationshipTarget(goal.goal_value) || goal.goal_value;
    return {
      target_true_relationships: {
        value,
        estimated: true,
        unit: 'true_relationships',
        source: 'inferred',
      },
      target_total_contacts: null,
      target_income: {
        value: incomeFromTrueRelationships(value),
        estimated: true,
        unit: 'usd',
        source: 'modeled',
      },
      target_gci: null,
      target_production: null,
      target_units: null,
      target_operating_capacity: null,
      calculation_basis: 'relationship_base_goal',
      assumptions,
      confidence: goal.goal_confidence || 'medium',
      evidence_sources: goal.evidence_sources || [],
      provenance: makeProvenance({
        source_artifact: 'real_estate_target_model',
        source_path: 'relationship_base_goal',
        source_rank: 2,
      }),
      modeled_not_guaranteed: true,
      goal_source: goal.goal_source || 'inferred',
      fallback_used: false,
      fallback_reason: null,
      last_updated: lastUpdated,
    };
  }

  return emptyTarget({ last_updated: lastUpdated });
}

export function computeRelationshipGap(currentMetric, targetMetric) {
  const current = metricNumber(currentMetric);
  const target = metricNumber(targetMetric);
  if (!Number.isFinite(current) || !Number.isFinite(target)) return null;
  const estimated =
    Boolean(currentMetric && typeof currentMetric === 'object' && currentMetric.estimated) ||
    Boolean(targetMetric && typeof targetMetric === 'object' && targetMetric.estimated);
  return {
    value: Math.max(0, Math.round(target - current)),
    estimated,
    unit: 'true_relationships',
    source: 'calculated',
  };
}

export default buildRealEstateTargetModel;
