/* global process */
import { createPublicSiteService } from './service.js';
import { createProfileStateReader } from './profileStateReader.js';
import { createRedisPublicStore } from './redisStore.js';
import { createCanonicalProfileOwnerReader } from './canonicalProfileOwnerReader.js';
import { createProfileOwnershipAdapter, resolveProfileOwnershipAudience } from './profileOwnership.js';
import { createResendOwnershipTransport } from './resendOwnershipTransport.js';
import {
  createResendInquiryTransportFromEnv,
  publicInquiryTransportConfigured,
} from './resendInquiryTransport.js';

export function createPublicRuntime(env = process.env, options = {}) {
  const store = options.store || createRedisPublicStore(env);
  const ownership = options.ownership || createProfileOwnershipAdapter({
    store,
    ownerReader: options.ownerReader || createCanonicalProfileOwnerReader(store),
    transport: options.ownershipTransport || createResendOwnershipTransport({ env }),
    signingKey: env.PUBLIC_PROFILE_OWNERSHIP_SIGNING_KEY,
    audience: options.ownershipAudience || resolveProfileOwnershipAudience(env),
    clock: options.clock,
    tokenFactory: options.ownershipTokenFactory,
    minimumResponseDelayMs: options.ownershipMinimumResponseDelayMs,
    monotonicClock: options.monotonicClock,
    delay: options.delay,
  });
  const inquiryTransport = options.inquiryTransport
    || (publicInquiryTransportConfigured(env) ? createResendInquiryTransportFromEnv(env) : null);
  const service = createPublicSiteService({
    store,
    startSigningKey: env.PUBLIC_PRODUCT_START_SIGNING_KEY,
    complimentaryPepper: env.PUBLIC_COMPLIMENTARY_PEPPER,
    complimentaryManifest: env.PUBLIC_COMPLIMENTARY_MANIFEST || '[]',
    profileStateReader: options.profileStateReader || createProfileStateReader(store),
    ownershipVerifier: options.ownershipVerifier || ((input) => ownership.verifyRequest(input)),
    inquiryTransport,
  });
  return { store, service, ownership };
}

export async function closePublicRuntime(runtime) {
  if (runtime?.store?.close) await runtime.store.close();
}
