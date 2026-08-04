import { deepFreeze } from '../../../validation.js';
import {
  samePrivateRuntimeScope,
} from '../contracts.js';
import {
  createPrivateRuntimeIntelligenceExecutionV1,
} from '../intelligenceExecution.js';
import {
  createPrivateLiveProductStoreV1,
} from './privateLiveProductStore.js';

export const PRIVATE_RUNTIME_COHORT_INTELLIGENCE_EXECUTION_VERSION =
  'private-runtime-cohort-intelligence-execution-v1';

const frozen = (value) => deepFreeze(structuredClone(value));

export function createPrivateRuntimeCohortIntelligenceExecutionV1({
  client,
  namespacePrefix,
  resolveMemberBindings,
  conversationProvider = null,
  conversationProviderBinding = null,
  conversationProviderCohortSha256 = null,
  clock = () => new Date().toISOString(),
} = {}) {
  if (client == null
    || typeof namespacePrefix !== 'string'
    || typeof resolveMemberBindings !== 'function') {
    throw new TypeError('cohort intelligence execution dependencies required');
  }

  async function execute(input = {}) {
    const exactScope = input?.request?.exact_scope;
    const resolution = await resolveMemberBindings(exactScope?.profile_id);
    if (!resolution?.valid
      || !samePrivateRuntimeScope(
        exactScope,
        resolution.value?.product_execution_binding?.exact_scope,
      )) {
      return frozen({
        ok: false,
        allowed: false,
        status: 403,
        code: 'APPROVED_PROFILE_COHORT_MEMBER_NOT_FOUND',
      });
    }
    const execution = createPrivateRuntimeIntelligenceExecutionV1({
      productStore: createPrivateLiveProductStoreV1({
        client,
        namespacePrefix,
        exactScope: resolution.value.product_execution_binding.exact_scope,
        clock,
      }),
      binding: resolution.value.product_execution_binding,
      productBindingAttestation: resolution.value.product_binding_attestation,
      conversationProvider,
      conversationProviderBinding,
      conversationProviderCohortSha256,
      clock,
    });
    const result = await execution.execute(input);
    return result?.ok === true
      ? frozen({
          ...result,
          cohort_scope_hash:
            resolution.value.product_execution_binding.exact_scope_hash,
          process_local_profile_cache_used: false,
        })
      : result;
  }

  return Object.freeze({
    execution_version: PRIVATE_RUNTIME_COHORT_INTELLIGENCE_EXECUTION_VERSION,
    configured: true,
    source_default_off: true,
    private_beta_only: true,
    public_access: false,
    append_only: true,
    immutable_history: true,
    process_local_profile_cache: false,
    execute,
  });
}
