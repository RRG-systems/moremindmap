import { redis as getRedis } from '../engine/redisClient.js';
import { createBosIntakeDraftStore } from '../engine/bosIntakeDraftV1.js';

function jsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-BOS-Draft-Token');
}

function token(req) {
  return String(req.headers['x-bos-draft-token'] || '').trim();
}

function customerError(res, status, code, message) {
  return res.status(status).json({ success: false, code, error: message });
}

export default async function handler(req, res) {
  jsonHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return customerError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');

  try {
    const store = createBosIntakeDraftStore({ redis: getRedis() });
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (action === 'create') {
      const created = await store.create(req.body?.snapshot);
      return res.status(201).json({ success: true, state: 'SAVED', ...created });
    }

    const draftId = String(req.body?.draft_id || '').trim();
    const resumeToken = token(req);
    if (!draftId || !resumeToken) {
      return customerError(res, 400, 'BOS_DRAFT_REFERENCE_REQUIRED', 'Your saved assessment could not be verified.');
    }

    if (action === 'resume') {
      const result = await store.resume({ draftId, resumeToken });
      if (result.code === 'NOT_FOUND') {
        return customerError(res, 404, 'BOS_DRAFT_NOT_FOUND', 'This saved assessment is no longer available.');
      }
      return res.status(200).json({ success: true, state: 'RESTORED', ...result.record });
    }

    if (action === 'discard') {
      const result = await store.discard({ draftId, resumeToken });
      if (result.code === 'NOT_FOUND') {
        return customerError(res, 404, 'BOS_DRAFT_NOT_FOUND', 'This saved assessment is no longer available.');
      }
      return res.status(200).json({ success: true, state: 'DISCARDED', code: 'BOS_DRAFT_DISCARDED' });
    }

    if (action === 'update') {
      const result = await store.update({
        draftId,
        resumeToken,
        baseRevision: req.body?.base_revision,
        mutationId: req.body?.mutation_id,
        snapshot: req.body?.snapshot
      });
      if (result.code === 'NOT_FOUND') {
        return customerError(res, 404, 'BOS_DRAFT_NOT_FOUND', 'This saved assessment is no longer available.');
      }
      if (result.code === 'STALE_REVISION') {
        return res.status(409).json({
          success: false,
          code: 'BOS_DRAFT_STALE_REVISION',
          error: 'A newer saved version already exists. Restore it before continuing.',
          revision: result.revision,
          updated_at: result.updated_at
        });
      }
      if (result.code === 'ALREADY_SUBMITTED') {
        return res.status(409).json({ success: false, code: 'BOS_DRAFT_ALREADY_SUBMITTED', error: 'This assessment was already submitted.' });
      }
      return res.status(200).json({ success: true, state: result.code, ...result.record });
    }

    return customerError(res, 400, 'BOS_DRAFT_ACTION_UNSUPPORTED', 'Saved-assessment action is not supported.');
  } catch (error) {
    const code = error?.code || 'BOS_DRAFT_UNAVAILABLE';
    const status = code === 'BOS_DRAFT_IDENTITY_REQUIRED' ? 400 : 500;
    return customerError(
      res,
      status,
      code,
      status === 400 ? 'Your name and email are required before progress can be saved.' : 'Your progress could not be saved right now. Your answers remain on this device.'
    );
  }
}
