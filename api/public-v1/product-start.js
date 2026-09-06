import { createProductStartHandler } from '../../src/lib/publicSiteAirlockV1/handlers.js';
import { closePublicRuntime, createPublicRuntime } from '../../src/lib/publicSiteAirlockV1/runtime.js';

export default createProductStartHandler({
  serviceFactory: async () => {
    const runtime = createPublicRuntime();
    return { ...runtime, close: () => closePublicRuntime(runtime) };
  },
});

