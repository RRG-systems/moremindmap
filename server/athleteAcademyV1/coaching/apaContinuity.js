// Account/MM authority adapter. Additive private APA state never overwrites reports.
import { randomUUID } from 'node:crypto';
import { digest, requireValue } from '../repository.js';
import { assertOwner } from './bundle.js';
import { createMainCurrentApaAdapter, MAIN_CURRENT_APA_CONTRACT } from './currentApa.js';
import { pendingApaCurrency, applicableApaReviewRequirements, completeApaReviewRequirements } from './currency.js';
import { hasCurrentApaState, hasFlagshipState, coachingWriteHold, assertCoachingWritable } from './compatibility.js';
import { redactCoachingPresentation } from './presentation.js';
const ACTIONS = new Set(['confirm_fact', 'update_apa', 'publish_apa', 'discard_apa']);
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const stamp = now => new Date(now()).toISOString();
const event = (s, type, data, a, now) => s.events.push({ type, ...data, actorId: a.id, at: stamp(now) });
export function createApaContinuityService({ repo, config, academy, transport, now, bundleFor, principalFor, initialState }) {
  const contexts = new WeakSet();
  const same = (a, b) => digest(a) === digest(b);
  function readable(current, account, snapshot) {
    const a = snapshot[`account:${account.id}`], d = snapshot[`dossier:${current.person.mm}`];
    requireValue(a?.id === account.id && a.verified === true && a.sessionVersion === account.sessionVersion, 'SESSION_EXPIRED', 401);
    academy.participant(d, account, 'coach');
    requireValue(d.reports.bos?.artifactHash === current.binding.bos && d.reports.apa?.artifactHash === current.binding.apa && d.reports.apa.bosVersionId === d.reports.bos.currentVersionId && current.canonicalVersions?.bos === d.reports.bos.currentVersionId && current.canonicalVersions?.apa === d.reports.apa.currentVersionId, 'COACH_SOURCES_CHANGED', 409);
    return true;
  }
  function fence(current, state, account, snapshot) {
    readable(current, account, snapshot);
    requireValue(state.mm === current.person.mm && same(state.sourceBinding, current.binding), 'COACH_SOURCES_CHANGED', 409);
    return true;
  }
  function authority(snapshot, current, state, account, attempt = null, mode = 'composition') {
    fence(current, state, account, snapshot);
    assertCoachingWritable(config,state);
    const value = Object.freeze({ snapshot, account, revision: state.revision, binding: digest(current.binding), attempt, mode });
    contexts.add(value); return value;
  }
  const adapter = createMainCurrentApaAdapter({ assertFencedAuthority({ bundle, principal, state, authority: value, operation }) {
    requireValue(contexts.has(value) && principal.actorId === value.account.id && state.revision === value.revision && digest(bundle.binding) === value.binding, 'CURRENT_APA_AUTHORITY_REQUIRED', 403);
    if (value.attempt) {
      const pending = state.pendingAttempt;
      const active = value.mode === 'recovery'
        ? operation === 'recovery' && (state.status === 'unknown' || pending?.lease < now())
        : ['source_preflight', 'delta_binding', 'reconstruction', 'publication', 'publication_dry_run', 'composition'].includes(operation)
          && state.status === 'working' && pending?.lease >= now();
      requireValue(active && state.pendingTask === 'APA_UPDATE' && pending?.id === value.attempt
        && pending.task === 'APA_UPDATE' && same(pending.sourceBinding, bundle.binding), 'COACH_OPERATION_MISMATCH', 409);
    } else {
      requireValue(['source_preflight', 'publication'].includes(operation) && !state.pendingAttempt && !['working', 'unknown'].includes(state.status), 'COACH_OPERATION_PENDING', 409);
    }
    return fence(bundle, state, value.account, value.snapshot);
  } });
  function read(current, s, a) { return adapter.currentApaView({ bundle: current, record: s.currentApa || null, principal: principalFor(a, current.person.mm) }); }
  function sourceHash(current, s, change, contract = 'v1') {
    const message = s.messages.find(m => m.id === change.source_message_id);
    const original = { binding: current.binding, message, confirmedChanges: s.apaConfirmedChanges || [], acceptedPlan: s.plan, approvedLearning: s.learning, currentApa: s.currentApa || null };
    requireValue(['v1', 'rsl-review-v2'].includes(contract), 'CURRENT_APA_DRAFT_CHANGED', 409);
    return digest(contract === 'v1' ? original : { ...original,
      rslEvents: s.rslEvents || [], reviewRequirements: s.apaReviewRequirements || [] });
  }
  function exposed(s, current, a) {
    if (!config.currentApaEnabled && !hasCurrentApaState(s) && !hasFlagshipState(s)) return s;
    const stale = !same(s.sourceBinding, current.binding);
    const view = stale ? null : read(current, s, a);
    return { ...s, apaNeedsReview: stale || pendingApaCurrency(current, s, view?.artifact).needsReview,
      ...(coachingWriteHold(config,s)?{coaching_write_hold:coachingWriteHold(config,s)}:{}),
      capabilities: { ...(s.capabilities || {}), currentApa: true }, continuity: {
      contract: MAIN_CURRENT_APA_CONTRACT, binding: structuredClone(s.sourceBinding), original: structuredClone(current.apa),
      current: stale ? null : s.currentApa || null, draft: stale ? null : s.apaDraft || null,
      changes: s.apaConfirmedChanges || [], current_version: view?.version ?? 0,
      stale: stale || s.status === 'unknown' || Boolean(s.pendingAttempt),
    } };
  }
  function refreshSources(s, a) {
    if (!config.currentApaEnabled) return;
    if (s.currentApa || s.apaDraft || s.apaConfirmedChanges?.length) {
      s.apaSourceArchive = [...(s.apaSourceArchive || []), { sourceBinding: structuredClone(s.sourceBinding), currentApa: s.currentApa || null, apaDraft: s.apaDraft || null, confirmedChanges: s.apaConfirmedChanges || [], actorId: a.id, at: stamp(now) }];
    }
    s.currentApa = null; s.apaDraft = null; s.apaConfirmedChanges = [];
  }
  const restore = s => { s.status = s.beforeWorking || 'active'; delete s.beforeWorking; delete s.pendingTask; delete s.pendingAttempt; };
  function invalidateClosing(s, a, action) {
    if (s.status === 'review' && s.closing) { event(s, 'closing_preview_invalidated', { action }, a, now); s.closing = null; s.status = 'active'; }
  }
  function checkCommand(command) {
    requireValue(command && typeof command === 'object' && !Array.isArray(command), 'COACH_COMMAND_INVALID');
    requireValue(!['actor', 'actorId', 'speaker', 'subjectActorId', 'mm', 'coachActorId', 'authority', 'principal'].some(k => Object.hasOwn(command, k)), 'COACH_ACTOR_SPOOF_DENIED');
    const fields = { confirm_fact: ['action', 'source_message_id', 'reason', 'kind', 'supersedes'], update_apa: ['action', 'confirmation_id', 'expected_version'], publish_apa: ['action', 'id', 'hash', 'expected_version', 'artifact_hash', 'confirmation_id', 'source_id'], discard_apa: ['action', 'id', 'hash'] }[command.action];
    requireValue(fields && Object.keys(command).every(k => fields.includes(k)), 'CURRENT_APA_COMMAND_INVALID');
  }
  async function responseFor(a, current, key) {
    const state = await repo.transact([key, `dossier:${current.person.mm}`, `account:${a.id}`], snapshot => {
      readable(current, a, snapshot);
      requireValue(snapshot[key]?.mm === current.person.mm, 'COACH_STATE_SOURCE_MISMATCH');
      return { writes: {}, result: snapshot[key] };
    });
    return { state: redactCoachingPresentation(exposed(state, current, a)) };
  }
  async function action(a, b) {
    requireValue(config.currentApaEnabled, 'CURRENT_APA_NOT_ACTIVE', 404);
    const command = b.command; checkCommand(command);
    requireValue(ACTIONS.has(command.action), 'UNKNOWN_ACTION');
    const current = await bundleFor(a, b), principal = principalFor(a, current.person.mm);
    assertOwner(current, principal);
    const key = `coach:${current.person.mm}`, dk = `dossier:${current.person.mm}`;
    const attempt = randomUUID(), changeId = randomUUID(), draftId = randomUUID();
    if (command.action === 'update_apa') requireValue(config.providerEnabled && typeof transport === 'function', 'COACH_CONNECTION_UNAVAILABLE', 503);
    const claimed = await academy.mutate(a, [key, dk], b, snapshot => {
      const s = snapshot[key] || initialState(current);
      assertCoachingWritable(config,s);
      const auth = authority(snapshot, current, s, a);
      requireValue(s.revision === b.revision, 'STATE_CHANGED_RELOAD', 409);
      requireValue(!s.pendingAttempt && !['working', 'unknown'].includes(s.status), 'COACH_OPERATION_PENDING', 409);
      const expectedVersion = read(current, s, a).version;
      if (command.action === 'confirm_fact') {
        requireValue(UUID.test(command.source_message_id || '') && typeof command.reason === 'string' && command.reason.trim() && command.reason.length <= 1000 && ['reality', 'correction'].includes(command.kind) && Array.isArray(command.supersedes) && command.supersedes.length <= 8, 'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED');
        const change = { id: changeId, source_message_id: command.source_message_id, actorId: a.id, mm: current.person.mm, kind: command.kind, supersedes: structuredClone(command.supersedes), confirmed: true, confirmed_by: 'athlete', confirmed_at: stamp(now), reason: command.reason.trim() };
        requireValue((s.apaConfirmedChanges || []).length < 512, 'CURRENT_APA_CONFIRMATION_LIMIT', 409);
        const verified = adapter.assertCurrentApaConfirmedSource({ bundle: current, record: s.currentApa || null, state: s, confirmedChange: change, expectedVersion, principal, authority: auth });
        s.apaConfirmedChanges = [...(s.apaConfirmedChanges || []), { ...change, source_id: verified.source.id }];
        if (s.apaDraft) { event(s, 'current_apa_draft_invalidated', { draft_id: s.apaDraft.id, reason: 'SOURCE_LINEAGE_CHANGED' }, a, now); s.apaDraft = null; }
        invalidateClosing(s, a, command.action);
        event(s, 'athlete_current_reality_confirmed', { confirmation_id: change.id, source_message_id: change.source_message_id, kind: change.kind }, a, now);
      } else if (command.action === 'update_apa') {
        const change = (s.apaConfirmedChanges || []).find(x => x.id === command.confirmation_id);
        requireValue(change && command.expected_version === expectedVersion, 'CURRENT_APA_STALE_VERSION', 409);
        adapter.assertCurrentApaConfirmedSource({ bundle: current, record: s.currentApa || null, state: s, confirmedChange: change, expectedVersion, principal, authority: auth });
        applicableApaReviewRequirements(s, change);
        invalidateClosing(s, a, command.action);
        s.beforeWorking = s.status; s.status = 'working'; s.pendingTask = 'APA_UPDATE';
        s.revision++;
        const sourceHashContract = config.flagshipEnabled === true ? 'rsl-review-v2' : 'v1';
        s.pendingAttempt = { id: attempt, task: 'APA_UPDATE', at: now(), lease: now() + 630000, sourceBinding: structuredClone(current.binding), currentVersion: expectedVersion, confirmationId: change.id,
          sourceHashContract, sourceHash: sourceHash(current, s, change, sourceHashContract) };
        return { writes: { [key]: s }, result: { state: s, attempt, change, expectedVersion } };
      } else {
        const d = s.apaDraft;
        requireValue(d && command.id === d.id && command.hash === d.hash, 'CURRENT_APA_DRAFT_CHANGED', 409);
        if (command.action === 'discard_apa') { event(s, 'current_apa_draft_declined', { draft_id: d.id }, a, now); s.apaDraft = null; }
        else {
          requireValue(command.expected_version === d.expectedVersion && command.expected_version === expectedVersion && command.artifact_hash === d.previewRecord.artifact.artifact_sha256 && command.confirmation_id === d.confirmedChange.id && command.source_id === d.source_id && d.source_hash === sourceHash(current, s, d.confirmedChange, d.source_hash_contract || 'v1'), 'CURRENT_APA_DRAFT_CHANGED', 409);
          const published = adapter.publishCurrentApa({ bundle: current, record: s.currentApa || null, state: s, confirmedChange: d.confirmedChange, candidate: d.candidate, expectedVersion, principal, authority: auth });
          requireValue(published.changed && published.record.artifact.artifact_sha256 === command.artifact_hash, 'CURRENT_APA_DRAFT_CHANGED', 409);
          completeApaReviewRequirements(s, d.reviewRequirementIds);
          s.currentApa = published.record; s.apaDraft = null;
          event(s, 'current_apa_published', { version: published.record.version, artifact_hash: command.artifact_hash, draft_id: d.id }, a, now);
        }
        invalidateClosing(s, a, command.action);
      }
      s.revision++; s.lastError = null;
      return { writes: { [key]: s }, result: { state: s } };
    });
    if (command.action !== 'update_apa' || claimed.attempt !== attempt) return responseFor(a, current, key);
    // Authority is NOT stored in an operation/result or trusted after serialization.
    // Re-resolve a private immutable preflight snapshot; final publication rechecks atomically.
    let snapshot;
    try {
      snapshot = await repo.transact([key, dk, `account:${a.id}`], saved => {
        const state = saved[key];
        fence(current, state, a, saved);
        requireValue(state?.pendingAttempt?.id === attempt && state.pendingAttempt.task === 'APA_UPDATE'
          && state.status === 'working' && state.pendingTask === 'APA_UPDATE' && state.pendingAttempt.lease >= now()
          && state.pendingAttempt.sourceHash === sourceHash(current, state, claimed.change, state.pendingAttempt.sourceHashContract || 'v1'), 'COACH_OPERATION_MISMATCH', 409);
        return { writes: {}, result: saved };
      });
    } catch (error) {
      // Close only this already-owned attempt's admission. No provider was called,
      // no report was changed, and revoked callers receive no private response.
      await repo.transact([key], saved => {
        const state = saved[key];
        if (state?.pendingAttempt?.id !== attempt) return { writes: {}, result: true };
        state.status = 'unknown'; state.revision++;
        state.pendingAttempt.errorCode = /^[A-Z_]+$/u.test(error.message || '') ? error.message : 'CURRENT_APA_RESULT_UNAVAILABLE';
        state.lastError = 'Your original reports and saved plan are safe. This APA update did not start. Review the unresolved attempt before continuing.';
        event(state, 'current_apa_preflight_rejected', { attempt_id: attempt, code: state.pendingAttempt.errorCode, noProviderCall: true }, a, now);
        return { writes: { [key]: state }, result: true };
      });
      throw error;
    }
    const s = snapshot[key];
    requireValue(s?.pendingAttempt?.id === attempt, 'COACH_OPERATION_MISMATCH', 409);
    const auth = authority(snapshot, current, s, a, attempt);
    const compose = adapter.createApaComposer({ transport, evidenceSink: event => repo.putImmutable(`coach-apa-evidence:${current.person.mm}:${attempt}:${event.kind}`, event) });
    let composed, failure;
    try { composed = await compose({ bundle: current, record: s.currentApa || null, state: s, confirmedChange: claimed.change, expectedVersion: claimed.expectedVersion, principal, authority: auth }); }
    catch (e) { failure = e; }
    await repo.transact([key, dk, `account:${a.id}`], saved => {
      const state = saved[key];
      if (state?.pendingAttempt?.id !== attempt) return { writes: {}, result: true };
      try {
        const finalAuthority = authority(saved, current, state, a, attempt);
        requireValue(!failure && state.pendingAttempt.sourceHash === sourceHash(current, state, claimed.change, state.pendingAttempt.sourceHashContract || 'v1'), 'CURRENT_APA_RESULT_UNAVAILABLE', 409);
        const preview = adapter.publishCurrentApa({ bundle: current, record: state.currentApa || null, state, confirmedChange: claimed.change, candidate: composed.candidate, expectedVersion: claimed.expectedVersion, principal, authority: finalAuthority });
        requireValue(preview.changed === composed.changed, 'CURRENT_APA_COMPOSER_MISMATCH');
        if (preview.changed) {
          if (state.apaDraft) event(state, 'current_apa_draft_superseded', { draft_id: state.apaDraft.id }, a, now);
          const source_id = adapter.assertCurrentApaConfirmedSource({ bundle: current, record: state.currentApa || null, state, confirmedChange: claimed.change, expectedVersion: claimed.expectedVersion, principal, authority: finalAuthority }).source.id;
          const source_hash_contract = state.pendingAttempt.sourceHashContract || 'v1';
          const d = { id: draftId, candidate: composed.candidate, confirmedChange: claimed.change, expectedVersion: claimed.expectedVersion, source_id, previewRecord: preview.record,
            source_hash_contract, source_hash: sourceHash(current, state, claimed.change, source_hash_contract),
            reviewRequirementIds: applicableApaReviewRequirements(state, claimed.change) };
          d.hash = digest({ candidate: d.candidate, confirmedChange: d.confirmedChange, expectedVersion: d.expectedVersion, artifact_hash: d.previewRecord.artifact.artifact_sha256, source_hash: d.source_hash });
          state.apaDraft = d;
        }
        restore(state); state.lastError = null;
        event(state, preview.changed ? 'current_apa_draft_prepared' : 'current_apa_no_change', { confirmation_id: claimed.change.id, draft_id: preview.changed ? draftId : null }, a, now);
      } catch (e) {
        state.status = 'unknown'; state.pendingAttempt.errorCode = /^[A-Z_]+$/u.test(e.message || '') ? e.message : 'CURRENT_APA_RESULT_UNAVAILABLE';
        state.lastError = 'Your original reports and saved plan are safe. This APA update was not published. Review the unresolved attempt before continuing.';
        event(state, 'current_apa_outcome_unresolved', { attempt_id: attempt, code: state.pendingAttempt.errorCode }, a, now);
      }
      state.revision++;
      return { writes: { [key]: state }, result: true };
    });
    return responseFor(a, current, key);
  }
  async function coachPreflight(a, current, attempt) {
    const key = `coach:${current.person.mm}`;
    return repo.transact([key, `dossier:${current.person.mm}`, `account:${a.id}`], snapshot => {
      const s = snapshot[key]; fence(current, s, a, snapshot);
      assertCoachingWritable(config,s);
      requireValue(s.pendingAttempt?.id === attempt && s.status === 'working'
        && ['OPENING', 'CHAT', 'CLOSE'].includes(s.pendingTask) && s.pendingAttempt.task === s.pendingTask
        && s.pendingAttempt.lease >= now(), 'COACH_OPERATION_MISMATCH', 409);
      const artifact = read(current, s, a).artifact;
      return { writes: {}, result: { state: { ...s, apaNeedsReview: pendingApaCurrency(current, s, artifact).needsReview }, artifact } };
    });
  }
  async function recover(a, b, current) {
    requireValue(config.currentApaEnabled, 'CURRENT_APA_NOT_ACTIVE', 404);
    requireValue(b.command?.action === 'recover', 'CURRENT_APA_COMMAND_INVALID');
    const key = `coach:${current.person.mm}`, before = await repo.read(key), attempt = before?.pendingAttempt?.id;
    const validAttempt = UUID.test(attempt || '') && before?.pendingAttempt?.task === 'APA_UPDATE';
    const prefix = validAttempt ? `coach-apa-evidence:${current.person.mm}:${attempt}` : null;
    const requestKey = prefix && `${prefix}:request`, responseKey = prefix && `${prefix}:response`, draftId = randomUUID();
    const principal = principalFor(a, current.person.mm);
    await academy.mutate(a, [key, `dossier:${current.person.mm}`, ...(validAttempt ? [requestKey, responseKey] : [])], b, snapshot => {
      const s = snapshot[key], pending = s?.pendingAttempt;
      assertCoachingWritable(config,s);
      // The existing account/session idempotency gate runs before this callback,
      // so a completed recovery can be read back without reusing an attempt.
      requireValue(validAttempt, 'RECOVERY_NOT_REQUIRED', 409);
      requireValue(pending?.id === attempt && pending.task === 'APA_UPDATE' && (s.status === 'unknown' || pending.lease < now()), 'ATTEMPT_STILL_ACTIVE', 409);
      requireValue(s.revision === b.revision, 'STATE_CHANGED_RELOAD', 409);
      const change = s.apaConfirmedChanges?.find(x => x.id === pending.confirmationId);
      requireValue(change && pending.sourceHash === sourceHash(current, s, change, pending.sourceHashContract || 'v1')
        && pending.currentVersion === read(current, s, a).version, 'CURRENT_APA_RESULT_UNAVAILABLE', 409);
      const auth = authority(snapshot, current, s, a, attempt, 'recovery');
      requireValue(snapshot[requestKey] && snapshot[responseKey], 'RESULT_NOT_YET_RECOVERABLE', 409);
      const recovered = adapter.recoverApaComposition({ bundle: current, record: s.currentApa || null, state: s,
        confirmedChange: change, expectedVersion: pending.currentVersion, principal, authority: auth,
        savedRequest: snapshot[requestKey], savedResponse: snapshot[responseKey] });
      if (recovered.changed) {
        requireValue(recovered.previewRecord?.artifact.artifact_sha256 === recovered.receipt.preview_content_hash, 'CURRENT_APA_COMPOSER_MISMATCH');
        if (s.apaDraft) event(s, 'current_apa_draft_superseded', { draft_id: s.apaDraft.id }, a, now);
        const d = { id: draftId, candidate: recovered.candidate, confirmedChange: change,
          expectedVersion: pending.currentVersion, source_id: recovered.receipt.source_id,
          previewRecord: recovered.previewRecord, source_hash_contract: pending.sourceHashContract || 'v1',
          source_hash: sourceHash(current, s, change, pending.sourceHashContract || 'v1'),
          reviewRequirementIds: applicableApaReviewRequirements(s, change) };
        d.hash = digest({ candidate: d.candidate, confirmedChange: d.confirmedChange,
          expectedVersion: d.expectedVersion, artifact_hash: d.previewRecord.artifact.artifact_sha256, source_hash: d.source_hash });
        s.apaDraft = d;
      }
      event(s, 'current_apa_response_recovered', { attempt_id: attempt, evidence_id: snapshot[requestKey].id,
        draft_id: recovered.changed ? draftId : null, noProviderCall: true, publicationPerformed: false }, a, now);
      restore(s); s.revision++; s.lastError = null;
      return { writes: { [key]: s }, result: { recovered: true, noProviderCall: true, publicationPerformed: false } };
    });
    return responseFor(a, current, key);
  }
  return { handles: action => ACTIONS.has(action), action, recover, exposed, refreshSources, responseFor, coachPreflight, assertReadableSnapshot: readable,
    currentArtifact: (s, current, a) => config.currentApaEnabled || hasCurrentApaState(s) || hasFlagshipState(s)
      ? read(current, s, a).artifact : current.apa };
}
