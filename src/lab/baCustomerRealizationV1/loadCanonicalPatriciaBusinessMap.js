import wholeBusinessModelSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_WHOLE_BUSINESS_MODEL_V1.json?raw';
import fiveFuturesSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_FIVE_FUTURES_V2.json?raw';
import oneMoveSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_ONE_MOVE_V2.json?raw';
import lineageSource from '../../../docs/patricia-canonical-ba-triplet-v1/canonical/PATRICIA_CANONICAL_TRIPLET_LINEAGE_MANIFEST_V1.json?raw';

import { buildBusinessMapProjection } from './buildBusinessMapViewModel.js';

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadCanonicalPatriciaBusinessMap() {
  const [wholeBusinessModel, fiveFutures, oneMove, lineage] = [
    wholeBusinessModelSource, fiveFuturesSource, oneMoveSource, lineageSource,
  ].map((source) => JSON.parse(source));
  const [wholeBusinessModelHash, fiveFuturesHash, oneMoveHash, lineageHash] = await Promise.all([
    sha256Text(wholeBusinessModelSource), sha256Text(fiveFuturesSource), sha256Text(oneMoveSource), sha256Text(lineageSource),
  ]);
  return buildBusinessMapProjection({
    wholeBusinessModel,
    fiveFutures,
    oneMove,
    lineage,
    sourceFileDigests: {
      wholeBusinessModel: wholeBusinessModelHash,
      fiveFutures: fiveFuturesHash,
      oneMove: oneMoveHash,
      lineage: lineageHash,
    },
    displayName: 'Patricia Gutierrez',
  });
}
