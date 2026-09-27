// Proposed private note replay adapter. No runtime/provider creation or role grant.
import { digest, requireValue } from '../repository.js';
import { COACH_NOTES_POLICY_VERSION, noteGate, noteSession } from './coachNotesPolicy.js';

export function createCoachNoteContinuity({ repo, academy, config, notes, apa, now }) {
  const enabled = () => config.coachNotesEnabled === true && config.coachNotesPolicyVersion === COACH_NOTES_POLICY_VERSION;
  const same = (a, b) => digest(a) === digest(b);
  async function keys(a, mm) {
    if (!enabled()) return [];
    noteGate(config);
    requireValue(notes, 'COACH_NOTES_NOT_ACTIVE', 404);
    return notes.replayKeys({ mm, ownerId: a.id });
  }
  function readable(snapshot, a, current) {
    const mm = current.person.mm, d = snapshot[`dossier:${mm}`];
    noteSession(a, snapshot[`account:${a.id}`]);
    academy.participant(d, a, 'coach');
    requireValue(d?.mm === mm && d.ownerId === a.id
      && d.reports.bos?.artifactHash === current.binding.bos
      && d.reports.apa?.artifactHash === current.binding.apa
      && d.reports.apa.bosVersionId === d.reports.bos.currentVersionId,
    'COACH_SOURCES_CHANGED', 409);
    if (config.currentApaEnabled) apa.assertReadableSnapshot(current, a, snapshot);
  }
  function attempt(snapshot, a, current, id, recovery = false) {
    readable(snapshot, a, current);
    const s = snapshot[`coach:${current.person.mm}`], p = s?.pendingAttempt;
    requireValue(s?.mm === current.person.mm && same(s.sourceBinding, current.binding)
      && p?.id === id && p.task === 'OPENING' && s.pendingTask === 'OPENING'
      && same(p.sourceBinding, current.binding)
      && (recovery ? s.status === 'unknown' || p.lease < now() : s.status === 'working' && p.lease >= now()),
    'COACH_OPERATION_MISMATCH', 409);
    return s;
  }
  function reserve(snapshot, a, current, next) {
    if (!enabled() || next.pendingTask !== 'OPENING') return {};
    readable(snapshot, a, current);
    const result = notes.reserveOpening({ snapshot, mm: current.person.mm, ownerAccount: a,
      attemptId: next.pendingAttempt.id });
    if (result.reservation) next.pendingAttempt.coachNoteReservation = result.reservation;
    return result.writes;
  }
  async function preflight(a, current, id) {
    return repo.transact(await keys(a, current.person.mm), snapshot => {
      const s = attempt(snapshot, a, current, id), r = s.pendingAttempt.coachNoteReservation;
      const result = r ? notes.preflightOpening({ snapshot, mm: current.person.mm,
        ownerAccount: a, reservation: r }) : { observations: [] };
      return { writes: {}, result: { state: s, artifact: apa.currentArtifact(s, current, a),
        observations: result.observations, reservation: r || null } };
    });
  }
  async function admit(a, current, id, reservation, request, evidenceId) {
    // Immutable request evidence is saved before this admission. The second
    // atomic check is immediately before transport; revocation after admission
    // cannot retract an already admitted provider request.
    return repo.transact(await keys(a, current.person.mm), snapshot => {
      const s = attempt(snapshot, a, current, id), r = s.pendingAttempt.coachNoteReservation;
      requireValue(r && same(r, reservation) && !s.pendingAttempt.coachNoteEvidenceId,
        'COACH_NOTE_ATTEMPT_CHANGED', 409);
      const input = notes.preflightOpening({ snapshot, mm: current.person.mm, ownerAccount: a, reservation: r });
      let packet;
      try { packet = JSON.parse(request.input); } catch { requireValue(false, 'COACH_NOTE_REQUEST_MISMATCH'); }
      requireValue(packet.task === 'OPENING' && packet.athlete?.actorId === a.id
        && packet.athlete.mm === current.person.mm && same(packet.reviewed_coach_observations, input.observations)
        && packet.full_youth_apa?.artifact_sha256 === apa.currentArtifact(s,current,a).artifact_sha256,
      'COACH_NOTE_REQUEST_MISMATCH');
      const admitted = notes.dispatchedOpening({ snapshot, mm: current.person.mm, ownerAccount: a,
        reservation: r, evidenceId });
      s.pendingAttempt.coachNoteEvidenceId = evidenceId;
      s.pendingAttempt.coachNoteRequestSha256 = digest(request);
      return { writes: { ...admitted.writes, [`coach:${current.person.mm}`]: s }, result: true };
    });
  }
  function complete(snapshot, a, current, before, next, request = null) {
    const p = before.pendingAttempt, r = p?.coachNoteReservation;
    if (!r) return {};
    noteGate(config); readable(snapshot, a, current);
    attempt(snapshot,a,current,p.id,Boolean(request));
    requireValue(p.task === 'OPENING' && before.pendingTask === 'OPENING' && p.coachNoteEvidenceId
      && /^[a-f0-9]{64}$/u.test(p.coachNoteRequestSha256||''),
      'COACH_NOTE_ATTEMPT_CHANGED', 409);
    if (request) {
      requireValue(request.id === p.coachNoteEvidenceId && digest(request.request)===p.coachNoteRequestSha256,
        'RECOVERED_RESULT_MISMATCH');
      let packet;
      try { packet = JSON.parse(request.request.input); } catch { requireValue(false, 'RECOVERED_RESULT_MISMATCH'); }
      const input=notes.openingObservations({snapshot,mm:current.person.mm,ownerAccount:a,reservation:r});
      requireValue(packet.task === 'OPENING' && packet.athlete?.actorId === a.id
        && packet.athlete.mm === current.person.mm
        && same(packet.reviewed_coach_observations,input.observations)
        && packet.full_youth_apa?.artifact_sha256===apa.currentArtifact(before,current,a).artifact_sha256,
      'RECOVERED_RESULT_MISMATCH');
    }
    const completed = notes.completeOpening({ snapshot, mm: current.person.mm,
      ownerAccount: a, reservation: r, evidenceId: p.coachNoteEvidenceId });
    next.events.push({ type: 'reviewed_coach_observations_delivered', ...completed.receipt,
      actorId: a.id, at: new Date(now()).toISOString(), noApaPlanOrLearningChange: true });
    return completed.writes;
  }
  function abandon(snapshot,a,current,before){
    const p=before.pendingAttempt,r=p?.coachNoteReservation;
    if(!r||p.coachNoteEvidenceId)return {};
    attempt(snapshot,a,current,p.id,true);
    try {
      return notes.abandonOpening({snapshot,mm:current.person.mm,ownerAccount:a,reservation:r,evidenceId:null}).writes;
    } catch (error) {
      // Lost recipient/grant authority cannot release the reserved note, but
      // must not prevent the owner from closing their unfinished session.
      // Leave that note claim and its history intact; never requeue it here.
      if (['COACH_NOTE_GRANT_UNAVAILABLE', 'COACH_NOTE_RECIPIENT_UNAVAILABLE'].includes(error.code || error.message)) return {};
      throw error;
    }
  }
  return { enabled, keys, readable, reserve, preflight, admit, complete, abandon };
}
