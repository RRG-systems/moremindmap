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
import { buildExecutiveIntelligencePacket } from '../behavioralDNAInterpretation.js';

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
    'communicationStyle',
    'hiddenContradictions',
    'strategicCeiling',
    'coachingLeverage',
    'recommendedNextStep',
    'teamExperience',
    'facilitatorNotes',
    'fiveFutures',
    'executiveSummary',
  ];
  const cognitionAwareSections = new Set([
    'profileDNA',
    'executiveSummary',
    'hiddenContradictions',
    'strategicCeiling',
    'recommendedNextStep',
    'teamExperience',
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
  let skipGptForRemainder = false;

  for (const section of sections) {
    let prompt;
    try {
      if (section === 'executiveSummary') {
        const executiveIntelligence = buildExecutiveIntelligencePacket(canonical, cognitionContext, previousSections);
        prompt = getPromptBuilder(section)(
          unified,
          interpreted,
          previousSections,
          cognitionContext,
          executiveIntelligence
        );
      } else if (cognitionAwareSections.has(section)) {
        prompt = getPromptBuilder(section)(unified, interpreted, previousSections, cognitionContext);
      } else {
        prompt = getPromptBuilder(section)(unified, interpreted, previousSections);
      }
    } catch (error) {
      console.warn(`[V3 PROMPT FALLBACK] section: ${section}`, error);
      prompt = { section, canonical: {}, instruction: 'Render deterministic fallback.', format: 'JSON' };
    }

    let rendering;
    let sectionRenderSource = 'fallback_local';

    try {
      if (useGPT && !skipGptForRemainder) {
        // [FORENSIC] GPT call attempt
        console.log(`[V3 GPT START] section: ${section} | prompt_length: ${JSON.stringify(prompt).length}`);

        const gptResponse = await callGPT55(prompt, section);

        if (gptResponse?.__error) {
          narrative.openai_error_message = gptResponse.message || 'Narrative V3 GPT call failed';
          if (gptResponse.rate_limited) {
            skipGptForRemainder = true;
            console.warn(`[V3 RATE LIMIT] section: ${section}. Using local fallback for remaining sections.`);
          }
        }

        if (gptResponse && !gptResponse.__error && validateGrounding(gptResponse, interpreted)) {
          console.log(`[V3 GPT SUCCESS] section: ${section} | response_length: ${gptResponse.body?.length || 0} | model_used: gpt-4o-2024-08-06`);
          rendering = gptResponse;
          sectionRenderSource = 'gpt55';
          gptSuccess = true;
          narrative.gpt_call_success = true;
          if (!narrative.render_source || firstGptCall) {
            narrative.render_source = 'gpt55';
          }
        } else {
          // [FORENSIC] GPT failed, fallback activated
          const triggerReason = gptResponse?.__error
            ? (gptResponse.rate_limited ? 'rate_limited' : 'endpoint_error')
            : !gptResponse ? 'null_response' : 'validation_failed';
          console.log(`[V3 FALLBACK TRIGGER]`);
          console.log(`  section: ${section}`);
          console.log(`  reason: ${triggerReason}`);
          if (gptResponse && !gptResponse.__error) {
            console.log(`  gptResponse.section: ${gptResponse.section}`);
            console.log(`  gptResponse.body length: ${gptResponse.body?.length || 0}`);
            console.log(`  gptResponse.grounding_used: ${JSON.stringify(gptResponse.grounding_used)}`);
            console.log(`  full response keys: ${Object.keys(gptResponse).join(', ')}`);
          }
          console.log(`  prompt keys in request: ${Object.keys(prompt).join(', ')}`);

          rendering = await safeLocalRendering(prompt, section, interpreted);
          sectionRenderSource = 'fallback_local';
          fallbackActivated = true;
          narrative.fallback_used = true;
          if (!narrative.render_source || firstGptCall) {
            narrative.render_source = 'fallback_local';
          }
        }
        firstGptCall = false;
      } else {
        // Local rendering only
        console.log(`[V3 LOCAL ONLY] section: ${section}`);
        rendering = await safeLocalRendering(prompt, section, interpreted);
        sectionRenderSource = 'fallback_local';
        narrative.render_source = narrative.render_source || 'fallback_local';
      }

      rendering = rendering || getDefaultSection(section);
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
      rendering = normalizeStructuredSection(section, rendering) || getDefaultSection(section);
    } catch (error) {
      console.error(`[V3 SECTION FAILURE] section: ${section}`, error);
      rendering = getDefaultSection(section);
      rendering.render_source = 'fallback_local';
      rendering.violations = [];
      rendering.groundingUsed = [];
      fallbackActivated = true;
      narrative.fallback_used = true;
      narrative.openai_error_message = narrative.openai_error_message || error.message;
    }

    narrative[section] = rendering;
    previousSections[section] = rendering.body || rendering.primary_guidance || rendering.summary || '';
  }

  // [FORENSIC] Calculate generation time
  narrative.generation_time_ms = Math.round(performance.now() - startTime);
  if (gptSuccess && fallbackActivated) {
    narrative.render_source = 'mixed_gpt_fallback';
  } else if (!narrative.render_source) {
    narrative.render_source = 'fallback_local';
  }

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
    teamExperience: prompts.buildTeamExperiencePrompt,
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
  const sentence = (value, fallback) => String(value || fallback || '')
    .trim()
    .replace(/[.!?]+$/g, '');

  if (section === 'executiveSummary') {
    const packet = prompt.executiveIntelligence || prompt.canonical?.executive_intelligence || {};
    const dna = packet.behavioral_dna || {};

    body =
      `${sentence(packet.value_created, 'Creates value through the primary operating engine')}. ` +
      `The limiting pattern: ${sentence(packet.limiting_pattern, 'the role asks for behavior outside the supported pattern')}. ` +
      `Pressure pattern: ${sentence(packet.pressure_shift, 'the primary engine intensifies first')}. ` +
      `Best fit: ${sentence(packet.natural_role_fit, 'roles aligned to the evidence-supported engine')}. ` +
      `Exhausting fit: ${sentence(packet.exhausting_role_fit, 'environments that block the primary engine')}. ` +
      `Highest leverage: ${sentence(packet.highest_leverage_insight, 'design the role around the supported operating weight, not the aspirational one')}.`;

    keyWarning = dna.wrong_seat_risk
      ? `Wrong-seat risk: ${dna.wrong_seat_risk}.`
      : 'Role fit should follow evidence-supported operating weight, not title expectations.';
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

  if (section === 'teamExperience') {
    const fallbackProfile = buildFallbackProfile(interpreted, prompt);
    return buildTeamExperienceFallback(fallbackProfile);
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

async function safeLocalRendering(prompt, section, interpreted) {
  try {
    return await localRendering(prompt, section, interpreted);
  } catch (error) {
    console.error(`[V3 LOCAL FALLBACK FAILURE] section: ${section}`, error);
    return getDefaultSection(section);
  }
}

function getDefaultSection(section) {
  if (section === 'fiveFutures') {
    const futures = [
      {
        title: 'Current Trajectory',
        likelihood: 'likely',
        trajectory: 'The current operating pattern continues with its existing strengths and constraints.',
        organization_experiences: 'The organization experiences the same value creation pattern and the same friction points.',
      },
      {
        title: 'Optimized Trajectory',
        likelihood: 'possible',
        trajectory: 'The strongest operating pattern is supported by clearer environment design.',
        organization_experiences: 'The organization receives more of the upside with less unmanaged drag.',
      },
      {
        title: 'Burnout Trajectory',
        likelihood: 'risk',
        trajectory: 'The operating pattern is overused without enough structural support.',
        organization_experiences: 'The organization begins depending on personal effort instead of transferable systems.',
      },
      {
        title: 'Leadership Trajectory',
        likelihood: 'possible',
        trajectory: 'The operator turns instinctive strengths into repeatable leadership architecture.',
        organization_experiences: 'The organization gains clearer decision rhythm and more predictable execution.',
      },
      {
        title: 'Constraint Trajectory',
        likelihood: 'likely',
        trajectory: 'The main constraint remains unresolved and shows up more clearly as complexity rises.',
        organization_experiences: 'The organization keeps paying the same operating cost at larger scale.',
      },
    ];

    return {
      section,
      summary: 'Five trajectory scenarios are available from the local narrative fallback.',
      most_likely: futures[0],
      futures,
      body: 'Five trajectory scenarios are available from the local narrative fallback.',
      key_warning: null,
      grounding_used: [],
    };
  }

  if (section === 'facilitatorNotes') {
    return {
      section,
      summary: 'Environment design should support the strongest operating pattern and reduce unmanaged friction.',
      primary_guidance: 'Create explicit decision lanes, feedback timing, and accountability ownership around the profile pattern.',
      notes: [
        {
          label: 'Operating support',
          guidance: 'Make the profile strength easier to use without forcing it to carry the entire system.',
          rationale: 'Strong patterns become constraints when the environment relies on personal force instead of design.',
        },
      ],
      caution: 'Environment design notes, not behavior coaching.',
      key_warning: null,
      grounding_used: [],
    };
  }

  if (section === 'teamExperience') {
    return {
      section,
      summary: 'Others experience the profile through its strongest operating pattern first.',
      first_impression: { interpretation: 'The clearest behavioral signal lands before the full context is visible.' },
      communication_pattern: { interpretation: 'Communication follows the dominant operating pattern and can create friction when others need a different pace or sequence.' },
      listening_pattern: { interpretation: 'Listening quality depends on whether the environment makes room for the lower-weighted systems.' },
      relational_friction: { interpretation: 'Friction appears when the profile strength is overused under pressure.' },
      key_signals: ['Dominant operating pattern', 'Pressure response', 'Lowest weighted systems'],
      causal_interpretation: 'The team experiences the operating system through its dominant pattern, then feels the hidden cost when pressure rises.',
      body: 'Others experience the profile through its strongest operating pattern first.',
      key_warning: null,
      grounding_used: [],
    };
  }

  return {
    section,
    headline: section.replace(/([A-Z])/g, ' $1').trim(),
    body: 'This section is available from the local narrative fallback.',
    micro_scenario: null,
    key_warning: null,
    grounding_used: [],
  };
}

function buildFallbackProfile(interpreted, prompt) {
  const primary = normalizeDimension(interpreted.primarySystem.dimension || 'primary');
  const secondary = normalizeDimension(interpreted.secondarySystem.dimension || 'secondary');
  const ranked = interpreted.ranked || [];
  const tertiary = normalizeDimension(ranked[2]?.dimension || '');
  const lowest = normalizeDimension(ranked[ranked.length - 1]?.dimension || '');
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
  const tieBreakerProfile = getTieBreakerFallback(tertiary.key, lowest.key);
  const lowProfile = getLowDimensionFallback(lowDimensions);
  const bottleneck = joinFallbackParts([
    pairProfile.bottleneck,
    tieBreakerProfile.bottleneck,
    lowProfile?.bottleneck,
  ]);

  return {
    primaryKey: primary.key,
    primaryName: primary.name,
    secondaryKey: secondary.key,
    secondaryName: secondary.name,
    tertiaryKey: tertiary.key,
    tertiaryName: tertiary.name,
    lowestKey: lowest.key,
    lowestName: lowest.name,
    rankedNames: ranked.slice(0, 4).map((d) => normalizeDimension(d.dimension).name).filter(Boolean),
    tensionPair,
    pressureMechanics,
    oneMoveSeed,
    strategicCeilingSeed,
    bottleneck,
    oneMove: joinFallbackParts([
      pairProfile.oneMove,
      tieBreakerProfile.oneMove,
      lowProfile?.oneMove,
    ]),
    scalingBreak: joinFallbackParts([
      pairProfile.scalingBreak,
      tieBreakerProfile.scalingBreak,
      lowProfile?.scalingBreak,
    ]),
    current: pairProfile.current,
    optimized: lowProfile?.optimized || tieBreakerProfile.optimized || pairProfile.optimized,
    overload: lowProfile?.overload || tieBreakerProfile.overload || pairProfile.overload,
    leadership: pairProfile.leadership,
    constraint: lowProfile?.constraint || tieBreakerProfile.constraint || pairProfile.constraint,
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
  const pairProfiles = {
    'signal:fidelity': {
      bottleneck: 'calibrated checking before concern becomes hesitation',
      oneMove: 'separate the relationship signal from the verification standard: name the concern, the evidence required, and the decision owner',
      scalingBreak: 'Signal + Fidelity breaks when relational concern and verification both slow the same decision lane.',
      current: 'people receive careful reading and quality attention, but decisions can wait for both relational confidence and proof',
      optimized: 'concern gets translated into evidence requests, so care improves quality without freezing movement',
      overload: 'calibration becomes hesitation; the organization waits for emotional and factual certainty at the same time',
      leadership: 'the operator turns sensitivity and precision into a clear trust-and-evidence protocol',
      constraint: 'hesitation persists when concern and verification are not separated into different operating steps',
    },
    'vector:fidelity': {
      bottleneck: 'decision threshold before command outruns checking',
      oneMove: 'define the command checkpoint: what must be verified before direction locks and what can move without review',
      scalingBreak: 'Vector + Fidelity breaks when direction forms faster than the verification threshold is visible.',
      current: 'direction creates momentum while precision tries to protect quality after the path is already forming',
      optimized: 'verification happens at the decision threshold, not as late-stage drag',
      overload: 'people either follow speed without enough checking or slow decisions because standards are implicit',
      leadership: 'the operator turns command into standards-backed direction others can trust',
      constraint: 'quality risk remains when command and checking do not share a visible threshold',
    },
    'vector:velocity': {
      bottleneck: 'tempo translation before speed becomes rework',
      oneMove: 'install a weekly alignment cadence that translates pace into shared sequence before work starts',
      scalingBreak: 'Vector + Velocity breaks when command and pace accelerate faster than the team can sequence work.',
      current: 'pace keeps producing momentum, but unfinished interpretation turns into rework',
      optimized: 'cadence makes pace legible; fast decisions become repeatable tempo instead of surprise acceleration',
      overload: 'tempo becomes personal load; the organization chases speed while quality repair grows behind it',
      leadership: 'the operator turns speed into transferable rhythm, not personal urgency',
      constraint: 'rework becomes the tax when pace outruns shared interpretation',
    },
    'fidelity:framework': {
      bottleneck: 'standard capture before precision becomes process drag',
      oneMove: 'convert one recurring quality judgment into a documented rule with owner, exception path, and completion test',
      scalingBreak: 'Fidelity + Framework breaks when standards exist but are too slow or heavy to run at volume.',
      current: 'quality and structure protect consistency, but the operating system can become heavier than the decision requires',
      optimized: 'standards become lean enough to preserve quality while keeping work moving',
      overload: 'process becomes the work; people optimize for compliance instead of useful completion',
      leadership: 'the operator turns quality judgment into right-sized operating rules',
      constraint: 'precision remains costly when standards are not sized to decision risk',
    },
    'vector:flex': {
      bottleneck: 'ambiguity translation before adaptability becomes drift',
      oneMove: 'create a decision feedback loop that names what is fixed, what is flexible, and when ambiguity gets resolved',
      scalingBreak: 'Vector + Flex breaks when direction and adaptability coexist without a visible resolution rule.',
      current: 'adaptability keeps options open, but interpretation fragments across the team',
      optimized: 'ambiguity gets named early; pivots become intentional instead of socially expensive',
      overload: 'flexibility becomes unresolved consensus pressure; people keep adjusting without knowing the real decision',
      leadership: 'the operator turns adaptability into clear option architecture others can use',
      constraint: 'interpretation drift persists when Flex cannot distinguish openness from undecided direction',
    },
    'vector:horizon': {
      bottleneck: 'strategic sequencing before vision outruns grounding',
      oneMove: 'convert the long-range thesis into a near-term sequence with visible decision gates',
      scalingBreak: 'Vector + Horizon breaks when strategic reach outpaces present-tense sequencing.',
      current: 'vision keeps expanding the map, while near-term sequencing carries the strain',
      optimized: 'strategic compression becomes staged execution; the team knows what matters now and what waits',
      overload: 'future pull creates impatience with present constraints; too many moves compete for the same attention',
      leadership: 'the operator turns vision into sequence that others can inherit and execute',
      constraint: 'delayed grounding keeps the future persuasive but hard to operationalize',
    },
  };

  const pairKey = `${primaryKey}:${secondaryKey}`;
  if (pairProfiles[pairKey]) return pairProfiles[pairKey];

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

function getTieBreakerFallback(tertiaryKey, lowestKey) {
  const tertiaryProfiles = {
    framework: {
      bottleneck: 'tertiary Framework makes speed depend on explicit operating rails',
      oneMove: 'use the Framework signal to write the sequence rule before pace accelerates',
      scalingBreak: 'Tertiary Framework can stabilize the pair if it becomes an operating rail instead of a remembered preference.',
      optimized: 'operating rails turn the primary pair into repeatable team behavior',
      overload: 'implicit process expectations create rework because the rails are felt but not written',
      constraint: 'the pair stays person-dependent when Framework remains tertiary instead of explicit',
    },
    signal: {
      bottleneck: 'tertiary Signal makes adoption depend on captured feedback',
      oneMove: 'use the Signal layer to capture objections and adoption friction before the decision is treated as settled',
      scalingBreak: 'Tertiary Signal can prevent silent misalignment if feedback is collected before execution hardens.',
      optimized: 'feedback capture makes the primary pair easier for others to adopt',
      overload: 'people comply outwardly while unstated concerns become late-cycle friction',
      constraint: 'the pair loses leverage when Signal remains informal and feedback arrives after commitment',
    },
    fidelity: {
      bottleneck: 'tertiary Fidelity makes scale depend on a lightweight proof point',
      oneMove: 'use the Fidelity layer to define the smallest proof point required before handoff',
      scalingBreak: 'Tertiary Fidelity prevents expensive misses when proof points are narrow and early.',
      optimized: 'targeted checks catch the expensive miss without slowing every move',
      overload: 'small errors compound because checking exists as instinct, not a designed threshold',
      constraint: 'the pair stays fragile when Fidelity is present but not operationalized',
    },
    leverage: {
      bottleneck: 'tertiary Leverage makes scale depend on choosing the compounding lane',
      oneMove: 'use the Leverage layer to name which work compounds and which work should be refused',
      scalingBreak: 'Tertiary Leverage improves scale when effort is routed toward compounding decisions.',
      optimized: 'capacity concentrates around the work that multiplies the system',
      overload: 'energy disperses across useful work that does not compound',
      constraint: 'the pair stays busy instead of leveraged when the compounding lane is unnamed',
    },
    flex: {
      bottleneck: 'tertiary Flex makes scale depend on a visible pivot rule',
      oneMove: 'use the Flex layer to state what new evidence permits a pivot and what remains fixed',
      scalingBreak: 'Tertiary Flex prevents rigidity when the pivot rule is named before pressure.',
      optimized: 'adaptation becomes deliberate instead of reactive',
      overload: 'people keep adjusting to moving targets without knowing the pivot standard',
      constraint: 'the pair becomes brittle when Flex exists but the pivot rule is implicit',
    },
    horizon: {
      bottleneck: 'tertiary Horizon makes scale depend on sequencing the future pull',
      oneMove: 'use the Horizon layer to separate this week, this quarter, and later decisions',
      scalingBreak: 'Tertiary Horizon helps scale when future pull is converted into time horizons.',
      optimized: 'future orientation becomes sequence instead of distraction',
      overload: 'long-range possibility competes with near-term execution',
      constraint: 'the pair overreaches when Horizon stays inspirational instead of sequenced',
    },
    velocity: {
      bottleneck: 'tertiary Velocity makes scale depend on tempo control',
      oneMove: 'use the Velocity layer to set cadence and pause points before work starts',
      scalingBreak: 'Tertiary Velocity helps only when tempo is designed rather than absorbed.',
      optimized: 'tempo becomes predictable enough for others to match',
      overload: 'pace becomes invisible pressure that others experience as urgency',
      constraint: 'the pair creates fatigue when Velocity stays implicit',
    },
  };

  const lowestProfiles = {
    framework: {
      bottleneck: 'lowest Framework leaves the repeatable process underbuilt',
      oneMove: 'add one process capture step for the decision most likely to repeat',
      scalingBreak: 'Lowest Framework makes repeatability the tie-breaker constraint.',
      optimized: 'captured process keeps the same issue from being reinterpreted every cycle',
      overload: 'people recreate the same operating logic from scratch',
      constraint: 'repeatability stays weak when Framework is the lowest signal',
    },
    signal: {
      bottleneck: 'lowest Signal leaves adoption risk hidden until people react late',
      oneMove: 'add a named dissent check before execution begins',
      scalingBreak: 'Lowest Signal makes adoption and feedback the tie-breaker constraint.',
      optimized: 'objections surface early enough to shape the handoff',
      overload: 'misalignment stays quiet until the cost is already embedded',
      constraint: 'feedback remains late when Signal is the lowest signal',
    },
    fidelity: {
      bottleneck: 'lowest Fidelity leaves error cost invisible until downstream',
      oneMove: 'add one narrow verification point before the highest-cost handoff',
      scalingBreak: 'Lowest Fidelity makes verification the tie-breaker constraint.',
      optimized: 'the expensive miss gets caught without slowing the whole system',
      overload: 'small misses travel downstream and become coordination debt',
      constraint: 'quality risk stays latent when Fidelity is the lowest signal',
    },
    flex: {
      bottleneck: 'lowest Flex leaves pivot rules brittle under pressure',
      oneMove: 'define what evidence permits a change before the decision is locked',
      scalingBreak: 'Lowest Flex makes adaptability the tie-breaker constraint.',
      optimized: 'the team knows when adaptation is allowed and when direction is fixed',
      overload: 'change feels like reversal because pivot criteria were never named',
      constraint: 'adaptability stays costly when Flex is the lowest signal',
    },
    horizon: {
      bottleneck: 'lowest Horizon leaves near-term action disconnected from longer timing',
      oneMove: 'name the near-term decision and the future decision separately',
      scalingBreak: 'Lowest Horizon makes timing the tie-breaker constraint.',
      optimized: 'near-term work stops competing with vague future possibility',
      overload: 'the system optimizes today while the larger timing picture stays underused',
      constraint: 'sequencing stays weak when Horizon is the lowest signal',
    },
    velocity: {
      bottleneck: 'lowest Velocity leaves movement waiting on certainty',
      oneMove: 'define the smallest reversible next action and deadline it',
      scalingBreak: 'Lowest Velocity makes movement cadence the tie-breaker constraint.',
      optimized: 'progress starts before full certainty is available',
      overload: 'the system stays careful but slow enough that opportunities decay',
      constraint: 'pace stays underpowered when Velocity is the lowest signal',
    },
  };

  const tertiary = tertiaryProfiles[tertiaryKey];
  const lowest = lowestProfiles[lowestKey];

  return {
    bottleneck: joinFallbackParts([tertiary?.bottleneck, lowest?.bottleneck]),
    oneMove: joinFallbackParts([tertiary?.oneMove, lowest?.oneMove]),
    scalingBreak: joinFallbackParts([tertiary?.scalingBreak, lowest?.scalingBreak]),
    optimized: tertiary?.optimized || lowest?.optimized,
    overload: lowest?.overload || tertiary?.overload,
    constraint: lowest?.constraint || tertiary?.constraint,
  };
}

function joinFallbackParts(parts) {
  return parts.filter(Boolean).join(' with ');
}

function buildScalingFallback(profile) {
  return {
    body:
      `Primary system: ${profile.primaryName}. Secondary system: ${profile.secondaryName}. ` +
      `The unique bottleneck is ${profile.bottleneck}.\n\n` +
      `At current scale, ${profile.current}. Pressure mechanics: ${stringifyFallbackSeed(profile.pressureMechanics)}\n\n` +
      `At the next scale, ${profile.scalingBreak} Top operating signals: ${profile.rankedNames.join(', ') || profile.tensionPair}.\n\n` +
      `At larger scale, ${profile.constraint}. The tie-breaker is ${profile.tertiaryName} as tertiary signal and ${profile.lowestName} as lowest signal. ` +
      `The breakthrough is not generic structure; it is the specific translation layer between ${profile.primaryName} and ${profile.secondaryName}. ` +
      `Seed evidence: ${stringifyFallbackSeed(profile.strategicCeilingSeed)}`,
    keyWarning: `${profile.primaryName} + ${profile.secondaryName} fails when ${profile.bottleneck} stays implicit.`,
  };
}

function buildOneMoveFallback(profile) {
  return {
    body:
      `One move: ${profile.oneMove}.\n\n` +
      `This is specific to ${profile.primaryName} + ${profile.secondaryName}: the bottleneck is ${profile.bottleneck}. ` +
      `The tie-breaker signal is ${profile.tertiaryName}; the lowest signal is ${profile.lowestName}. ` +
      `It interrupts the active tension pair (${profile.tensionPair}) by turning ${profile.primaryName}'s advantage into something the organization can read before pressure escalates.\n\n` +
      `Evidence seed: ${stringifyFallbackSeed(profile.oneMoveSeed)}`,
    keyWarning: `Do not add generic structure. Build the one mechanism that resolves ${profile.bottleneck}.`,
  };
}

function buildTeamExperienceFallback(profile) {
  const pair = `${profile.primaryName} + ${profile.secondaryName}`;
  const tieBreaker = `${profile.tertiaryName} tertiary / ${profile.lowestName} lowest`;

  return {
    section: 'teamExperience',
    summary: `${pair} lands through ${profile.bottleneck}; the team initially trusts the visible ${profile.primaryName} signal, then has to adapt to the ${profile.lowestName} constraint under load.`,
    first_impression: {
      interpretation: `Others first read ${profile.primaryName} as the leading signal and ${profile.secondaryName} as the stabilizer, with ${tieBreaker} shaping whether trust holds. The trust point is ${profile.current}; the misread is assuming that ${profile.bottleneck} will explain itself without a translation layer.`
    },
    communication_pattern: {
      interpretation: `Communication works best when the team can see the ${pair} mechanism: ${profile.scalingBreak}. Without that context, people may copy the pace or standard without understanding the decision rule behind it.`
    },
    listening_pattern: {
      interpretation: `The team has to learn to surface information through the tie-breaker signal: ${tieBreaker}. Feedback needs to connect directly to ${profile.bottleneck}, not to generic preference or style.`
    },
    relational_friction: {
      interpretation: `Under load, frustration forms around ${profile.overload} inside the ${pair} pattern. The consequence is specific: ${profile.constraint}; because the tie-breaker is ${tieBreaker}, team members must learn when to ask for the missing translation before execution hardens.`
    },
    key_signals: [
      `Primary/secondary mechanism: ${pair}`,
      `Tie-breaker profile: ${tieBreaker}`,
      `Unique team consequence: ${profile.constraint}`
    ],
    causal_interpretation: `${pair} creates ${profile.bottleneck}; ${tieBreaker} determines what the team must name early so trust, friction, and follow-through do not become generic interpretation work.`
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
