// Account-owned orchestration. Shared domain cores never acquire storage,
// session, participant, report or publication authority of their own.
import { randomUUID } from 'node:crypto';
import { digest, requireValue } from '../repository.js';
import { createMainCurrentApaAdapter } from './currentApa.js';
import { createMainAthleteRslAdapter } from './rsl.js';
import { createMainMapChangeAdapter } from './mapChange.js';
import { createMainVisualAdapter } from './visual.js';
import { applyCoachOutput } from './state.js';
import { pendingApaCurrency } from './currency.js';
import { flagshipCoachingInput, FLAGSHIP_INSTRUCTIONS, SCHEMA } from './coach.js';
import { assertCoachingWritable } from './compatibility.js';
import { redactCoachingPresentation } from './presentation.js';

export const MAIN_FLAGSHIP_CONTRACT = 'athlete_academy_flagship_attempt_v1';
export const CLOSING_SOURCE_ACTIONS = new Set(['approve', 'draft', 'discard', 'share_draft',
  'revoke_share', 'confirm_memory', 'remember', 'forget', 'confirm_fact', 'update_apa',
  'publish_apa', 'discard_apa', 'refresh_sources']);
const stamp = now => new Date(now()).toISOString();
const same = (a, b) => digest(a) === digest(b);
const inputProjection = s => ({ mm: s.mm, sourceBinding: s.sourceBinding,
  messages: s.messages, plan: s.plan, draft: s.draft,
  learning: s.learning, currentApa: s.currentApa, apaDraft: s.apaDraft,
  confirmedChanges: s.apaConfirmedChanges || [], reviewRequirements: s.apaReviewRequirements || [],
  rslEvents: s.rslEvents || [], sessionId: s.sessionId, sessionStartMap: s.sessionStartMap || null,
  sessions: s.sessions, sessionStart: s.sessionStart, view: s.view, viewContext: s.viewContext,
  speaker: s.speaker, closing: s.closing });
const eventFor = (state, text) => state.pendingTask === 'OPENING' ? 'SESSION_OPENING'
  : state.pendingTask === 'CLOSE' ? 'SESSION_FINALIZATION'
    : typeof text === 'string' && /\b(compare|comparison|versus|vs\.?|options?|difference|show me visually)\b/iu.test(text)
      && (state.events || []).filter(e => e.type === 'visual_considered'
        && e.event === 'COACHING_MOMENT' && e.session_id === state.sessionId).length < 2
      ? 'COACHING_MOMENT' : null;

export function createFlagshipContinuity({ config, apa, principalFor, now }) {
  const enabled = () => config.flagshipEnabled === true;
  if (enabled()) requireValue(config.currentApaEnabled === true, 'MAIN_FLAGSHIP_CURRENT_APA_REQUIRED', 503);
  const contexts = new WeakMap();
  const keyFor = current => `coach:${current.person.mm}`;
  function readable(snapshot, current, a) {
    apa.assertReadableSnapshot(current, a, snapshot);
    requireValue(same(snapshot[keyFor(current)]?.sourceBinding, current.binding), 'COACH_SOURCES_CHANGED', 409);
  }
  function authority(snapshot, current, a, states) {
    readable(snapshot, current, a);
    const value = Object.freeze({});
    contexts.set(value, { snapshot, current, account: a, states: new WeakSet(states) });
    return value;
  }
  function fenced(input) {
    const c = contexts.get(input.authority);
    requireValue(c && c.states.has(input.state) && c.account.id === input.principal.actorId
      && same(c.current.binding, input.bundle.binding), 'MAIN_FLAGSHIP_AUTHORITY_REQUIRED', 403);
    readable(c.snapshot, input.bundle, c.account);
    return true;
  }
  const currentApaAdapter = createMainCurrentApaAdapter({ assertFencedAuthority: fenced });
  const rsl = createMainAthleteRslAdapter({ assertFencedAuthority: fenced });
  const map = createMainMapChangeAdapter({ assertFencedAuthority: fenced, currentApaAdapter });
  const visual = createMainVisualAdapter({ assertFencedAuthority: fenced, currentApaAdapter, mapChangeAdapter: map });
  function input(snapshot, current, a, state, states = [state]) {
    return { bundle: current, principal: principalFor(a, current.person.mm), state,
      authority: authority(snapshot, current, a, states) };
  }
  function events(i) {
    const ledger = i.state.rslEvents || [];
    const result = ledger.length || i.state.rslLedgerContract ? ledger : rsl.deriveRslEvents(i);
    rsl.validateRslSources({ ...i, events: result });
    rsl.replayRsl({ ...i, events: result });
    return structuredClone(result);
  }
  function memory(i, queryText = '') {
    return rsl.retrieveRslContext({ ...i, events: events(i), queryText });
  }
  function append(snapshot, current, a, before, next, command, requestId) {
    if (!enabled()) return;
    const tracked = ['approve', 'remember', 'forget', 'finish', 'confirm_memory'];
    if (!tracked.includes(command.action)) return;
    const i = input(snapshot, current, a, next, [before, next]);
    const ledger = events({ ...i, state: before });
    const add = spec => {
      const event = rsl.createRslEvent({ ...i, ...spec });
      ledger.push(event); rsl.replayRsl({ ...i, events: ledger }); return event;
    };
    const review = e => {
      next.apaReviewRequirements = [...(before.apaReviewRequirements || []), {
        event_id: e.event_id, event_type: e.event_type, recorded_at: e.recorded_at,
        source_message_id: e.event_type === 'CORRECTION' ? command.source_message_id : null,
        minimum_message_index: e.event_type === 'RETRACTION' ? before.messages.length - 1 : null }];
    };
    if (command.action === 'forget') {
      const active = rsl.replayRsl({ ...i, events: ledger }).active_events;
      const target = active.find(e => e.event_type === 'APPROVED_LEARNING' && e.source_id === command.id);
      if (target) review(add({ type: 'RETRACTION', sourceId: requestId, recordedAt: stamp(now),
        targetEventId: target.event_id, authorityName: 'EXPLICIT_ATHLETE_RETRACTION' }));
      else {
        // Old/scope-archived saved preferences remain removable by their owner.
        // An explicit removal is new evidence, not invented prior RSL approval.
        const item = before.learning.find(item => item.id === command.id);
        requireValue(item && !next.learning.some(item => item.id === command.id), 'LEARNING_CHANGED', 409);
        const removal = { event_id: `athlete_saved_preference_removal_${digest({ actorId:a.id, mm:current.person.mm,
          requestId, itemHash:digest(item) }).slice(0,24)}`, event_type:'RETRACTION', recorded_at:stamp(now) };
        next.events.push({ type:'owned_saved_preference_removed', actorId:a.id, at:removal.recorded_at,
          item_id:item.id, item_sha256:digest(item), request_id:requestId,
          prior_rsl_confirmation_available:false, no_prior_rsl_event_invented:true });
        review(removal);
      }
    }
    for (const item of next.learning.filter(item => !before.learning.some(old => old.id === item.id)))
      add({ type: 'APPROVED_LEARNING', sourceId: item.id, recordedAt: item.approved_at,
        text: item.text, authorityName: 'ATHLETE_LEARNING_CONFIRMATION' });
    if (next.plan && next.plan.id !== before.plan?.id)
      add({ type: 'ACCEPTED_PLAN', sourceId: next.plan.id, recordedAt: next.plan.accepted_at,
        plan: next.plan, authorityName: 'PROTECTED_PLAN_APPROVAL' });
    if (command.action === 'confirm_memory') {
      requireValue(Object.keys(command).every(k => ['action', 'source_message_id', 'target_event_id'].includes(k)),
        'ATHLETE_FACT_COMMAND_INVALID');
      const message = next.messages.find(m => m.id === command.source_message_id);
      requireValue(message?.role === 'user' && message.speaker === 'athlete'
        && message.actorId === a.id && !message.capture, 'ATHLETE_FACT_SOURCE_REQUIRED');
      const correction = command.target_event_id !== undefined && command.target_event_id !== null;
      if (correction) {
        const target = rsl.replayRsl({ ...i, events: ledger }).active_events.find(e => e.event_id === command.target_event_id);
        requireValue(['ATHLETE_STATEMENT', 'CORRECTION'].includes(target?.event_type), 'ATHLETE_RSL_TARGET_NOT_ACTIVE');
      }
      const e = add({ type: correction ? 'CORRECTION' : 'ATHLETE_STATEMENT', sourceId: requestId,
        recordedAt: stamp(now), text: message.text.trim(), sourceMessage: message,
        targetEventId: correction ? command.target_event_id : null,
        authorityName: correction ? 'EXPLICIT_ATHLETE_CORRECTION' : 'EXPLICIT_ATHLETE_SELF_REPORT' });
      if (correction) review(e);
    }
    next.rslEvents = ledger; next.rslLedgerContract = 'athlete_academy_rsl_ledger_v1';
  }
  function refreshSources(next) {
    if (!enabled()) return;
    if (next.rslEvents?.length || next.apaReviewRequirements?.length)
      next.rslSourceArchive = [...(next.rslSourceArchive || []), { sourceBinding: structuredClone(next.sourceBinding),
        events: structuredClone(next.rslEvents || []), reviewRequirements: structuredClone(next.apaReviewRequirements || []) }];
    next.rslEvents = []; next.rslLedgerContract = 'athlete_academy_rsl_ledger_v1';
    next.apaReviewRequirements = []; next.sessionStartMap = null;
  }
  function prepare(snapshot, current, a, next, command, requestId) {
    if (!enabled()) return;
    const i = input({ ...snapshot, [keyFor(current)]: next }, current, a, next);
    const p = next.pendingAttempt;
    requireValue(p && ['OPENING', 'CHAT', 'CLOSE'].includes(p.task), 'COACH_OPERATION_MISMATCH');
    const sessionId = p.task === 'OPENING' ? randomUUID() : next.sessionId || randomUUID();
    const reservedIdentity = { assistantId: randomUUID(), draftId: randomUUID(), closingId: randomUUID(), at: stamp(now) };
    let startMap = null;
    if (p.task === 'OPENING') {
      const startState = { ...next, sessionId, status: next.beforeWorking,
        apaNeedsReview: pendingApaCurrency(current,next,apa.currentArtifact(next,current,a)).needsReview };
      contexts.get(i.authority).states.add(startState);
      startMap = map.captureSessionStartMap({ ...i, state: startState });
    }
    p.flagship = { contract: MAIN_FLAGSHIP_CONTRACT, requestId, commandHash: digest(command),
      text: p.task === 'CHAT' ? command.text : null, sessionId, startMap, reservedIdentity,
      visualId: randomUUID(), sourceRevision: next.revision,
      event: eventFor(next, command.text), inputHash: digest(inputProjection(next)) };
    // Two one-shot provider stages need a single nonrenewed, finite lease.
    p.lease = now() + 420000;
  }
  function active(snapshot, current, a, attempt, recovery = false) {
    readable(snapshot, current, a);
    const s = snapshot[keyFor(current)], p = s?.pendingAttempt;
    assertCoachingWritable(config,s);
    requireValue(p?.id === attempt && p.flagship?.contract === MAIN_FLAGSHIP_CONTRACT
      && same(p.sourceBinding, current.binding) && p.task === s.pendingTask
      && ['OPENING', 'CHAT', 'CLOSE'].includes(p.task)
      && (recovery ? s.status === 'unknown' || p.lease < now() : s.status === 'working' && p.lease >= now())
      && digest(inputProjection(s)) === p.flagship.inputHash, 'COACH_OPERATION_MISMATCH', 409);
    return s;
  }
  function preflight(snapshot, current, a, attempt) {
    const s = active(snapshot, current, a, attempt);
    const artifact = apa.currentArtifact(s, current, a), i = input(snapshot, current, a, s);
    return { state: { ...s, flagship_enabled: true,
      apaNeedsReview: pendingApaCurrency(current, s, artifact).needsReview,
      governedMemory: memory(i, s.messages.at(-1)?.text || '') }, artifact };
  }
  function admit(snapshot,current,a,attempt,request,evidenceId) {
    const s = active(snapshot,current,a,attempt), p = s.pendingAttempt;
    requireValue(!p.flagship.coachEvidenceId, 'COACH_OPERATION_MISMATCH', 409);
    let packet;
    try { packet = JSON.parse(request.input); } catch { requireValue(false,'COACH_REQUEST_MISMATCH'); }
    const fp = preflight(snapshot,current,a,attempt);
    const expected = flagshipCoachingInput({ ...current,current_apa:fp.artifact,
      ...(packet.reviewed_coach_observations ? {coach_note_observations:packet.reviewed_coach_observations} : {}) },
    fp.state,p.task,{knowledge:packet.governed_knowledge});
    requireValue(typeof packet.now==='string' && new Date(packet.now).toISOString()===packet.now,
      'COACH_REQUEST_MISMATCH');
    expected.now = packet.now;
    const template = {model:'gpt-5.6-sol',reasoning:{effort:'xhigh'},store:false,max_output_tokens:6500,
      instructions:FLAGSHIP_INSTRUCTIONS,input:JSON.stringify(expected),text:{format:{type:'json_schema',name:'athlete_coaching',strict:true,schema:SCHEMA}}};
    requireValue(same(request,template) && typeof evidenceId==='string' && evidenceId,
      'COACH_REQUEST_MISMATCH');
    p.flagship.coachEvidenceId = evidenceId; p.flagship.coachRequestHash = digest(request);
    return s;
  }
  function validateCoachRecovery(snapshot,current,a,attempt,savedRequest,savedResponse) {
    const s = active(snapshot,current,a,attempt,true), p = s.pendingAttempt;
    const r = savedRequest?.record;
    requireValue(savedRequest?.kind==='request' && savedResponse?.kind==='response'
      && savedRequest.id===savedResponse.id && r?.id===savedRequest.id
      && savedRequest.id===p.flagship.coachEvidenceId && r.mm===current.person.mm && r.task===p.task
      && r.source_bos===current.binding.bos && r.source_apa===current.binding.apa
      && r.current_apa===apa.currentArtifact(s,current,a).artifact_sha256
      && r.request_sha256===digest(savedRequest.request)
      && p.flagship.coachRequestHash===r.request_sha256, 'RECOVERED_RESULT_MISMATCH');
    return true;
  }
  function stage(snapshot, current, a, attempt, output, recovery = false) {
    const before = active(snapshot, current, a, attempt, recovery), p = before.pendingAttempt, f = p.flagship;
    const reserved = { ...before, status: 'working', sessionId: f.sessionId, revision: f.sourceRevision };
    const next = applyCoachOutput(reserved, output, p.task, current, principalFor(a, current.person.mm), f.reservedIdentity);
    if (p.task === 'OPENING') next.sessionStartMap = f.startMap;
    if (p.task === 'CLOSE' && !before.sessionId) next.events.push({ type: 'legacy_session_finalization_binding',
      session_id: f.sessionId, not_a_session_start: true, at: f.reservedIdentity.at });
    next.apaNeedsReview = pendingApaCurrency(current, next, apa.currentArtifact(next, current, a)).needsReview;
    const i = input(snapshot, current, a, next);
    const world = f.event ? visual.buildAthleteVisualWorld({ ...i, event: f.event,
      scopeId: 'athlete-academy-private', sessionId: f.sessionId, triggerRequestId: f.requestId,
      ...(f.event === 'COACHING_MOMENT' ? { currentExchange: {
        athleteMessage: f.text, coachMessage: next.messages.at(-1)?.text } } : {}) }) : null;
    return { state: next, world };
  }
  function complete(snapshot, current, a, attempt, output, recovery = false) {
    const staged = stage(snapshot, current, a, attempt, output, recovery), next = staged.state;
    const f = next.pendingAttempt.flagship;
    if (staged.world) {
      const ek = `coach-visual-evidence:${current.person.mm}:${attempt}`;
      const result = visual.recoverAthleteVisualComposition({ world: staged.world,
        savedRequest: snapshot[`${ek}:request`], savedResponse: snapshot[`${ek}:response`],
        savedReceipt: snapshot[`${ek}:receipt`] });
      next.events.push({ type: 'visual_considered', event: f.event, session_id: next.sessionId,
        request_id: f.requestId, rendered: result.plan.renderDecision.render, at: f.reservedIdentity.at });
      if (result.plan.renderDecision.render) {
        next.visuals = [...(next.visuals || []), { id: f.visualId, event: f.event,
          session_id: next.sessionId, after_message_id: next.messages.at(-1).id,
          trigger_request_id: f.requestId, source_hash: staged.world.stateBinding.triggerHash,
          plan: result.plan, receipt: result.receipt, at: f.reservedIdentity.at }];
        if (next.pendingTask === 'CLOSE' || f.event === 'SESSION_FINALIZATION') next.closing.visual_id = f.visualId;
      }
    }
    return next;
  }
  function closingReady(s, current, a) {
    const v = (s.visuals || []).find(v => v.id === s.closing?.visual_id
      && v.event === 'SESSION_FINALIZATION' && v.session_id === s.sessionId);
    const p = v?.plan, b = p?.stateBinding;
    const artifact = apa.currentArtifact(s, current, a);
    return Boolean(v && s.messages.some(m => m.id === v.after_message_id && m.role === 'assistant')
      && p.planVersion === 'athlete-academy-visual-v1' && p.event === v.event
      && p.renderDecision?.render === true && p.interactions?.length === 0
      && b?.actorId === current.binding.actorId && b.mm === current.person.mm && b.sessionId === s.sessionId
      && b.relationshipScopeHash === digest({ scopeId: 'athlete-academy-private', ...current.binding })
      && b.bosHash === current.binding.bos && b.baselineApaHash === current.binding.apa
      && b.currentApaHash === artifact.artifact_sha256 && b.triggerHash === v.source_hash
      && p.blocks?.some(block => block.objects?.some(o => o.id === 'athlete-map-change' && o.kind === 'MAP_CHANGE_REVEAL')));
  }
  function exposed(snapshot, current, a, source) {
    if (!enabled()) return source;
    const s = snapshot[keyFor(current)], i = input(snapshot, current, a, s);
    const targets = rsl.retrieveRslCorrectionTargets({ ...i, events: events(i) });
    const surface = redactCoachingPresentation(source);
    surface.flagship_enabled = true;
    surface.closing_reveal_ready = closingReady(s, current, a);
    surface.personalMemory = { contract: 'athlete_academy_memory_ui_v1',
      items: targets.items, omitted_count: targets.omitted_count };
    return surface;
  }
  const evidenceKeys = (mm, attempt) => ['request', 'response', 'receipt'].map(k => `coach-visual-evidence:${mm}:${attempt}:${k}`);
  return Object.freeze({ enabled, prepare, preflight, stage, complete, append, refreshSources, admit, validateCoachRecovery,
    exposed, closingReady, evidenceKeys, createVisualComposer: visual.createAthleteVisualComposer });
}
