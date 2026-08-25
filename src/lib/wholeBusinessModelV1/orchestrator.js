import { assembleWholeBusinessContext } from './contextAssembler.js';
import { finalizeWholeBusinessState } from './beliefState.js';
import { validateWholeBusinessModel } from './validator.js';

export async function buildWholeBusinessModel(input, {
  synthesisAdapter,
  library,
  libraryRoot,
  contextBudget,
  cassetteRegistry,
} = {}) {
  if (!synthesisAdapter || typeof synthesisAdapter.synthesize !== 'function') {
    throw new TypeError('whole_business_model_requires_frontier_synthesis_adapter');
  }
  const context = assembleWholeBusinessContext(input, { library, libraryRoot, contextBudget, cassetteRegistry });
  const candidate = await synthesisAdapter.synthesize(context);
  const validationReceipt = validateWholeBusinessModel(candidate, context);
  const model = finalizeWholeBusinessState(candidate, validationReceipt);
  return Object.freeze({ context, model, validation_receipt: validationReceipt });
}
