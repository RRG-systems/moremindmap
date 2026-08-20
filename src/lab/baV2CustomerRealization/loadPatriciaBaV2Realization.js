import businessTwinSource from '../../../docs/ba-v2-run-2-intelligence-runtime/PATRICIA_BUSINESS_TWIN_V1.json?raw'
import vbrmSource from '../../../docs/ba-v2-run-2-intelligence-runtime/PATRICIA_VERTICAL_BUSINESS_REALITY_V1.json?raw'
import customerSafeTwinSource from '../../../docs/ba-v2-run-2-intelligence-runtime/PATRICIA_CUSTOMER_SAFE_BUSINESS_TWIN_VIEW_V1.json?raw'
import eToPSource from '../../../docs/ba-v2-run-2-intelligence-runtime/PATRICIA_E_TO_P_STATE_V1.json?raw'
import lensTraversalSource from '../../../docs/ba-v2-run-2-intelligence-runtime/PATRICIA_DIAGNOSTIC_LENS_TRAVERSAL_V1.json?raw'
import wbmSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_WHOLE_BUSINESS_MODEL_V1.json?raw'
import futuresSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_FIVE_FUTURES_V2.json?raw'
import oneMoveSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_ONE_MOVE_V2.json?raw'
import lineageSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_CANONICAL_TRIPLET_LINEAGE_MANIFEST_V1.json?raw'
import doctrineSource from '../../../docs/ba-v2-run-3-98-level-customer-realization/MORE_MINDMAP_GENERATIVE_BUSINESS_INTELLIGENCE_DOCTRINE_V1.json?raw'

import { buildBaV2CustomerRealization } from './buildBaV2CustomerRealization.js'

async function sha256(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function loadPatriciaBaV2Realization() {
  const sources = {
    businessTwin: businessTwinSource,
    vbrm: vbrmSource,
    customerSafeTwin: customerSafeTwinSource,
    eToP: eToPSource,
    lensTraversal: lensTraversalSource,
    wbm: wbmSource,
    futures: futuresSource,
    oneMove: oneMoveSource,
    lineage: lineageSource,
    doctrine: doctrineSource,
  }
  const fileDigests = Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([key, source]) => [key, await sha256(source)])))
  return buildBaV2CustomerRealization({
    ...Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, JSON.parse(source)])),
    fileDigests,
  })
}
