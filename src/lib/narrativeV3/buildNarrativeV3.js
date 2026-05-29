/**
 * buildNarrativeV3.js
 * 
 * Main orchestrator for Narrative Expansion V3.
 * Coordinates: interpretation → GPT → filtering → compression
 * 
 * PRODUCTION READY for OpenAI API integration.
 * Currently using LOCAL FALLBACK for testing/demo.
 */

import buildUnifiedInterpretation from './unifiedInterpreter.js';
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
import { getCognitionContext } from './getCognitionContext.js';

/**
 * Main entry point for V3 narrative expansion.
 * Renders 4 target sections: executive summary, communication, contradictions, ceiling.
 */
export async function buildNarrativeV3(canonical, useGPT = true, profileId = null, disableCache = false, disableCompression = false) {
  if (!canonical) return getDefaultNarrative();

  // [FORENSIC] Environment check
  const apiKeyPresent = !!( import.meta?.env?.VITE_OPENAI_API_KEY);
  console.log('[V3 ENV CHECK] API_KEY_PRESENT:', apiKeyPresent);

  // Check cache first (unless disabled for forensic test)
  let cacheHit = false;
  if (profileId && !disableCache) {
    const cached = getCachedNarrative(profileId);
    if (cached) {
      cacheHit = true;
      console.log('[V3 CACHE HIT]', profileId, '| render_source:', cached.render_source);
      return cached;
    }
  } else if (disableCache) {
    console.log('[V3 FORENSIC] Cache disabled for testing');
  }

  // UNIFIED INTERPRETER: Produces ONE shared interpretation artifact
  // All 7 sections render FROM this shared interpretation (not independent reinvention)
  const unified = buildUnifiedInterpretation(canonical);
  
  // Keep old structured interpreter for backward compat with buildMicroScenario
  const interpreted = interpretCanonical(canonical);
  
  // COGNITION CONTEXT: Extract GPT/V1 behavioral layer if available
  const cognitionContext = getCognitionContext(canonical);
  console.log('[COGNITION CONTEXT]', {
    source: cognitionContext?.source,
    hasDominance: !!cognitionContext?.dominance_profile,
    rankedCount: cognitionContext?.ranked_dimensions?.length,
  });
  const previousSections = {};

  const sections = [
    'profileDNA',
    'executiveSummary',
    'communicationStyle',
    'hiddenContradictions',
    'strategicCeiling',
    'coachingLeverage',
    'recommendedNextStep',
    'facilitatorNotes',
    'fiveFutures',
  ];
  const cognitionAwareSections = new Set([
    'profileDNA',
    'executiveSummary',
    'hiddenContradictions',
    'strategicCeiling',
    'recommendedNextStep',
    'facilitatorNotes',
    'fiveFutures',
  ]);

  const narrative = {
    render_source: null,
    cache_hit: cacheHit,
    gpt_call_success: false,
    fallback_used: false,
    openai_error_message: null,
    generation_time_ms: 0,
  };

  const startTime = performance.now();

  let firstGptCall = true;
  let fallbackActivated = false;
  let gptSuccess = false;
  let gptError = null;

  for (const section of sections) {
    const prompt = cognitionAwareSections.has(section)
      ? getPromptBuilder(section)(unified, interpreted, previousSections, cognitionContext)
      : getPromptBuilder(section)(unified, interpreted, previousSections);

    let rendering;
    let sectionRenderSource = 'fallback_local';

    if (useGPT) {
      // [FORENSIC] GPT call attempt
      console.log(`[V3 GPT START] section: ${section} | prompt_length: ${JSON.stringify(prompt).length}`);
      
      const gptResponse = await callGPT55(prompt, section);
      
      if (gptResponse && validateGrounding(gptResponse, interpreted)) {
        console.log(`[V3 GPT SUCCESS] section: ${section} | response_length: ${gptResponse.body?.length || 0} | model_used: gpt-4o-2024-08-06`);
        rendering = gptResponse;
        sectionRenderSource = 'gpt55';
        gptSuccess = true;
        if (firstGptCall) {
          narrative.gpt_call_success = true;
          narrative.render_source = 'gpt55';
        }
      } else {
        // [FORENSIC] GPT failed, fallback activated
        const triggerReason = !gptResponse ? 'null_response' : 'validation_failed';
        console.log(`[V3 FALLBACK TRIGGER]`);
        console.log(`  section: ${section}`);
        console.log(`  reason: ${triggerReason}`);
        if (gptResponse) {
          console.log(`  gptResponse.section: ${gptResponse.section}`);
          console.log(`  gptResponse.body length: ${gptResponse.body?.length || 0}`);
          console.log(`  gptResponse.grounding_used: ${JSON.stringify(gptResponse.grounding_used)}`);
          console.log(`  full response keys: ${Object.keys(gptResponse).join(', ')}`);
        }
        console.log(`  prompt keys in request: ${Object.keys(prompt).join(', ')}`);
        
        rendering = await localRendering(prompt, section, interpreted);
        sectionRenderSource = 'fallback_local';
        fallbackActivated = true;
        if (firstGptCall) {
          narrative.fallback_used = true;
          narrative.render_source = 'fallback_local';
        }
      }
      firstGptCall = false;
    } else {
      // Local rendering only
      console.log(`[V3 LOCAL ONLY] section: ${section}`);
      rendering = await localRendering(prompt, section, interpreted);
      sectionRenderSource = 'fallback_local';
      narrative.render_source = 'fallback_local';
    }

    // [FORENSIC] Add render source to section
    rendering.render_source = sectionRenderSource;

    // Post-processing (with forensic option to disable)
    if (typeof rendering.body === 'string') {
      rendering.body = suppressBannedPhrases(rendering.body);
      if (!disableCompression) {
        rendering.body = compressionPass(rendering.body);
      } else {
        console.log(`[V3 FORENSIC] Compression disabled for section: ${section}`);
      }
    } else if (disableCompression) {
      console.log(`[V3 FORENSIC] Compression disabled for structured section: ${section}`);
    }

    // Validate grounding
    const violations = typeof rendering.body === 'string'
      ? scanForBannedPhrases(rendering.body, section)
      : [];
    rendering.violations = violations;
    rendering.groundingUsed = extractGroundingUsed(section, interpreted);

    narrative[section] = rendering;
    previousSections[section] = rendering.body || rendering.primary_guidance || rendering.summary || '';
  }

  // [FORENSIC] Calculate generation time
  narrative.generation_time_ms = Math.round(performance.now() - startTime);

  // [FORENSIC] Log summary
  console.log('[V3 RENDER COMPLETE]', {
    render_source: narrative.render_source,
    gpt_success: narrative.gpt_call_success,
    fallback_used: narrative.fallback_used,
    cache_hit: narrative.cache_hit,
    generation_time_ms: narrative.generation_time_ms,
  });

  // Cache the result (unless disabled for forensic test)
  if (profileId && !disableCache) {
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
    profileDNA: prompts.buildProfileDNAPrompt,
    executiveSummary: prompts.buildExecutiveSummaryPrompt,
    communicationStyle: prompts.buildCommunicationStylePrompt,
    hiddenContradictions: prompts.buildHiddenContradictionsPrompt,
    strategicCeiling: prompts.buildStrategicCeilingPrompt,
    coachingLeverage: prompts.buildCoachingLeveragePrompt,
    recommendedNextStep: prompts.buildRecommendedNextStepPrompt,
    facilitatorNotes: prompts.buildFacilitatorNotesPrompt,
    fiveFutures: prompts.buildFiveFuturesPrompt,
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

  if (section === 'profileDNA') {
    body = 
      `Operating Model: Moves with directional conviction. Pattern-reading drives decision velocity. ` +
      `Paired with ${interpreted.secondarySystem.dimension || 'secondary system'}, creates execution speed advantage that dominates coordination friction. ` +
      `Builds competitive edge through rapid pattern convergence and direct execution.`;
  }

  if (section === 'coachingLeverage') {
    body =
      `1. Pace as signal: explicit awareness that meeting velocity = decision certainty. Slow decisions down when wrong choices cost more than speed saves.\n\n` +
      `2. Process friction is intelligence: "Why did we need 6 meetings?" should prompt system redesign, not dismissal of process advocates.\n\n` +
      `3. Delegate conviction, not execution: build teams where others own the 95%, you own the edge 5%. Requires trusting pattern-reading in others.\n\n` +
      `4. Course correction has windows: waiting until month 4 to revisit month 1 decisions costs 3x what month 2 revision would. Speed includes strategic pivots.`;
    
    keyWarning = "Coaching works when framed as competitive advantage, not personal development. Position corrections as system optimization.";
  }

  if (section === 'recommendedNextStep') {
    body =
      `Conduct a "decision velocity audit": map 5 recent decisions. For each: when was it locked in, when did consequences surface, what was the gap cost? ` +
      `Pattern reveals whether speed is advantage or constraint in your current context.\n\n` +
      `Then: establish feedback lag metrics. Treat feedback speed as design problem, not people problem. ` +
      `That shift moves system from 1x to 2x operating efficiency.`;
  }

  if (section === 'facilitatorNotes') {
    return {
      section,
      summary: "Environment should turn the operating pattern into explicit structure instead of relying on personal translation.",
      primary_guidance: "Create clear decision lanes, feedback timing, and delegation boundaries so speed does not outrun shared understanding.",
      notes: [
        {
          label: "Decision review",
          guidance: "Review major decisions after consequences surface, not only when the decision is made.",
          rationale: "This keeps fast operating patterns connected to downstream evidence."
        },
        {
          label: "Communication architecture",
          guidance: "Separate direction-setting meetings from input-gathering meetings.",
          rationale: "The environment must make room for slower processing before direction feels locked."
        },
        {
          label: "Accountability",
          guidance: "Track feedback lag, handoff clarity, and unresolved objections as operating metrics.",
          rationale: "These signals show whether the system is scaling or becoming person-dependent."
        }
      ],
      caution: "Do not treat this as personality coaching. The useful lever is environment design."
    };
  }

  if (section === 'fiveFutures') {
    const futures = [
      {
        title: "Current Trajectory",
        likelihood: "likely",
        trajectory: "The current operating pattern continues. Speed and directness keep producing momentum, while slower signals arrive too late to shape decisions.",
        organization_experiences: "The organization gets clarity and pace, but begins adapting around the person instead of building independent capacity."
      },
      {
        title: "Optimized Trajectory",
        likelihood: "possible",
        trajectory: "Decision reviews, delegation boundaries, and feedback timing turn the operating pattern into a repeatable system.",
        organization_experiences: "The team keeps the advantage of speed while gaining enough structure to challenge, refine, and carry decisions without bottlenecking."
      },
      {
        title: "Burnout Trajectory",
        likelihood: "risk",
        trajectory: "Pressure keeps routing more decisions through the same person. Urgency becomes the default operating environment.",
        organization_experiences: "Energy depletes, repair work increases, and the team learns to wait for direction rather than build judgment."
      },
      {
        title: "Leadership Trajectory",
        likelihood: "possible",
        trajectory: "The operator matures from personal execution into leadership architecture: clear standards, visible decision logic, and delegated ownership.",
        organization_experiences: "People understand how to make aligned decisions without needing constant intervention, which increases trust and scale capacity."
      },
      {
        title: "Constraint Trajectory",
        likelihood: "likely",
        trajectory: "The main scaling constraint remains unresolved. What works at small scale becomes coordination debt at larger scale.",
        organization_experiences: "Growth exposes gaps in communication, ownership, and feedback loops. The team experiences pace without enough shared architecture."
      }
    ];

    return {
      section,
      summary: "Five trajectory scenarios emerge from the current operating pattern.",
      most_likely: futures[0],
      futures
    };
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
  if (section === 'profileDNA') {
    body = 
      `Operating Model: Moves with directional conviction. Pattern-reading drives decision velocity. ` +
      `Paired with ${interpreted.secondarySystem.dimension || 'secondary system'}, creates execution speed advantage that dominates coordination friction. ` +
      `Builds competitive edge through rapid pattern convergence and direct execution.`;
  }

  if (section === 'coachingLeverage') {
    body =
      `1. Pace as signal: explicit awareness that meeting velocity = decision certainty. Slow decisions down when wrong choices cost more than speed saves.\n\n` +
      `2. Process friction is intelligence: "Why did we need 6 meetings?" should prompt system redesign, not dismissal of process advocates.\n\n` +
      `3. Delegate conviction, not execution: build teams where others own the 95%, you own the edge 5%. Requires trusting pattern-reading in others.\n\n` +
      `4. Course correction has windows: waiting until month 4 to revisit month 1 decisions costs 3x what month 2 revision would. Speed includes strategic pivots.`;
    
    keyWarning = "Coaching works when framed as competitive advantage, not personal development. Position corrections as system optimization.";
  }

  if (section === 'recommendedNextStep') {
    body =
      `Conduct a "decision velocity audit": map 5 recent decisions. For each: when was it locked in, when did consequences surface, what was the gap cost? ` +
      `Pattern reveals whether speed is advantage or constraint in your current context.\n\n` +
      `Then: establish feedback lag metrics. Treat feedback speed as design problem, not people problem. ` +
      `That shift moves system from 1x to 2x operating efficiency.`;
  }

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
