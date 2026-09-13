import { fileURLToPath } from 'node:url';
import { createReadOnlySourceLibrary } from './readOnlySources.js';
import { SOURCE_REGISTRY_SHA256 } from './sourceLibrary/pin.js';

let library;
export function pinnedSubscriptionSources() {
  try {
    library ||= createReadOnlySourceLibrary({
      registryPath: fileURLToPath(new URL('./sourceLibrary/SOURCE_REGISTRY.json', import.meta.url)),
      expectedRegistrySha256: SOURCE_REGISTRY_SHA256,
    });
    return library;
  } catch {
    // No replacement source or generated fallback. Ordinary coaching can still
    // answer; any lookup receives an explicit unavailable result.
    return Object.freeze({ info: { status: 'UNAVAILABLE', registry_sha256: SOURCE_REGISTRY_SHA256,
      document_count: 0, customer_truth_override_allowed: false },
      execute: () => ({ ok: false, code: 'SOURCE_LIBRARY_UNAVAILABLE', results: [], customer_truth_override_allowed: false }) });
  }
}
