import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';
import {
  DARREN_SYNTHETIC_DEMO_CANDIDATE_ID,
  DARREN_SYNTHETIC_DEMO_INVARIANTS,
  createDarrenSyntheticDemoBaseline,
} from '../src/lib/recruitingV1/darrenSyntheticDemo.js';
import { createDarrenSyntheticDemoRuntime, InMemoryRecruitingDemoStore } from '../api/engine/recruitingV1/demoRuntime.js';

const DARREN_PROFILE = 'mm-20260527-6zshuaao';
const DARREN = {
  membership_id: 'membership_darren_demo_test', manager_subject_id: 'manager_darren_demo_test', enterprise_id: 'enterprise_darren_demo_test',
  manager_profile_id: DARREN_PROFILE, manager_name: 'Darren Synthetic Authority', manager_email: 'darren@example.test',
  enterprise_name: 'MORE MindMap', status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: 'unlimited',
  admin_roles: ['RECRUITING_ADMIN'], recruiting_governance: { all_enterprises: true, enterprise_ids: [] }, synthetic_only: true,
};

const OTHER_ADMIN = { ...DARREN, membership_id: 'membership_other_admin', manager_subject_id: 'manager_other_admin', manager_profile_id: 'mm-20990101-other001' };

async function sessionFor(service, profileId) {
  const requested = await service.requestManagerVerification(profileId);
  return (await service.verifyManager(requested.verification_token)).session_token;
}

function validOutput() {
  return {
    understand_this_recruit: {
      summary: 'Jordan is pursuing material growth while testing whether stronger operating evidence or first leverage deserves priority.',
      important_realities: ['The growth goal is explicit.', 'The dominant constraint remains deliberately unresolved.'],
    },
    bilateral_communication: {
      advantage: 'Darren can make the decision concrete without pretending the missing evidence is settled.',
      recruiter_watchout: 'A decisive recommendation would outrun the synthetic evidence currently available.',
      adaptation: 'Separate opportunity-flow proof from leverage readiness and let Jordan test both hypotheses.',
    },
    authentic_angles: [{
      title: 'Test the first-leverage decision against current opportunity flow',
      recruit_need: 'Jordan wants growth without simply adding personal workload.',
      current_reality: 'The scenario supports a leverage question but leaves pipeline and transferable-work evidence incomplete.',
      locally_supported_help: 'A synthetic bounded opportunity-and-capacity evidence review is supported in this demo.',
      rationale: 'The review can distinguish whether leverage or opportunity generation is the nearer constraint.',
      validating_question: 'What evidence would tell you an assistant removes a real constraint rather than adding management work?',
      uncertainty: 'Actual repeatable opportunity flow and transferable work volume remain unknown.',
      recruit_evidence_ids: ['demo_evidence_growth_goal'],
      opportunity_evidence_ids: ['demo_opp_evidence_review'],
    }],
    withheld_angles: ['No lead-volume or production promise is supported by the synthetic opportunity authority.'],
    success_environment: {
      natural_success_patterns: ['Purposeful relationship-led growth with visible operating proof'],
      supportive_conditions: ['Clear ownership boundaries', 'Truthful weekly numbers'],
      likely_frictions: ['Hiring before work and economics are visible'],
    },
    missing_evidence: ['Qualified opportunity flow', 'Transferable recurring work', 'Assistant economics'],
    meeting_plan: {
      start_here: 'Ask Jordan what changed between the current production level and the stated growth goal.',
      learn: ['How opportunity is created now', 'Which recurring work can leave Jordan’s hands'],
      listen_for: ['A demand constraint', 'An ownership constraint'],
      your_watchout: 'Do not assume first leverage is the answer because it is under consideration.',
      supported_paths_if_confirmed: ['Opportunity-and-capacity evidence review'],
      do_not_assume: 'Do not imply a lead source, staffing result, or recruiting promise.',
      next_step_if_fit_is_real: 'Agree on one bounded evidence review before recommending a move.',
    },
  };
}

function harness() {
  const mainStore = new InMemoryRecruitingStore(createEmptyRecruitingState([DARREN, OTHER_ADMIN]));
  const recruitingService = new RecruitingV1Service({ store: mainStore, transport: createSyntheticNotificationTransport() });
  const demoStore = new InMemoryRecruitingDemoStore();
  const providerRequests = [];
  const env = {
    RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
    RECRUITING_DEMO_MANAGER_PROFILE_ID: DARREN_PROFILE,
  };
  const runtime = createDarrenSyntheticDemoRuntime({
    env, recruitingService, demoStore,
    canonicalProfileLoader: async (profileId) => ({
      found: true,
      dossier: { canonical_profile_json: { profile_id: profileId, ranked_dimensions: [{ dimension: 'directness', narrative_hint: 'Direct while remaining curious.' }] } },
    }),
    providerFactory: () => async (request) => {
      providerRequests.push(request);
      return { output: validOutput(), receipt: { model: 'gpt-5.6-sol', usage: { input_tokens: 100, output_tokens: 200 } } };
    },
  });
  return { mainStore, recruitingService, demoStore, providerRequests, runtime };
}

test('Jordan baseline is explicitly synthetic, complete, resettable, and zero-impact', () => {
  const state = createDarrenSyntheticDemoBaseline({ managerName: 'Darren', enterpriseName: 'MORE MindMap' });
  assert.equal(state.label, 'DEMO CANDIDATE — SYNTHETIC DATA');
  assert.equal(state.candidates[0].candidate_id, DARREN_SYNTHETIC_DEMO_CANDIDATE_ID);
  assert.equal(state.candidates[0].invitation_id, null);
  assert.equal(state.candidates[0].recruit_email, null);
  assert.equal(state.candidates[0].synthetic_only, true);
  assert.equal(state.resettable, true);
  assert.deepEqual(DARREN_SYNTHETIC_DEMO_INVARIANTS, {
    real_invitation_created: false,
    email_delivery_permitted: false,
    entitlement_consumed: false,
    real_relationship_created: false,
    canonical_customer_mutation_permitted: false,
    manager_bos_storage_permitted: false,
    real_recruiting_audit_permitted: false,
  });
});

test('exact Darren admin authority is required and another all-enterprise admin is denied', async () => {
  const { recruitingService, runtime } = harness();
  const darrenSession = await sessionFor(recruitingService, DARREN_PROFILE);
  assert.equal((await runtime.availability(darrenSession)).demo.available, true);
  const otherSession = await sessionFor(recruitingService, OTHER_ADMIN.manager_profile_id);
  await assert.rejects(runtime.availability(otherSession), /RECRUITING_DEMO_SCOPE_DENIED/);
});

test('demo generation reads Darren BOS, uses GPT-5.6 Sol store false, and never mutates Recruiting ledgers', async () => {
  const { mainStore, recruitingService, providerRequests, runtime } = harness();
  const session = await sessionFor(recruitingService, DARREN_PROFILE);
  const before = await mainStore.read();
  const opened = await runtime.read(session);
  assert.deepEqual(opened.demo.ledger_effect, { invitations: 0, emails: 0, relationships: 0, entitlement: 0, recruiting_audit: 0 });
  const generated = await runtime.mutate(session, opened.csrf_token, 'GENERATE_DEMO_INTELLIGENCE');
  const after = await mainStore.read();
  assert.deepEqual(after, before);
  assert.equal(providerRequests.length, 1);
  assert.equal(providerRequests[0].model, 'gpt-5.6-sol');
  assert.equal(providerRequests[0].store, false);
  assert.equal(generated.demo.intelligence.output.authentic_angles.length, 1);
  assert.equal(generated.demo.intelligence.demo_only, true);
  assert.equal(JSON.stringify(generated.demo).includes('manager_bos_reference_sha256'), false);
  assert.equal(JSON.stringify((await runtime.read(session)).demo).includes('Direct while remaining curious.'), false);
});

test('demo evidence and reset stay in the isolated demo store and return exactly to baseline', async () => {
  const { mainStore, recruitingService, runtime } = harness();
  const session = await sessionFor(recruitingService, DARREN_PROFILE);
  const before = await mainStore.read();
  const opened = await runtime.read(session);
  const added = await runtime.mutate(session, opened.csrf_token, 'ADD_DEMO_EVIDENCE', {
    evidence: { type: 'OBSERVATION', claim: 'Synthetic observation for reset proof.', source: 'Founder synthetic demo', source_date: '2026-08-23' },
  });
  assert.equal(added.demo.manager_evidence.length, 3);
  const reset = await runtime.mutate(session, added.csrf_token, 'RESET_DEMO');
  assert.equal(reset.demo.manager_evidence.length, 2);
  assert.equal(reset.demo.intelligence, null);
  assert.deepEqual(await mainStore.read(), before);
});
