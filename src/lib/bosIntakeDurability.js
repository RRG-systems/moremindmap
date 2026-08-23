export const BOS_DRAFT_STORAGE_KEY = 'moremindmap_bos_intake_draft_v1';
export const BOS_DRAFT_CONTRACT_VERSION = 'bos_intake_draft_v1';

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function createBosDraftSnapshot({ phase, step = 0, metadata, responses = {} }) {
  return {
    contract_version: BOS_DRAFT_CONTRACT_VERSION,
    phase,
    step,
    metadata: safeObject(metadata),
    responses: safeObject(responses)
  };
}

export function loadBosDraftEnvelope(storage = globalThis?.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(BOS_DRAFT_STORAGE_KEY) || 'null');
    if (
      parsed?.contract_version !== BOS_DRAFT_CONTRACT_VERSION ||
      typeof parsed?.draft_id !== 'string' ||
      typeof parsed?.resume_token !== 'string' ||
      !Number.isInteger(parsed?.revision)
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBosDraftEnvelope(envelope, storage = globalThis?.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(BOS_DRAFT_STORAGE_KEY, JSON.stringify({
      contract_version: BOS_DRAFT_CONTRACT_VERSION,
      draft_id: envelope.draft_id,
      resume_token: envelope.resume_token,
      revision: envelope.revision,
      updated_at: envelope.updated_at || new Date().toISOString(),
      snapshot: envelope.snapshot
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearBosDraftEnvelope(storage = globalThis?.localStorage) {
  try {
    storage?.removeItem(BOS_DRAFT_STORAGE_KEY);
  } catch {
    // A blocked storage surface must not prevent server-side cleanup.
  }
}

function responseJson(response) {
  return response.json().catch(() => ({}));
}

export function createBosDraftCoordinator({
  fetchImpl = globalThis.fetch,
  storage = globalThis?.localStorage,
  endpoint = '/api/moremindmap/bos-draft',
  newMutationId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
} = {}) {
  let envelope = loadBosDraftEnvelope(storage);
  let queue = Promise.resolve();

  function persistLocal(nextEnvelope) {
    if (saveBosDraftEnvelope(nextEnvelope, storage)) return;
    const error = new Error('This browser could not retain the saved-assessment resume key.');
    error.code = 'BOS_DRAFT_LOCAL_PERSISTENCE_UNAVAILABLE';
    throw error;
  }

  function request(action, body, resumeToken = envelope?.resume_token) {
    return fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(resumeToken ? { 'X-BOS-Draft-Token': resumeToken } : {})
      },
      body: JSON.stringify({ action, ...body })
    });
  }

  async function restore() {
    if (!envelope) return { ok: false, code: 'NO_LOCAL_DRAFT' };
    const response = await request('resume', { draft_id: envelope.draft_id });
    const data = await responseJson(response);
    if (!response.ok) return { ok: false, code: data.code || 'BOS_DRAFT_RESTORE_FAILED', local: envelope };
    envelope = {
      contract_version: BOS_DRAFT_CONTRACT_VERSION,
      draft_id: data.draft_id,
      resume_token: envelope.resume_token,
      revision: data.revision,
      updated_at: data.updated_at,
      snapshot: data.snapshot
    };
    persistLocal(envelope);
    return { ok: true, envelope };
  }

  async function saveNow(snapshot) {
    if (!envelope) {
      const response = await request('create', { snapshot }, null);
      const data = await responseJson(response);
      if (!response.ok) throw Object.assign(new Error(data.error || 'BOS_DRAFT_CREATE_FAILED'), { code: data.code });
      envelope = {
        contract_version: BOS_DRAFT_CONTRACT_VERSION,
        draft_id: data.draft_id,
        resume_token: data.resume_token,
        revision: data.revision,
        updated_at: data.updated_at,
        snapshot: data.snapshot
      };
      persistLocal(envelope);
      return envelope;
    }

    // Mirror the newest customer state locally before the network boundary.
    persistLocal({ ...envelope, snapshot });
    const mutationId = newMutationId();
    const response = await request('update', {
      draft_id: envelope.draft_id,
      base_revision: envelope.revision,
      mutation_id: mutationId,
      snapshot
    });
    const data = await responseJson(response);
    if (response.status === 409 && data.code === 'BOS_DRAFT_STALE_REVISION') {
      const restored = await restore();
      const error = new Error('A newer saved assessment was restored. Review it before continuing.');
      error.code = 'BOS_DRAFT_STALE_REVISION';
      error.restored = restored;
      throw error;
    }
    if (!response.ok) throw Object.assign(new Error(data.error || 'BOS_DRAFT_UPDATE_FAILED'), { code: data.code });
    envelope = {
      ...envelope,
      revision: data.revision,
      updated_at: data.updated_at,
      snapshot: data.snapshot
    };
    persistLocal(envelope);
    return envelope;
  }

  function save(snapshot) {
    const operation = queue.then(() => saveNow(snapshot));
    queue = operation.catch(() => undefined);
    return operation;
  }

  async function flush() {
    await queue;
    return envelope;
  }

  function clear() {
    envelope = null;
    clearBosDraftEnvelope(storage);
  }

  async function discard() {
    const current = envelope;
    if (!current) {
      clear();
      return { ok: true, code: 'NO_DRAFT' };
    }
    try {
      const response = await request('discard', { draft_id: current.draft_id }, current.resume_token);
      const data = await responseJson(response);
      if (!response.ok && response.status !== 404) {
        return { ok: false, code: data.code || 'BOS_DRAFT_DISCARD_FAILED' };
      }
      return { ok: true, code: data.code || 'DISCARDED' };
    } finally {
      clear();
    }
  }

  return Object.freeze({
    hasLocalDraft: () => Boolean(envelope),
    localEnvelope: () => envelope,
    restore,
    save,
    flush,
    discard,
    clear
  });
}
