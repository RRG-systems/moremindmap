import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { assert, normalizeIntake, stateHash } from './contract.js';
import { getFixture } from './fixtures.js';
import { sha256Stable } from '../newBosProductionReadinessV1/realizationIdentity.js';
import { createLocalSingleFlightCoordinator } from '../newBosProductionReadinessV1/singleFlight.js';

// This filesystem adapter has no Redis/client/store dependency or canonical key resolver.
// Immutable revisions + CAS and replay IDs follow the existing BOS draft mechanism.
export class AthleteLocalStore {
  constructor(root) { this.root = root; this.flight = createLocalSingleFlightCoordinator(); this.queue = Promise.resolve(); }
  async init() { await fs.mkdir(this.root, { recursive: true, mode: 0o700 }); }
  async read(name) { assert(/^[a-z0-9-]+\.json$/.test(name), 'LOCAL_NAME_INVALID'); return JSON.parse(await fs.readFile(path.join(this.root, name), 'utf8')); }
  async append(name, data) { assert(/^[a-z0-9-]+\.json$/.test(name), 'LOCAL_NAME_INVALID'); await fs.writeFile(path.join(this.root, name), JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 }); }
  async latest(prefix) {
    const files = (await fs.readdir(this.root)).filter(f => f.startsWith(prefix) && /-v\d+\.json$/.test(f));
    if (!files.length) return null;
    files.sort((a, b) => Number(b.match(/-v(\d+)/)[1]) - Number(a.match(/-v(\d+)/)[1]));
    return this.read(files[0]);
  }
  async subject(id) {
    assert(/^synthetic-athlete-(nia|ivo|noor|mara|eli|sam|ren|ari|intake|parity)$/.test(id), 'SYNTHETIC_SUBJECT_NOT_ALLOWED');
    const saved = await this.latest(`${id}-v`);
    if (saved) return saved;
    assert(id !== 'synthetic-athlete-intake', 'INTAKE_NOT_SAVED'); return getFixture(id);
  }
  serial(task) { const run = this.queue.then(task); this.queue = run.catch(() => {}); return run; }
  async draft(action, body, token) {
    return this.serial(async () => {
      if (action === 'create') {
        const id = `athlete-draft-${crypto.randomUUID()}`; const resume = crypto.randomBytes(32).toString('hex');
        const subject = normalizeIntake(body.snapshot, null);
        const draft = { draft_id: id, revision: 1, tokenHash: sha256Stable(resume), updated_at: new Date().toISOString(), snapshot: body.snapshot, subject, replays: [] };
        await this.append(`${id}-v1.json`, draft);
        return { ...this.envelope(draft), resume_token: resume };
      }
      assert(/^athlete-draft-[a-f0-9-]{36}$/.test(body.draft_id || ''), 'DRAFT_ID_INVALID');
      const draft = await this.latest(`${body.draft_id}-v`);
      assert(draft && sha256Stable(token || '') === draft.tokenHash && !draft.discarded, 'DRAFT_NOT_AUTHORIZED');
      if (action === 'resume') return this.envelope(draft);
      if (action === 'discard') { await this.append(`${draft.draft_id}-v${draft.revision + 1}.json`, { ...draft, revision: draft.revision + 1, discarded: true }); return { code: 'DISCARDED' }; }
      assert(action === 'update', 'DRAFT_ACTION_INVALID');
      const replay = draft.replays.find(r => r.id === body.mutation_id);
      if (replay) { assert(replay.hash === sha256Stable(body.snapshot), 'IDEMPOTENCY_CONFLICT'); return this.envelope(draft); }
      assert(body.base_revision === draft.revision, 'BOS_DRAFT_STALE_REVISION');
      const next = { ...draft, revision: draft.revision + 1, updated_at: new Date().toISOString(), snapshot: body.snapshot, subject: normalizeIntake(body.snapshot, draft.subject), replays: [...draft.replays, { id: body.mutation_id, hash: sha256Stable(body.snapshot) }] };
      await this.append(`${draft.draft_id}-v${next.revision}.json`, next); return this.envelope(next);
    });
  }
  envelope(d) { return { draft_id: d.draft_id, revision: d.revision, updated_at: d.updated_at, snapshot: d.snapshot }; }
  async submitIntake(draftId, token, revision) {
    const draft = await this.latest(`${draftId}-v`);
    assert(draft && !draft.discarded && sha256Stable(token || '') === draft.tokenHash && draft.revision === revision, 'DRAFT_NOT_AUTHORIZED');
    assert(Object.hasOwn(draft.subject.responses, 'C01'), 'LIFE_INVITATION_REQUIRED_ANSWER_MAY_BE_UNKNOWN_OR_DECLINED');
    return this.serial(async () => {
      const previous = await this.latest('synthetic-athlete-intake-v');
      const next = { ...draft.subject, revision: (previous?.revision || 0) + 1 };
      await this.append(`synthetic-athlete-intake-v${next.revision}.json`, next); return next;
    });
  }
  async correct(id, { sourceHash, claimId, displayedClaim, reportIdentity, claimEvidenceIds, text, previousAnswerId = null }) {
    return this.serial(async () => {
      const subject = await this.subject(id);
      assert(sourceHash === stateHash(subject), 'STALE_CORRECTION_REFUSED');
      assert(typeof text === 'string' && text.trim().length > 0 && text.length < 4000, 'CORRECTION_REQUIRED');
      // Report binding is checked by the caller against its exact accepted artifact.
      assert(claimId && displayedClaim && reportIdentity, 'DISPLAYED_CLAIM_BINDING_REQUIRED');
      assert(Array.isArray(claimEvidenceIds) && claimEvidenceIds.length > 0 && claimEvidenceIds.every(evidenceId => subject.evidence.some(({ id: currentId }) => currentId === evidenceId)), 'CORRECTED_CLAIM_EVIDENCE_BINDING_REQUIRED');
      const revision = subject.revision + 1; const correctionId = `correction-${revision}`;
      const correction = { id: correctionId, claimId, displayedClaim, reportIdentity, claimEvidenceIds: [...new Set(claimEvidenceIds)], text: text.trim(), previousAnswerId, capturedAt: new Date().toISOString(), status: 'athlete_correction_not_third_party_proof' };
      const next = { ...subject, revision, corrections: [...subject.corrections, correction], evidence: [...subject.evidence, { id: correctionId, rootId: correctionId, text: text.trim(), actor: 'athlete', kind: 'correction', audience: 'private', eventTime: null, revisesClaim: claimId }] };
      await this.append(`${id}-v${revision}.json`, next); return next;
    });
  }
}
