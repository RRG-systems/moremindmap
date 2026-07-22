import { deepFreeze } from '../../validation.js';
import { liveSessionSemanticHash } from './contracts.js';
import { transitionSessionArtifact } from './stateMachines.js';

export function queueArtifactForReview(artifact) { const moved = transitionSessionArtifact(artifact.lifecycle_state, 'QUEUE_REVIEW'); return deepFreeze(moved.ok ? { ok: true, artifact: { ...artifact, lifecycle_state: moved.current, version: artifact.version + 1 } } : moved); }

export function reviewArtifact({ artifact, action, coach_id, reviewed_at, edited_content_reference = null }) {
  const moved = transitionSessionArtifact(artifact.lifecycle_state, action); if (!moved.ok) return moved;
  if (!coach_id || !reviewed_at) return deepFreeze({ ok: false, code: 'EXPLICIT_REVIEW_REQUIRED' });
  if (action === 'EDIT' && !edited_content_reference) return deepFreeze({ ok: false, code: 'EDIT_REFERENCE_REQUIRED' });
  const reviewed = { ...artifact, artifact_id: action === 'EDIT' ? `artifact_review_${liveSessionSemanticHash({ source: artifact.artifact_id, edited_content_reference }).slice(0, 24)}` : artifact.artifact_id, lifecycle_state: moved.current, content_reference: edited_content_reference || artifact.content_reference, original_artifact_id: action === 'EDIT' ? artifact.artifact_id : artifact.original_artifact_id, reviewed_by: coach_id, reviewed_at, review_action: action, version: artifact.version + 1, canonical_authority: false };
  return deepFreeze({ ok: true, artifact: reviewed, preserved_original: structuredClone(artifact) });
}
