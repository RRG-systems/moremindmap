import {Buffer} from 'node:buffer';
import { BUNDLED_BIBLE_FILES_BASE64, BUNDLED_BIBLE_MANIFEST_BASE64 } from '../../../api/engine/newBosProductionReadinessV1/bundledBibleAuthority.js';
import { hash, requireThat } from './contract.js';

export function getAuthority() {
  const manifest = JSON.parse(Buffer.from(BUNDLED_BIBLE_MANIFEST_BASE64, 'base64').toString());
  const selected = [1, 2, 3, 4, 5, 6, 10, 11, 14, 15];
  return selected.map(number => {
    const entry = manifest.bibles.find(x => x.number === number);
    const full = Buffer.from(BUNDLED_BIBLE_FILES_BASE64[entry.path], 'base64').toString();
    requireThat(hash(full) === entry.sha256, 'ADULT_AUTHORITY_HASH_MISMATCH');
    let excerpts;
    if (number === 1) {
      excerpts = [full.slice(0, full.indexOf('## 4. Canonical Eight-Vector'))];
      for (const block of full.split(/(?=^# \d{2}\. )/m).slice(1, 9)) {
        excerpts.push(block.slice(0, block.indexOf('## Continuum / Regional Model')));
      }
    } else {
      // Exact source excerpts; no synthesized replacement doctrine.
      const cut = full.indexOf('## Internal Calculations');
      excerpts = [full.slice(0, Math.min(cut > 0 ? cut : 10500, 10500))];
    }
    return { number, title: entry.title, source_sha256: entry.sha256, excerpts, excerpt_sha256: hash(excerpts) };
  });
}
