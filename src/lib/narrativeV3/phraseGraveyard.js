/**
 * phraseGraveyard.js
 * 
 * Hard-suppressed phrases across all sections.
 * Prevents repetitive AI cadence and taxonomy-speak.
 */

export const GLOBAL_BANNED_PHRASES = [
  "under pressure",
  "creates friction",
  "compounds over time",
  "velocity",
  "operator",
  "scaling complexity",
  "pattern recognition",
  "decision velocity",
  "strength becomes liability",
  "hidden cost",
  "blind spot",
  "gap between",
  "tends to",
  "often",
  "can feel like",
  "executive summary",
  "operating pattern",
  "decision architecture",
  "communication style",
  "system under strain",
  "hidden contradictions",
  "strategic ceiling",
  "coaching leverage",
];

export const SECTION_SPECIFIC_BANS = {
  executiveSummary: [
    "strength",
    "liability",
    "manifests",
    "creates",
    "person operates",
  ],
  communicationStyle: [
    "communicates",
    "responds",
    "dialogue",
    "receptive",
    "listeners",
  ],
  hiddenContradictions: [
    "contradiction",
    "paradox",
    "tension",
    "believes",
    "self",
  ],
  strategicCeiling: [
    "scale",
    "impossible",
    "requires",
    "system",
    "fragments",
  ],
};

/**
 * Scanning function: detect if text uses banned phrases.
 * Severity levels: warn, suppress, enforce.
 */
export function scanForBannedPhrases(text, section = "general") {
  const banned = [
    ...GLOBAL_BANNED_PHRASES,
    ...(SECTION_SPECIFIC_BANS[section] || []),
  ];

  const violations = [];

  banned.forEach((phrase) => {
    const regex = new RegExp(`\\b${phrase}\\b`, "gi");
    const matches = text.match(regex) || [];

    if (matches.length > 0) {
      violations.push({
        phrase,
        count: matches.length,
        severity: matches.length > 2 ? "enforce" : "warn",
      });
    }
  });

  return violations;
}

/**
 * Suppression filter: attempt to replace banned phrases.
 * Falls back to accept if no good replacement exists.
 */
export function suppressBannedPhrases(text) {
  let cleaned = text;

  // Global replacements
  cleaned = cleaned.replace(/\bunder pressure\b/gi, "under load");
  cleaned = cleaned.replace(/\bcreates friction\b/gi, "creates tension");
  cleaned = cleaned.replace(/\bcompounds over time\b/gi, "surfaces over time");
  cleaned = cleaned.replace(/\bvelocity\b/gi, "speed");
  cleaned = cleaned.replace(/\boperator\b/gi, "person");
  cleaned = cleaned.replace(/\bpattern recognition\b/gi, "pattern reading");
  cleaned = cleaned.replace(/\bdecision velocity\b/gi, "decision speed");
  cleaned = cleaned.replace(/\bhidden cost\b/gi, "invisible cost");
  cleaned = cleaned.replace(/\bblind spot\b/gi, "missed signal");
  cleaned = cleaned.replace(/\bgap between\b/gi, "separation between");
  cleaned = cleaned.replace(/\bcan feel like\b/gi, "feels like");

  // Section-specific replacements
  cleaned = cleaned.replace(/\bstrength is\b/gi, "advantage:");
  cleaned = cleaned.replace(/\bliability\b/gi, "constraint");
  cleaned = cleaned.replace(/\bcommunicates\b/gi, "speaks");
  cleaned = cleaned.replace(/\bresponds well to\b/gi, "engages with");

  return cleaned;
}

export default {
  GLOBAL_BANNED_PHRASES,
  SECTION_SPECIFIC_BANS,
  scanForBannedPhrases,
  suppressBannedPhrases,
};
