import { applyLayer3Translations } from './premiumSurfaceAdapter.js';
import { validateLayer3TranslationBundle } from './translationValidator.js';

const APPROVED_TRANSLATION_SOURCES = new Set(['cache', 'gpt_translation']);

/**
 * Apply Layer 3 only when the bundle is validated and its receipt identifies
 * an approved source. Every other state returns the exact Layer 2 object.
 */
export function resolveLayer3CustomerViewModel(viewModel, packet, result) {
  if (!packet
      || !result?.bundle
      || !APPROVED_TRANSLATION_SOURCES.has(result?.receipt?.source)
      || !validateLayer3TranslationBundle(packet, result.bundle).valid) {
    return viewModel;
  }

  try {
    return applyLayer3Translations(viewModel, packet, result.bundle, result.receipt);
  } catch {
    return viewModel;
  }
}

export default resolveLayer3CustomerViewModel;
