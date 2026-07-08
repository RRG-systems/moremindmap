/**
 * MMB18/MMB205 lab-only — Customer BA view model builder.
 * Derives customer-facing structure from BA retrieve + profile + briefing lab inputs.
 * MMB205: customer_language_v2 layer at ~25/100 technicality — no Universal Translator.
 * No source mutation; production /business-assessment path not affected.
 */

import tammyFixtureV1 from './fixtures/tammyBaCustomerViewModel.json';
import tammyFixtureV2 from './fixtures/tammyBaCustomerViewModelV2.json';

export const BA_SHELL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'business-reality', label: 'Your Business Today' },
  { id: 'behavioral-os', label: 'How You Work' },
  { id: 'model-alignment', label: 'Business Fit' },
  { id: 'constraint-reality', label: "What's Holding You Back" },
  { id: 'confidence-reality', label: 'How Sure Is This?' },
  { id: 'five-futures', label: 'Where This Is Heading' },
  { id: 'one-move', label: 'Your One Move' },
  { id: 'visual-dna', label: 'Visual Maps' },
  { id: 'advanced-source', label: 'Technical Source' },
];

export function customerLanguageSections(viewModel) {
  return viewModel?.customer_language_v2?.sections || null;
}

export function buildCustomerBAViewModel(sources = tammyFixtureV2) {
  if (!sources?.person_name) {
    throw new Error('buildCustomerBAViewModel: invalid source payload');
  }
  return {
    ...sources,
    shell_tabs: sources.shell_tabs || BA_SHELL_TABS,
    meta: {
      labOnly: true,
      missionId: sources.mission_id || 'MMB205_BA_CUSTOMER_LANGUAGE_SIMPLIFICATION_LAB',
      brandLine: 'MORE MindMap / Business Assessment',
      customerLanguageTarget: sources.customer_language_v2?.target_technicality ?? 25,
      universalTranslatorRequired: false,
    },
  };
}

export const TAMMY_BA_VIEW_MODEL_V1 = buildCustomerBAViewModel(tammyFixtureV1);
export const TAMMY_BA_VIEW_MODEL = buildCustomerBAViewModel(tammyFixtureV2);