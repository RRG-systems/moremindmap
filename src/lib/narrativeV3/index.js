/**
 * narrativeV3/index.js
 * 
 * Exports for Narrative Expansion V3 language engine.
 */

export { default as buildNarrativeV3 } from './buildNarrativeV3.js';
export { default as interpretCanonical, buildMicroScenario, extractGroundingUsed }
  from './structuredInterpreter.js';
export {
  GLOBAL_BANNED_PHRASES,
  SECTION_SPECIFIC_BANS,
  scanForBannedPhrases,
  suppressBannedPhrases,
} from './phraseGraveyard.js';
export {
  buildExecutiveSummaryPrompt,
  buildCommunicationStylePrompt,
  buildHiddenContradictionsPrompt,
  buildStrategicCeilingPrompt,
} from './sectionPrompts.js';
