import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { sameScope, scopeFingerprint } from '../contracts.js';
import { createRelationshipEpisodeEvent, validateRelationshipEpisodeEvent } from '../lineage.js';
import { InMemoryPersonalRslStore } from '../personalRsl.js';
import { validateGovernedChangeProposal, validateProposalDecision, validatePublicationHash } from './contracts.js';
import { recomputeLivingBusinessTwin } from './recomputation.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function emptyState() {
  return {
    scope: null,
    proposals: {},
    decisions: {},
    personal_rsl_records: [],
    relationship_episode_records: [],
    publications: {},
    current_publication_hash: null,
    idempotency: {},
    transaction_count: 0,
  };
}

function restoreRslStore(records, scope) {
  const store = new InMemoryPersonalRslStore({ store_version: 'subscription_v1_afw05_transactional_v1' });
  for (const record of records) {
    const result = store.append({ scope, event: record.event, appended_at: record.envelope.appended_at });
    if (!result.ok || result.envelope.envelope_hash !== record.envelope.envelope_hash) throw new Error('AFW05_PERSONAL_RSL_SNAPSHOT_INVALID');
  }
  return store;
}

function transactionReceipt({ state, operation, proposalId, decisionId = null, priorHash = null, nextHash = null, status, occurredAt }) {
  const body = {
    contract_id: 'living_relationship_transaction_receipt',
    schema_version: '1.0.0',
    transaction_id: `living_transaction_${hashCanonicalJson({ operation, proposalId, decisionId, priorHash, nextHash, occurredAt }).slice(0, 24)}`,
    operation,
    proposal_id: proposalId,
    decision_id: decisionId,
    prior_publication_hash: priorHash,
    next_publication_hash: nextHash,
    status,
    transaction_sequence: state.transaction_count,
    committed_at: occurredAt,
    atomic_snapshot_committed: true,
    partial_publication: false,
    provider_calls: 0,
  };
  return { ...body, transaction_hash: hashCanonicalJson(body) };
}

function appendRelationshipEpisodeEventsToState({ state, scope, events, appended_at }) {
  if (!sameScope(state.scope, scope) || !Array.isArray(events) || events.some((event) => !validateRelationshipEpisodeEvent(event, scope))) {
    return { ok: false, code: 'RELATIONSHIP_EPISODE_EVENT_INVALID' };
  }
  const records = state.relationship_episode_records || [];
  for (const event of events) {
    const existing = records.find((record) => record.event.episode_event_id === event.episode_event_id);
    if (existing) {
      if (existing.event.event_hash !== event.event_hash) return { ok: false, code: 'RELATIONSHIP_EPISODE_EVENT_ID_CONFLICT' };
      continue;
    }
    const previousEnvelopeHash = records.at(-1)?.envelope_hash || null;
    const envelopeBody = {
      contract_id: 'subscription_relationship_episode_envelope_v1',
      sequence: records.length + 1,
      event_id: event.episode_event_id,
      event_hash: event.event_hash,
      previous_envelope_hash: previousEnvelopeHash,
      appended_at: new Date(appended_at).toISOString(),
    };
    records.push({ event: clone(event), ...envelopeBody, envelope_hash: hashCanonicalJson(envelopeBody) });
  }
  state.relationship_episode_records = records;
  return { ok: true, appended_event_ids: events.map((event) => event.episode_event_id) };
}

export class InMemoryLivingRelationshipStore {
  constructor(snapshot = null) {
    this.state = snapshot ? { ...emptyState(), ...clone(snapshot), relationship_episode_records: clone(snapshot.relationship_episode_records || []) } : emptyState();
    this.busy = false;
  }

  async _persistSnapshot() { return { ok: true, status: 'IN_MEMORY_COMMITTED' }; }

  async _refreshBeforeTransaction() {}

  async _releaseTransactionLock() {}

  async _withTransaction(operation) {
    if (this.busy) return deepFreeze({ ok: false, code: 'AFW05_TRANSACTION_BUSY' });
    this.busy = true;
    try {
      await this._refreshBeforeTransaction();
      const next = clone(this.state);
      const result = await operation(next);
      if (!result?.commit) return deepFreeze(result?.response || { ok: false, code: 'AFW05_TRANSACTION_ABORTED' });
      const persisted = await this._persistSnapshot(next);
      if (!persisted?.ok) return deepFreeze({ ok: false, code: 'AFW05_DURABLE_SNAPSHOT_FAILED', detail: persisted?.status || null });
      this.state = next;
      return deepFreeze({ ...result.response, persistence_status: persisted.status });
    } finally {
      await this._releaseTransactionLock();
      this.busy = false;
    }
  }

  async initialize({ scope, publication }) {
    return this._withTransaction(async (next) => {
      if (!validatePublicationHash(publication) || !sameScope(scope, publication.scope)) return { commit: false, response: { ok: false, code: 'AFW05_INITIAL_PUBLICATION_INVALID' } };
      if (next.scope && !sameScope(next.scope, scope)) return { commit: false, response: { ok: false, code: 'AFW05_STORE_SCOPE_DENIED' } };
      if (next.current_publication_hash) {
        const current = next.publications[next.current_publication_hash];
        return { commit: false, response: current.publication_hash === publication.publication_hash
          ? { ok: true, code: 'IDEMPOTENT_REPLAY', publication: current }
          : { ok: false, code: 'AFW05_ALREADY_INITIALIZED' } };
      }
      next.scope = clone(scope);
      next.publications[publication.publication_hash] = clone(publication);
      next.current_publication_hash = publication.publication_hash;
      next.transaction_count += 1;
      const receipt = transactionReceipt({ state: next, operation: 'INITIALIZE', proposalId: null, nextHash: publication.publication_hash, status: 'INITIALIZED', occurredAt: publication.published_at });
      return { commit: true, response: { ok: true, code: 'AFW05_LIVING_STORE_INITIALIZED', publication, receipt } };
    });
  }

  async saveProposal({ scope, proposal, saved_at, relationship_episode_events = [] }) {
    return this._withTransaction(async (next) => {
      const validation = validateGovernedChangeProposal(proposal);
      if (!validation.valid || !sameScope(scope, proposal.scope) || !sameScope(next.scope, scope)) return { commit: false, response: { ok: false, code: 'AFW05_PROPOSAL_STORE_DENIED' } };
      if (!Array.isArray(relationship_episode_events)) return { commit: false, response: { ok: false, code: 'RELATIONSHIP_EPISODE_EVENT_INVALID' } };
      const existing = next.proposals[proposal.proposal_id];
      if (existing) return { commit: false, response: existing.proposal.proposal_hash === proposal.proposal_hash
        ? { ok: true, code: 'IDEMPOTENT_REPLAY', proposal: existing.proposal }
        : { ok: false, code: 'AFW05_PROPOSAL_ID_CONFLICT' } };
      next.proposals[proposal.proposal_id] = { proposal: clone(proposal), workflow_status: proposal.status, persisted_at: saved_at, decision_id: null, canonical_event_id: null };
      const episodeAppend = appendRelationshipEpisodeEventsToState({ state: next, scope, events: relationship_episode_events, appended_at: saved_at });
      if (!episodeAppend.ok) return { commit: false, response: episodeAppend };
      next.transaction_count += 1;
      return { commit: true, response: { ok: true, code: 'AFW05_PROPOSAL_DURABLY_STAGED', proposal, relationship_episode_event_ids: episodeAppend.appended_event_ids } };
    });
  }

  async appendRelationshipEpisodeEvents({ scope, events, appended_at }) {
    return this._withTransaction(async (next) => {
      if (!sameScope(next.scope, scope) || !Array.isArray(events) || !events.length) return { commit: false, response: { ok: false, code: 'RELATIONSHIP_EPISODE_APPEND_DENIED' } };
      const episodeAppend = appendRelationshipEpisodeEventsToState({ state: next, scope, events, appended_at });
      if (!episodeAppend.ok) return { commit: false, response: episodeAppend };
      next.transaction_count += 1;
      return { commit: true, response: { ok: true, code: 'RELATIONSHIP_EPISODE_EVENTS_APPENDED', appended_event_ids: episodeAppend.appended_event_ids, canonical_customer_truth_mutated: false, personal_rsl_mutated: false } };
    });
  }

  async commitDecision({ scope, proposal, decision, event = null, derived_events = [], idempotency_key, committed_at }) {
    return this._withTransaction(async (next) => {
      const decisionValidation = validateProposalDecision(decision, proposal);
      if (!decisionValidation.valid || !sameScope(next.scope, scope) || !sameScope(proposal.scope, scope)) return { commit: false, response: { ok: false, code: 'AFW05_DECISION_STORE_DENIED', errors: decisionValidation.errors } };
      const staged = next.proposals[proposal.proposal_id];
      if (!staged || staged.proposal.proposal_hash !== proposal.proposal_hash) return { commit: false, response: { ok: false, code: 'AFW05_STAGED_PROPOSAL_REQUIRED' } };
      const semanticHash = hashCanonicalJson({ proposal_hash: proposal.proposal_hash, decision_hash: decision.decision_hash, event_hash: event?.content_hash || null, derived_event_hashes: derived_events.map((item) => item.content_hash) });
      const existing = next.idempotency[idempotency_key];
      if (existing) return { commit: false, response: existing.semantic_hash === semanticHash
        ? { ok: true, code: 'IDEMPOTENT_REPLAY', ...clone(existing.result) }
        : { ok: false, code: 'AFW05_IDEMPOTENCY_CONFLICT' } };
      const prior = next.publications[next.current_publication_hash];
      if (!prior || prior.publication_version !== decision.expected_prior_publication_version
        || prior.publication_hash !== decision.expected_prior_publication_hash) {
        return { commit: false, response: { ok: false, code: 'AFW05_STALE_PROPOSAL_REEVALUATION_REQUIRED', current_publication_version: prior?.publication_version || null, current_publication_hash: prior?.publication_hash || null } };
      }
      if (next.decisions[decision.decision_id]) return { commit: false, response: { ok: false, code: 'AFW05_DECISION_ID_CONFLICT' } };
      next.decisions[decision.decision_id] = clone(decision);
      if (!decision.mutation_authorized) {
        next.proposals[proposal.proposal_id] = { ...staged, workflow_status: decision.decision === 'REJECT' ? 'REJECTED' : 'DEFERRED', decision_id: decision.decision_id };
        next.transaction_count += 1;
        const receipt = transactionReceipt({ state: next, operation: 'DECIDE_NO_MUTATION', proposalId: proposal.proposal_id, decisionId: decision.decision_id, priorHash: prior.publication_hash, nextHash: prior.publication_hash, status: decision.decision, occurredAt: committed_at });
        const response = { mutation_performed: false, publication: clone(prior), receipt };
        next.idempotency[idempotency_key] = { semantic_hash: semanticHash, result: clone(response) };
        return { commit: true, response: { ok: true, code: `AFW05_PROPOSAL_${decision.decision}`, ...response } };
      }
      if (!event || !sameScope(event.scope, scope) || event.confirmation_event_id !== decision.decision_id) return { commit: false, response: { ok: false, code: 'AFW05_CONFIRMED_EVENT_REQUIRED' } };
      let rsl;
      try { rsl = restoreRslStore(next.personal_rsl_records, scope); } catch (error) { return { commit: false, response: { ok: false, code: error.message } }; }
      const appended = rsl.append({ scope, event, appended_at: committed_at });
      if (!appended.ok) return { commit: false, response: { ok: false, code: appended.code } };
      for (const derivedEvent of derived_events) {
        if (!sameScope(derivedEvent?.scope, scope) || derivedEvent?.source_class !== 'DETERMINISTIC_RUNTIME'
          || !['CONFIDENCE_CHANGE', 'VALIDATION', 'FALSIFICATION'].includes(derivedEvent?.event_type)) {
          return { commit: false, response: { ok: false, code: 'AFW05_DERIVED_LINEAGE_EVENT_DENIED' } };
        }
        const sourceIds = derivedEvent.semantic_payload?.derived_from_event_ids || [];
        const availableIds = new Set([...rsl.read({ scope }).records.map((record) => record.event.event_id)]);
        if (!sourceIds.length || sourceIds.some((id) => !availableIds.has(id))) return { commit: false, response: { ok: false, code: 'AFW05_DERIVED_LINEAGE_SOURCE_INVALID' } };
        const derivedAppend = rsl.append({ scope, event: derivedEvent, appended_at: committed_at });
        if (!derivedAppend.ok) return { commit: false, response: { ok: false, code: derivedAppend.code } };
      }
      const replay = rsl.replay({ scope, effective_as_of: committed_at, recorded_as_of: committed_at });
      if (!replay.ok) return { commit: false, response: replay };
      const recomputed = recomputeLivingBusinessTwin({ prior_publication: prior, personal_rsl_replay: replay, published_at: committed_at });
      if (!recomputed.ok) return { commit: false, response: recomputed };
      next.personal_rsl_records = clone(rsl.read({ scope }).records);
      next.publications[recomputed.publication.publication_hash] = clone(recomputed.publication);
      next.current_publication_hash = recomputed.publication.publication_hash;
      next.proposals[proposal.proposal_id] = { ...staged, workflow_status: 'CONFIRMED_AND_PUBLISHED', decision_id: decision.decision_id, canonical_event_id: event.event_id };
      const agreement = createRelationshipEpisodeEvent({
        scope,
        session_id: proposal.source_session_id,
        event_type: 'CUSTOMER_AGREEMENT',
        summary: proposal.summary,
        occurred_at: committed_at,
        source_content_hash: decision.decision_hash,
        proposal_id: proposal.proposal_id,
        decision_id: decision.decision_id,
        intervention_lineage_id: event.semantic_payload?.lineage?.intervention_lineage_id || null,
      });
      if (!agreement.ok) return { commit: false, response: agreement };
      const agreementAppend = appendRelationshipEpisodeEventsToState({ state: next, scope, events: [agreement.event], appended_at: committed_at });
      if (!agreementAppend.ok) return { commit: false, response: agreementAppend };
      next.transaction_count += 1;
      const receipt = transactionReceipt({ state: next, operation: 'CONFIRM_RECOMPUTE_PUBLISH', proposalId: proposal.proposal_id, decisionId: decision.decision_id, priorHash: prior.publication_hash, nextHash: recomputed.publication.publication_hash, status: 'ATOMICALLY_PUBLISHED', occurredAt: committed_at });
      const response = { mutation_performed: true, event: clone(event), derived_events: clone(derived_events), replay: clone(replay), publication: clone(recomputed.publication), receipt };
      next.idempotency[idempotency_key] = { semantic_hash: semanticHash, result: clone(response) };
      return { commit: true, response: { ok: true, code: 'AFW05_CONFIRMED_MUTATION_ATOMICALLY_PUBLISHED', ...response } };
    });
  }

  readCurrent({ scope }) {
    if (!sameScope(this.state.scope, scope)) return deepFreeze({ ok: false, code: 'AFW05_STORE_SCOPE_DENIED' });
    const publication = this.state.publications[this.state.current_publication_hash];
    return deepFreeze({ ok: true, code: 'AFW05_CURRENT_LIVING_TWIN_READ', publication: clone(publication) });
  }

  readProposal({ scope, proposal_id }) {
    if (!sameScope(this.state.scope, scope)) return deepFreeze({ ok: false, code: 'AFW05_STORE_SCOPE_DENIED' });
    const proposal = this.state.proposals[proposal_id];
    return deepFreeze(proposal
      ? { ok: true, code: 'AFW05_PROPOSAL_READ', proposal: clone(proposal.proposal), workflow_status: proposal.workflow_status }
      : { ok: false, code: 'AFW05_PROPOSAL_NOT_FOUND' });
  }

  readPersonalRsl({ scope }) {
    if (!sameScope(this.state.scope, scope)) return deepFreeze({ ok: false, code: 'AFW05_STORE_SCOPE_DENIED', records: [] });
    return deepFreeze({ ok: true, code: 'AFW05_PERSONAL_RSL_READ', records: clone(this.state.personal_rsl_records) });
  }

  readRelationshipEpisodes({ scope }) {
    if (!sameScope(this.state.scope, scope)) return deepFreeze({ ok: false, code: 'AFW05_STORE_SCOPE_DENIED', records: [] });
    return deepFreeze({ ok: true, code: 'RELATIONSHIP_EPISODE_EVENTS_READ', records: clone(this.state.relationship_episode_records || []) });
  }

  verifyRelationshipEpisodes({ scope }) {
    const read = this.readRelationshipEpisodes({ scope });
    if (!read.ok) return read;
    let previous = null;
    for (const [index, record] of read.records.entries()) {
      const envelopeBody = {
        contract_id: record.contract_id,
        sequence: record.sequence,
        event_id: record.event_id,
        event_hash: record.event_hash,
        previous_envelope_hash: record.previous_envelope_hash,
        appended_at: record.appended_at,
      };
      if (!validateRelationshipEpisodeEvent(record.event, scope) || record.sequence !== index + 1
        || record.event_id !== record.event.episode_event_id || record.event_hash !== record.event.event_hash
        || record.previous_envelope_hash !== previous || record.envelope_hash !== hashCanonicalJson(envelopeBody)) {
        return deepFreeze({ ok: false, code: 'RELATIONSHIP_EPISODE_HASH_CHAIN_INVALID', sequence: index + 1 });
      }
      previous = record.envelope_hash;
    }
    return deepFreeze({ ok: true, code: 'RELATIONSHIP_EPISODE_HASH_CHAIN_VALID', event_count: read.records.length, head_hash: previous });
  }

  buildPersonalRslStore({ scope }) {
    if (!sameScope(this.state.scope, scope)) throw new Error('AFW05_STORE_SCOPE_DENIED');
    return restoreRslStore(this.state.personal_rsl_records, scope);
  }

  inspect({ scope }) {
    if (!sameScope(this.state.scope, scope)) return deepFreeze({ ok: false, code: 'AFW05_STORE_SCOPE_DENIED' });
    return deepFreeze({
      ok: true,
      scope_hash: scopeFingerprint(scope),
      proposal_count: Object.keys(this.state.proposals).length,
      decision_count: Object.keys(this.state.decisions).length,
      personal_rsl_event_count: this.state.personal_rsl_records.length,
      relationship_episode_event_count: (this.state.relationship_episode_records || []).length,
      publication_count: Object.keys(this.state.publications).length,
      current_publication_hash: this.state.current_publication_hash,
      transaction_count: this.state.transaction_count,
      raw_transcript_persisted: false,
      snapshot_hash: hashCanonicalJson(this.state),
    });
  }

  snapshot() { return deepFreeze(clone(this.state)); }
}
