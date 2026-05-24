/**
 * buildNarrativeV3.js
 * 
 * Main orchestrator for Narrative Expansion V3.
 * Coordinates: interpretation → GPT → filtering → compression
 * 
 * PRODUCTION READY for OpenAI API integration.
 * Currently using LOCAL FALLBACK for testing/demo.
 */

import interpretCanonical, { buildMicroScenario, extractGroundingUsed }
  from './structuredInterpreter.js';
import {
  GLOBAL_BANNED_PHRASES,
  SECTION_SPECIFIC_BANS,
  suppressBannedPhrases,
  scanForBannedPhrases,
} from './phraseGraveyard.js';
import * as prompts from './sectionPrompts.js';
import { callGPT55, validateGrounding } from './openaiIntegration.js';
import { getCachedNarrative, cacheNarrative } from './cache.js';

/**
 * Main entry point for V3 narrative expansion.
 * Renders 4 target sections: executive summary, communication, contradictions, ceiling.
 */
export async function buildNarrativeV3(canonical, useGPT = true, profileId = null) {
  if (!canonical) return getDefaultNarrative();

  // Check cache first
  if (profileId) {
    const cached = getCachedNarrative(profileId);
    if (cached) {
      console.log('[V3] Using cached narrative for', profileId);
      return cached;
    }
  }

  const interpreted = interpretCanonical(canonical);
  const previousSections = {};

  const sections = [
    'executiveSummary',
    'communicationStyle',
    'hiddenContradictions',
    'strategicCeiling',
  ];

  const narrative = {};

  for (const section of sections) {
    const prompt = getPromptBuilder(section)(interpreted, previousSections);

    let rendering;
    if (useGPT) {
      // Try GPT-5.5 first
      console.log('[V3] Calling GPT-5.5 for', section);
      const gptResponse = await callGPT55(prompt, section);
      
      if (gptResponse && validateGrounding(gptResponse, interpreted)) {
        rendering = gptResponse;
        console.log('[V3] GPT-5.5 success:', section);
      } else {
        // Fallback to local rendering
        console.log('[V3] GPT-5.5 failed or invalid, using local fallback:', section);
        rendering = await localRendering(prompt, section, interpreted);
      }
    } else {
      // Local rendering only
      rendering = await localRendering(prompt, section, interpreted);
    }

    // Post-processing
    rendering.body = suppressBannedPhrases(rendering.body);
    rendering.body = compressionPass(rendering.body);

    // Validate grounding
    const violations = scanForBannedPhrases(rendering.body, section);
    rendering.violations = violations;
    rendering.groundingUsed = extractGroundingUsed(section, interpreted);

    narrative[section] = rendering;
    previousSections[section] = rendering.body;
  }

  // Cache the result
  if (profileId) {
    cacheNarrative(profileId, narrative);
    console.log('[V3] Cached narrative for', profileId);
  }

  return narrative;
}

/**
 * Route to correct prompt builder.
 */
function getPromptBuilder(section) {
  const builders = {
    executiveSummary: prompts.buildExecutiveSummaryPrompt,
    communicationStyle: prompts.buildCommunicationStylePrompt,
    hiddenContradictions: prompts.buildHiddenContradictionsPrompt,
    strategicCeiling: prompts.buildStrategicCeilingPrompt,
  };
  return builders[section] || prompts.buildExecutiveSummaryPrompt;
}

// callGPT55 is imported from openaiIntegration.js
// It provides REAL OpenAI API integration when VITE_OPENAI_API_KEY is available.
// When unavailable, it returns null and triggers local fallback.

/**
 * LOCAL FALLBACK: Render using deterministic logic.
 * This is what runs in the browser/during testing.
 * Keeps output consistent, grounded, and predictable.
 */
async function localRendering(prompt, section, interpreted) {
  let body = '';
  let microScenario = buildMicroScenario(interpreted, section);
  let keyWarning = '';

  if (section === 'executiveSummary') {
    const primary = interpreted.primarySystem.description || "high on primary";
    const secondary = interpreted.secondarySystem.description || "high on secondary";
    const primaryOp = interpreted.primarySystem.operating || "enters with direction";

    body =
      `Moves with directional conviction. ${primaryOp}. ` +
      `Coupled with ${secondary}, maintains strategic scope. ` +
      `Immediate impact: executes faster than peers, builds momentum. ` +
      `Medium-term: precision details compound into problems. ` +
      `Under acute load: doubles down on speed. Works briefly. Then fails catastrophically.`;

    keyWarning = "Missing the last 25% of information doesn't feel risky until month 4.";
  }

  if (section === 'communicationStyle') {
    const primaryOp = interpreted.primarySystem.operating || "";
    const tradeoff = interpreted.tradeoffs[0]?.tradeoff || "speed vs precision";

    body =
      `Destination first. Path second. Creates clarity for aligned listeners. ` +
      `For detail-focused listeners, feels like override. ` +
      `Meeting pace: accelerating. Meetings move fast. Silent processing drops to zero. ` +
      `Some team members stop offering contrary opinions around the decision point. ` +
      `They sense the path is locked.\n\n` +
      `Engages with competitive advantage framing. Rejects personal development framing. ` +
      `Risk feedback lands as blame, not intelligence. ` +
      `Under load, directness increases. Nuance decreases. ` +
      `Can read as powerful leadership or dismissive override, depending on whether decision proves right.`;

    keyWarning = "Team processing speed gap: they decide at month 1, team catches consequences at month 3.";
  }

  if (section === 'hiddenContradictions') {
    body =
      `Self-Model vs Reality: Pattern reading feels like mastery. 70% looks identical to 95% for 3-4 months. ` +
      `Missing 25% surfaces later. They attribute surprises to external factors, not recalibration needed.\n\n` +
      `Strategy vs Execution: Plans multi-move strategy. Execution speed short-circuits it. ` +
      `Speed wins. Consistently.\n\n` +
      `Strength Becomes Constraint: Conviction that drives success prevents course correction. ` +
      `Doesn't slow when signals suggest they should. By the time they do, problem is large.`;

    keyWarning = "Decision lock-in: once committed, rarely revisited. Truth arriving late costs more.";
  }

  if (section === 'strategicCeiling') {
    const primaryDim = interpreted.primarySystem.dimension || "primary";
    const secondaryDim = interpreted.secondarySystem.dimension || "secondary";

    body =
      `1x: Optimized. Speed advantage compounds. Execution outpaces peers.\n\n` +
      `2x: Velocity advantage starts creating coordination gaps. ` +
      `Structures built by this person begin conflicting with each other. Same speed, now cross-purpose.\n\n` +
      `5x: Contradictions inevitable. High-conviction decisions made independently conflict. ` +
      `Integration fails. Architecture needs re-thinking.\n\n` +
      `10x: Personal execution becomes impossible. Must delegate. ` +
      `Means building teams that deliberately slow velocity (uncomfortable). ` +
      `Unlock: delegate conviction to instinct, reserve deliberation for non-obvious edge cases.`;

    keyWarning = "5x scale is the breaking point. Most don't adapt. System collapses.";
  }

  return {
    section,
    headline: section.replace(/([A-Z])/g, ' $1').trim(),
    body: body.trim(),
    micro_scenario: microScenario || "[Scenario would be injected]",
    key_warning: keyWarning,
    grounding_used: extractGroundingUsed(section, interpreted),
  };
}

/**
 * Compression pass: remove AI over-explanation.
 * Target 10-15% reduction.
 */
function compressionPass(text) {
  let compressed = text;

  // Remove weak qualifiers
  compressed = compressed.replace(/\s+very\s+/g, ' ');
  compressed = compressed.replace(/\s+quite\s+/g, ' ');
  compressed = compressed.replace(/\s+really\s+/g, ' ');

  // Remove meta-explanation
  compressed = compressed.replace(/In other words,\s+/gi, '');
  compressed = compressed.replace(/This means that\s+/gi, '');
  compressed = compressed.replace(/What this really\s+/gi, '');

  // Compress connectors
  compressed = compressed.replace(/\.\s+This is because\s+/g, '. ');
  compressed = compressed.replace(/\.\s+The reason is\s+/g, '. ');

  return compressed.trim();
}

function getDefaultNarrative() {
  return {
    executiveSummary: {
      section: 'executiveSummary',
      headline: 'Profile data not available',
      body: 'Profile data not available',
      micro_scenario: null,
      key_warning: null,
      grounding_used: [],
    },
    communicationStyle: {
      section: 'communicationStyle',
      headline: 'Profile data not available',
      body: 'Profile data not available',
      micro_scenario: null,
      key_warning: null,
      grounding_used: [],
    },
    hiddenContradictions: {
      section: 'hiddenContradictions',
      headline: 'Profile data not available',
      body: 'Profile data not available',
      micro_scenario: null,
      key_warning: null,
      grounding_used: [],
    },
    strategicCeiling: {
      section: 'strategicCeiling',
      headline: 'Profile data not available',
      body: 'Profile data not available',
      micro_scenario: null,
      key_warning: null,
      grounding_used: [],
    },
  };
}

export default buildNarrativeV3;
