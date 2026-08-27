import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { validatePublicationHash } from '../afw05/contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function initialLivingStateFromBusinessTwin(viewModel) {
  const plan = viewModel?.destinations?.plan;
  if (!plan?.goal || !Array.isArray(plan.ways) || plan.ways.length !== 3) throw new TypeError('AFW06_BUSINESS_TWIN_PLAN_REQUIRED');
  return deepFreeze({
    WHERE_YOU_ARE: { accepted_changes: {} },
    FIVE_FUTURES: { customer_challenges: [] },
    ONE_MOVE: { customer_challenges: [] },
    plan_135: {
      goal: plan.goal.title,
      ways: plan.ways.map((way, index) => ({
        title: way.title,
        strategies: index === 0 ? plan.strategies.map((strategy) => strategy.title) : [],
      })),
    },
    EVIDENCE: { accepted_changes: {}, corrections: [] },
    engagement: { commitments: [], interventions: [], outcomes: [] },
  });
}

function applyPlan(viewModel, plan) {
  viewModel.destinations.plan.goal.title = plan.goal;
  viewModel.destinations.plan.headline = plan.goal;
  viewModel.destinations.plan.ways = plan.ways.map((way, index) => ({
    status: way.title && way.strategies.length === 5 ? 'SELECTED_COMPLETE' : 'OPEN',
    title: way.title,
    destinationState: way.title ? `Five accepted strategies now support ${way.title.toLowerCase()}.` : null,
    whyPriority: index === 0 ? viewModel.destinations.plan.ways[0]?.whyPriority : 'Added through an explicit customer-confirmed Living Twin update.',
    livingStrategies: [...way.strategies],
  }));
  viewModel.destinations.plan.completion = {
    goal: Boolean(plan.goal),
    way1: Boolean(plan.ways[0]?.title && plan.ways[0].strategies.length === 5),
    way2: Boolean(plan.ways[1]?.title && plan.ways[1].strategies.length === 5),
    way3: Boolean(plan.ways[2]?.title && plan.ways[2].strategies.length === 5),
  };
  const planCard = viewModel.layer0.cards.find((card) => card.id === 'plan');
  if (plan.complete) {
    viewModel.destinations.plan.subhead = 'One goal. Three ways to get there. Five accepted strategies for each way.';
    planCard.value = 'Your full 1–3–5 is now complete.';
    planCard.qualifier = 'One goal. Three ways. Five strategies for each way—kept current through confirmed changes.';
  }
}

function applyEvidence(viewModel, publication) {
  const accepted = Object.entries(publication.five_boxes.EVIDENCE.accepted_changes);
  const where = Object.entries(publication.five_boxes.WHERE_YOU_ARE.accepted_changes);
  const additions = [...where, ...accepted];
  if (!additions.length) return;
  const known = viewModel.destinations.evidence.categories.find((category) => category.id === 'known');
  if (known) known.value += additions.length;
  const card = viewModel.layer0.cards.find((item) => item.id === 'evidence');
  const cardKnown = card?.items?.find((item) => item.label === 'Things we know');
  if (cardKnown) cardKnown.value += additions.length;
  if (card && cardKnown) card.value = `${cardKnown.value} things known`;
  viewModel.destinations.evidence.livingAcceptedChanges = additions.map(([field, value]) => ({ field, value }));
}

function projectRelationshipHistory(records, publication) {
  const activeIds = new Set(publication.active_personal_rsl_event_ids || []);
  const displayValue = (value) => {
    if (typeof value === 'string') return value;
    if (value == null) return null;
    if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(' · ');
    if (typeof value === 'object') {
      const title = typeof value.title === 'string' ? value.title : null;
      const strategies = Array.isArray(value.strategies) ? value.strategies.map(displayValue).filter(Boolean) : [];
      return [title, ...strategies].filter(Boolean).join(' · ') || 'Structured confirmed update';
    }
    return String(value);
  };
  const displayItem = (item) => {
    if (/^plan_135\.way_[123]$/u.test(item?.field || '') && typeof item?.value === 'string') {
      try { return displayValue(JSON.parse(item.value)); } catch { return displayValue(item.value); }
    }
    return displayValue(item?.value);
  };
  const labelFor = (eventType) => {
    if (['COMMITMENT', 'DECISION', 'PLAN_CHANGE'].includes(eventType)) return 'Agreed';
    if (['ATTEMPT', 'INTERVENTION'].includes(eventType)) return 'Attempted';
    if (['OUTCOME', 'VALIDATION', 'FALSIFICATION'].includes(eventType)) return 'Outcome';
    if (['CORRECTION', 'EVIDENCE_CORRECTED', 'STATE_CHANGE'].includes(eventType)) return 'Changed';
    return 'Learned';
  };
  return (records || [])
    .map((record) => record?.event)
    .filter((event) => event && activeIds.has(event.event_id))
    .sort((left, right) => right.effective_at.localeCompare(left.effective_at) || right.recorded_at.localeCompare(left.recorded_at))
    .map((event) => ({
      eventId: event.event_id,
      kind: labelFor(event.event_type),
      eventType: event.event_type,
      happenedAt: event.effective_at,
      title: event.semantic_payload?.summary || 'Confirmed relationship update',
      details: (event.semantic_payload?.items || []).map(displayItem).filter(Boolean),
      source: event.source_class === 'CUSTOMER_SELF_REPORT' ? 'You confirmed this with MORE' : 'Private MORE relationship evidence',
    }));
}

export function projectLivingPublicationToBusinessTwin({ base_view_model, publication, personal_rsl_records = [] }) {
  if (!base_view_model || !validatePublicationHash(publication)) throw new TypeError('AFW06_VALIDATED_PUBLICATION_REQUIRED');
  const viewModel = clone(base_view_model);
  applyPlan(viewModel, publication.five_boxes.PLAN_135);
  applyEvidence(viewModel, publication);
  viewModel.destinations.evidence.relationshipHistory = {
    items: projectRelationshipHistory(personal_rsl_records, publication),
    sourceBoundary: 'Private MORE relationship history includes only governed, customer-confirmed Personal RSL events.',
    coachingBoundary: 'Coaching Notes, Coach Connect history, and coach reports are not connected to this Subscription history.',
  };
  viewModel.destinations.where.livingAcceptedChanges = clone(publication.five_boxes.WHERE_YOU_ARE.accepted_changes);
  viewModel.destinations.futures.livingChallenges = clone(publication.five_boxes.FIVE_FUTURES.customer_challenges);
  viewModel.destinations.move.livingChallenges = clone(publication.five_boxes.ONE_MOVE.customer_challenges);
  viewModel.hero.modelDate = publication.publication_version === 1
    ? `${viewModel.hero.modelDate} · Living relationship ready`
    : `Living update ${publication.publication_version - 1} · ${new Date(publication.published_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
  viewModel.hero.subtitle = 'One living map. Five destinations. One continuous business relationship.';
  viewModel.livingMap = {
    active: true,
    headline: 'Your Business Twin is alive and current.',
    copy: publication.publication_version === 1
      ? 'Talk naturally with MORE. Nothing changes until you explicitly confirm it.'
      : 'The map now reflects your last confirmed change. Keep talking from this new state.',
    action: 'Talk with MORE',
  };
  viewModel.livingState = {
    active: true,
    publicationId: publication.publication_id,
    publicationVersion: publication.publication_version,
    changedObjects: clone(publication.changed_governed_objects),
    planComplete: publication.completeness.plan_135_complete,
    noLayer3: true,
  };
  return deepFreeze(viewModel);
}
