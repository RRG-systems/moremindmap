/* global process */
import { createPublicSiteService } from './service.js';
import { createProfileStateReader } from './profileStateReader.js';
import { createRedisPublicStore } from './redisStore.js';

export function createPublicRuntime(env = process.env, options = {}) {
  const store = options.store || createRedisPublicStore(env);
  const service = createPublicSiteService({
    store,
    startSigningKey: env.PUBLIC_PRODUCT_START_SIGNING_KEY,
    complimentaryPepper: env.PUBLIC_COMPLIMENTARY_PEPPER,
    complimentaryManifest: env.PUBLIC_COMPLIMENTARY_MANIFEST || '[]',
    profileStateReader: options.profileStateReader || createProfileStateReader(store),
    ownershipVerifier: options.ownershipVerifier,
    inquiryTransport: options.inquiryTransport,
  });
  return { store, service };
}

export async function closePublicRuntime(runtime) {
  if (runtime?.store?.close) await runtime.store.close();
}
