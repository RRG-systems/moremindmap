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
      `Paired with ${interpreted.secondarySystem.dimension || 'supporting decision style'}, creates execution speed advantage that dominates coordination friction. ` +
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
      summary: "Environment should make decision rules visible instead of relying on personal translation.",
      primary_guidance: "Create clear decision lanes, feedback timing, and delegation boundaries so speed does not outrun shared understanding.",
      notes: [
        {
          label: "Decision review",
          guidance: "Review major decisions after consequences surface, not only when the decision is made.",
          rationale: "This keeps fast decisions connected to downstream evidence."
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
      summary: `These five paths show what happens if the current leadership pattern continues, gets clearer, or carries too much of the company.`,
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
        trajectory: 'The current decision pattern continues with its existing strengths and constraints.',
        organization_experiences: 'The organization experiences the same value creation pattern and the same friction points.',
      },
      {
        title: 'Optimized Trajectory',
        likelihood: 'possible',
        trajectory: 'The strongest decision pattern is supported by clearer environment design.',
        organization_experiences: 'The organization receives more of the upside with less unmanaged drag.',
      },
      {
        title: 'Burnout Trajectory',
        likelihood: 'risk',
        trajectory: 'The current decision pattern is overused without enough structural support.',
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
      summary: 'Environment design should support the strongest decision pattern and reduce unmanaged friction.',
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
      summary: 'Others experience the profile through its strongest decision pattern first.',
      first_impression: { interpretation: 'The clearest behavioral signal lands before the full context is visible.' },
      communication_pattern: { interpretation: 'Communication follows the dominant decision pattern and can create friction when others need a different pace or sequence.' },
      listening_pattern: { interpretation: 'Listening quality depends on whether the environment makes room for the lower-weighted systems.' },
      relational_friction: { interpretation: 'Friction appears when the profile strength is overused under pressure.' },
      key_signals: ['Dominant decision pattern', 'Pressure response', 'Lowest weighted signals'],
      causal_interpretation: 'The team experiences the operating system through its dominant pattern, then feels the hidden cost when pressure rises.',
      body: 'Others experience the profile through its strongest decision pattern first.',
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
    'pressure intensifies the main decision style';
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

  const profile = {
    primaryKey: primary.key,
    primaryName: primary.name,
    secondaryKey: secondary.key,
    secondaryName: secondary.name,
    tertiaryKey: tertiary.key,
    tertiaryName: tertiary.name,
    lowestKey: lowest.key,
    lowestName: lowest.name,
    rankedNames: ranked.slice(0, 4).map((d) => toCustomerDimensionName(normalizeDimension(d.dimension).name)).filter(Boolean),
    tensionPair,
    pressureMechanics,
    oneMoveSeed,
    strategicCeilingSeed,
    mechanism: {
      pair: `${primary.name} + ${secondary.name}`,
      bottleneck,
      tertiary: {
        key: tertiary.key,
        name: tertiary.name,
      },
      lowest: {
        key: lowest.key,
        name: lowest.name,
      },
    },
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

  profile.consequences = buildConsequenceTranslation(profile);
  return profile;
}

function normalizeDimension(dimension) {
  const inputKey = String(dimension || '').trim().toLowerCase();
  const key = inputKey.includes('speed') ? 'velocity' : inputKey;
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
      constraint: 'missing repeatable process remains the ceiling even when the main decision style is strong',
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
      overload: 'people comply outwardly while unstated concerns become problems that surface too late',
      constraint: 'the pair loses leverage when Signal remains informal and feedback arrives after commitment',
    },
    fidelity: {
      bottleneck: 'tertiary Fidelity makes scale depend on a lightweight proof point',
      oneMove: 'use the Fidelity layer to define the smallest proof point required before handoff',
      scalingBreak: 'Tertiary Fidelity prevents expensive misses when proof points are narrow and early.',
      optimized: 'a short review point before expensive handoffs catches the costly miss without slowing every move',
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

function buildConsequenceTranslation(profile) {
  const pairKey = `${profile.primaryKey}:${profile.secondaryKey}`;
  const pairConsequences = getPairConsequences(pairKey, profile.secondaryKey, profile.primaryKey);
  const tertiaryConsequence = getTertiaryConsequence(profile.tertiaryKey);
  const lowestConsequence = getLowestConsequence(profile.lowestKey);

  return {
    leadership: joinConsequenceParts([
      pairConsequences.leadership,
      tertiaryConsequence.leadership,
    ]),
    team: joinConsequenceParts([
      pairConsequences.team,
      lowestConsequence.team,
    ]),
    business: joinConsequenceParts([
      pairConsequences.business,
      tertiaryConsequence.business,
    ]),
    scaling: joinConsequenceParts([
      pairConsequences.scaling,
      lowestConsequence.scaling,
    ]),
    future: joinConsequenceParts([
      pairConsequences.future,
      lowestConsequence.future,
    ]),
    oneMove: joinConsequenceParts([
      pairConsequences.oneMove,
      tertiaryConsequence.oneMove,
      lowestConsequence.oneMove,
    ]),
  };
}

function getPairConsequences(pairKey, secondaryKey, primaryKey) {
  const pairMap = {
    'vector:velocity': {
      leadership: 'The leader creates momentum quickly, but must translate pace into shared sequence before execution starts.',
      team: 'The team trusts the urgency when handoffs are clear, but fast decisions can become cleanup work when ownership is unclear.',
      business: 'Growth starts depending on how well fast decisions become coordinated execution.',
      scaling: 'At scale, progress becomes dependent on the leader turning speed into a rhythm others can follow.',
      future: 'The organization either converts pace into operating cadence or keeps paying for rework behind visible momentum.',
      oneMove: 'Install a short alignment cadence that turns fast decisions into clear owners, timing, and what success looks like.',
    },
    'vector:flex': {
      leadership: 'The leader changes direction with useful adaptability, but must make clear what is fixed and what is still open.',
      team: 'The team increasingly waits for clarification because flexibility can feel like unresolved direction.',
      business: 'Execution consistency drops when people cannot tell whether a decision is settled or still adapting.',
      scaling: "Growth depends too heavily on the leader's personal judgment when everyone waits on the leader for clarity.",
      future: 'The organization either turns adaptability into clear option architecture or keeps drifting around unresolved decisions.',
      oneMove: 'Create a decision feedback loop that names what is fixed, what is flexible, and when ambiguity gets resolved.',
    },
    'vector:fidelity': {
      leadership: 'The leader sets direction decisively, but trust depends on naming what must be checked before commitment.',
      team: 'The team needs to know which decisions require checking and which can move without review.',
      business: 'Quality risk appears when direction locks before standards are clear.',
      scaling: 'Scale requires visible decision rules so speed and trust can coexist.',
      future: 'The organization either learns when to verify or splits between fast action and late correction.',
      oneMove: 'Define the decision checkpoint: what must be verified before direction locks and what can move without review.',
    },
    'signal:fidelity': {
      leadership: 'The leader protects trust through careful reading and verification, but must separate concern from decision ownership.',
      team: 'The team trusts the caution but can wait too long for certainty.',
      business: 'Opportunities slow when relational confidence and proof have to arrive at the same time.',
      scaling: 'Scale requires different lanes for concern capture, evidence, and the final decision owner.',
      future: 'The organization either turns caution into a clear trust protocol or loses time waiting for complete certainty.',
      oneMove: 'Name the concern, the evidence required, and the decision owner before the lane slows down.',
    },
    'fidelity:framework': {
      leadership: 'The leader creates trust through accuracy and process, but must size rules to the cost of the decision.',
      team: 'The team trusts the standards until the process feels heavier than the work requires.',
      business: 'Throughput slows when quality control becomes the work instead of protecting the work.',
      scaling: 'Scale requires right-sized standards that preserve trust without turning every decision into procedure.',
      future: 'The organization either converts precision into usable rules or lets process weight slow execution.',
      oneMove: 'Convert one recurring quality judgment into a documented rule with owner, exception path, and completion test.',
    },
    'vector:horizon': {
      leadership: 'The leader pulls the organization toward the future, but must sequence the vision into decisions people can execute now.',
      team: 'The team can believe the destination while still needing clarity on what matters this week.',
      business: 'Strategic reach loses force when near-term priorities compete for the same attention.',
      scaling: 'Scale requires staged timing so vision becomes execution instead of competing possibility.',
      future: 'The organization either inherits a sequence or keeps chasing a persuasive future that stays hard to operationalize.',
      oneMove: 'Convert the long-range thesis into a near-term sequence with visible decision gates.',
    },
  };

  const secondaryMap = {
    velocity: pairMap['vector:velocity'],
    flex: pairMap['vector:flex'],
    fidelity: {
      leadership: 'The leader protects quality by checking decisions, but must make the acceptable error band explicit.',
      team: 'The team needs to know when precision is required and when ownership can move.',
      business: 'Decision congestion grows when the standard is felt but not named.',
      scaling: 'Scale requires verification thresholds that catch expensive misses without slowing every move.',
      future: 'The organization either turns checking into standards or keeps routing decisions back through personal review.',
      oneMove: 'Define what must be checked, what can move, and who owns exceptions.',
    },
    framework: {
      leadership: 'The leader makes repeatability possible, but must keep process light enough to serve execution.',
      team: 'The team needs clear rules they can run without asking the leader to reconstruct the answer.',
      business: 'Capacity gets consumed by rebuilding decisions that should already be repeatable.',
      scaling: 'Scale requires the working pattern to survive without personal memory or repeated explanation.',
      future: 'The organization either captures process or keeps making growth dependent on the same interpreter.',
      oneMove: 'Capture the next recurring decision as a repeatable process with owner, trigger, and done condition.',
    },
    signal: {
      leadership: 'The leader reads people and context, but must collect feedback before commitment makes it expensive.',
      team: 'The team needs earlier dissent capture so concerns do not become late repair work.',
      business: 'Execution risk rises when feedback appears after work has already started.',
      scaling: 'Scale requires early feedback from the people who have to execute before quiet concerns become drag.',
      future: 'The organization either makes feedback a design input or keeps paying for repair after momentum commits people.',
      oneMove: 'Add explicit objection checks, repair windows, and dissent capture after major decisions.',
    },
    leverage: {
      leadership: 'The leader looks for compounding lift, but must choose which work deserves multiplication.',
      team: 'The team needs a clear lane for what compounds and what should be refused.',
      business: 'Activity can stay high while strategic lift stays capped.',
      scaling: 'Scale requires effort to concentrate around the few decisions that multiply the system.',
      future: 'The organization either concentrates capacity or stays busy without enough lift.',
      oneMove: 'Name the highest-leverage decision lane and remove work that does not compound through it.',
    },
    horizon: pairMap['vector:horizon'],
  };

  return pairMap[pairKey] || secondaryMap[secondaryKey] || secondaryMap[primaryKey] || {
    leadership: 'The leader creates value through clear judgment, but must make the handoff rule visible.',
    team: 'The team needs to see how decisions move from instinct to shared execution.',
    business: 'Execution becomes harder to repeat when decision logic stays implicit.',
    scaling: 'Growth depends on turning personal judgment into a system others can run.',
    future: 'The organization either inherits the operating logic or keeps routing interpretation through the same person.',
    oneMove: 'Name the primary operating advantage and define the handoff rule that lets others use it without guessing.',
  };
}

function getTertiaryConsequence(key) {
  const map = {
    framework: {
      leadership: 'Process is available as a stabilizer when the leader writes the rule before pace increases.',
      business: 'Explicit operating rails reduce preventable rework.',
      oneMove: 'Use the process signal to write the sequence rule before pace accelerates.',
    },
    signal: {
      leadership: 'Feedback can stabilize the pattern when the leader captures objections before decisions harden.',
      business: 'Early feedback from the people who have to execute prevents problems from surfacing too late.',
      oneMove: 'Use feedback capture before treating the decision as settled.',
    },
    fidelity: {
      leadership: 'Clear evidence before handoff can protect trust without slowing every move.',
      business: 'A short review point before expensive handoffs catches costly misses.',
      oneMove: 'Define the clear evidence required before handoff.',
    },
    leverage: {
      leadership: 'Compounding work becomes easier to choose when the leader names the lane that matters most.',
      business: 'Capacity concentrates around work that multiplies the system.',
      oneMove: 'Name which work compounds and which work should be refused.',
    },
    flex: {
      leadership: 'Adaptability improves when the leader names what evidence permits a pivot.',
      business: 'Change stops feeling like reversal when pivot criteria are visible.',
      oneMove: 'State what new evidence permits a pivot and what remains fixed.',
    },
    horizon: {
      leadership: 'Future orientation helps when the leader separates this week, this quarter, and later decisions.',
      business: 'Sequencing keeps long-range pull from competing with near-term execution.',
      oneMove: 'Separate this week, this quarter, and later decisions.',
    },
    velocity: {
      leadership: 'Tempo helps when the leader designs cadence instead of letting others absorb urgency.',
      business: 'Predictable pace lowers invisible pressure on execution.',
      oneMove: 'Set cadence and pause points before work starts.',
    },
  };

  return map[key] || {};
}

function getLowestConsequence(key) {
  const map = {
    framework: {
      team: 'People recreate the same logic unless repeatable process is captured.',
      scaling: 'Repeatability remains the ceiling until the decision process is written down.',
      future: 'Growth keeps depending on personal reconstruction instead of inherited process.',
      oneMove: 'Add one process capture step for the decision most likely to repeat.',
    },
    signal: {
      team: 'People may comply before they are aligned if dissent is not invited early.',
      scaling: 'Feedback arrives too late unless adoption risk is captured before execution begins.',
      future: 'Quiet misalignment becomes visible only after cost is already embedded.',
      oneMove: 'Add a named dissent check before execution begins.',
    },
    fidelity: {
      team: 'People move faster than the quality threshold unless checking is named.',
      scaling: 'Quality risk stays hidden until volume makes misses expensive.',
      future: 'Small misses travel downstream and become coordination debt.',
      oneMove: 'Add one narrow verification point before the highest-cost handoff.',
    },
    flex: {
      team: 'People experience change as reversal when pivot criteria are not named.',
      scaling: 'Adaptability stays costly until the team knows when change is allowed.',
      future: 'Growth exposes brittle pivot rules when pressure rises.',
      oneMove: 'Define what evidence permits a change before the decision is locked.',
    },
    horizon: {
      team: 'People optimize the immediate move without seeing the larger timing picture.',
      scaling: 'Sequencing stays weak when near-term action and future timing are not separated.',
      future: 'The system keeps solving today while the bigger timing question stays underused.',
      oneMove: 'Name the near-term decision and the future decision separately.',
    },
    velocity: {
      team: 'People wait too long for certainty unless the next move is made small enough to start.',
      scaling: 'Pace stays underpowered when movement lacks a deadline.',
      future: 'Opportunities decay while the system remains careful.',
      oneMove: 'Define the smallest reversible next action and deadline it.',
    },
  };

  return map[key] || {};
}

function joinConsequenceParts(parts) {
  return parts.filter(Boolean).join(' ');
}

function buildScalingFallback(profile) {
  const consequences = profile.consequences;
  const body = toExecutiveLanguage(
    `Right now, ${profile.current}. That creates value because the leader moves decisions forward before momentum disappears.\n\n` +
    `At the next level, the company needs clearer decision rules so people can move without waiting for the leader to translate the decision. ${consequences.leadership}\n\n` +
    `${consequences.team} ${consequences.business}\n\n` +
    `The issue is not effort. It is transfer. ${consequences.scaling} The breakthrough is making judgment visible enough for the team to execute without guessing.`
  );

  return {
    body,
    keyWarning: toExecutiveLanguage(consequences.scaling),
  };
}

function buildOneMoveFallback(profile) {
  const consequences = profile.consequences;
  const body = toExecutiveLanguage(
    `For the next 30 days, make every major decision include four things:\n` +
    `1. owner\n` +
    `2. timeline\n` +
    `3. what success looks like\n` +
    `4. what would cause the decision to change\n\n` +
    `${consequences.oneMove}\n\n` +
    `This gives the team a decision rule they can execute without waiting for the leader to translate it. ${consequences.team} ${consequences.business}`
  );

  return {
    body,
    keyWarning: toExecutiveLanguage(consequences.scaling),
  };
}

function buildTeamExperienceFallback(profile) {
  const consequences = profile.consequences;

  return {
    section: 'teamExperience',
    summary: toExecutiveLanguage(`People trust the leader's decisiveness early. They feel momentum, clarity, and urgency. Over time, ${lowerFirst(consequences.team)}`),
    first_impression: {
      interpretation: toExecutiveLanguage(`Others first trust the leader's ability to create direction and keep movement alive. The early benefit is visible: ${profile.current}.`)
    },
    communication_pattern: {
      interpretation: `Communication works best when decisions include ownership, timing, and what is still open. Without that, people may copy the pace without understanding the decision rule.`
    },
    listening_pattern: {
      interpretation: `The team has to surface objections before the plan hardens. Feedback needs to connect to the decision and handoff, not to generic preference or style.`
    },
    relational_friction: {
      interpretation: toExecutiveLanguage(`Under load, frustration shows up as coordination cost. ${consequences.business} ${consequences.scaling}`)
    },
    key_signals: [
      `Initial trust: decisive movement`,
      `Team effect: ${toExecutiveLanguage(consequences.team)}`,
      `Scaling risk: ${toExecutiveLanguage(consequences.scaling)}`
    ],
    causal_interpretation: `Trust depends on whether decisions become clear enough for other people to execute without waiting for the leader to translate them.`
  };
}

function getDisplayPair(profile) {
  return `${toCustomerDimensionName(profile.primaryName)} + ${toCustomerDimensionName(profile.secondaryName)}`;
}

function toCustomerDimensionName(value) {
  const text = String(value || '').trim();
  if (/speed/i.test(text)) return 'Velocity';
  return text;
}

function lowerFirst(text) {
  const value = String(text || '').trim();
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function sanitizeConsequenceText(text) {
  return String(text || '')
    .split('Vector + speed').join('Vector + Velocity')
    .split('Vector + Speed').join('Vector + Velocity')
    .replace(/\bspeed, Fidelity\b/g, 'Velocity, Fidelity')
    .replace(/\bspeed, /g, 'Velocity, ');
}

function toExecutiveLanguage(text) {
  return sanitizeConsequenceText(text)
    .replace(/\bvisible mechanism\b/gi, 'practical issue')
    .replace(/\bvisible operating mechanism\b/gi, 'practical issue')
    .replace(/\boperating pair\b/gi, 'leadership pattern')
    .replace(/\bleadership consequence is simpler:?\s*/gi, '')
    .replace(/\blate-cycle friction\b/gi, 'problems surface too late')
    .replace(/\badoption data\b/gi, 'early feedback from the people who have to execute')
    .replace(/\btargeted checks\b/gi, 'a short review point before expensive handoffs')
    .replace(/\bevidence seed:?\s*/gi, '')
    .replace(/\bseed evidence:?\s*/gi, '')
    .replace(/\binternal system balance\b/gi, 'stress pattern')
    .replace(/\bthis addresses the practical issue without making the team decode it\.?\s*/gi, '')
    .replace(/\bthis addresses the visible operating mechanism without making the team decode it\.?\s*/gi, '')
    .replace(/\bprimary system\b/gi, 'main decision style')
    .replace(/\bsecondary system\b/gi, 'supporting decision style')
    .replace(/\boperating pattern\b/gi, 'decision pattern')
    .replace(/\boperating logic\b/gi, 'decision logic')
    .replace(/\boperating speed\b/gi, 'decision speed')
    .replace(/\boperating rails\b/gi, 'decision rails')
    .replace(/\bproof point\b/gi, 'clear evidence')
    .replace(/\bacceptance criteria\b/gi, 'what success looks like')
    .replace(/\bambiguity resolution lives with the leader\b/gi, 'everyone waits on the leader for clarity')
    .replace(/\bgrowth becomes person-dependent\b/gi, "growth depends too heavily on the leader's personal judgment")
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function buildFiveFuturesFallback(profile) {
  const consequences = profile.consequences;
  const titles = getExecutiveFutureTitles(profile);

  return [
    {
      title: `Current Trajectory: ${titles.current}`,
      likelihood: 'likely',
      trajectory: toExecutiveLanguage(`${profile.current}. The leader keeps creating movement, but the team needs clearer decision rules before execution begins.`),
      organization_experiences: toExecutiveLanguage(`${consequences.team} ${consequences.business}`)
    },
    {
      title: `Optimized Trajectory: ${titles.optimized}`,
      likelihood: 'possible',
      trajectory: toExecutiveLanguage(`${profile.optimized}. The one move is to ${consequences.oneMove}`),
      organization_experiences: `People gain a usable decision layer, so the leader's advantage becomes easier to repeat without guessing.`
    },
    {
      title: `Burnout Trajectory: ${titles.burnout}`,
      likelihood: 'risk',
      trajectory: toExecutiveLanguage(`${profile.overload}. Pressure puts more of the same leadership burden back on one person instead of distributing it.`),
      organization_experiences: toExecutiveLanguage(`${consequences.business} Repair, rework, or delayed interpretation becomes the hidden workload.`)
    },
    {
      title: `Leadership Trajectory: ${titles.leadership}`,
      likelihood: 'possible',
      trajectory: toExecutiveLanguage(`${profile.leadership}. The leader turns personal judgment into transferable decision rules.`),
      organization_experiences: `Others can carry more of the work because decision rules, communication, and accountability become visible.`
    },
    {
      title: `Constraint Trajectory: ${titles.constraint}`,
      likelihood: 'likely',
      trajectory: toExecutiveLanguage(`${consequences.scaling}`),
      organization_experiences: `Growth keeps routing interpretation through the leader instead of giving the organization decision rules it can inherit.`
    }
  ];
}

function getExecutiveFutureTitles(profile) {
  const pairKey = `${profile.primaryKey}:${profile.secondaryKey}`;
  const byPair = {
    'vector:velocity': {
      current: 'Momentum With Rising Coordination Cost',
      optimized: 'Speed Becomes Scalable',
      burnout: 'Urgency Becomes Cleanup',
      leadership: 'Judgment Becomes Transferable',
      constraint: 'Growth Routes Back Through You',
    },
    'vector:flex': {
      current: 'Progress With Unclear Boundaries',
      optimized: 'Decision Rules Become Transferable',
      burnout: 'Ambiguity Becomes Drag',
      leadership: 'Clarity Compounds',
      constraint: 'Founder Dependency Increases',
    },
    'vector:fidelity': {
      current: 'Fast Direction With Quality Risk',
      optimized: 'Trust Checks Become Clear',
      burnout: 'Correction Work Increases',
      leadership: 'Standards Support Speed',
      constraint: 'Quality Problems Surface Late',
    },
    'signal:fidelity': {
      current: 'Caution Slows Commitment',
      optimized: 'Trust Protocols Clarify Decisions',
      burnout: 'Certainty Takes Too Long',
      leadership: 'Judgment Becomes Trusted Process',
      constraint: 'Proof Delays Momentum',
    },
    'fidelity:framework': {
      current: 'Quality With Procedural Weight',
      optimized: 'Standards Become Usable',
      burnout: 'Process Outweighs Progress',
      leadership: 'The Team Carries More',
      constraint: 'Throughput Slows Under Rules',
    },
    'vector:horizon': {
      current: 'Vision With Execution Drag',
      optimized: 'Strategy Becomes Sequence',
      burnout: 'Future Pull Splits Focus',
      leadership: 'Direction Becomes Transferable',
      constraint: 'Timing Exposes The Gap',
    },
  };

  const bySecondary = {
    velocity: byPair['vector:velocity'],
    flex: byPair['vector:flex'],
    fidelity: {
      current: 'Quality Risk Surfaces Late',
      optimized: 'Review Points Protect Trust',
      burnout: 'Correction Work Increases',
      leadership: 'Standards Become Transferable',
      constraint: 'Decisions Route Back For Review',
    },
    framework: {
      current: 'Progress Depends On Rebuilding',
      optimized: 'Process Becomes Repeatable',
      burnout: 'Explanation Load Builds',
      leadership: 'The Team Carries More',
      constraint: 'Repeatability Exposes The Gap',
    },
    signal: {
      current: 'Feedback Arrives Too Late',
      optimized: 'Early Feedback Improves Execution',
      burnout: 'Repair Work Builds',
      leadership: 'Trust Becomes A System',
      constraint: 'Silent Misalignment Increases',
    },
    leverage: {
      current: 'Activity Outruns Leverage',
      optimized: 'Focus Creates Lift',
      burnout: 'Useful Work Dilutes Impact',
      leadership: 'Priorities Become Clearer',
      constraint: 'Busy Work Caps Growth',
    },
    horizon: byPair['vector:horizon'],
  };

  return byPair[pairKey] || bySecondary[profile.secondaryKey] || {
    current: 'Progress With Hidden Cost',
    optimized: 'Decision Rules Become Transferable',
    burnout: 'Leadership Strain Builds',
    leadership: 'Judgment Becomes Transferable',
    constraint: 'Scale Exposes The Gap',
  };
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
      `Paired with ${interpreted.secondarySystem.dimension || 'supporting decision style'}, creates execution speed advantage that dominates coordination friction. ` +
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
