/**
 * narrativeExpanderV3Architecture.js
 * 
 * BEHAVIORAL OPERATING SYSTEM INTELLIGENCE
 * 
 * Architecture Doctrine:
 * - Canonical dossier = SOURCE OF TRUTH
 * - GPT-5.5 = texture layer only (no hallucination)
 * - Each section = independent voice (no repetition)
 * - Anti-repetition system = enforced variance
 * - Trait propagation = advance not repeat
 * 
 * TARGET FEEL:
 * Elite executive intelligence briefing
 * Systems psychology operating system
 * Behavioral risk analysis
 * Strategic coaching dossier
 * 
 * NOT:
 * DISC test, therapy app, motivational fluff, LinkedIn coaching
 */

/**
 * SECTIONAL VOICE PROFILES
 * 
 * Each section has distinct narrative texture.
 * Prevents repetitive AI cadence.
 * Improves psychological believability.
 */

export const SECTIONAL_VOICES = {
  executiveSummary: {
    objective: "Compressed strategic observation",
    feel: "High-signal operational summary",
    characteristics: [
      "compressed",
      "observational",
      "intelligence-briefing",
      "no emotional prose",
      "single paragraph",
      "factual asymmetry",
    ],
    sentenceLength: "short-dominant",
    emotionalTemperature: "neutral",
    banWords: [
      "operates",
      "pattern",
      "under pressure",
      "convic",
      "executes",
      "strength is",
    ],
    maxLength: 200,
  },

  operatingPattern: {
    objective: "Behavioral motion; how they move through decisions",
    feel: "Experiential; what they feel like in action",
    characteristics: [
      "behavioral observation",
      "movement-oriented",
      "kinetic language",
      "sensory detail",
      "tempo variation",
    ],
    sentenceLength: "varied",
    emotionalTemperature: "observant",
    banWords: ["default mode", "under pressure", "creates", "manifests"],
    maxLength: 300,
  },

  decisionArchitecture: {
    objective: "Systems analysis of cognition",
    feel: "Engineering analysis of decision mechanics",
    characteristics: [
      "mechanical",
      "systems-oriented",
      "causal chains",
      "process-focused",
      "technical precision",
    ],
    sentenceLength: "medium-then-long",
    emotionalTemperature: "analytical",
    banWords: [
      "pattern",
      "conviction",
      "friction",
      "creates",
      "compounds",
    ],
    maxLength: 350,
  },

  communicationStyle: {
    objective: "Relational consequences; what people experience",
    feel: "Social dynamics; what it's like working with them",
    characteristics: [
      "relational",
      "social observation",
      "meeting dynamics",
      "feedback reactions",
      "interpersonal consequences",
      "concrete behavior",
    ],
    sentenceLength: "short-medium",
    emotionalTemperature: "social-observant",
    banWords: [
      "communicates",
      "directional",
      "clarity",
      "dialogue",
      "receptive",
    ],
    maxLength: 320,
  },

  systemUnderStrain: {
    objective: "Escalation mechanics in real time",
    feel: "Watching stress unfold; progression model",
    characteristics: [
      "sequential",
      "escalating",
      "physiological",
      "phase-based",
      "breakdown trajectory",
    ],
    sentenceLength: "short-fragments-long",
    emotionalTemperature: "escalating",
    banWords: [
      "under strain",
      "system tension",
      "gap widens",
      "pressure",
      "increases",
    ],
    maxLength: 340,
  },

  hiddenContradictions: {
    objective: "Self-deception and paradox",
    feel: "Psychologically uncomfortable truths",
    characteristics: [
      "paradoxical",
      "introspective",
      "self-deception modeling",
      "uncomfortable honesty",
      "cognitive dissonance",
    ],
    sentenceLength: "medium",
    emotionalTemperature: "uncomfortable",
    banWords: [
      "contradiction",
      "believes",
      "reality",
      "gap",
      "often",
    ],
    maxLength: 380,
  },

  strategicCeiling: {
    objective: "Scaling failure analysis; organizational math",
    feel: "Founder/investor memo on growth limits",
    characteristics: [
      "future-pressure modeling",
      "scaling analysis",
      "organizational systems thinking",
      "scale transitions",
      "inevitability language",
    ],
    sentenceLength: "compressed-per-scale",
    emotionalTemperature: "detached-pragmatic",
    banWords: [
      "scale",
      "requires",
      "fragment",
      "velocity",
      "impossible",
    ],
    maxLength: 400,
  },

  coachingLeverage: {
    objective: "Tactical intervention points",
    feel: "Elite operator coaching; direct, practical",
    characteristics: [
      "direct",
      "tactical",
      "practical",
      "action-oriented",
      "no therapy tone",
      "specific experiments",
    ],
    sentenceLength: "short-imperative",
    emotionalTemperature: "pragmatic",
    banWords: [
      "leverage",
      "reframe",
      "game",
      "coach",
      "help them",
    ],
    maxLength: 350,
  },
};

/**
 * PHRASE GRAVEYARD
 * 
 * System-wide banned phrases to suppress repetition.
 * Enforced across all sections.
 */

export const PHRASE_GRAVEYARD = [
  "under pressure",
  "creates friction",
  "compounds over time",
  "velocity",
  "operator",
  "scaling complexity",
  "pattern recognition",
  "conviction increases",
  "speed increases",
  "reads less",
  "system breaks",
  "decision velocity",
  "information velocity",
  "tends to",
  "often",
  "begins to",
  "can feel like",
  "strength becomes liability",
  "hidden cost",
  "blind spot",
  "gap between",
];

/**
 * SECTION-SPECIFIC SUPPRESSION
 * 
 * Additional banned words per section
 * to prevent thematic repetition.
 */

export const SECTION_SUPPRESSIONS = {
  executiveSummary: [
    "strength",
    "liability",
    "dynamic",
    "manifests",
  ],
  operatingPattern: [
    "normal",
    "default",
    "state",
    "mode",
  ],
  decisionArchitecture: [
    "decision",
    "architecture",
    "form",
    "evaluate",
  ],
  communicationStyle: [
    "communicate",
    "dialogue",
    "respond",
    "receptive",
  ],
  systemUnderStrain: [
    "strain",
    "stress",
    "break",
    "fail",
  ],
  hiddenContradictions: [
    "contradiction",
    "paradox",
    "tension",
    "believe",
  ],
  strategicCeiling: [
    "scale",
    "impossible",
    "requires",
    "fragment",
  ],
  coachingLeverage: [
    "leverage",
    "reframe",
    "game",
    "coach",
  ],
};

/**
 * ANTI-REPETITION MEMORY
 * 
 * Tracks what's been said to prevent recycling.
 * Noun/verb/phrase frequency limiting.
 */

export class AntiRepetitionMemory {
  constructor() {
    this.usedNouns = {};
    this.usedVerbs = {};
    this.usedPhrases = {};
    this.sentenceOpenings = {};
    this.cadenceHistory = [];
  }

  record(noun, verb, phrase, opening) {
    this.usedNouns[noun] = (this.usedNouns[noun] || 0) + 1;
    this.usedVerbs[verb] = (this.usedVerbs[verb] || 0) + 1;
    this.usedPhrases[phrase] = (this.usedPhrases[phrase] || 0) + 1;
    this.sentenceOpenings[opening] =
      (this.sentenceOpenings[opening] || 0) + 1;
  }

  canUse(noun, verb, phrase, opening, maxFrequency = 2) {
    return (
      (this.usedNouns[noun] || 0) < maxFrequency &&
      (this.usedVerbs[verb] || 0) < maxFrequency &&
      (this.usedPhrases[phrase] || 0) < maxFrequency &&
      (this.sentenceOpenings[opening] || 0) < maxFrequency
    );
  }

  clear() {
    this.usedNouns = {};
    this.usedVerbs = {};
    this.usedPhrases = {};
    this.sentenceOpenings = {};
    this.cadenceHistory = [];
  }
}

/**
 * TRAIT PROPAGATION MEMORY
 * 
 * Once a trait is established, ADVANCE it.
 * Don't re-explain; evolve understanding.
 */

export class TraitPropagationMemory {
  constructor() {
    this.establishedTraits = {};
    this.traitAdvancementLevel = {};
  }

  establish(traitName, description) {
    this.establishedTraits[traitName] = description;
    this.traitAdvancementLevel[traitName] = 1;
  }

  isEstablished(traitName) {
    return !!this.establishedTraits[traitName];
  }

  getAdvancementLevel(traitName) {
    return this.traitAdvancementLevel[traitName] || 0;
  }

  advance(traitName) {
    this.traitAdvancementLevel[traitName] =
      (this.traitAdvancementLevel[traitName] || 1) + 1;
  }

  shouldAdvance(traitName) {
    return this.getAdvancementLevel(traitName) >= 1;
  }
}

/**
 * COMPRESSION PASS
 * 
 * AI naturally over-explains.
 * This removes redundancy and tightens prose.
 */

export function compressionPass(text) {
  let compressed = text;

  // Remove "that" clauses where unnecessary
  compressed = compressed.replace(/\s+that\s+/g, " ");

  // Remove redundant descriptors
  compressed = compressed.replace(/\s+very\s+/g, " ");
  compressed = compressed.replace(/\s+quite\s+/g, " ");
  compressed = compressed.replace(/\s+really\s+/g, " ");

  // Remove over-explaining phrases
  compressed = compressed.replace(
    /In other words,\s+/gi,
    ""
  );
  compressed = compressed.replace(
    /This means that\s+/gi,
    ""
  );
  compressed = compressed.replace(
    /What this really\s+/gi,
    ""
  );

  // Compress redundant sentences
  compressed = compressed.replace(
    /\.\s+This is because\s+/g,
    ". "
  );
  compressed = compressed.replace(
    /\.\s+The reason is\s+/g,
    ". "
  );

  // Target 10-15% compression
  const originalLength = text.length;
  const targetLength = Math.round(originalLength * 0.87);

  if (compressed.length > targetLength) {
    // Sentence truncation pass
    const sentences = compressed.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length > 1) {
      // Remove least important sentences (those with weak signal)
      compressed = sentences
        .filter((s) => {
          const lowSignal = [
            "however",
            "also",
            "additionally",
            "furthermore",
          ].some((w) => s.toLowerCase().includes(w));
          return !lowSignal;
        })
        .join(" ");
    }
  }

  return compressed.trim();
}

/**
 * SENTENCE RHYTHM VARIATION
 * 
 * Prevents uniform prosody.
 * Creates asymmetry like real human writing.
 */

export function varyRhythm(text, targetStyle = "mixed") {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  if (targetStyle === "short-dominant") {
    // Executive Summary: favor short, punchy sentences
    return sentences
      .map((s, i) => {
        if (i % 3 === 0 && s.length > 80) {
          // Break longer sentences into fragments
          return s.replace(/;\s+/g, ".\n");
        }
        return s;
      })
      .join(" ")
      .trim();
  }

  if (targetStyle === "varied") {
    // Natural rhythm: mix short + medium + long
    let rhythm = [];
    sentences.forEach((s, i) => {
      const len = s.split(" ").length;
      if (i % 4 === 0 && len > 20) {
        rhythm.push("LONG");
      } else if (i % 3 === 0 && len < 10) {
        rhythm.push("SHORT");
      } else {
        rhythm.push("MEDIUM");
      }
    });

    // If we have too many of one type, vary it
    const shortCount = rhythm.filter((r) => r === "SHORT").length;
    const longCount = rhythm.filter((r) => r === "LONG").length;

    if (shortCount / rhythm.length > 0.6) {
      // Too many shorts; combine some
      return sentences.join(" ");
    }

    return text;
  }

  return text;
}

/**
 * REALISM INJECTION
 * 
 * Adds concrete operational detail.
 * Prevents generic abstraction.
 */

export function injectRealism(narrativeObj, canonical) {
  // Pull concrete behavior signals from canonical
  const topSystems = canonical.top_systems || {};
  const scores = canonical.vector_scores || {};

  // Find specific pressure manifestation
  const pressureManifest =
    topSystems.primary_driver?.pressure_manifestation || "";

  // Inject meeting-level detail
  if (pressureManifest.includes("faster")) {
    // Add meeting tempo detail
    return narrativeObj.replace(
      /communication becomes more directive/i,
      "meetings accelerate; silent processing drops to zero"
    );
  }

  return narrativeObj;
}

/**
 * GPT-5.5 RENDERING INSTRUCTION BUILDER
 * 
 * Each section gets independent, focused GPT call.
 * NOT whole-report rendering (causes repetition).
 */

export function buildSectionPrompt(
  sectionName,
  canonical,
  antiRep,
  traitProp,
  priorSections
) {
  const voice = SECTIONAL_VOICES[sectionName];
  const suppressions = [
    ...PHRASE_GRAVEYARD,
    ...(SECTION_SUPPRESSIONS[sectionName] || []),
  ];

  return `
You are an elite executive intelligence writer.
Your task: expand ONE section of a behavioral operating system dossier.

CANONICAL EVIDENCE (SOURCE OF TRUTH):
${JSON.stringify(canonical, null, 2).slice(0, 500)}

SECTION: ${sectionName}
VOICE: ${voice.feel}
CHARACTERISTICS: ${voice.characteristics.join(", ")}
EMOTIONAL TEMPERATURE: ${voice.emotionalTemperature}
MAX LENGTH: ${voice.maxLength} characters
SENTENCE RHYTHM: ${voice.sentenceLength}

SECTION OBJECTIVE:
${voice.objective}

CRITICAL CONSTRAINTS:
1. DO NOT INVENT behavioral claims
2. ALL statements must trace back to canonical evidence
3. DO NOT use these words/phrases: ${suppressions.join(", ")}
4. DO NOT repeat these traits (already established): ${Object.keys(traitProp.establishedTraits).join(", ")}
5. DO NOT match the rhythm or cadence of previous sections:
${Object.entries(priorSections)
  .slice(-2)
  .map(([k, v]) => `${k}: ${v.slice(0, 100)}...`)
  .join("\n")}

TASK:
Generate the ${sectionName} section.
- Grounded to canonical data only
- No hallucination
- Distinct voice from other sections
- Advance traits (don't re-explain)
- Inject concrete operational reality
- Target ${voice.maxLength} characters

GO:
`;
}

/**
 * MULTI-PASS RENDERING ORCHESTRATOR
 */

export class NarrativeExpanderV3 {
  constructor(canonical) {
    this.canonical = canonical;
    this.antiRep = new AntiRepetitionMemory();
    this.traitProp = new TraitPropagationMemory();
    this.renderedSections = {};
  }

  async renderSection(sectionName) {
    const prompt = buildSectionPrompt(
      sectionName,
      this.canonical,
      this.antiRep,
      this.traitProp,
      this.renderedSections
    );

    // In real implementation, this calls GPT-5.5
    // For now, returns structured instruction
    return {
      sectionName,
      prompt,
      expectations: {
        voice: SECTIONAL_VOICES[sectionName].feel,
        maxLength: SECTIONAL_VOICES[sectionName].maxLength,
        banWords: SECTION_SUPPRESSIONS[sectionName],
      },
    };
  }

  async renderFullNarrative() {
    const sections = Object.keys(SECTIONAL_VOICES);
    const narrative = {};

    for (const section of sections) {
      const raw = await this.renderSection(section);

      // Pass 1: Render with GPT-5.5
      // (placeholder for now)
      const rendered = raw.prompt;

      // Pass 2: Remove repetition
      // (antiRep filtering)

      // Pass 3: Inject realism
      // (concrete operational detail)

      // Pass 4: Compress
      const compressed = compressionPass(rendered);

      narrative[section] = compressed;
      this.renderedSections[section] = compressed;
    }

    return narrative;
  }
}

export default NarrativeExpanderV3;
