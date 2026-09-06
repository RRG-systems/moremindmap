import { createPurchaseIntentHandler } from '../../src/lib/publicSiteAirlockV1/handlers.js';
import { closePublicRuntime, createPublicRuntime } from '../../src/lib/publicSiteAirlockV1/runtime.js';
import { createStripeCheckoutProvider } from '../../src/lib/publicSiteAirlockV1/stripeCheckoutProvider.js';

export default createPurchaseIntentHandler({
  serviceFactory: async () => {
    const runtime = createPublicRuntime();
    return { ...runtime, close: () => closePublicRuntime(runtime) };
  },
  checkoutProviderFactory: createStripeCheckoutProvider,
});

