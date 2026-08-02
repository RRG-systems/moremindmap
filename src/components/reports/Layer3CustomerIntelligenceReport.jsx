import { useEffect, useMemo, useState } from 'react';

import { resolveLayer3CustomerViewModel } from '../../lib/bosCustomerIntelligence/customerViewModelOverlay.js';
import { buildLayer3SemanticPacket } from '../../lib/bosCustomerIntelligence/semanticPacket.js';
import {
  cacheLayer3Translation,
  getCachedLayer3Translation,
} from '../../lib/bosCustomerIntelligence/translationCache.js';
import { validateLayer3TranslationBundle } from '../../lib/bosCustomerIntelligence/translationValidator.js';
import FinalBOSCustomerReport from './FinalBOSCustomerReport.jsx';

function layer3Enabled() {
  return import.meta.env.VITE_BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED === 'true';
}

function prepareLayer3(viewModel, enabled) {
  if (!enabled) return { packet: null, viewModel };
  try {
    const packet = buildLayer3SemanticPacket(viewModel);
    const bundle = getCachedLayer3Translation(packet);
    return {
      packet,
      viewModel: resolveLayer3CustomerViewModel(viewModel, packet, bundle ? {
        bundle,
        receipt: { source: 'cache' },
      } : null),
    };
  } catch {
    return { packet: null, viewModel };
  }
}

export default function Layer3CustomerIntelligenceReport({ viewModel }) {
  const enabled = layer3Enabled();
  const prepared = useMemo(() => prepareLayer3(viewModel, enabled), [viewModel, enabled]);
  const [remoteTranslation, setRemoteTranslation] = useState(null);

  useEffect(() => {
    if (!enabled || !prepared.packet) return undefined;

    setRemoteTranslation(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    (async () => {
      try {
        const response = await fetch('/api/moremindmap/customer-intelligence', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: viewModel?.meta?.profileId,
            packet: prepared.packet,
          }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!['cache', 'gpt_translation'].includes(result?.receipt?.source)
            || !validateLayer3TranslationBundle(prepared.packet, result?.bundle).valid) return;
        cacheLayer3Translation(prepared.packet, result.bundle);
        setRemoteTranslation({
          sourceHash: prepared.packet.semantic_hash,
          bundle: result.bundle,
          receipt: result.receipt || null,
        });
      } catch {
        // The exact Layer 2 customer model remains visible.
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [enabled, prepared, viewModel]);

  const customerViewModel = remoteTranslation?.sourceHash === prepared.packet?.semantic_hash
    ? resolveLayer3CustomerViewModel(viewModel, prepared.packet, {
        bundle: remoteTranslation.bundle,
        receipt: remoteTranslation.receipt,
      })
    : prepared.viewModel;

  return <FinalBOSCustomerReport viewModel={customerViewModel} />;
}
