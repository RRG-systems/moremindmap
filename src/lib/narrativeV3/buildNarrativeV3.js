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
    rendering = normalizeStructuredSection(section, rendering);

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

function normalizeStructuredSection(section, rendering) {
  if (!rendering) return rendering;

  if (section === 'fiveFutures') {
    if (rendering.body?.futures) {
      return { ...rendering, ...rendering.body };
    }
    if (rendering.futures) {
      return rendering;
    }
  }

  if (section === 'facilitatorNotes') {
    if (rendering.body?.notes) {
      return { ...rendering, ...rendering.body };
    }
    if (rendering.notes) {
      return rendering;
    }
  }

  return rendering;
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
    const fallbackProfile = buildFallbackProfile(interpreted, prompt);
    const scaling = buildScalingFallback(fallbackProfile);

    body = scaling.body;
    keyWarning = scaling.keyWarning;
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
    const fallbackProfile = buildFallbackProfile(interpreted, prompt);
    const oneMove = buildOneMoveFallback(fallbackProfile);

    body = oneMove.body;
    keyWarning = oneMove.keyWarning;
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
    const fallbackProfile = buildFallbackProfile(interpreted, prompt);
    const futures = buildFiveFuturesFallback(fallbackProfile);

    return {
      section,
      summary: `${fallbackProfile.primaryName} + ${fallbackProfile.secondaryName} creates ${fallbackProfile.bottleneck}. Five fallback trajectories model what happens if that pattern is preserved, developed, or overloaded.`,
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

function buildFallbackProfile(interpreted, prompt) {
  const primary = normalizeDimension(interpreted.primarySystem.dimension || 'primary');
  const secondary = normalizeDimension(interpreted.secondarySystem.dimension || 'secondary');
  const ranked = interpreted.ranked || [];
  const lowDimensions = ranked
    .filter((d) => Number(d.score) <= 0)
    .map((d) => normalizeDimension(d.dimension));
  const pressureMechanics =
    prompt?.canonical?.pressurePattern ||
    interpreted.pressureResponse ||
    interpreted.primarySystem.pressure ||
    'pressure intensifies the primary operating pattern';
  const oneMoveSeed =
    prompt?.canonical?.oneMoveSeed ||
    interpreted.tradeoffs[0]?.cost ||
    interpreted.scalingTension ||
    'make the hidden operating cost explicit';
  const strategicCeilingSeed =
    prompt?.canonical?.strategicCeiling ||
    prompt?.canonical?.scalingConstraint ||
    interpreted.constraintAtScale ||
    'current advantage becomes harder to transfer at scale';
  const tensionPair =
    interpreted.tradeoffs[0]?.dimensions?.map((d) => normalizeDimension(d).name).join(' + ') ||
    `${primary.name} + ${secondary.name}`;
  const pairProfile = getPairFallbackProfile(primary.key, secondary.key);
  const lowProfile = getLowDimensionFallback(lowDimensions);
  const bottleneck = lowProfile
    ? `${pairProfile.bottleneck} with ${lowProfile.bottleneck}`
    : pairProfile.bottleneck;

  return {
    primaryKey: primary.key,
    primaryName: primary.name,
    secondaryKey: secondary.key,
    secondaryName: secondary.name,
    rankedNames: ranked.slice(0, 4).map((d) => normalizeDimension(d.dimension).name).filter(Boolean),
    tensionPair,
    pressureMechanics,
    oneMoveSeed,
    strategicCeilingSeed,
    bottleneck,
    oneMove: lowProfile
      ? `${pairProfile.oneMove}; also ${lowProfile.oneMove}`
      : pairProfile.oneMove,
    scalingBreak: lowProfile
      ? `${pairProfile.scalingBreak} ${lowProfile.scalingBreak}`
      : pairProfile.scalingBreak,
    current: pairProfile.current,
    optimized: lowProfile?.optimized || pairProfile.optimized,
    overload: lowProfile?.overload || pairProfile.overload,
    leadership: pairProfile.leadership,
    constraint: lowProfile?.constraint || pairProfile.constraint,
  };
}

function normalizeDimension(dimension) {
  const key = String(dimension || '').toLowerCase();
  const names = {
    vector: 'Vector',
    velocity: 'Velocity',
    flex: 'Flex',
    horizon: 'Horizon',
    fidelity: 'Fidelity',
    framework: 'Framework',
    signal: 'Signal',
    leverage: 'Leverage',
    primary: 'Primary',
    secondary: 'Secondary',
  };

  return {
    key,
    name: names[key] || key.charAt(0).toUpperCase() + key.slice(1) || 'Unknown',
  };
}

function getPairFallbackProfile(primaryKey, secondaryKey) {
  const bySecondary = {
    velocity: {
      bottleneck: 'tempo translation before speed becomes rework',
      oneMove: 'install a weekly alignment cadence that translates pace into shared sequence before work starts',
      scalingBreak: 'Velocity breaks through rework: fast starts remain useful only if handoffs and acceptance criteria are explicit.',
      current: 'pace keeps producing momentum, but unfinished interpretation turns into rework',
      optimized: 'cadence makes pace legible; fast decisions become repeatable tempo instead of surprise acceleration',
      overload: 'tempo becomes personal load; the organization chases speed while quality repair grows behind it',
      leadership: 'the operator turns speed into transferable rhythm, not personal urgency',
      constraint: 'rework becomes the tax when pace outruns shared interpretation',
    },
    flex: {
      bottleneck: 'ambiguity translation before adaptability becomes drift',
      oneMove: 'create a decision feedback loop that names what is fixed, what is flexible, and when ambiguity gets resolved',
      scalingBreak: 'Flex breaks through ambiguity: adaptability helps until people cannot tell which choices are settled.',
      current: 'adaptability keeps options open, but interpretation fragments across the team',
      optimized: 'ambiguity gets named early; pivots become intentional instead of socially expensive',
      overload: 'flexibility becomes unresolved consensus pressure; people keep adjusting without knowing the real decision',
      leadership: 'the operator turns adaptability into clear option architecture others can use',
      constraint: 'interpretation drift persists when Flex cannot distinguish openness from undecided direction',
    },
    horizon: {
      bottleneck: 'strategic sequencing before vision outruns grounding',
      oneMove: 'convert the long-range thesis into a near-term sequence with visible decision gates',
      scalingBreak: 'Horizon breaks through over-extension: long-range vision must be staged before the present system absorbs it.',
      current: 'vision keeps expanding the map, while near-term sequencing carries the strain',
      optimized: 'strategic compression becomes staged execution; the team knows what matters now and what waits',
      overload: 'future pull creates impatience with present constraints; too many moves compete for the same attention',
      leadership: 'the operator turns vision into sequence that others can inherit and execute',
      constraint: 'delayed grounding keeps the future persuasive but hard to operationalize',
    },
    fidelity: {
      bottleneck: 'verification threshold before precision becomes drag',
      oneMove: 'define the decision threshold: what must be checked, what can move, and who owns exceptions',
      scalingBreak: 'Fidelity breaks through verification bottlenecks: checking protects quality only when thresholds are explicit.',
      current: 'precision protects decisions, but unchecked verification loops slow ownership transfer',
      optimized: 'verification standards become clear enough for others to apply without waiting',
      overload: 'quality concern turns into decision congestion; people hesitate because the acceptable error band is unclear',
      leadership: 'the operator turns precision into standards instead of personal review',
      constraint: 'verification bottlenecks remain when Fidelity is capability but not system design',
    },
    framework: {
      bottleneck: 'process capture before repeatability depends on memory',
      oneMove: 'capture the next recurring decision as a repeatable process with owner, trigger, and done condition',
      scalingBreak: 'Framework breaks through missing repeatable process: scale requires the pattern to survive without personal reconstruction.',
      current: 'execution keeps moving, but repeatability depends on personal recall and informal transfer',
      optimized: 'process capture turns working instincts into shared operating rails',
      overload: 'the same decisions get rebuilt repeatedly; speed hides the cost until volume rises',
      leadership: 'the operator turns judgment into process other people can run',
      constraint: 'missing repeatable process keeps growth dependent on the same interpreter',
    },
    signal: {
      bottleneck: 'feedback instrumentation before relational signals arrive late',
      oneMove: 'instrument feedback with explicit objection checks, repair windows, and dissent capture after major decisions',
      scalingBreak: 'Signal breaks through late feedback: relational information must be collected before pressure makes it expensive.',
      current: 'direction moves first, while relational feedback arrives after commitment',
      optimized: 'feedback instrumentation makes dissent visible early enough to improve decisions',
      overload: 'relationship repair becomes operational drag because concerns surface after the work is already moving',
      leadership: 'the operator turns feedback into a design input rather than a postmortem',
      constraint: 'late relational data keeps the team adapting silently until cost becomes visible',
    },
    leverage: {
      bottleneck: 'leverage selection before effort multiplies the wrong activity',
      oneMove: 'name the highest-leverage decision lane and remove work that does not compound through it',
      scalingBreak: 'Leverage breaks through misplaced effort: scale depends on choosing which work deserves multiplication.',
      current: 'energy stays high, but leverage gets diluted across too many active fronts',
      optimized: 'work concentrates around the few decisions that create compounding lift',
      overload: 'more activity creates less lift because effort spreads across non-compounding work',
      leadership: 'the operator teaches the organization how to select leverage, not just work harder',
      constraint: 'misplaced leverage keeps capacity busy while strategic lift stays capped',
    },
  };

  return bySecondary[secondaryKey] || bySecondary[primaryKey] || {
    bottleneck: `${normalizeDimension(primaryKey).name} and ${normalizeDimension(secondaryKey).name} need explicit translation before scale`,
    oneMove: 'name the primary operating advantage, then define the handoff rule that lets others use it without guessing',
    scalingBreak: `${normalizeDimension(primaryKey).name} + ${normalizeDimension(secondaryKey).name} breaks when the operating logic stays implicit.`,
    current: 'the operating advantage works through the person more than the system',
    optimized: 'the operating logic becomes visible enough for others to copy',
    overload: 'pressure routes interpretation back through the same person',
    leadership: 'the operator turns instinct into shared operating architecture',
    constraint: 'implicit logic stays useful but hard to scale',
  };
}

function getLowDimensionFallback(lowDimensions) {
  if (lowDimensions.some((d) => d.key === 'framework')) {
    return {
      bottleneck: 'missing repeatable process before scale depends on personal reconstruction',
      oneMove: 'capture one recurring operating loop as a process with owner, trigger, decision rule, and done condition',
      scalingBreak: 'Low Framework breaks through missing repeatable process: what works once must become runnable without personal reconstruction.',
      optimized: 'repeatable process lets the team preserve speed without rebuilding the same answer each time',
      overload: 'process gaps convert growth into repeated explanation and avoidable handoff repair',
      constraint: 'missing repeatable process remains the ceiling even when the primary system is strong',
    };
  }

  if (lowDimensions.some((d) => d.key === 'signal')) {
    return {
      bottleneck: 'late feedback before relational data becomes repair work',
      oneMove: 'add a feedback instrumentation step after major decisions: dissent captured, objection owner named, repair window scheduled',
      scalingBreak: 'Low Signal breaks through feedback instrumentation: the system needs relational data before pressure makes it expensive.',
      optimized: 'feedback is surfaced early enough to steer execution instead of becoming cleanup',
      overload: 'concerns arrive late, so repair work grows after momentum has already committed people',
      constraint: 'late relational signals keep the team compliant before they are aligned',
    };
  }

  if (lowDimensions.some((d) => d.key === 'fidelity')) {
    return {
      bottleneck: 'verification threshold before errors compound downstream',
      oneMove: 'define a lightweight verification threshold for high-cost decisions: what gets checked, by whom, and before which handoff',
      scalingBreak: 'Low Fidelity breaks through verification thresholds: speed needs a check layer where downstream error is expensive.',
      optimized: 'verification becomes targeted enough to catch expensive misses without slowing every decision',
      overload: 'small unchecked misses travel downstream and become larger coordination problems',
      constraint: 'verification gaps remain hidden until volume makes them expensive',
    };
  }

  return null;
}

function buildScalingFallback(profile) {
  return {
    body:
      `Primary system: ${profile.primaryName}. Secondary system: ${profile.secondaryName}. ` +
      `The unique bottleneck is ${profile.bottleneck}.\n\n` +
      `At current scale, ${profile.current}. Pressure mechanics: ${stringifyFallbackSeed(profile.pressureMechanics)}\n\n` +
      `At the next scale, ${profile.scalingBreak} Top operating signals: ${profile.rankedNames.join(', ') || profile.tensionPair}.\n\n` +
      `At larger scale, ${profile.constraint}. The breakthrough is not generic structure; it is the specific translation layer between ${profile.primaryName} and ${profile.secondaryName}. ` +
      `Seed evidence: ${stringifyFallbackSeed(profile.strategicCeilingSeed)}`,
    keyWarning: `${profile.primaryName} + ${profile.secondaryName} fails when ${profile.bottleneck} stays implicit.`,
  };
}

function buildOneMoveFallback(profile) {
  return {
    body:
      `One move: ${profile.oneMove}.\n\n` +
      `This is specific to ${profile.primaryName} + ${profile.secondaryName}: the bottleneck is ${profile.bottleneck}. ` +
      `It interrupts the active tension pair (${profile.tensionPair}) by turning ${profile.primaryName}'s advantage into something the organization can read before pressure escalates.\n\n` +
      `Evidence seed: ${stringifyFallbackSeed(profile.oneMoveSeed)}`,
    keyWarning: `Do not add generic structure. Build the one mechanism that resolves ${profile.bottleneck}.`,
  };
}

function buildFiveFuturesFallback(profile) {
  return [
    {
      title: `Current Trajectory: ${toTitleSuffix(profile.bottleneck)}`,
      likelihood: 'likely',
      trajectory: `${profile.primaryName} remains the lead operating system while ${profile.secondaryName} stabilizes it. ${profile.current}.`,
      organization_experiences: `The organization experiences ${profile.primaryName} clearly, but the unresolved bottleneck (${profile.bottleneck}) determines where friction repeats.`
    },
    {
      title: `Optimized Trajectory: ${toTitleSuffix(profile.oneMove)}`,
      likelihood: 'possible',
      trajectory: `${profile.optimized}. The one move is to ${profile.oneMove}.`,
      organization_experiences: `People gain a usable translation layer between ${profile.primaryName} and ${profile.secondaryName}, so the advantage becomes easier to repeat without guessing.`
    },
    {
      title: `Burnout Trajectory: ${toTitleSuffix(profile.overload)}`,
      likelihood: 'risk',
      trajectory: `${profile.overload}. Pressure mechanics intensify the same bottleneck instead of distributing it.`,
      organization_experiences: `The team absorbs the cost of ${profile.bottleneck}; repair, rework, or delayed interpretation becomes the hidden workload.`
    },
    {
      title: `Leadership Trajectory: ${toTitleSuffix(profile.leadership)}`,
      likelihood: 'possible',
      trajectory: `${profile.leadership}. ${profile.primaryName} stops being only personal force and becomes transferable operating architecture.`,
      organization_experiences: `Others can carry more of the ${profile.primaryName} + ${profile.secondaryName} logic because the bottleneck has been named and designed around.`
    },
    {
      title: `Constraint Trajectory: ${toTitleSuffix(profile.constraint)}`,
      likelihood: 'likely',
      trajectory: `${profile.constraint}. ${profile.scalingBreak}`,
      organization_experiences: `Growth exposes the same ${profile.bottleneck}; the organization keeps working around the operator instead of inheriting the operating system.`
    }
  ];
}

function stringifyFallbackSeed(seed) {
  if (!seed) return 'No seed available.';
  if (typeof seed === 'string') return seed.slice(0, 220);
  if (Array.isArray(seed)) return seed.map(stringifyFallbackSeed).join(' ').slice(0, 220);
  if (typeof seed === 'object') {
    return Object.values(seed).map(stringifyFallbackSeed).join(' ').slice(0, 220);
  }
  return String(seed).slice(0, 220);
}

function toTitleSuffix(text) {
  const words = String(text || '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || 'Profile Specific Constraint';
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
