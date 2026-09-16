import { fileURLToPath } from 'node:url';
import {
  createReadOnlySourceLibrary,
  LOAN_ORIGINATOR_SOURCE_NAMESPACES,
  LOAN_ORIGINATOR_SOURCE_TOOLS,
  MORE_SOURCE_NAMESPACES,
  MORE_SOURCE_TOOLS,
} from './readOnlySources.js';
import { LOAN_ORIGINATOR_SOURCE_REGISTRY_SHA256 } from './sourceLibrary/loanOriginatorPin.js';
import { SOURCE_REGISTRY_SHA256 } from './sourceLibrary/pin.js';

let library;
let loanOriginatorLibrary;

function unavailableLibrary({ registrySha256, namespaces, tools }) {
  return Object.freeze({
    info: Object.freeze({
      status: 'UNAVAILABLE',
      registry_sha256: registrySha256,
      document_count: 0,
      namespaces,
      customer_truth_override_allowed: false,
    }),
    tools,
    execute: () => ({
      ok: false,
      code: 'SOURCE_LIBRARY_UNAVAILABLE',
      results: [],
      customer_truth_override_allowed: false,
    }),
  });
}

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
    return unavailableLibrary({
      registrySha256: SOURCE_REGISTRY_SHA256,
      namespaces: MORE_SOURCE_NAMESPACES,
      tools: MORE_SOURCE_TOOLS,
    });
  }
}

export function pinnedLoanOriginatorSubscriptionSources() {
  try {
    loanOriginatorLibrary ||= createReadOnlySourceLibrary({
      registryPath: fileURLToPath(new URL('./sourceLibrary/LOAN_ORIGINATOR_SOURCE_REGISTRY.json', import.meta.url)),
      expectedRegistrySha256: LOAN_ORIGINATOR_SOURCE_REGISTRY_SHA256,
      namespaces: LOAN_ORIGINATOR_SOURCE_NAMESPACES,
      tools: LOAN_ORIGINATOR_SOURCE_TOOLS,
    });
    return loanOriginatorLibrary;
  } catch {
    return unavailableLibrary({
      registrySha256: LOAN_ORIGINATOR_SOURCE_REGISTRY_SHA256,
      namespaces: LOAN_ORIGINATOR_SOURCE_NAMESPACES,
      tools: LOAN_ORIGINATOR_SOURCE_TOOLS,
    });
  }
}
