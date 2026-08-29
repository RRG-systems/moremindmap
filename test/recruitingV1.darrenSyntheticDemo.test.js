import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DARREN_SYNTHETIC_DEMO_CANDIDATE_ID,
  DARREN_SYNTHETIC_DEMO_INVARIANTS,
  createDarrenSyntheticDemoBaseline,
} from '../src/lib/recruitingV1/darrenSyntheticDemo.js';
import { createDarrenSyntheticDemoRuntime, InMemoryRecruitingDemoStore } from '../api/engine/recruitingV1/demoRuntime.js';

const DEMO_CAPABILITY = Object.freeze({
  contract: 'recruiting_synthetic_demo_capability_v1',
  demo_scope_id: 'leadership_demo_scope_test',
  subject_key: 'recruiting-darren-jordan-v1',
  allowed_product: 'recruiting',
  synthetic_only: true,
});

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
  const demoStore = new InMemoryRecruitingDemoStore();
  const providerRequests = [];
  const env = { RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true' };
  const runtime = createDarrenSyntheticDemoRuntime({
    env, demoStore,
    providerFactory: () => async (request) => {
      providerRequests.push(request);
      return { output: validOutput(), receipt: { model: 'gpt-5.6-sol', usage: { input_tokens: 100, output_tokens: 200 } } };
    },
  });
  return { demoStore, providerRequests, runtime };
}

test('Jordan baseline is explicitly synthetic, complete, resettable, and zero-impact', () => {
  const state = createDarrenSyntheticDemoBaseline({ managerName: 'Darren', enterpriseName: 'MORE MindMap' });
  assert.equal(state.label, 'DEMO CANDIDATE — SYNTHETIC DATA');
  assert.equal(state.candidates[0].candidate_id, DARREN_SYNTHETIC_DEMO_CANDIDATE_ID);
  assert.equal(state.candidates[0].invitation_id, null);
  assert.equal(state.candidates[0].recruit_email, null);
  assert.equal(state.candidates[0].synthetic_only, true);
  assert.equal(state.resettable, true);
  assert.equal(state.intelligence.contract, 'recruiting_intelligence_projection_v1');
  assert.equal(state.intelligence.output.authentic_angles.length, 1);
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

test('only the product-specific synthetic capability opens the demo', async () => {
  const { runtime } = harness();
  const availability = await runtime.availability(DEMO_CAPABILITY);
  assert.equal(availability.demo.available, true);
  assert.equal(availability.demo.manager_session_required, false);
  assert.equal(availability.demo.manager_profile_bound_server_side, false);
  await assert.rejects(runtime.availability({ ...DEMO_CAPABILITY, allowed_product: 'subscription' }), /RECRUITING_DEMO_SCOPE_DENIED/);
  await assert.rejects(runtime.availability(null), /RECRUITING_DEMO_SCOPE_DENIED/);
});

test('demo generation uses synthetic Darren and Jordan only, GPT-5.6 Sol store false, and no Recruiting ledger authority', async () => {
  const { providerRequests, runtime } = harness();
  const opened = await runtime.read(DEMO_CAPABILITY);
  assert.deepEqual(opened.demo.ledger_effect, { invitations: 0, emails: 0, relationships: 0, entitlement: 0, recruiting_audit: 0 });
  assert.equal(opened.demo.manager_authority_mode, 'SYNTHETIC_BOS_ONLY');
  const generated = await runtime.mutate(DEMO_CAPABILITY, opened.csrf_token, 'GENERATE_DEMO_INTELLIGENCE');
  assert.equal(providerRequests.length, 1);
  assert.equal(providerRequests[0].model, 'gpt-5.6-sol');
  assert.equal(providerRequests[0].store, false);
  assert.equal(generated.demo.intelligence.output.authentic_angles.length, 1);
  assert.equal(generated.demo.intelligence.demo_only, true);
  assert.equal(JSON.stringify(generated.demo).includes('manager_bos_reference_sha256'), false);
  assert.equal(JSON.stringify((await runtime.read(DEMO_CAPABILITY)).demo).includes('canonical_profile'), false);
});

test('demo evidence and reset stay in the isolated demo store and return exactly to baseline', async () => {
  const { runtime } = harness();
  const opened = await runtime.read(DEMO_CAPABILITY);
  const added = await runtime.mutate(DEMO_CAPABILITY, opened.csrf_token, 'ADD_DEMO_EVIDENCE', {
    evidence: { type: 'OBSERVATION', claim: 'Synthetic observation for reset proof.', source: 'Founder synthetic demo', source_date: '2026-08-23' },
  });
  assert.equal(added.demo.manager_evidence.length, 3);
  assert.equal(added.demo.intelligence.stale, true);
  const reset = await runtime.mutate(DEMO_CAPABILITY, added.csrf_token, 'RESET_DEMO');
  assert.equal(reset.demo.manager_evidence.length, 2);
  assert.equal(reset.demo.intelligence.output.authentic_angles.length, 1);
  assert.equal(reset.demo.intelligence.stale, false);
});

test('obsolete V1 demo route launches GU V1 when enabled and preserves Campaign 2G as the default-off rollback', () => {
  const runtime = fs.readFileSync(new URL('../api/engine/recruitingV1/demoRuntime.js', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../src/recruitingV1/RecruitingV1App.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(runtime, /getCanonicalProfile|inspectManagerReadOnly|getRecruitingService|canonicalProfileLoader/u);
  assert.match(route, /location\.pathname === '\/recruiting\/demo'.+RECRUITING_GU_V1_ENABLED \? '\/recruiting-gu-v1\/demo' : '\/recruiting-v2\/demo'/u);
  assert.ok(route.indexOf("location.pathname === '/recruiting/demo'") < route.indexOf('return <ManagerExperience />'));
  assert.doesNotMatch(route, /RecruitingDemoExperience|DarrenSyntheticDemoSurface/u);
});
