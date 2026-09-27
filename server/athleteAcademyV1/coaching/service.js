import { randomUUID } from 'node:crypto';
import {ageOn} from '../config.js';
import { digest, requireValue } from '../repository.js';
import { buildCanonicalCoachBundle } from './bundle.js';
import { initialCoachState, applyActorAction, applyCoachOutput, coachStateForPrincipal } from './state.js';
import { createCoach, parseCoachResponse } from './coach.js';
import { createApaContinuityService } from './apaContinuity.js';
import { createCoachNotesService } from './coachNotes.js';
import { createCoachNoteContinuity } from './coachNoteContinuity.js';
import { createFlagshipContinuity, CLOSING_SOURCE_ACTIONS } from './flagship.js';
import { pendingApaCurrency } from './currency.js';
import { coachingWriteHold, assertCoachingWritable } from './compatibility.js';
import { redactCoachingPresentation } from './presentation.js';

export function createCoachingService({ repo, config, academy, notes = null, transport, now = Date.now }) {
  const principal = (a, mm) => ({ authenticated: true, actorId: a.id, subjectActorId: a.id, mm, role: 'athlete', grants: { coachingRead: true, reportsRead: true, participation: true } });
  const same = (s, b) => digest(s.sourceBinding) === digest(b.binding);
  const apaContinuity = createApaContinuityService({ repo, config, academy, transport, now,
    bundleFor: bundle, principalFor: principal, initialState: initialCoachState });
  const noteContinuity = createCoachNoteContinuity({ repo, config, academy, now, apa: apaContinuity,
    notes: notes || createCoachNotesService({ repo, config, academy, now }) });
  const flagship = createFlagshipContinuity({ repo, config, academy, apa: apaContinuity, principalFor: principal, now });
  const responseCapabilities=result=>noteContinuity.enabled()&&result?.state
    ?{...result,state:{...result.state,capabilities:{...(result.state.capabilities||{}),coachNotes:true}}}:result;
  function fence(d, b) {
    requireValue(d.reports.bos?.artifactHash === b.binding.bos && d.reports.apa?.artifactHash === b.binding.apa
      && d.reports.apa.bosVersionId === d.reports.bos.currentVersionId, 'COACH_SOURCES_CHANGED', 409);
  }
  async function bundle(a, b) {
    const d = await academy.dossier(a, b.mm); academy.participant(d, a, 'coach');
    const bos = await academy.getReport(a, { mm: d.mm, service: 'bos' });
    const apa = await academy.getReport(a, { mm: d.mm, service: 'apa' });
    requireValue(d.reports.apa.bosVersionId === bos.versionId, 'APA_NEEDS_CURRENT_BOS', 409);
    const result = buildCanonicalCoachBundle({ person: { ...d.person, age:ageOn(d.person.dateOfBirth,now()), actorId: a.id, synthetic: d.synthetic === true }, bos: bos.artifact, apa: apa.artifact, bosInput: { ...bos.source, person: d.person } }, principal(a, d.mm));
    return {...result,bos_feedback:bos.feedback,canonicalVersions:{bos:bos.versionId,apa:apa.versionId}};
  }
  async function exposed(s, current, a) {
    s={...s,feedback:Object.values(current.bos_feedback||{})};
    const hold=coachingWriteHold(config,s);
    if(hold)s={...s,coaching_write_hold:hold};
    if (noteContinuity.enabled()) s={...s,capabilities:{...(s.capabilities||{}),coachNotes:true}};
    // A source update is visible before a deliberate transition. Old records remain bound to their original reports.
    if (!same(s, current)) return { state: redactCoachingPresentation(apaContinuity.exposed({ ...structuredClone(s), sourceUpdateAvailable: true }, current, a)) };
    const surface = apaContinuity.exposed(coachStateForPrincipal(s, current, principal(a, current.person.mm)), current, a);
    if (!flagship.enabled()||hold) return { state: redactCoachingPresentation(surface) };
    return repo.transact([`coach:${current.person.mm}`, `dossier:${current.person.mm}`, `account:${a.id}`], snapshot => {
      apaContinuity.assertReadableSnapshot(current,a,snapshot);
      const savedState = { ...snapshot[`coach:${current.person.mm}`], feedback: Object.values(current.bos_feedback || {}),
        ...(noteContinuity.enabled() ? { capabilities: { coachNotes: true } } : {}) };
      return { writes: {}, result: { state: flagship.exposed(snapshot, current, a,
        apaContinuity.exposed(coachStateForPrincipal(savedState, current, principal(a,current.person.mm)),current,a)) } };
    });
  }
  async function responseFor(a,current,key) {
    if (flagship.enabled()) return exposed(await repo.read(key),current,a);
    return responseCapabilities(await apaContinuity.responseFor(a,current,key));
  }
  async function state(a, b) {
    const current = await bundle(a, b), key = `coach:${current.person.mm}`;
    const keys = [...new Set([key, `dossier:${current.person.mm}`, `account:${a.id}`,
      ...await noteContinuity.keys(a,current.person.mm)])];
    const s = await repo.transact(keys, saved => {
      apaContinuity.assertReadableSnapshot(current, a, saved);
      if (noteContinuity.enabled()) noteContinuity.readable(saved,a,current);
      const next = saved[key] || initialCoachState(current);
      if(coachingWriteHold(config,next))return {writes:{},result:next};
      if (next.pendingAttempt?.lease < now() && next.status === 'working') {
        next.status = 'unknown'; next.revision++;
        next.lastError = 'Your message is saved. Check the saved response before continuing.';
      }
      return { writes: { [key]: next }, result: next };
    });
    return exposed(s, current, a);
  }
  function endAttempt(before, a, reason) {
    const next = structuredClone(before);
    next.events.push({ type: 'coach_attempt_closed', attempt: next.pendingAttempt, reason, actorId: a.id, at: new Date(now()).toISOString(), noProviderCall: true });
    next.status = next.beforeWorking || 'active';
    delete next.pendingAttempt; delete next.pendingTask; delete next.beforeWorking;
    next.lastError = 'The unfinished reply was set aside. Your conversation and plan are preserved.';
    return next;
  }
  async function recovery(a, b, current) {
    const mm = current.person.mm, key = `coach:${mm}`, dk = `dossier:${mm}`, actor = principal(a, mm);
    const before = await repo.read(key); requireValue(before, 'COACH_NOT_STARTED', 409);
    const cmd = b.command.action;
    let output, recoveredRequest;
    if (cmd === 'recover') {
      if (config.currentApaEnabled && (!before.pendingAttempt || before.pendingAttempt.task === 'APA_UPDATE')) {
        await apaContinuity.recover(a, b, current); return responseFor(a,current,key);
      }
      requireValue(before.pendingAttempt, 'RECOVERY_NOT_REQUIRED', 409);
      const ek = `coach-evidence:${mm}:${before.pendingAttempt.id}`;
      const request = await repo.read(`${ek}:request`), saved = await repo.read(`${ek}:response`);
      requireValue(request && saved, 'RESULT_NOT_YET_RECOVERABLE', 409);
      requireValue(request.id === saved.id && request.record.request_sha256 === digest(request.request)
        && request.record.source_bos === before.sourceBinding.bos && request.record.source_apa === before.sourceBinding.apa, 'RECOVERED_RESULT_MISMATCH');
      if (before.pendingAttempt.flagship) await repo.transact([key,dk,`account:${a.id}`], snapshot => {
        flagship.validateCoachRecovery(snapshot,current,a,before.pendingAttempt.id,request,saved);
        return {writes:{},result:true};
      });
      output = parseCoachResponse(saved.response);
      recoveredRequest=request;
    }
    const result = await academy.mutate(a, [...new Set([key, dk,...await noteContinuity.keys(a,mm),
      ...(before.pendingAttempt?.flagship ? flagship.evidenceKeys(mm,before.pendingAttempt.id) : [])])], b, saved => {
      academy.participant(saved[dk], a, 'coach'); fence(saved[dk], current);
      if (config.currentApaEnabled) apaContinuity.assertReadableSnapshot(current, a, saved);
      if (noteContinuity.enabled()) noteContinuity.readable(saved,a,current);
      const s = saved[key]; requireValue(s.revision === b.revision, 'STATE_CHANGED_RELOAD', 409);
      assertCoachingWritable(config,s);
      let next,noteWrites={};
      if (cmd === 'refresh_sources') {
        requireValue(!s.pendingAttempt, 'PREVIOUS_RESPONSE_NEEDS_REVIEW', 409);
        requireValue(b.command.confirm === true, 'SOURCE_UPDATE_CONFIRMATION_REQUIRED');
        next = structuredClone(s);
        next.events.push({ type: 'source_pair_changed', previous: s.sourceBinding, next: current.binding, previousDraft: s.draft, actorId: a.id, at: new Date(now()).toISOString() });
        apaContinuity.refreshSources(next, a);
        flagship.refreshSources(next);
        next.sourceBinding = structuredClone(current.binding); next.draft = null; next.suggestedLearning = [];
        if (next.plan) next.plan = { ...next.plan, sourceBinding: next.plan.sourceBinding || s.sourceBinding };
        next.lastError = null;
      } else {
        requireValue(s.pendingAttempt && (s.status === 'unknown' || s.pendingAttempt.lease < now()), 'ATTEMPT_STILL_ACTIVE', 409);
        if (cmd === 'abandon_response') {
          requireValue(b.command.confirm === true, 'RECOVERY_CONFIRMATION_REQUIRED');
          noteWrites=noteContinuity.abandon(saved,a,current,s);
          next = endAttempt(s, a, 'participant_continued_without_unfinished_response');
        } else {
          requireValue(same(s, current), 'COACH_SOURCES_CHANGED', 409);
          next = s.pendingAttempt.flagship
            ? flagship.complete(saved,current,a,s.pendingAttempt.id,output,true)
            : applyCoachOutput({ ...s, status: 'working' }, output, s.pendingTask, current, actor);
          next.revision = s.revision;
          noteWrites=noteContinuity.complete(saved,a,current,s,next,recoveredRequest);
          delete next.pendingAttempt; next.lastError = null;
          next.events.push({ type: 'coach_response_recovered', attempt: s.pendingAttempt.id, actorId: a.id, at: new Date(now()).toISOString(), noProviderCall: true });
        }
      }
      next.revision++;
      return { writes: { ...noteWrites,[key]: next }, result: { state: next } };
    });
    if (config.currentApaEnabled) return responseFor(a,current,key);
    return exposed(result.state, current, a);
  }
  async function finish(a, current, attempt, output, error) {
    const mm = current.person.mm, key = `coach:${mm}`, dk = `dossier:${mm}`;
    const result=await repo.transact([...new Set([key, dk, `account:${a.id}`,...await noteContinuity.keys(a,mm),
      ...flagship.evidenceKeys(mm,attempt)])], saved => {
      const before = saved[key];
      if (before.pendingAttempt?.id !== attempt) return { writes: {}, result: { state: before } };
      let next,noteWrites={};
      try {
        academy.participant(saved[dk], a, 'coach'); fence(saved[dk], current);
        if (config.currentApaEnabled) apaContinuity.assertReadableSnapshot(current, a, saved);
        if (noteContinuity.enabled()) noteContinuity.readable(saved,a,current);
        requireValue(saved[`account:${a.id}`].sessionVersion === a.sessionVersion, 'SESSION_EXPIRED');
        if (error) throw new Error(error);
        assertCoachingWritable(config,before);
        next = before.pendingAttempt.flagship
          ? flagship.complete(saved,current,a,attempt,output)
          : applyCoachOutput({ ...before, status: 'working' }, output, before.pendingTask, current, principal(a, mm));
        next.revision = before.revision;
        noteWrites=noteContinuity.complete(saved,a,current,before,next);
        delete next.pendingAttempt; next.lastError = null;
      } catch (e) {
        next = { ...before, status: 'unknown', lastError: 'Your message is saved. Check the saved response before continuing.', pendingAttempt: { ...before.pendingAttempt, errorCode: /^[A-Z_]+$/.test(e.message) ? e.message : 'COACH_OUTCOME_UNKNOWN' } };
      }
      next.revision++;
      return { writes: { ...noteWrites,[key]: next }, result: { state: next } };
    });
    if (config.currentApaEnabled) return responseFor(a,current,key);
    return exposed(result.state,current,a);
  }
  async function action(a, b) {
    requireValue(b.command && typeof b.command === 'object', 'COMMAND_REQUIRED');
    requireValue(!['actor', 'actorId', 'speaker', 'subjectActorId', 'mm', 'coachActorId'].some(k => Object.hasOwn(b.command, k)), 'COACH_ACTOR_SPOOF_DENIED');
    if (apaContinuity.handles(b.command.action)) {
      const result = responseCapabilities(await apaContinuity.action(a, b));
      if (!flagship.enabled()) return result;
      const current = await bundle(a,b); return exposed(result.state,current,a);
    }
    const current = await bundle(a, b), mm = current.person.mm, key = `coach:${mm}`, dk = `dossier:${mm}`, actor = principal(a, mm), attempt = randomUUID();
    if(b.command.action==='feedback'){
      await repo.transact([key,dk,`account:${a.id}`],snapshot=>{
        apaContinuity.assertReadableSnapshot(current,a,snapshot);assertCoachingWritable(config,snapshot[key]);
        return {writes:{},result:true};
      });
      await academy.feedback(a,{...b.command,mm:b.mm,requestId:b.requestId});return state(a,b);
    }
    if (['recover', 'abandon_response', 'refresh_sources'].includes(b.command.action)) return recovery(a, b, current);
    const providerAction = ['start', 'message', 'close'].includes(b.command.action);
    if (providerAction) requireValue(config.providerEnabled && transport, 'COACH_CONNECTION_UNAVAILABLE', 503);
    const claimed = await academy.mutate(a, [...new Set([key, dk,...await noteContinuity.keys(a,mm)])], b, saved => {
      academy.participant(saved[dk], a, 'coach'); fence(saved[dk], current);
      if (config.currentApaEnabled) apaContinuity.assertReadableSnapshot(current, a, saved);
      if (noteContinuity.enabled()) noteContinuity.readable(saved,a,current);
      const before = saved[key] || initialCoachState(current);
      assertCoachingWritable(config,before);
      requireValue(before.revision === b.revision, 'STATE_CHANGED_RELOAD', 409);
      requireValue(!before.pendingAttempt, 'PREVIOUS_RESPONSE_NEEDS_REVIEW', 409);
      if (b.command.action === 'finish' && flagship.enabled() && before.status !== 'closed')
        requireValue(before.status === 'review' && flagship.closingReady(before,current,a), 'CLOSING_REVIEW_REFRESH_REQUIRED', 409);
      const next = b.command.action === 'confirm_memory' && flagship.enabled()
        ? structuredClone(before)
        : applyActorAction(before, { ...b.command, revision: b.revision }, current, actor);
      flagship.append(saved,current,a,before,next,b.command,b.requestId);
      if (flagship.enabled() && next.apaDraft && digest(next.rslEvents || []) !== digest(before.rslEvents || [])) {
        next.events.push({ type: 'current_apa_draft_invalidated', draft_id: next.apaDraft.id,
          reason: 'SOURCE_LINEAGE_CHANGED', actorId: a.id, at: new Date(now()).toISOString() });
        next.apaDraft = null;
      }
      if (flagship.enabled() && CLOSING_SOURCE_ACTIONS.has(b.command.action)
        && next.status === 'review' && next.closing) {
        next.events.push({ type: 'closing_preview_invalidated', visual_id: next.closing.visual_id || null,
          action: b.command.action, request_id: b.requestId, actorId: a.id, at: new Date(now()).toISOString() });
        next.closing = null; next.status = 'active';
      }
      next.revision++;
      if (providerAction) next.pendingAttempt = { id: attempt, task: next.pendingTask, at: now(), lease: now() + 210000, sourceBinding: current.binding };
      if (providerAction) flagship.prepare(saved,current,a,next,b.command,b.requestId);
      const noteWrites=providerAction?noteContinuity.reserve(saved,a,current,next):{};
      return { writes: { ...noteWrites,[key]: next }, result: { state: next, attempt: providerAction ? attempt : null } };
    });
    if (!providerAction || claimed.attempt !== attempt) return state(a, b);
    const ek = `coach-evidence:${mm}:${attempt}`;
    let output, error;
    try {
      let preflight = noteContinuity.enabled()&&claimed.state.pendingTask==='OPENING'
        ?await noteContinuity.preflight(a,current,attempt)
        :config.currentApaEnabled?await apaContinuity.coachPreflight(a, current, attempt):null;
      if (claimed.state.pendingAttempt.flagship) {
        const fp = await repo.transact([key,dk,`account:${a.id}`], saved => ({ writes: {},
          result: flagship.preflight(saved,current,a,attempt) }));
        preflight = { ...preflight, ...fp };
      } else if (preflight) preflight.state = { ...preflight.state,
        apaNeedsReview: pendingApaCurrency(current,preflight.state,preflight.artifact).needsReview };
      const coach = createCoach({ flagship: Boolean(claimed.state.pendingAttempt.flagship), transport:async(request,options)=>{
        if (preflight?.reservation) await noteContinuity.admit(a,current,attempt,preflight.reservation,request,options.id);
        if (claimed.state.pendingAttempt.flagship) await repo.transact([key,dk,`account:${a.id}`], snapshot => {
          const admitted = flagship.admit(snapshot,current,a,attempt,request,options.id);
          return {writes:{[key]:admitted},result:true};
        });
        return transport(request,options);
      },evidenceSink: event => repo.putImmutable(`${ek}:${event.kind}`, event) });
      output = await coach(preflight ? { ...current, current_apa: preflight.artifact,
        ...(preflight.reservation?{coach_note_observations:preflight.observations}:{}) } : current,
        preflight?.state || claimed.state, claimed.state.pendingTask);
      if (claimed.state.pendingAttempt.flagship) {
        const stageSnapshot = await repo.transact([key,dk,`account:${a.id}`], saved => ({ writes: {}, result: saved }));
        // The private world capability is created after repository cloning;
        // serialized state or a saved model world is never composer authority.
        const staged = flagship.stage(stageSnapshot,current,a,attempt,output);
        if (staged.world) {
          const compose = flagship.createVisualComposer({ transport,
            evidenceSink: event => repo.putImmutable(`coach-visual-evidence:${mm}:${attempt}:${event.kind}`,event) });
          await compose(staged.world);
        }
      }
    }
    catch (e) { error = /^COACH_[A-Z_]+$/.test(e.message) ? e.message : 'COACH_OUTCOME_UNKNOWN'; }
    return finish(a, current, attempt, output, error);
  }
  return { bundle, state, action };
}
