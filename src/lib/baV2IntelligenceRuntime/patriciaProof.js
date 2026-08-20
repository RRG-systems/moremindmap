import { buildBusinessTwin, projectCustomerSafeBusinessTwin } from './businessTwin.js'
import { createRealEstateCassetteRuntime } from './cassette.js'
import { buildWbmCompatibilityAdapter } from './compatibility.js'
import { runDiagnosticLenses } from './diagnosticLenses.js'
import { createUniversalDoctrineRuntime } from './doctrine.js'
import { buildUniversalEToPState } from './eToP.js'
import { loadBaV2FrozenAuthorityPacket, loadFrozenPatriciaRuntimeProof } from './nodeAuthorityLoader.js'
import { evaluateBusinessRecognition } from './recognition.js'
import { buildVerticalBusinessRealityModel } from './vbrm.js'
import { canonicalHash, deepFreeze } from './utils.js'

export async function buildFrozenPatriciaBaV2Proof(repositoryRoot) {
  const authority = await loadBaV2FrozenAuthorityPacket(repositoryRoot)
  const frozen = await loadFrozenPatriciaRuntimeProof(repositoryRoot)
  const evidenceRef = (...questions) => questions.map((question) => `${frozen.evidenceManifest.assessment_id}-${question}`)

  const doctrineRuntime = createUniversalDoctrineRuntime()
  const eToPRuntime = buildUniversalEToPState({
    evidenceByDimension: {
      MODELS: { state: 'TRANSITIONAL', evidence_refs: evidenceRef('q2', 'q8'), confidence: 'MODERATE', rationale: 'A defined current operating model and desired delegated future are present, while feasibility and economics remain only partly governed.' },
      SYSTEMS: { state: 'ENTREPRENEURIAL', evidence_refs: evidenceRef('q5', 'q8'), confidence: 'MODERATE', rationale: 'Core workflows are articulated, but repeatability, data completeness and transfer from the operator are not directly corroborated.' },
      TOOLS: { state: 'TRANSITIONAL', evidence_refs: evidenceRef('q5', 'q12'), confidence: 'MODERATE', rationale: 'A database and CRM direction exist, but governed completeness and daily operating use remain unfinished.' },
      ACCOUNTABILITY: { state: 'ENTREPRENEURIAL', evidence_refs: evidenceRef('q7', 'q11'), confidence: 'MODERATE', rationale: 'External coaching exists, while recurring operating ownership and inspection remain mostly self-held or absent.' },
      COACHING: { state: 'TRANSITIONAL', evidence_refs: evidenceRef('q7'), confidence: 'MODERATE', rationale: 'Coaching is present for development and recruiting; application to the active operating constraint is not directly evidenced.' },
      ONGOING_EDUCATION: { state: 'MISSING', evidence_refs: [], missing_evidence_refs: ['patricia-missing-direct-operating-corroboration-v1'], confidence: 'LOW', rationale: 'The governed assessment does not establish an applied ongoing-education loop tied to a current capability gap.' },
    },
  })
  const cassetteRuntime = createRealEstateCassetteRuntime({
    territoryRegistry: authority.territoryRegistry,
    lensRegistry: authority.lensRegistry,
    evidenceManifest: frozen.evidenceManifest,
  })
  const lensRuntime = runDiagnosticLenses({
    lensRegistry: authority.lensRegistry,
    cassetteRuntime,
    signals: {
      goal: { state: 'SUPPORTED', evidence_refs: evidenceRef('q2') },
      operator_problem_label: { state: 'INSUFFICIENT', evidence_refs: evidenceRef('q1') },
      opportunity_flow: { state: 'UNKNOWN', evidence_refs: evidenceRef('q1', 'q4', 'q6') },
      conversion: { state: 'UNKNOWN', evidence_refs: evidenceRef('q8') },
      capacity: { state: 'CONSTRAINED', evidence_refs: evidenceRef('q11', 'q12') },
    },
    contradictions: frozen.wbm.epistemic_state.contradictions,
    missingEvidence: frozen.wbm.epistemic_state.missing_evidence,
    governingConstraint: { meaning: frozen.wbm.governing_constraint.candidate },
    downstreamReady: true,
  })
  const vbrm = buildVerticalBusinessRealityModel({
    acceptedWbm: frozen.wbm,
    authorityBinding: authority.authorityBinding,
    cassetteRuntime,
    lensRuntime,
    eToPRuntime,
    evidenceManifest: frozen.evidenceManifest,
  })
  const compatibilityAdapter = buildWbmCompatibilityAdapter({
    vbrm,
    acceptedWbm: frozen.wbm,
    fiveFutures: frozen.futures,
    oneMove: frozen.oneMove,
    lineage: frozen.lineage,
  })
  const businessTwin = buildBusinessTwin({
    vbrm,
    acceptedWbm: frozen.wbm,
    fiveFutures: frozen.futures,
    oneMove: frozen.oneMove,
    lineage: frozen.lineage,
    territoryRegistry: authority.territoryRegistry,
    adapter: compatibilityAdapter,
  })
  const customerSafeTwin = projectCustomerSafeBusinessTwin(businessTwin)
  const recognition = evaluateBusinessRecognition(businessTwin)

  return deepFreeze({
    authority,
    frozen,
    doctrineRuntime,
    eToPRuntime,
    cassetteRuntime,
    lensRuntime,
    vbrm,
    compatibilityAdapter,
    businessTwin,
    customerSafeTwin,
    recognition,
    executionReceipt: {
      mode: 'OFFLINE_FROZEN_COMPATIBILITY_PROJECTION',
      provider_calls: 0,
      retrieval_calls: 0,
      customer_mutations: 0,
      accepted_intelligence_regenerated: false,
      runtime_hash: canonicalHash({
        vbrm_hash: vbrm.state_hash,
        twin_hash: businessTwin.twin_hash,
        adapter_hash: compatibilityAdapter.adapter_hash,
      }),
    },
  })
}

