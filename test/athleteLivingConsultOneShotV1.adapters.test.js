import assert from 'node:assert/strict';
import test from 'node:test';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { createCoachingMutationCandidate } from '../src/lib/subscriptionV1/afw04/contracts.js';
import {
  InMemoryLivingRelationshipStore,
  InMemoryPersonalRslStore,
  createConfirmedPersonalRslMutation,
  createGovernedChangeProposal,
  createPersonalRslEvent,
  createProposalDecision,
  retrieveRelevantPersonalHistory,
} from '../src/lib/subscriptionV1/index.js';
import {
  adaptAthletePersonalRslInputV1,
  buildAthleteConsultSurfaceProjectionV1,
  compileAthleteSharedContextV1,
  createAthleteDomainAdapterV1,
  createAthleteLivingRelationshipScopeV1,
  createAthletePublicationAdapterV1,
  createAthleteSharedContextGrantV1,
  createAthleteSharedHumanConfirmationV1,
  createAthleteSharedQuorumDecisionV1,
  createInitialAthleteLivingMapPublicationV1,
  recomputeAthleteLivingMapV1,
  revokeAthleteSharedContextGrantV1,
  validateAthleteDomainAdapterV1,
  validateAthleteLivingMapPublicationV1,
  validateAthleteMapDeltaReceiptV1,
  validateAthleteSharedQuorumReceiptV1,
} from '../src/lib/athleteLivingConsultOneShotV1/index.js';

const AT = '2026-09-05T18:00:00.000Z';
const LATER = '2026-09-05T18:10:00.000Z';
const EXPIRES = '2026-12-05T18:00:00.000Z';
const hash = (value) => hashCanonicalJson(value);

function rehashReceipt(receipt, changes) {
  const unsigned = { ...structuredClone(receipt), ...changes };
  delete unsigned.receipt_hash;
  return { ...unsigned, receipt_hash: hash(unsigned) };
}

function setupScope(suffix = 'mika') {
  const scope = createAthleteLivingRelationshipScopeV1({
    subject_id: `synthetic-athlete-${suffix}`,
    relationship_id: `synthetic-athlete-${suffix}-coach-ellis`,
    membership_id: `synthetic-membership-${suffix}`,
    tenant_id: 'synthetic-athlete-lab',
    athlete_profile_id: `synthetic-athlete-profile-${suffix}`,
  });
  return { scope, adapter: createAthleteDomainAdapterV1({ scope }) };
}

function setupSharedContext() {
  const { scope, adapter } = setupScope();
  const relationship = {
    relationship_id: scope.relationship_id,
    athlete_actor_id: scope.subject_id,
    instructor_actor_id: 'synthetic-instructor-ellis',
    synthetic_only: true,
  };
  const bosPresentationArtifact = {
    identity: 'synthetic-athlete-bos-presentation-mika',
    title: 'Mika',
    chapters: [{ title: 'When the moment gets loud', body: 'One useful cue can help Mika stay connected to the next play.' }],
  };
  const bosBinding = {
    source_kind: 'ATHLETE_BOS',
    artifact_id: 'athlete-bos-mika-v1',
    artifact_version: '1.0.0-synthetic',
    content_hash: hash(bosPresentationArtifact),
  };
  const apaBinding = {
    source_kind: 'ATHLETE_APA',
    artifact_id: 'athlete-apa-mika-v1',
    artifact_version: '1.0.0-synthetic',
    content_hash: hash({ artifact: 'athlete-apa-mika-v1' }),
  };
  const allowedObjects = [
    {
      object_id: 'bos:pattern:pressure-response',
      source_binding: bosBinding,
      source_class: 'ATHLETE_SELF_REPORT',
      epistemic_status: 'REPORTED',
      presentation: {
        title: 'Pressure can narrow the field',
        summary: 'Mika can become quiet or try to solve too much at once when a moment feels important.',
        uncertainty: 'This is context-dependent, not a fixed trait.',
      },
      evidence_refs: ['athlete-bos-evidence-pressure'],
      observed_at: '2026-09-01T18:00:00.000Z',
      presentation_safe: true,
    },
    {
      object_id: 'apa:claim:communication-timing',
      source_binding: apaBinding,
      source_class: 'SHARED_AGREEMENT',
      epistemic_status: 'AGREED',
      presentation: {
        title: 'Communication timing varies under pressure',
        summary: 'Mika and Coach Ellis agree that one clear cue is worth testing.',
        uncertainty: 'The current evidence does not establish the cause.',
      },
      evidence_refs: ['athlete-apa-claim-a17'],
      observed_at: '2026-09-05T17:00:00.000Z',
      presentation_safe: true,
    },
  ];
  const grant = createAthleteSharedContextGrantV1({
    scope,
    relationship,
    source_artifact_bindings: [bosBinding, apaBinding],
    allowed_object_ids: allowedObjects.map(({ object_id }) => object_id),
    granted_at: AT,
    expires_at: EXPIRES,
    granted_by: { actor_role: 'ATHLETE', actor_ref: scope.subject_id },
  });
  const compiled = compileAthleteSharedContextV1({
    adapter,
    grant,
    relationship,
    object_catalog: allowedObjects,
    as_of_at: LATER,
    page_context: { room: 'YOUR_SPORT', visible_object_ids: ['apa:claim:communication-timing'] },
  });
  assert.equal(compiled.ok, true, compiled.code);
  return { scope, adapter, relationship, bosPresentationArtifact, bosBinding, apaBinding, allowedObjects, grant, compiled };
}

function initialMap({ adapter, compiled }) {
  return createInitialAthleteLivingMapPublicationV1({
    adapter,
    initial_state: {
      athlete_current_reality: { focus: 'One clear cue under pressure' },
      athlete_futures: { paths: 'Conditional, not predictive' },
      athlete_one_move: { proposal: 'Test one shared communication cue' },
      athlete_plan: { intervention: null, open_loop_state: 'UNRESOLVED' },
      athlete_evidence: { confidence: 'BOUNDED' },
    },
    source_state_hash: hash({ apa: 'sealed-current-reality' }),
    authority_receipt_hash: compiled.authority_receipt.receipt_hash,
    created_at: LATER,
  });
}

function governedProposal({ adapter, publication, grant }) {
  const packetHash = hash({ packet: 'athlete-consult-session-one' });
  const items = [
    { field: 'athlete_plan.intervention', value: 'Use one agreed cue before four comparable practice sequences.' },
    { field: 'athlete_plan.open_loop_state', value: 'OPEN' },
    { field: 'athlete_plan.due_at', value: '2026-09-12T18:00:00.000Z' },
    { field: 'athlete_plan.observation_window_start', value: '2026-09-06T18:00:00.000Z' },
    { field: 'athlete_plan.observation_window_end', value: '2026-09-12T18:00:00.000Z' },
    { field: 'athlete_plan.falsifiers', value: 'The cue adds confusion; comparable sequences show no usable signal.' },
  ];
  const hidden = createCoachingMutationCandidate({
    session_id: 'athlete-session-one',
    scope_hash: adapter.rsl_scope_hash,
    state_packet_hash: packetHash,
    output: {
      proposal: {
        proposal_type: 'COMMITMENT_CANDIDATE',
        target_contract: 'athlete_living_map_v1',
        operation: 'PROPOSE',
        summary: 'Test one clear shared cue in four comparable practice moments.',
        items,
        reason: 'Mika and Coach Ellis want one bounded next step.',
        evidence_ref_ids: [],
        authority_ref_ids: [
          'athlete-shared-context-grant',
          grant.grant_id,
          grant.grant_hash,
          `athlete-permission-version:${grant.permission_version}`,
        ],
        confirmation_required: true,
        generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
      },
    },
    created_at: '2026-09-05T18:12:00.000Z',
  });
  const result = createGovernedChangeProposal({
    hidden_proposal: hidden,
    scope: adapter.rsl_scope,
    source_state_packet: { packet_hash: packetHash },
    current_publication: publication,
    created_at: '2026-09-05T18:12:00.000Z',
  });
  assert.equal(result.ok, true, result.code);
  return result.proposal;
}

test('Athlete Domain Adapter emits a first-class Athlete scope and reuses one Subscription RSL without an identity shortcut', () => {
  const first = setupScope('mika');
  const second = setupScope('kai');
  assert.equal(validateAthleteDomainAdapterV1(first.adapter).valid, true);
  assert.deepEqual(Object.keys(first.adapter.rsl_scope), ['domain', 'subject_id', 'membership_id', 'tenant_id', 'profile_id', 'athlete_relationship_id']);
  assert.equal(JSON.stringify(first.adapter).includes('business_id'), false);
  assert.notEqual(first.adapter.rsl_scope_hash, second.adapter.rsl_scope_hash);

  const eventInput = adaptAthletePersonalRslInputV1({
    adapter: first.adapter,
    input: {
      event_id: 'athlete-rsl-event-mika-one',
      session_id: 'athlete-session-one',
      event_type: 'COMMITMENT',
      effective_at: AT,
      recorded_at: AT,
      source_class: 'ATHLETE_SELF_REPORT',
      actor: { actor_type: 'ATHLETE', actor_ref: first.adapter.rsl_scope.subject_id },
      establishing_authority: {
        authority_id: 'athlete-confirmation-one',
        authority_version: '1.0.0',
        authority_hash: hash({ confirmation: 'one' }),
      },
      semantic_payload: { summary: 'Mika agreed to notice one cue.', privacy_classification: 'TENANT_PRIVATE' },
      evidence_refs: [{ evidence_id: 'athlete-bos-evidence-one', evidence_domain: 'ATHLETE_BOS', content_hash: hash({ evidence: 'one' }), certainty: 'KNOWN' }],
      supersedes_event_ids: [],
      retracts_event_ids: [],
      confirmation_event_id: 'athlete-confirmation-one',
    },
  });
  const created = createPersonalRslEvent(eventInput);
  assert.equal(created.ok, true, created.code);
  assert.equal(JSON.stringify(created.event).includes('business_id'), false);
  const store = new InMemoryPersonalRslStore();
  assert.equal(store.append({ scope: first.adapter.rsl_scope, event: created.event, appended_at: AT }).ok, true);
  assert.equal(store.verify({ scope: first.adapter.rsl_scope }).code, 'PERSONAL_RSL_HASH_CHAIN_VALID');
  assert.equal(store.read({ scope: second.adapter.rsl_scope }).records.length, 0);
  const history = retrieveRelevantPersonalHistory({
    store,
    scope: first.adapter.rsl_scope,
    purpose: 'ATHLETE_LIVING_CONSULT_SHARED',
    active_lens: 'PLAN',
    topics: ['cue'],
    as_of_at: LATER,
  });
  assert.equal(history.ok, true, history.code);
  assert.deepEqual(history.result.selected_event_ids, [created.event.event_id]);
});

test('shared-context grant is exact, expiring and revocable; ungranted object existence changes neither projection nor receipt', () => {
  const fixture = setupSharedContext();
  const privateOnly = {
    object_id: 'bos:private:not-granted',
    source_binding: fixture.bosBinding,
    source_class: 'ATHLETE_SELF_REPORT',
    epistemic_status: 'REPORTED',
    raw_answer: 'This must never enter the joint context.',
  };
  const withPrivateObject = compileAthleteSharedContextV1({
    adapter: fixture.adapter,
    grant: fixture.grant,
    relationship: fixture.relationship,
    object_catalog: [...fixture.allowedObjects, privateOnly],
    as_of_at: LATER,
    page_context: { room: 'YOUR_SPORT', visible_object_ids: ['apa:claim:communication-timing', privateOnly.object_id] },
  });
  assert.equal(withPrivateObject.ok, true, withPrivateObject.code);
  assert.deepEqual(withPrivateObject.projection, fixture.compiled.projection);
  assert.deepEqual(withPrivateObject.authority_receipt, fixture.compiled.authority_receipt);
  assert.equal(JSON.stringify(withPrivateObject).includes('not-granted'), false);
  assert.equal(JSON.stringify(withPrivateObject).includes('must never'), false);
  assert.equal(withPrivateObject.private_object_existence_disclosed, false);

  const wrongPurpose = compileAthleteSharedContextV1({
    adapter: fixture.adapter,
    grant: fixture.grant,
    relationship: fixture.relationship,
    object_catalog: fixture.allowedObjects,
    purpose: 'ATHLETE_SELECTION',
    as_of_at: LATER,
  });
  assert.equal(wrongPurpose.ok, false);
  assert.equal(wrongPurpose.private_object_existence_disclosed, false);

  const revoked = revokeAthleteSharedContextGrantV1({
    grant: fixture.grant,
    actor: { actor_role: 'ATHLETE', actor_ref: fixture.relationship.athlete_actor_id },
    expected_permission_version: fixture.grant.permission_version,
    revoked_at: '2026-09-05T18:20:00.000Z',
  });
  assert.equal(revoked.ok, true, revoked.code);
  const afterRevocation = compileAthleteSharedContextV1({
    adapter: fixture.adapter,
    grant: revoked.grant,
    relationship: fixture.relationship,
    object_catalog: fixture.allowedObjects,
    as_of_at: '2026-09-05T18:21:00.000Z',
  });
  assert.equal(afterRevocation.ok, false);
  assert.equal(afterRevocation.shared_objects.length, 0);
});

test('surface projection exposes only authorized presentation-safe BOS and governed APA bodies', () => {
  const fixture = setupSharedContext();
  const surface = buildAthleteConsultSurfaceProjectionV1({
    compiled_context: fixture.compiled,
    bos_presentation_artifact: fixture.bosPresentationArtifact,
    bos_authority_object_id: 'bos:pattern:pressure-response',
    apa_customer_view_model: {
      contract: 'athlete-apa-customer-view-model-v1',
      destinations: { where: { title: 'Where you are', domains: ['SPORT', 'TRAINING', 'WARRIOR MENTALITY'] } },
    },
    apa_source_binding: fixture.apaBinding,
    projected_at: LATER,
  });
  assert.equal(surface.ok, true, surface.code);
  assert.equal(surface.projection.surfaces.bos.presentation_safe, true);
  assert.equal(surface.projection.surfaces.apa.presentation_safe, true);
  assert.equal(surface.projection.forbidden_object_existence_disclosed, false);
  assert.equal(JSON.stringify(surface).includes('raw_answer'), false);

  const substituted = buildAthleteConsultSurfaceProjectionV1({
    compiled_context: fixture.compiled,
    bos_presentation_artifact: {
      ...fixture.bosPresentationArtifact,
      chapters: [{ title: 'A broader private artifact', body: 'This was never bound to the granted presentation artifact.' }],
    },
    bos_authority_object_id: 'bos:pattern:pressure-response',
    apa_customer_view_model: {
      contract: 'athlete-apa-customer-view-model-v1',
      destinations: { where: { title: 'Where you are', domains: ['SPORT', 'TRAINING', 'WARRIOR MENTALITY'] } },
    },
    apa_source_binding: fixture.apaBinding,
    projected_at: LATER,
  });
  assert.equal(substituted.ok, false);
  assert.equal(substituted.code, 'ATHLETE_CONSULT_SURFACE_PROJECTION_DENIED');
  assert.equal(substituted.private_object_existence_disclosed, false);
});

test('Athlete shared Plan requires explicit athlete plus instructor quorum before atomic RSL/publication mutation', async () => {
  const fixture = setupSharedContext();
  const publication = initialMap(fixture);
  assert.equal(validateAthleteLivingMapPublicationV1(publication, fixture.adapter).valid, true);
  const proposal = governedProposal({ adapter: fixture.adapter, publication, grant: fixture.grant });
  const customerShortcut = createProposalDecision({
    proposal,
    decision: 'CONFIRM',
    actor: { actor_type: 'CUSTOMER', actor_ref: fixture.adapter.rsl_scope.subject_id },
    decided_at: '2026-09-05T18:15:00.000Z',
  });
  assert.equal(customerShortcut.ok, false);
  assert.equal(customerShortcut.code, 'AFW05_ATHLETE_JOINT_AUTHORITY_REQUIRED');

  const athlete = createAthleteSharedHumanConfirmationV1({
    adapter: fixture.adapter,
    grant: fixture.grant,
    relationship: fixture.relationship,
    proposal,
    actor: { actor_role: 'ATHLETE', actor_ref: fixture.relationship.athlete_actor_id },
    decision: 'CONFIRM',
    confirmed_at: '2026-09-05T18:15:00.000Z',
  });
  assert.equal(athlete.ok, true, athlete.code);
  const pending = createAthleteSharedQuorumDecisionV1({
    adapter: fixture.adapter,
    grant: fixture.grant,
    relationship: fixture.relationship,
    proposal,
    confirmations: [athlete.confirmation],
    decided_at: '2026-09-05T18:16:00.000Z',
  });
  assert.equal(pending.ok, false);
  assert.equal(pending.code, 'ATHLETE_SHARED_QUORUM_PENDING');

  const instructor = createAthleteSharedHumanConfirmationV1({
    adapter: fixture.adapter,
    grant: fixture.grant,
    relationship: fixture.relationship,
    proposal,
    actor: { actor_role: 'INSTRUCTOR', actor_ref: fixture.relationship.instructor_actor_id },
    decision: 'CONFIRM',
    confirmed_at: '2026-09-05T18:15:30.000Z',
  });
  assert.equal(instructor.ok, true, instructor.code);
  const quorum = createAthleteSharedQuorumDecisionV1({
    adapter: fixture.adapter,
    grant: fixture.grant,
    relationship: fixture.relationship,
    proposal,
    confirmations: [athlete.confirmation, instructor.confirmation],
    decided_at: '2026-09-05T18:16:00.000Z',
  });
  assert.equal(quorum.ok, true, quorum.code);
  assert.equal(quorum.decision.actor.actor_type, 'JOINT_AUTHORITY');
  const quorumValidationContext = {
    adapter: fixture.adapter,
    grant: fixture.grant,
    proposal,
    decision: quorum.decision,
    confirmations: [athlete.confirmation, instructor.confirmation],
  };
  const publicationAuthorityContext = {
    authoritative_grant: fixture.grant,
    authoritative_relationship: fixture.relationship,
    authoritative_confirmations: [athlete.confirmation, instructor.confirmation],
  };
  assert.equal(validateAthleteSharedQuorumReceiptV1(quorum.quorum_receipt, quorumValidationContext).valid, true);
  const tamperedReceiptValues = [
    { expected_prior_publication_version: proposal.expected_prior_publication_version + 1 },
    { expected_prior_publication_hash: hash({ tampered: 'prior' }) },
    { athlete_confirmation_id: 'athlete-confirmation-tampered' },
    { athlete_confirmation_hash: hash({ tampered: 'athlete-confirmation' }) },
    { instructor_confirmation_id: 'instructor-confirmation-tampered' },
    { instructor_confirmation_hash: hash({ tampered: 'instructor-confirmation' }) },
    { grant_id: 'athlete-grant-tampered' },
    { grant_hash: hash({ tampered: 'grant' }) },
  ];
  for (const changes of tamperedReceiptValues) {
    const forged = rehashReceipt(quorum.quorum_receipt, changes);
    assert.equal(validateAthleteSharedQuorumReceiptV1(forged, quorumValidationContext).valid, false, `tampered receipt accepted: ${Object.keys(changes)[0]}`);
    const recomputed = recomputeAthleteLivingMapV1({
      adapter: fixture.adapter,
      current_publication: publication,
      proposal,
      decision: quorum.decision,
      quorum_receipt: forged,
      ...publicationAuthorityContext,
      recorded_at: '2026-09-05T18:16:00.000Z',
    });
    assert.equal(recomputed.ok, false, `forged receipt reached recomputation: ${Object.keys(changes)[0]}`);
  }
  const forgedQuorumAuthority = rehashReceipt(quorum.quorum_receipt, { quorum_authority_hash: hash({ forged: 'quorum-authority' }) });
  assert.equal(recomputeAthleteLivingMapV1({
    adapter: fixture.adapter,
    current_publication: publication,
    proposal,
    decision: quorum.decision,
    quorum_receipt: forgedQuorumAuthority,
    ...publicationAuthorityContext,
    recorded_at: '2026-09-05T18:16:00.000Z',
  }).ok, false);

  assert.equal(recomputeAthleteLivingMapV1({
    adapter: fixture.adapter,
    current_publication: publication,
    proposal,
    decision: quorum.decision,
    quorum_receipt: quorum.quorum_receipt,
    recorded_at: '2026-09-05T18:16:00.000Z',
  }).code, 'ATHLETE_LIVING_MAP_SHARED_QUORUM_REQUIRED');

  const eventResult = createConfirmedPersonalRslMutation({
    proposal,
    decision: quorum.decision,
    evidence_catalog: [],
    active_personal_rsl_events: [],
    event_id: 'athlete-rsl-intervention-session-one',
    recorded_at: '2026-09-05T18:16:00.000Z',
  });
  assert.equal(eventResult.ok, true, eventResult.code);
  assert.equal(eventResult.event.event_type, 'INTERVENTION');
  assert.equal(eventResult.event.source_class, 'JOINT_HUMAN_AGREEMENT');
  assert.equal(eventResult.event.actor.actor_type, 'JOINT_AUTHORITY');
  assert.match(JSON.stringify(eventResult.event.semantic_payload.items), /athlete_plan\.intervention/u);
  assert.doesNotMatch(JSON.stringify(eventResult.event.semantic_payload.items), /plan_135|where_you_are/u);

  const store = new InMemoryLivingRelationshipStore(null, {
    publication_adapter: createAthletePublicationAdapterV1(fixture.adapter, {
      authority_context_provider: ({ proposal: boundProposal, decision: boundDecision, authority_receipt: boundReceipt }) => (
        boundProposal.proposal_hash === proposal.proposal_hash
        && boundDecision.decision_hash === quorum.decision.decision_hash
        && boundReceipt.receipt_hash === quorum.quorum_receipt.receipt_hash
          ? {
            grant: fixture.grant,
            relationship: fixture.relationship,
            confirmations: [athlete.confirmation, instructor.confirmation],
          }
          : null
      ),
    }),
  });
  assert.equal((await store.initialize({ scope: fixture.adapter.rsl_scope, publication })).ok, true);
  assert.equal((await store.saveProposal({ scope: fixture.adapter.rsl_scope, proposal, saved_at: '2026-09-05T18:14:00.000Z' })).ok, true);
  assert.equal(store.inspect({ scope: fixture.adapter.rsl_scope }).personal_rsl_event_count, 0);
  const committed = await store.commitDecision({
    scope: fixture.adapter.rsl_scope,
    proposal,
    decision: quorum.decision,
    event: eventResult.event,
    authority_receipt: quorum.quorum_receipt,
    idempotency_key: 'athlete-joint-plan-session-one',
    committed_at: '2026-09-05T18:16:00.000Z',
  });
  assert.equal(committed.ok, true, committed.code);
  assert.equal(committed.mutation_performed, true);
  assert.equal(committed.publication.publication_version, 2);
  assert.equal(committed.publication.state.athlete_plan.intervention, proposal.proposed_items[0].value);
  assert.equal(store.inspect({ scope: fixture.adapter.rsl_scope }).personal_rsl_event_count, 1);
  assert.equal(store.buildPersonalRslStore({ scope: fixture.adapter.rsl_scope }).verify({ scope: fixture.adapter.rsl_scope }).code, 'PERSONAL_RSL_HASH_CHAIN_VALID');
  assert.equal(committed.map_delta_receipt.customer_message, 'YOUR MAP JUST CHANGED');
  assert.equal(validateAthleteMapDeltaReceiptV1(committed.map_delta_receipt, { adapter: fixture.adapter, before: publication, after: committed.publication }).valid, true);
  assert.equal(JSON.stringify(committed).includes('business_id'), false);
});

test('18–20 scope is enforced and 14–17 policy remains intentionally out of this adapter', () => {
  assert.throws(() => createAthleteLivingRelationshipScopeV1({
    subject_id: 'synthetic-athlete-minor',
    relationship_id: 'synthetic-athlete-minor-coach',
    membership_id: 'synthetic-membership-minor',
    tenant_id: 'synthetic-athlete-lab',
    athlete_profile_id: 'synthetic-athlete-profile-minor',
    age_band: '14–17',
  }), /ATHLETE_SCOPE_18_20_ONLY/u);
});
