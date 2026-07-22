import { deepFreeze } from '../../validation.js';
import { liveSessionSemanticHash, validateStructuredSessionArtifact, validateTranscriptArtifact } from './contracts.js';

export function buildTranscriptArtifact(input) {
  const value = { transcript_id: input.transcript_id, session_id: input.session_id, provider_reference: input.provider_reference, status: input.status, segments: input.segments || [], speaker_attribution: input.speaker_attribution || 'ATTRIBUTED', source_timestamps: input.source_timestamps || [], confidence: input.confidence ?? 0, redaction_state: input.redaction_state || 'NOT_REDACTED', subscriber_scope: input.subscriber_scope, privacy_class: input.privacy_class || 'RESTRICTED_SENSITIVE', schema_version: '1.0.0', policy_version: input.policy_version, created_at: input.created_at, finalized_at: input.finalized_at || null, version: input.version || 1, raw_transcript: null };
  const validation = validateTranscriptArtifact(value); return deepFreeze(validation.valid ? { ok: true, transcript: value } : { ok: false, code: 'INVALID_TRANSCRIPT_ARTIFACT', errors: validation.errors });
}

export function extractStructuredCandidates({ transcript, candidates, extraction_version = 'synthetic-extractor-v1' }) {
  const transcriptValidation = validateTranscriptArtifact(transcript); if (!transcriptValidation.valid) return deepFreeze({ ok: false, code: 'INVALID_TRANSCRIPT' });
  if (transcript.status === 'FAILED') return deepFreeze({ ok: false, code: 'TRANSCRIPT_FAILED' });
  const segmentIds = new Set(transcript.segments.map((segment) => segment.segment_id));
  const artifacts = [];
  for (const candidate of candidates || []) {
    if (!candidate.speaker_id || !candidate.source_spans?.length || candidate.source_spans.some((id) => !segmentIds.has(id))) return deepFreeze({ ok: false, code: 'UNSAFE_OR_UNATTRIBUTED_CANDIDATE' });
    if (candidate.speaker_ambiguous || candidate.unsupported_causal_claim || candidate.third_party_private || candidate.sovereignty_override || candidate.regulated_claim) return deepFreeze({ ok: false, code: 'UNSAFE_OR_UNATTRIBUTED_CANDIDATE' });
    const artifact = { artifact_id: `artifact_${liveSessionSemanticHash({ transcript: transcript.transcript_id, candidate }).slice(0, 24)}`, session_id: transcript.session_id, source_transcript_id: transcript.transcript_id, extraction_version, artifact_type: candidate.artifact_type, lifecycle_state: 'EXTRACTED', source_spans: candidate.source_spans, speaker_id: candidate.speaker_id, confidence: candidate.confidence, direct_statement: candidate.direct_statement, content_reference: candidate.content_reference, conflicts: candidate.conflicts || [], subscriber_scope: transcript.subscriber_scope, privacy_class: candidate.privacy_class || 'COACH_SHARED', schema_version: '1.0.0', policy_version: transcript.policy_version, canonical_authority: false, original_artifact_id: null, version: 1 };
    const validation = validateStructuredSessionArtifact(artifact); if (!validation.valid) return deepFreeze({ ok: false, code: 'INVALID_STRUCTURED_ARTIFACT', errors: validation.errors }); artifacts.push(artifact);
  }
  return deepFreeze({ ok: true, artifacts });
}
