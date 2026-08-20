import { CONTRACTS, FUTURE_ROLES } from './constants.js'
import { canonicalHash, deepFreeze, invariant, unique } from './utils.js'
import { validateVerticalBusinessRealityModel } from './vbrm.js'

function sameIdentity(left, right) {
  return left.business_id === right.business_id
    && left.owner_profile_id.toLowerCase() === right.owner_profile_id.toLowerCase()
}

export function buildWbmCompatibilityAdapter({ vbrm, acceptedWbm, fiveFutures, oneMove, lineage }) {
  validateVerticalBusinessRealityModel(vbrm)
  invariant(acceptedWbm.validation_receipt?.status === 'PASS', 'ADAPTER_WBM_INVALID', 'Accepted WBM validation receipt is not PASS.')
  invariant(sameIdentity(vbrm.identity, acceptedWbm.assessment_identity), 'ADAPTER_IDENTITY', 'VBRM and WBM identities do not match.')
  invariant(fiveFutures.whole_business_model_binding.whole_business_model_hash === acceptedWbm.state_hash, 'ADAPTER_FUTURES_WBM', 'Five Futures is not bound to the accepted WBM.')
  invariant(oneMove.whole_business_model_binding.hash === acceptedWbm.state_hash, 'ADAPTER_MOVE_WBM', 'One Move is not bound to the accepted WBM.')
  invariant(oneMove.five_futures_binding.hash === fiveFutures.artifact_hash, 'ADAPTER_MOVE_FUTURES', 'One Move is not bound to the accepted Five Futures artifact.')
  invariant(JSON.stringify(fiveFutures.futures.map((future) => future.future_role)) === JSON.stringify(FUTURE_ROLES), 'ADAPTER_FUTURE_ROLES', 'Five Futures roles or order have drifted.')
  invariant(fiveFutures.futures.reduce((sum, future) => sum + future.normalized_relative_support_weight, 0) === 100, 'ADAPTER_FUTURE_WEIGHT', 'Five Futures weights must total exactly 100.')
  invariant(lineage.cross_artifact_lineage_hash, 'ADAPTER_LINEAGE', 'Frozen cross-artifact lineage is required.')

  const vbrmEvidence = unique(vbrm.claims.flatMap((claim) => claim.evidence_refs))
  const wbmEvidence = new Set(acceptedWbm.source_integrity.evidence_refs)
  invariant(vbrmEvidence.every((ref) => wbmEvidence.has(ref)), 'ADAPTER_EVIDENCE_EXPANSION', 'VBRM compatibility projection introduced evidence outside the accepted WBM.')

  const adapter = {
    contract_id: CONTRACTS.adapter,
    contract_version: '1.0.0',
    schema_version: '1.0.0',
    mode: 'FROZEN_ACCEPTED_WBM_COMPATIBILITY_PROJECTION',
    input: {
      vbrm_version: vbrm.contract_version,
      vbrm_hash: vbrm.state_hash,
      evidence_packet_hash: vbrm.state_lineage.evidence_packet_hash,
    },
    output: {
      accepted_wbm_reused: true,
      accepted_wbm_version: acceptedWbm.contract_version,
      accepted_wbm_hash: acceptedWbm.state_hash,
      five_futures_hash: fiveFutures.artifact_hash,
      one_move_hash: oneMove.artifact_hash,
      cross_artifact_lineage_hash: lineage.cross_artifact_lineage_hash,
    },
    semantic_change: false,
    provider_call_required: false,
    raw_evidence_reconstruction_claimed: false,
    causality_source: 'The accepted WBM remains the frozen frontier causal checkpoint; this adapter proves compatibility and does not re-synthesize it.',
  }
  adapter.adapter_hash = canonicalHash(adapter)
  return deepFreeze(adapter)
}

