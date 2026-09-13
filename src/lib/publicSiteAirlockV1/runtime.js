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
import { resolvePublicSiteOrigin } from './publicSiteOrigin.js';
import { publicSubscriptionAccessConfigured, runtimeFlags } from './security.js';
import { createPaidMembershipBinder } from '../../../api/stripe/paidMembership.js';
import { createCurrentNewBaMembershipReadinessReader } from '../../../api/stripe/paidMembershipReadiness.js';
import { resolvePaidEntitlementFromStore } from '../../../api/engine/subscriptionV1/paidRuntimeInfrastructure.js';

export function createPublicRuntime(env = process.env, options = {}) {
  const store = options.store || createRedisPublicStore(env);
  const ownerReader = options.ownerReader || createCanonicalProfileOwnerReader(store);
  const profileStateReader = options.profileStateReader || createProfileStateReader(store);
  const ownership = options.ownership || createProfileOwnershipAdapter({
    store,
    ownerReader,
    transport: options.ownershipTransport || createResendOwnershipTransport({ env }),
    signingKey: env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY,
    audience: options.ownershipAudience || resolveProfileOwnershipAudience(env),
    clock: options.clock,
    tokenFactory: options.ownershipTokenFactory,
    minimumResponseDelayMs: options.ownershipMinimumResponseDelayMs,
    monotonicClock: options.monotonicClock,
    delay: options.delay,
  });
  const inquiryTransport = options.inquiryTransport
    || (publicInquiryTransportConfigured(env) ? createResendInquiryTransportFromEnv(env) : null);
  const flags = runtimeFlags(env);
  const ownershipVerifier = options.ownershipVerifier || ((input) => ownership.verifyRequest(input));
  const currentNewBaReadinessReader = options.currentNewBaReadinessReader
    || (flags.subscription_checkout_enabled ? createCurrentNewBaMembershipReadinessReader({
      store,
      namespace: env.NEW_BA_DERIVED_NAMESPACE,
    }) : null);
  const monthlyMembershipBinder = options.monthlyMembershipBinder
    || (flags.subscription_checkout_enabled ? createPaidMembershipBinder({
      store,
      ownerReader,
      profileStateReader,
      ownershipVerifier,
      currentNewBaReadinessReader,
      clock: options.clock,
    }) : null);
  const service = createPublicSiteService({
    store,
    startSigningKey: env.MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY,
    complimentaryPepper: env.MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_PEPPER,
    complimentaryManifest: env.MOREMINDMAP_SERVER_ONLY_COMPLIMENTARY_MANIFEST || '[]',
    complimentaryFlowAudience: options.complimentaryFlowAudience || resolvePublicSiteOrigin(env),
    profileStateReader,
    ownershipVerifier,
    monthlyMembershipBinder,
    monthlyCheckoutEnabled: flags.subscription_checkout_enabled,
    monthlyEntitlementResolver: options.monthlyEntitlementResolver || resolvePaidEntitlementFromStore,
    subscriptionDestination: publicSubscriptionAccessConfigured(env)
      ? env.PUBLIC_SUBSCRIPTION_DESTINATION
      : null,
    inquiryTransport,
  });
  return { store, service, ownership };
}

export async function closePublicRuntime(runtime) {
  if (runtime?.store?.close) await runtime.store.close();
}
