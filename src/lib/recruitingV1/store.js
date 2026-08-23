const clone = (value) => JSON.parse(JSON.stringify(value));

function normalizeMembership(item) {
  const status = item?.status || 'ACTIVE';
  return {
    ...clone(item),
    status,
    setup_state: item?.setup_state || (status === 'ACTIVE' ? 'COMPLETE' : 'NOT_SENT'),
    entitlement_mode: item?.entitlement_mode || '5_per_month',
    admin_roles: Array.isArray(item?.admin_roles) ? [...item.admin_roles] : [],
    recruiting_governance: item?.recruiting_governance || { all_enterprises: false, enterprise_ids: [item?.enterprise_id].filter(Boolean) },
  };
}

export function createEmptyRecruitingState(memberships = []) {
  return {
    version: 2,
    memberships: Object.fromEntries(memberships.map((item) => [item.membership_id, normalizeMembership(item)])),
    manager_challenges: {},
    manager_sessions: {},
    manager_csrf_proofs: {},
    manager_setup_challenges: {},
    manager_setup_sessions: {},
    manager_setup_csrf_proofs: {},
    invite_sessions: {},
    invitations: {},
    opportunity_by_enterprise: {},
    evidence_by_candidate: {},
    intelligence_by_candidate: {},
    outbox: {},
    inbox_by_membership: {},
    audit: [],
  };
}

export function normalizeRecruitingState(input) {
  const empty = createEmptyRecruitingState();
  const state = input && typeof input === 'object' ? clone(input) : empty;
  for (const key of Object.keys(empty)) {
    if (state[key] === undefined) state[key] = clone(empty[key]);
  }
  state.version = 2;
  state.memberships = Object.fromEntries(Object.values(state.memberships || {}).map((item) => {
    const membership = normalizeMembership(item);
    return [membership.membership_id, membership];
  }));
  return state;
}

export class InMemoryRecruitingStore {
  constructor(initialState = createEmptyRecruitingState()) {
    this.state = normalizeRecruitingState(initialState);
    this.queue = Promise.resolve();
  }

  async read() {
    await this.queue;
    return clone(this.state);
  }

  async transaction(operation) {
    let resolveResult;
    let rejectResult;
    const result = new Promise((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.queue = this.queue.then(async () => {
      const draft = clone(this.state);
      try {
        const value = await operation(draft);
        this.state = draft;
        resolveResult(clone(value));
      } catch (error) {
        rejectResult(error);
      }
    });
    await this.queue;
    return result;
  }
}

export const RECRUITING_STORE_CONTRACT = Object.freeze({
  read: 'returns an immutable snapshot',
  transaction: 'serializes mutation and commits the whole snapshot atomically',
  canonical_bos_ba_storage: false,
});
