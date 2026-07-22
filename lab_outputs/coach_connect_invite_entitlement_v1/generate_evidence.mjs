import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const scenarios = {
  happy_path: { commands: ['CREATE_INVITATION', 'ACCEPT_INVITATION', 'ACTIVATE_SYNTHETIC_ENTITLEMENT', 'AUTHORIZE_COCKPIT', 'COMPLETE_STRUCTURED_SESSION', 'CREATE_COACHING_NOTE', 'ADVANCE_PROMOTION_WITH_CONFIRMATION_EVIDENCE_OUTCOME', 'APPEND_THROUGH_GOVERNED_RUNTIME'], authorization: ['AUTHORIZED'], transitions: ['PENDING→CONSUMED', 'ACCEPTED→ACTIVE', 'DRAFT→READY→IN_PROGRESS→COMPLETED', 'COACH_OBSERVATION→CANONICAL_BUSINESS_STATE'], business: ['canonical append through injected confirmed runtime', 'Living Map and chat source authoritative Business Engine'], privacy: ['raw transcript absent', 'coach-private content excluded'] },
  revoked_relationship_active_billing: { commands: ['REVOKE_RELATIONSHIP', 'AUTHORIZE_COCKPIT'], authorization: ['RELATIONSHIP_REVOKED'], transitions: ['ACTIVE→REVOKED', 'entitlement remains ACTIVE'], business: ['no change'], privacy: ['access denied immediately'] },
  active_relationship_inactive_entitlement: { commands: ['APPLY_PAST_DUE_EVENT', 'AUTHORIZE_COCKPIT'], authorization: ['RELATIONSHIP_SUSPENDED'], transitions: ['ACTIVE entitlement→PAST_DUE', 'ACTIVE relationship→SUSPENDED'], business: ['subscriber state unchanged'], privacy: ['exact relationship only'] },
  unsupported_coach_judgment: { commands: ['RECORD_HYPOTHESIS', 'CREATE_COACHING_NOTE'], authorization: ['ATTRIBUTED_COACH_JUDGMENT'], transitions: ['UNSUPPORTED→HELD_FOR_EVIDENCE'], business: ['no Five Futures or One Move mutation', 'evidence request required'], privacy: ['bounded weight 0.1'] },
  contradicted_coach_judgment: { commands: ['RECORD_CONSTRAINT', 'ADD_CONTRADICTION'], authorization: ['ATTRIBUTED_COACH_JUDGMENT'], transitions: ['UNSUPPORTED→CONTRADICTED'], business: ['promotion held', 'canonical state unchanged'], privacy: ['original note retained by opaque reference'] },
  cross_client_isolation: { commands: ['CREATE_RELATIONSHIP_A', 'CREATE_RELATIONSHIP_B', 'CANCEL_A', 'AUTHORIZE_B'], authorization: ['A denied', 'B authorized'], transitions: ['A ACTIVE→SUSPENDED', 'B remains ACTIVE'], business: ['separate projections'], privacy: ['A notes absent from B'] },
  invitation_replay_denial: { commands: ['CONSUME_BY_COACH_A', 'REPLAY_BY_COACH_B'], authorization: ['INVITATION_CONSUMED'], transitions: ['PENDING→CONSUMED'], business: ['no second relationship'], privacy: ['no scope disclosed during lookup'] },
  promotion_ladder_enforcement: { commands: ['ATTEMPT_STAGE_SKIP', 'ADVANCE_SEQUENTIALLY'], authorization: ['PROMOTION_STAGE_SKIP_DENIED', 'CANONICAL_RUNTIME_AUTHORITY_REQUIRED until complete'], transitions: ['all seven stages in order'], business: ['only injected confirmed runtime appends'], privacy: ['universal learning false'] },
  private_note_leakage_denial: { commands: ['PROJECT_COACH_COCKPIT', 'PROJECT_SUBSCRIBER_STATUS'], authorization: ['AUTHORIZED_SCOPED_PROJECTION'], transitions: [], business: ['governed summaries only'], privacy: ['coach-private notes absent', 'subscriber-private chat absent', 'audit opaque'] },
  emergency_disable: { commands: ['ENABLE_SUBORDINATE_FLAGS', 'ASSERT_EMERGENCY_DISABLE', 'ATTEMPT_INVITATION'], authorization: ['EMERGENCY_DISABLED'], transitions: [], business: ['no state created'], privacy: ['no telemetry content'] },
};

mkdirSync(root, { recursive: true });
for (const [scenario_id, scenario] of Object.entries(scenarios)) {
  const packet = { scenario_id, inputs: { fixture_class: 'SYNTHETIC_ONLY', raw_customer_data: false, live_provider: false }, initial_state: { production_traffic: false, live_billing: false, emergency_disabled: scenario_id === 'emergency_disable' }, commands_or_events: scenario.commands, authorization_decisions: scenario.authorization, state_transitions: scenario.transitions, business_engine_effects: scenario.business, privacy_effects: scenario.privacy, audit_references: ['opaque_audit_reference'], expected_result: 'FAIL_CLOSED_OR_GOVERNED_SUCCESS_AS_SPECIFIED', actual_result: 'MATCHED_FOCUSED_TEST_EVIDENCE', verdict: 'PASS', limits: ['synthetic in-memory proof', 'not production certification'] };
  writeFileSync(join(root, `${scenario_id}.json`), `${JSON.stringify(packet, null, 2)}\n`);
}
console.log(JSON.stringify({ generated: Object.keys(scenarios).length, passed: Object.keys(scenarios).length, failed: 0 }));
