import { useEffect, useMemo, useState } from 'react';

import { buildDeterministicLayer3Translation } from '../../lib/bosCustomerIntelligence/deterministicFallback.js';
import { applyLayer3Translations } from '../../lib/bosCustomerIntelligence/premiumSurfaceAdapter.js';
import { buildLayer3SemanticPacket } from '../../lib/bosCustomerIntelligence/semanticPacket.js';
import { getCachedLayer3Translation } from '../../lib/bosCustomerIntelligence/translationCache.js';
import { validateLayer3TranslationBundle } from '../../lib/bosCustomerIntelligence/translationValidator.js';
import FinalBOSCustomerReport from './FinalBOSCustomerReport.jsx';

function layer3Enabled() {
  return import.meta.env.VITE_BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED === 'true';
}

function prepareLayer3(viewModel, enabled) {
  if (!enabled) return { packet: null, viewModel };
  try {
    const packet = buildLayer3SemanticPacket(viewModel);
    const bundle = getCachedLayer3Translation(packet)
      || buildDeterministicLayer3Translation(packet);
    return {
      packet,
      viewModel: applyLayer3Translations(viewModel, packet, bundle, {
        source: 'deterministic_fallback',
        reason: 'awaiting_validated_translation',
      }),
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    (async () => {
      try {
        const response = await fetch('/api/moremindmap/customer-intelligence', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packet: prepared.packet }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!validateLayer3TranslationBundle(prepared.packet, result?.bundle).valid) return;
        setRemoteTranslation({
          sourceHash: prepared.packet.semantic_hash,
          bundle: result.bundle,
          receipt: result.receipt || null,
        });
      } catch {
        // The deterministic, validated projection remains visible.
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
    ? applyLayer3Translations(
        viewModel,
        prepared.packet,
        remoteTranslation.bundle,
        remoteTranslation.receipt,
      )
    : prepared.viewModel;

  return <FinalBOSCustomerReport viewModel={customerViewModel} />;
}
