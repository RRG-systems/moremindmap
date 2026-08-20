import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { invariant } from './utils.js'

async function readJson(repositoryRoot, relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'))
}

async function sha256File(repositoryRoot, relativePath) {
  return createHash('sha256').update(await readFile(path.join(repositoryRoot, relativePath))).digest('hex')
}

async function replayManifestArtifacts(repositoryRoot, manifest) {
  const artifacts = manifest.artifacts_excluding_self_and_master_index || []
  for (const artifact of artifacts) {
    const actual = await sha256File(repositoryRoot, artifact.path)
    invariant(actual === artifact.sha256, 'RUN1_MANIFEST_REPLAY', `Run 1 artifact hash drift: ${artifact.path}.`)
  }
  return artifacts.length
}

async function replayBibleManifest(repositoryRoot, baseDir, manifest) {
  for (const artifact of manifest.artifacts) {
    const actual = await sha256File(repositoryRoot, path.posix.join(baseDir, artifact.path))
    invariant(actual === artifact.sha256, 'BIBLE_HASH_DRIFT', `Frozen authority hash drift: ${artifact.authority_id}.`)
  }
}

export async function loadBaV2FrozenAuthorityPacket(repositoryRoot) {
  const run1Dir = 'docs/ba-v2-run-1-architecture-contract-lock'
  const libraryDir = 'docs/ba-intelligence-authority-library-v1'
  const [run1Manifest, territoryRegistry, lensRegistry, universalManifest, verticalManifest] = await Promise.all([
    readJson(repositoryRoot, `${run1Dir}/BA_V2_ARCHITECTURE_MANIFEST.json`),
    readJson(repositoryRoot, `${run1Dir}/REAL_ESTATE_BUSINESS_TERRITORY_REGISTRY_V2.json`),
    readJson(repositoryRoot, `${run1Dir}/REAL_ESTATE_DIAGNOSTIC_LENS_REGISTRY_V1.json`),
    readJson(repositoryRoot, `${libraryDir}/freeze/UNIVERSAL_BIBLE_MANIFEST_V1.json`),
    readJson(repositoryRoot, `${libraryDir}/freeze/REAL_ESTATE_CASSETTE_MANIFEST_V1.json`),
  ])
  const run1ArtifactCount = await replayManifestArtifacts(repositoryRoot, run1Manifest)
  await replayBibleManifest(repositoryRoot, libraryDir, universalManifest)
  await replayBibleManifest(repositoryRoot, libraryDir, verticalManifest)

  const universalHashes = Object.fromEntries(universalManifest.artifacts.map((item) => [item.authority_id, item.sha256]))
  const verticalHashes = Object.fromEntries(verticalManifest.artifacts.map((item) => [item.authority_id, item.sha256]))
  return {
    run1Manifest,
    run1ArtifactCount,
    territoryRegistry,
    lensRegistry,
    universalManifest,
    verticalManifest,
    authorityBinding: {
      universal_doctrine_version: '1.0.0',
      universal_authority_hashes: universalHashes,
      vertical_authority_hashes: verticalHashes,
      territory_registry_hash: await sha256File(repositoryRoot, `${run1Dir}/REAL_ESTATE_BUSINESS_TERRITORY_REGISTRY_V2.json`),
      diagnostic_lens_registry_hash: await sha256File(repositoryRoot, `${run1Dir}/REAL_ESTATE_DIAGNOSTIC_LENS_REGISTRY_V1.json`),
      routed_authority_ids: [...Object.keys(universalHashes), ...Object.keys(verticalHashes)],
    },
  }
}

export async function loadFrozenPatriciaRuntimeProof(repositoryRoot) {
  const base = 'docs/patricia-canonical-ba-triplet-v1'
  const paths = {
    wbm: `${base}/canonical/PATRICIA_WHOLE_BUSINESS_MODEL_V1.json`,
    futures: `${base}/canonical/PATRICIA_FIVE_FUTURES_V2.json`,
    oneMove: `${base}/canonical/PATRICIA_ONE_MOVE_V2.json`,
    lineage: `${base}/canonical/PATRICIA_CANONICAL_TRIPLET_LINEAGE_MANIFEST_V1.json`,
    evidenceManifest: `${base}/receipts/PATRICIA_SANITIZED_EVIDENCE_MANIFEST_V1.json`,
  }
  const [wbm, futures, oneMove, lineage, evidenceManifest] = await Promise.all(Object.values(paths).map((relativePath) => readJson(repositoryRoot, relativePath)))
  invariant(evidenceManifest.profile_id.toLowerCase() === 'mm-20260708-dsst020z', 'PATRICIA_PROFILE', 'Frozen proof profile identity drifted.')
  invariant(evidenceManifest.assessment_id === 'ba-20260714-64ca0783', 'PATRICIA_ASSESSMENT', 'Frozen proof assessment identity drifted.')
  invariant(Object.keys(evidenceManifest.answer_receipts || {}).length === 12, 'PATRICIA_EVIDENCE_COUNT', 'Frozen proof requires 12 answer receipts.')
  invariant(wbm.state_hash === 'd51d01c4e807a3341e6b76178c8e33a0050d7bb0653b887aaaf0bfc515255eba', 'PATRICIA_WBM_HASH', 'Frozen Patricia WBM state hash drifted.')
  invariant(futures.artifact_hash === 'b245bcb9f12ef7e1cd02c6d1433ee733cff51a85a873bb98fe652db05a00d148', 'PATRICIA_FUTURES_HASH', 'Frozen Patricia Five Futures hash drifted.')
  invariant(oneMove.artifact_hash === '2e087bc4ea5b56212e7fefa5b00a33bbbb1c13e651351ca956176a017f4f4447', 'PATRICIA_MOVE_HASH', 'Frozen Patricia One Move hash drifted.')
  return { wbm, futures, oneMove, lineage, evidenceManifest, paths }
}

export { sha256File }

