import { deepFreeze } from '../../../validation.js';
import {
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
  validateSubdev1CanonicalProfileRecord,
} from './contracts.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export function validSubdev1ProfileId(value) {
  return typeof value === 'string'
    && value.length === 20
    && /^mm-\d{8}-[a-z0-9]{8}$/.test(value);
}

export function validateSubdev1ProfileRepository(value) {
  return frozen({
    valid: typeof value?.resolveExactProfile === 'function',
    missing_methods: typeof value?.resolveExactProfile === 'function'
      ? []
      : ['resolveExactProfile'],
  });
}

export function createUnavailableSubdev1ProfileRepository() {
  return Object.freeze({
    async resolveExactProfile() {
      return frozen({ status: 'UNAVAILABLE', record: null });
    },
  });
}

export function createSubdev1AuthoritativeProfileResolver({
  repository,
} = {}) {
  const repositoryValidation = validateSubdev1ProfileRepository(repository);

  async function resolve(profileId) {
    if (!validSubdev1ProfileId(profileId)) {
      return frozen({ allowed: false, code: 'PROFILE_ID_INVALID' });
    }
    if (!repositoryValidation.valid) {
      return frozen({ allowed: false, code: 'PROFILE_RESOLUTION_DENIED' });
    }
    let resolution;
    try {
      resolution = await repository.resolveExactProfile(profileId, Object.freeze({
        purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
        mutation_allowed: false,
        enumeration_allowed: false,
      }));
    } catch {
      return frozen({ allowed: false, code: 'PROFILE_RESOLUTION_DENIED' });
    }
    if (resolution?.status === 'AMBIGUOUS') {
      return frozen({ allowed: false, code: 'PROFILE_RESOLUTION_AMBIGUOUS' });
    }
    if (resolution?.status !== 'FOUND' || !resolution.record) {
      return frozen({ allowed: false, code: 'PROFILE_RESOLUTION_DENIED' });
    }
    const checked = validateSubdev1CanonicalProfileRecord(resolution.record);
    if (!checked.valid || resolution.record.profile_id !== profileId) {
      return frozen({
        allowed: false,
        code: checked.errors?.[0]?.code || 'PROFILE_SCOPE_INVALID',
      });
    }
    return frozen({
      allowed: true,
      code: null,
      record: checked.value,
      repository_mutated: false,
      enumerated: false,
    });
  }

  return Object.freeze({
    resolver_version: 'subdev1-authoritative-profile-resolver-v1',
    authoritative: repositoryValidation.valid,
    non_enumerating: true,
    mutation_authority: false,
    resolve,
  });
}
