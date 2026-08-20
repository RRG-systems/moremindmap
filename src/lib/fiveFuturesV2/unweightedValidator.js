import {
  CERTAINTY_SUPPORT_CLASSES,
  FUTURE_ROLES,
  PROHIBITED_MODEL_WEIGHT_FIELDS,
  SUPPORT_COMPONENTS,
} from './constants.js';
import { integrity } from './errors.js';

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function ensureTextArray(value, field, requireNonEmpty = false) {
  integrity(Array.isArray(value), 'MALFORMED_FUTURE_OBJECT', `${field} must be an array`);
  if (requireNonEmpty) integrity(value.length > 0, 'MALFORMED_FUTURE_OBJECT', `${field} must not be empty`);
  value.forEach((entry) => integrity(isText(entry), 'MALFORMED_FUTURE_OBJECT', `${field} must contain strings`));
}

function walk(value, callback, trail = []) {
  if (Array.isArray(value)) return value.forEach((entry, index) => walk(entry, callback, [...trail, index]));
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    callback(key, child, [...trail, key]);
    walk(child, callback, [...trail, key]);
  });
}

export function validateUnweightedFutures(unweightedFutures, context) {
  integrity(Array.isArray(unweightedFutures) && unweightedFutures.length === 5, 'MALFORMED_FUTURE_OBJECT', 'Exactly five futures are required');
  const evidenceRefs = new Set(context.evidence_refs);
  const mechanismRefs = new Set(context.causal_model.mechanisms.map((item) => item.mechanism_id));
  const seenIds = new Set();
  unweightedFutures.forEach((future, index) => {
    walk(future, (key, value, trail) => {
      if (PROHIBITED_MODEL_WEIGHT_FIELDS.includes(key)) {
        integrity(false, 'GPT_AUTHORED_NUMERICAL_WEIGHTS', `Frontier output included prohibited numerical field ${trail.join('.')}`);
      }
      void value;
      void trail;
    });
    integrity(future.future_role === FUTURE_ROLES[index], 'MALFORMED_FUTURE_OBJECT', `Future role/order mismatch at index ${index}`);
    integrity(isText(future.future_id) && !seenIds.has(future.future_id), 'MALFORMED_FUTURE_OBJECT', `Future ${index} requires unique future_id`);
    seenIds.add(future.future_id);
    for (const field of ['title', 'state_summary', 'business_state_if_realized', 'conditionality']) {
      integrity(isText(future[field]), 'MALFORMED_FUTURE_OBJECT', `${future.future_role}.${field} is required`);
    }
    for (const field of ['governing_mechanisms', 'supporting_evidence_refs', 'counterevidence_refs', 'assumptions', 'required_changes', 'leading_indicators', 'risks', 'falsifiers', 'operator_business_interactions', 'team_dependencies', 'dynamic_context_dependencies']) {
      ensureTextArray(future[field], `${future.future_role}.${field}`, ['governing_mechanisms', 'supporting_evidence_refs', 'assumptions', 'leading_indicators', 'falsifiers'].includes(field));
    }
    future.supporting_evidence_refs.forEach((ref) => integrity(evidenceRefs.has(ref), 'MALFORMED_FUTURE_OBJECT', `${future.future_role} references unknown evidence ${ref}`));
    future.counterevidence_refs.forEach((ref) => integrity(evidenceRefs.has(ref), 'MALFORMED_FUTURE_OBJECT', `${future.future_role} references unknown counterevidence ${ref}`));
    future.governing_mechanisms.forEach((ref) => integrity(mechanismRefs.has(ref), 'MALFORMED_FUTURE_OBJECT', `${future.future_role} references unknown mechanism ${ref}`));
    integrity(CERTAINTY_SUPPORT_CLASSES.includes(future.certainty_support_classification), 'MALFORMED_FUTURE_OBJECT', `${future.future_role} certainty classification is invalid`);
    integrity(future.support_signals && typeof future.support_signals === 'object', 'MALFORMED_FUTURE_OBJECT', `${future.future_role}.support_signals is required`);
    SUPPORT_COMPONENTS.forEach((component) => {
      integrity(Object.hasOwn(component.levels, future.support_signals[component.component_id]), 'MALFORMED_FUTURE_OBJECT', `${future.future_role} invalid ${component.component_id}`);
    });
    if (future.future_role === 'emerging_future') {
      integrity(future.emergence_evidence === true, 'MALFORMED_FUTURE_OBJECT', 'Emerging Future requires governed emergence evidence');
      integrity(future.leading_indicators.length > 0 && future.supporting_evidence_refs.length > 0, 'MALFORMED_FUTURE_OBJECT', 'Emerging Future requires leading indicators and evidence');
    }
    if (future.future_role === 'better_future' || future.future_role === 'bold_future') {
      integrity(future.required_changes.length > 0, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} requires a causal bridge through changes`);
    }
    if (future.future_role === 'downside_future') {
      integrity(future.risks.length > 0, 'MALFORMED_FUTURE_OBJECT', 'Downside Future requires evidence-supported risks');
    }
  });
  return Object.freeze({ status: 'PASS', future_count: 5, role_order: [...FUTURE_ROLES] });
}
