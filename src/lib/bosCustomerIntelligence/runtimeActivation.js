import { resolveLayer3CustomerViewModel } from './customerViewModelOverlay.js';
import { validateLayer3TranslationBundle } from './translationValidator.js';

export function hasMatchingLayer3Translation(remoteTranslation, packet) {
  if (!remoteTranslation || !packet || !remoteTranslation.bundle) return false;
  if (remoteTranslation.sourceHash !== packet.semantic_hash) return false;
  return validateLayer3TranslationBundle(packet, remoteTranslation.bundle).valid;
}

export function resolveLayer3ReportViewModel(viewModel, prepared, remoteTranslation) {
  if (!hasMatchingLayer3Translation(remoteTranslation, prepared?.packet)) {
    return prepared?.viewModel ?? viewModel;
  }
  return resolveLayer3CustomerViewModel(viewModel, prepared.packet, {
    bundle: remoteTranslation.bundle,
    receipt: remoteTranslation.receipt,
  });
}
