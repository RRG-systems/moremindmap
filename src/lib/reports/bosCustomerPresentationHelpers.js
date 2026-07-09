/**
 * BOS customer presentation layer helpers (L2 structure + L3 25/100 rewrite + L3R section bodies).
 *
 * Display-time only. Pure / deterministic. No OpenAI.
 * Does not mutate canonical, narrative source objects, or technical engine outputs.
 * Advanced Source / technical paths must use preserveTechnicalSource or forCustomer: false.
 *
 * Doctrine:
 * - Customer-facing BOS: ~25/100 technical
 * - Technical BOS engine/source: 100/100 (do not simplify here for technical path)
 *
 * L3R: Customer tabs bind customer-only section bodies built from structured facts
 * (scores, pattern soup, one-move fields, futures fields). Raw narrative paragraphs
 * stay in Advanced Source only — they are not the customer body strategy.
 */

/** Intervention enums → customer-safe recommended-move labels */
export const INTERVENTION_TYPE_CUSTOMER_LABELS = {
  install_accountability: 'Add simple accountability',
  transfer_judgment: 'Move judgment to the right person',
  build_system: 'Build a repeatable system',
  document_core_system: 'Document the core system',
  install_operating_cadence: 'Install a weekly operating rhythm',
  choose_generation_lane: 'Choose one lead generation lane',
  install_generation_rhythm: 'Install a lead generation rhythm',
  inspect_activity: 'Inspect activity weekly',
  narrow_focus: 'Narrow the focus',
};

/** Canonical dimension keys / display names → customer-facing aliases */
export const DIMENSION_CUSTOMER_LABELS = {
  Vector: 'Command',
  Velocity: 'Tempo',
  Signal: 'Relational awareness',
  Fidelity: 'Precision',
  Leverage: 'Leverage',
  Flex: 'Adaptability',
  Framework: 'Structure',
  Horizon: 'Perspective',
  vector: 'Command',
  velocity: 'Tempo',
  signal: 'Relational awareness',
  fidelity: 'Precision',
  leverage: 'Leverage',
  flex: 'Adaptability',
  framework: 'Structure',
  horizon: 'Perspective',
  'Human Calibration': 'Relational awareness',
  Adaptation: 'Adaptability',
  Command: 'Command',
  Tempo: 'Tempo',
  Structure: 'Structure',
  Precision: 'Precision',
  Perspective: 'Perspective',
};

/** One Move / doctrine headlines that still sound model-facing after phrase cleanup */
const HEADLINE_CUSTOMER_REWRITES = [
  [/Convert Read Into Decision Timing/gi, 'Turn what you notice into clearer decision timing'],
  [/Install Accountability/gi, 'Add simple accountability'],
  [/Transfer Judgment/gi, 'Move judgment to the right person'],
  [/Build System/gi, 'Build a repeatable system'],
  [/Install Operating Cadence/gi, 'Install a weekly operating rhythm'],
  [/Document Core System/gi, 'Document the core system'],
  [/Narrow Focus/gi, 'Narrow the focus'],
  [/Decision Rails/gi, 'Clear decision rules'],
  [/Operating Rails/gi, 'Clear operating rules'],
];

/**
 * Labels / fragments that belong in Advanced Source / technical paths only.
 * Used for detection; customer path maps or strips rather than showing raw.
 */
export const TECHNICAL_SOURCE_ONLY_LABELS = [
  'install_accountability',
  'transfer_judgment',
  'build_system',
  'least-supported operating demand',
  'useful throughput',
  'rescoring_gpt',
  'rescoring_v1',
  'render_ready',
  'canonical_profile_json',
  'pressure_shift',
  'wrong_seat_risk',
  'interventionType',
  'pressure mechanics',
  'execution throughput',
  'behavioral fusion outcomes',
  'role demand',
];

/**
 * Order matters: longer / more specific patterns first.
 * Applied after structural template rewrites inside cleanCustomerBOSCopy.
 */
const PHRASE_REPLACEMENTS = [
  // Intervention enums embedded in prose
  [/\binstall_accountability\b/gi, 'add simple accountability'],
  [/\btransfer_judgment\b/gi, 'move judgment to the right person'],
  [/\bbuild_system\b/gi, 'build a repeatable system'],
  [/\bdocument_core_system\b/gi, 'document the core system'],
  [/\binstall_operating_cadence\b/gi, 'install a weekly operating rhythm'],
  [/\bchoose_generation_lane\b/gi, 'choose one lead generation lane'],
  [/\binstall_generation_rhythm\b/gi, 'install a lead generation rhythm'],
  [/\binspect_activity\b/gi, 'inspect activity weekly'],
  [/\bnarrow_focus\b/gi, 'narrow the focus'],

  // Model-facing prefixes / metrics
  [/\bType of move:\s*/gi, 'Recommended move: '],
  // Pressure pattern — specific short forms first (proofSignals / futures), then colon, then bare
  [/\bPressure pattern less chaotic\b/gi, 'Pressure feels less chaotic'],
  [/\bPressure pattern more chaotic\b/gi, 'Pressure feels more chaotic'],
  [/\bPressure pattern continues\b/gi, 'Pressure continues'],
  [/\bPressure pattern stabilizes\b/gi, 'Pressure stabilizes'],
  [/\bPressure pattern improves\b/gi, 'Pressure becomes easier to manage'],
  [/\bPressure pattern eases\b/gi, 'Pressure eases'],
  [/\bPressure pattern:\s*/gi, 'When pressure rises, '],
  [/\bPressure patterns?\b/gi, 'When pressure rises'],
  [/\bWrong-seat risk:\s*/gi, 'Role-fit risk: '],
  [/\bwrong-seat risk\b/gi, 'role-fit risk'],
  [/\bWrong seat risk\b/gi, 'Role-fit risk'],
  [/\bWRONG-SEAT RISK\b/g, 'Role-fit risk'],

  // Pressure / demand vocabulary
  [/\bleast-supported operating demand\b/gi, 'work that gets the least natural support from you'],
  [/\buseful throughput\b/gi, 'useful progress'],
  [/\bexecution throughput\b/gi, 'how much real progress gets finished'],
  [/\bsupported pattern\b/gi, 'natural strength'],
  [/\bpressure mechanics\b/gi, 'how pressure shows up for you'],
  [/\bbehavioral fusion outcomes\b/gi, 'how these patterns combine in practice'],
  [/\brole demand\b/gi, 'what the role asks of you'],

  // Risk / systems vocabulary
  [/\bboundary ambiguity\b/gi, 'unclear boundaries between what is fixed and what is flexible'],
  [/\bcoordination friction\b/gi, 'team slowdown when people are not aligned'],
  [/\brapid pattern convergence\b/gi, 'reaching a shared answer quickly'],
  [/\bexecution speed advantage\b/gi, 'ability to move from idea to action quickly'],
  [/\bexplicit decision rails\b/gi, 'clear rules about who decides and when'],
  [/\bexplicit\s+clear decision rules\b/gi, 'clear rules about who decides and when'],
  [/\bdecision rails\b/gi, 'clear decision rules'],
  [/\boperating rails\b/gi, 'clear operating rules'],
  [/\boperating model:\s*/gi, 'How you tend to operate: '],
  [/\bOperating Model:\s*/gi, 'How you tend to operate: '],
  [/\boperating model\b/gi, 'how you tend to operate'],

  // Dimension technical labels in prose
  [/\bHuman Calibration\b/gi, 'Relational awareness'],
  [/\bAdaptation intensifies first\b/gi, 'you adjust quickly first'],
  [/\badaptation\b/gi, 'adaptability'],

  // Pattern-reading / conviction voice
  [/\bPattern-reading drives decision (?:speed|velocity)\b/gi, 'You decide quickly because you read patterns fast'],
  [/\bpattern-reading drives decision (?:speed|velocity)\b/gi, 'you decide quickly because you read patterns fast'],
  [/\bPattern-reading\b/g, 'Reading the pattern'],
  [/\bpattern-reading\b/g, 'reading the pattern'],
  [/\bMoves with directional conviction\b/gi, 'You move with clear direction once you see the path'],
  [/\bdirectional conviction\b/gi, 'clear direction once you see the path'],
  [/\bdecision velocity\b/gi, 'decision speed'],
  [/\bdominates coordination friction\b/gi, 'outpaces team alignment'],
  [/\bBuilds competitive edge through\b/gi, 'Creates an edge by'],
  [/\bprimary engine intensifies first\b/gi, 'your main strength shows up first under load'],
  [/\bprimary engine\b/gi, 'main strength'],
  [/\bsecondary engine\b/gi, 'supporting strength'],
  [/\btension pair\b/gi, 'strength tension'],
  [/\bpressure shift\b/gi, 'how pressure shows up'],
  [/\bnatural advantage\b/gi, 'natural strength'],
  [/\bnatural risk\b/gi, 'natural risk'],

  // Clinical dimension soup in free text (whole-word)
  [/\bFlex\b/g, 'Adaptability'],
  [/\bSignal\b/g, 'Relational awareness'],
  [/\bVelocity\b/g, 'Tempo'],
  [/\bVector\b/g, 'Command'],
  [/\bFramework\b/g, 'Structure'],
  [/\bHorizon\b/g, 'Perspective'],
  [/\bFidelity\b/g, 'Precision'],
];

const SNAKE_ENUM = /\b[a-z]+(?:_[a-z0-9]+)+\b/g;

/**
 * Map intervention enum → customer label. Unknown snake_case is humanized; other values pass through cleaned.
 */
export function mapInterventionTypeForCustomer(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (INTERVENTION_TYPE_CUSTOMER_LABELS[raw]) {
    return INTERVENTION_TYPE_CUSTOMER_LABELS[raw];
  }
  const lower = raw.toLowerCase();
  if (INTERVENTION_TYPE_CUSTOMER_LABELS[lower]) {
    return INTERVENTION_TYPE_CUSTOMER_LABELS[lower];
  }

  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(raw)) {
    return raw
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return cleanCustomerBOSCopy(raw);
}

/**
 * Map dimension name / technical trait label for customer display.
 */
export function mapDimensionNameForCustomer(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (DIMENSION_CUSTOMER_LABELS[raw]) return DIMENSION_CUSTOMER_LABELS[raw];

  const titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (DIMENSION_CUSTOMER_LABELS[titled]) return DIMENSION_CUSTOMER_LABELS[titled];

  const lower = raw.toLowerCase();
  if (DIMENSION_CUSTOMER_LABELS[lower]) return DIMENSION_CUSTOMER_LABELS[lower];

  return raw;
}

/**
 * Normalize dimension labels (technical or customer aliases) for soup matching.
 * Internal only — does not change display labels.
 */
function normalizeDimensionKey(token) {
  const raw = String(token || '').trim().toLowerCase();
  if (!raw) return '';
  const aliases = {
    flex: 'flex',
    adaptability: 'flex',
    adaptation: 'flex',
    signal: 'signal',
    'relational awareness': 'signal',
    'human calibration': 'signal',
    velocity: 'velocity',
    tempo: 'velocity',
    vector: 'vector',
    command: 'vector',
    framework: 'framework',
    structure: 'framework',
    horizon: 'horizon',
    perspective: 'horizon',
    fidelity: 'fidelity',
    precision: 'fidelity',
    leverage: 'leverage',
  };
  return aliases[raw] || raw;
}

function sameDimensionSet(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const sa = [...a].map(normalizeDimensionKey).sort().join('|');
  const sb = [...b].map(normalizeDimensionKey).sort().join('|');
  return sa === sb;
}

/**
 * Known technical soup combos → full customer sentences (L4R micro repair).
 * Match is order-insensitive on each side of · Lower.
 * Keys use canonical technical dimension names.
 */
const KNOWN_PATTERN_SOUP_SENTENCES = [
  {
    // Flex + Signal · Lower Velocity + Vector
    top: ['flex', 'signal'],
    bottom: ['velocity', 'vector'],
    sentence:
      'You read people quickly and adjust in the moment. The next step is making follow-through easier to see and repeat.',
  },
  {
    // Vector + Flex · Lower Horizon + Framework
    top: ['vector', 'flex'],
    bottom: ['horizon', 'framework'],
    sentence:
      'You move fastest when you can see the direction and adjust as conditions change. The risk is that longer-term structure may need more deliberate support.',
  },
];

/**
 * Parse "A + B · Lower C + D" (technical or already customer-mapped labels).
 * Returns null when structure is not recognized.
 */
function parsePatternSoupHeadline(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  const soup = value.match(/^(.+?)\s*[·•|]\s*Lower\s+(.+)$/i);
  if (!soup) return null;
  const topRaw = soup[1].split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
  const bottomRaw = soup[2].split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
  if (!topRaw.length || !bottomRaw.length) return null;
  return {
    topRaw,
    bottomRaw,
    topKeys: topRaw.map(normalizeDimensionKey),
    bottomKeys: bottomRaw.map(normalizeDimensionKey),
  };
}

/**
 * True when string is (or still looks like) a dimension combo / pattern-soup headline.
 */
export function isPatternSoupHeadline(value) {
  if (value === null || value === undefined || value === '') return false;
  const text = String(value).trim();
  if (!text) return false;
  if (parsePatternSoupHeadline(text)) return true;
  // Customer-remapped residual: "Adaptability + Relational awareness · Lower Tempo + Command"
  if (/\+|·/.test(text) && /Lower\s+/i.test(text) && text.length < 120) return true;
  return false;
}

/**
 * Rewrite "A + B · Lower C + D" pattern soup into a plain-language sentence.
 * Falls back to dimension-token mapping when structure is unrecognized.
 */
export function presentPatternHeadlineForCustomer(value) {
  if (value === null || value === undefined || value === '') return '';
  let text = String(value).trim();
  if (!text) return '';

  // Strip markdown bold wrappers if present on a soup-only headline
  text = text.replace(/^\*\*(.+)\*\*$/, '$1').trim();

  const parsed = parsePatternSoupHeadline(text);
  if (parsed) {
    for (const known of KNOWN_PATTERN_SOUP_SENTENCES) {
      if (
        sameDimensionSet(parsed.topKeys, known.top)
        && sameDimensionSet(parsed.bottomKeys, known.bottom)
      ) {
        return known.sentence;
      }
    }

    const top = parsed.topRaw.map((d) => mapDimensionNameForCustomer(d) || d);
    const bottom = parsed.bottomRaw.map((d) => mapDimensionNameForCustomer(d) || d);
    if (top.length && bottom.length) {
      const topPhrase = top.length === 1
        ? top[0]
        : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
      const bottomPhrase = bottom.length === 1
        ? bottom[0]
        : `${bottom.slice(0, -1).join(', ')} and ${bottom[bottom.length - 1]}`;
      return `You operate most naturally through ${topPhrase}. ${bottomPhrase} take${bottom.length === 1 ? 's' : ''} more deliberate effort.`;
    }
  }

  // "A + B" only
  if (/\+/.test(text) && !/Lower/i.test(text)) {
    const parts = text.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2 && parts.every((p) => p.split(/\s+/).length <= 3)) {
      const mapped = parts.map((d) => mapDimensionNameForCustomer(d) || d);
      const phrase = mapped.length === 1
        ? mapped[0]
        : `${mapped.slice(0, -1).join(', ')} and ${mapped[mapped.length - 1]}`;
      return `Stronger natural support in ${phrase}.`;
    }
  }

  return mapTechnicalPhraseForCustomer(text);
}

/**
 * Map a short technical phrase or pattern headline fragment for customer display.
 * L3: prefers full plain-language pattern sentences when structure is recognized.
 */
export function mapTechnicalPhraseForCustomer(value) {
  if (value === null || value === undefined || value === '') return '';
  let text = String(value).trim();
  if (!text) return '';

  // Prefer full pattern rewrite when soup shape is present
  if (/\+|·|Lower\s+/i.test(text) && /Lower\s+/i.test(text)) {
    return presentPatternHeadlineForCustomer(text);
  }

  // Pattern soup without Lower clause: map known dimension tokens
  if (/\+|·/i.test(text)) {
    text = text.replace(
      /\b(Vector|Velocity|Signal|Fidelity|Leverage|Flex|Framework|Horizon)\b/g,
      (dim) => mapDimensionNameForCustomer(dim) || dim,
    );
    return text.replace(/\s{2,}/g, ' ').trim();
  }

  return cleanCustomerBOSCopy(text);
}

/**
 * True when a value is a known technical-only token that should not appear raw on customer tabs.
 */
export function isTechnicalSourceOnlyLabel(value) {
  if (value === null || value === undefined || value === '') return false;
  const raw = String(value).trim();
  if (!raw) return false;

  if (TECHNICAL_SOURCE_ONLY_LABELS.some((label) => label.toLowerCase() === raw.toLowerCase())) {
    return true;
  }
  if (INTERVENTION_TYPE_CUSTOMER_LABELS[raw] || INTERVENTION_TYPE_CUSTOMER_LABELS[raw.toLowerCase()]) {
    return true;
  }
  if (/^[a-z]+(?:_[a-z0-9]+)+$/.test(raw)) return true;
  if (/least-supported operating demand/i.test(raw)) return true;
  if (/useful throughput/i.test(raw)) return true;
  if (/pressure pattern/i.test(raw)) return true;
  if (/wrong-?seat risk/i.test(raw)) return true;
  return false;
}

/**
 * Identity pass-through for Advanced Source / technical preservation.
 * Never apply customer phrase maps here.
 */
export function preserveTechnicalSource(value) {
  if (value === null || value === undefined) return value;
  return value;
}

/**
 * Structural rewrites for known engine templates before phrase-level maps.
 * Preserves psychological meaning; does not invent profile-specific facts.
 */
function applyStructuralCustomerRewrites(text) {
  let value = text;

  // Whole-line / whole-string pattern-soup headlines → plain sentences (before dim token maps)
  // e.g. "Flex + Signal · Lower Velocity + Vector" or customer-remapped residual forms
  value = value.replace(
    /(^|\n)([ \t]*)(\*\*)?([A-Za-z][A-Za-z\s/+-]*?\s*\+\s*[A-Za-z][A-Za-z\s/+-]*?\s*[·•|]\s*Lower\s+[A-Za-z][A-Za-z\s/+-]*?(?:\s*\+\s*[A-Za-z][A-Za-z\s/+-]*)?)(\*\*)?(?=\n|$)/gim,
    (full, lead, indent, openBold, soup) => {
      const rewritten = presentPatternHeadlineForCustomer(soup);
      if (!rewritten || rewritten === soup) return full;
      // Drop bold wrappers — full sentence does not need soup-headline emphasis
      return `${lead}${indent}${rewritten}`;
    },
  );

  // Full pressure_shift template from behavioralDNAInterpretation.getPressureShift
  // "{Primary} intensifies first; {Secondary} determines whether that pressure becomes useful throughput or gets pulled into {constraint}."
  value = value.replace(
    /(?:Pressure pattern:\s*)?([^.!?\n]+?)\s+intensifies first[;,]?\s*([^.!?\n]+?)\s+determines whether that pressure becomes useful throughput or gets pulled into\s+([^.!?\n]+)/gi,
    (_m, primary, secondary, constraint) => {
      const p = cleanPhraseFragment(primary);
      const s = cleanPhraseFragment(secondary);
      const c = cleanPhraseFragment(constraint);
      return `When pressure rises, ${p} shows up first. ${s} is what decides whether that energy turns into clear progress — or gets pulled into ${c}`;
    },
  );

  // Shorter residual pressure fragments (skip if already rewritten)
  if (!/shows up first/i.test(value)) {
    value = value.replace(
      /([A-Za-z][A-Za-z\s+/]+?)\s+intensifies first/gi,
      (_m, primary) => {
        const label = cleanPhraseFragment(primary);
        // Avoid "When pressure rises, X shows up first under pressure"
        if (/when pressure rises/i.test(value)) {
          return `${label} shows up first`;
        }
        return `${label} shows up first under pressure`;
      },
    );
  }

  // Operating Model multi-sentence template (Narrative V3 profileDNA)
  value = value.replace(
    /Operating Model:\s*Moves with directional conviction\.\s*Pattern-reading drives decision (?:velocity|speed)\.\s*Paired with\s+([^.]+),\s*creates execution speed advantage that dominates coordination friction\.\s*Builds competitive edge through rapid pattern convergence and direct execution\.?/gi,
    (_m, paired) => {
      const support = cleanPhraseFragment(paired);
      return (
        `How you tend to operate: You are strongest when you can see the pattern, choose a direction, and move. ` +
        `That creates speed. Paired with ${support}, you can outrun team alignment if others need more clarity than you naturally give. ` +
        `Your edge is reaching a shared answer quickly and acting on it.`
      );
    },
  );

  // Generic operating-model openers
  value = value.replace(
    /Operating Model:\s*Moves with directional conviction\.\s*Pattern-reading drives decision (?:velocity|speed)\.?/gi,
    'How you tend to operate: You are strongest when you can see the pattern, choose a direction, and move. That creates speed.',
  );

  // Human Calibration determines whether pressure becomes useful throughput...
  value = value.replace(
    /Human Calibration determines whether that pressure becomes useful throughput or gets pulled into the least-supported operating demand\.?/gi,
    'Your ability to read people decides whether pressure turns into clear progress — or gets pulled into work that does not fit your natural strengths.',
  );

  value = value.replace(
    /(?:Relational awareness|Human Calibration)\s+determines whether that pressure becomes useful (?:throughput|progress) or gets pulled into[^.!?\n]+/gi,
    'Your ability to read people decides whether pressure turns into clear progress — or gets pulled into work that gets the least natural support from you',
  );

  // Wrong-seat risk standalone framing
  value = value.replace(
    /Wrong-seat risk:\s*(High|Moderate|Low|None)\.?/gi,
    (_m, level) => {
      const map = {
        High: 'This role may ask you to operate in a way that does not fit your natural strengths.',
        Moderate: 'Parts of this role may pull you away from how you work best.',
        Low: 'This role is largely aligned with how you naturally operate.',
        None: 'No meaningful role-fit risk stands out from this assessment.',
      };
      return map[level] || `Role-fit risk: ${level}`;
    },
  );

  // Soften known One Move / doctrine headlines inside free text
  for (const [pattern, replacement] of HEADLINE_CUSTOMER_REWRITES) {
    value = value.replace(pattern, replacement);
  }

  return value;
}

/** Light cleanup for fragments used inside structural templates (no full phrase pipeline). */
function cleanPhraseFragment(fragment) {
  let value = String(fragment || '').trim();
  if (!value) return '';

  value = value
    .replace(/\bHuman Calibration\b/g, 'relational awareness')
    .replace(/\bAdaptation\b/g, 'adaptability')
    .replace(/\bFlex\b/g, 'adaptability')
    .replace(/\bSignal\b/g, 'relational awareness')
    .replace(/\bVelocity\b/g, 'tempo')
    .replace(/\bVector\b/g, 'command')
    .replace(/\bFramework\b/g, 'structure')
    .replace(/\bHorizon\b/g, 'perspective')
    .replace(/\bFidelity\b/g, 'precision')
    .replace(/\bLeverage\b/g, 'leverage')
    .replace(/\bleast-supported operating demand\b/gi, 'work that gets the least natural support from you')
    .replace(/\buseful throughput\b/gi, 'useful progress')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Avoid double "you" / awkward casing on leading label
  if (/^[a-z]/.test(value) === false && value.length > 1) {
    // keep sentence case for mid-sentence inserts when it starts with known lowercased labels
  }
  return value;
}

/**
 * Strip residual markdown markers from customer-facing strings.
 * Keeps text; removes **, __, heading hashes, and inline code ticks.
 * Does not alter Advanced Source / technical paths (those skip this helper).
 */
export function stripCustomerMarkdown(text) {
  if (text === null || text === undefined) return '';
  let value = typeof text === 'string' ? text : String(text);
  if (!value) return '';

  value = value.replace(/^#{1,6}\s+/gm, '');
  value = value.replace(/\*\*([^*]+)\*\*/g, '$1');
  value = value.replace(/__([^_]+)__/g, '$1');
  value = value.replace(/(^|[\s(])\*([^*\n]+)\*([\s).,;:!?]|$)/g, '$1$2$3');
  value = value.replace(/(^|[\s(])_([^_\n]+)_([\s).,;:!?]|$)/g, '$1$2$3');
  value = value.replace(/`([^`]+)`/g, '$1');
  // Residual lone markers after partial strip
  value = value.replace(/\*\*/g, '').replace(/__/g, '');
  value = value
    .replace(/\.{2,}/g, '.')
    .replace(/\.:/g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return value;
}

/**
 * Clean free-form BOS copy for customer tabs. Deterministic phrase maps only.
 * Does not invent profile-specific facts. Does not mutate source objects.
 */
export function cleanCustomerBOSCopy(text) {
  if (text === null || text === undefined) return '';
  let value = typeof text === 'string' ? text : String(text);
  if (!value.trim()) return '';

  value = applyStructuralCustomerRewrites(value);

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  // Remaining snake_case enums → customer labels or humanized words
  value = value.replace(SNAKE_ENUM, (token) => {
    if (INTERVENTION_TYPE_CUSTOMER_LABELS[token]) {
      return INTERVENTION_TYPE_CUSTOMER_LABELS[token];
    }
    if (INTERVENTION_TYPE_CUSTOMER_LABELS[token.toLowerCase()]) {
      return INTERVENTION_TYPE_CUSTOMER_LABELS[token.toLowerCase()];
    }
    if (/^(rescoring|canonical|render|primary|secondary)/i.test(token)) {
      return token.replace(/_/g, ' ');
    }
    return token.replace(/_/g, ' ');
  });

  value = value
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/:\s*:/g, ':')
    .replace(/\s+\./g, '.')
    // Collapse accidental double maps / redundant pressure phrasing
    .replace(/\bexplicit\s+clear (?:decision )?rules\b/gi, 'clear rules about who decides and when')
    .replace(/\bshows up first under pressure under pressure\b/gi, 'shows up first under pressure')
    .replace(/when pressure rises,?\s*([^.]{0,80}?)\s+shows up first under pressure/gi,
      'When pressure rises, $1 shows up first')
    .trim();

  value = collapseDuplicateCustomerPhrasing(value);
  value = stripCustomerMarkdown(value);

  // Capitalize sentence starts after . ! ? (keeps customer prose readable after fragment rewrites)
  value = value.replace(/(^|[.!?]\s+)([a-z])/g, (_m, boundary, ch) => `${boundary}${ch.toUpperCase()}`);

  return value;
}

/**
 * Collapse stacked openers produced by multi-pass cleanup (L3X root-cause residual).
 * Safe last-mile polish; section body builders should not rely on this as primary strategy.
 */
export function collapseDuplicateCustomerPhrasing(text) {
  if (text === null || text === undefined) return '';
  let value = String(text);
  if (!value) return '';

  // "When pressure rises, When pressure rises..."
  value = value.replace(/(When pressure rises,?\s*){2,}/gi, 'When pressure rises, ');
  // "How you tend to operate: How you tend to operate:"
  value = value.replace(/(How you tend to operate:\s*){2,}/gi, 'How you tend to operate: ');
  // "Role-fit risk: Role-fit risk:"
  value = value.replace(/(Role-fit risk:\s*){2,}/gi, 'Role-fit risk: ');
  // Double spaces after collapse
  value = value.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return value;
}

/**
 * Wrap a raw narrative section object into customer-safe field projections.
 * Source object is not mutated; returned object is presentation-only.
 */
export function makeCustomerSectionContent(rawSection, context = {}) {
  const sectionId = context.sectionId || context.id || '';
  if (!rawSection) {
    return {
      sectionId,
      headline: '',
      body: '',
      content: '',
      technicalPreserved: true,
      empty: true,
    };
  }

  if (typeof rawSection === 'string') {
    const body = cleanCustomerBOSCopy(rawSection);
    return {
      sectionId,
      headline: '',
      body,
      content: body,
      technicalPreserved: true,
      empty: !body,
    };
  }

  const headline = presentOneMoveHeadlineForCustomer(rawSection.headline || '');
  const body = cleanCustomerBOSCopy(rawSection.body || rawSection.summary || '');
  const keyWarning = presentScalingRiskForCustomer(rawSection.key_warning || '');
  const interventionTypeRaw = rawSection.interventionType || rawSection.intervention_type || '';
  const interventionType = mapInterventionTypeForCustomer(interventionTypeRaw);
  const intervention = cleanCustomerBOSCopy(rawSection.intervention || '');
  const futureBottleneck = cleanCustomerBOSCopy(rawSection.futureBottleneck || rawSection.future_bottleneck || '');
  const whyThisMatters = cleanCustomerBOSCopy(rawSection.whyThisMatters || rawSection.why_this_matters || '');
  const whatHappensIfIgnored = cleanCustomerBOSCopy(
    rawSection.whatHappensIfIgnored || rawSection.what_happens_if_ignored || '',
  );

  const first30 = (rawSection.first30Days || rawSection.first_30_days || [])
    .map((step) => cleanCustomerBOSCopy(step))
    .filter(Boolean);
  const proofSignals = (rawSection.proofSignals || rawSection.proof_signals || [])
    .map((signal) => cleanCustomerBOSCopy(signal))
    .filter(Boolean);

  return {
    sectionId,
    headline,
    body,
    key_warning: keyWarning,
    interventionType,
    interventionTypeRaw: preserveTechnicalSource(interventionTypeRaw),
    intervention,
    futureBottleneck,
    whyThisMatters,
    whatHappensIfIgnored,
    first30Days: first30,
    proofSignals,
    content: [headline, body].filter(Boolean).join('\n\n'),
    technicalPreserved: true,
    empty: !headline && !body && !intervention,
  };
}

/**
 * Apply customer presentation to a preformatted markdown-ish section string.
 */
export function presentCustomerFormattedText(text) {
  return cleanCustomerBOSCopy(text);
}

/** Soften One Move / Best Next Move headlines to coach-plain language. */
export function presentOneMoveHeadlineForCustomer(headline) {
  if (!headline) return '';
  let value = String(headline).trim();
  for (const [pattern, replacement] of HEADLINE_CUSTOMER_REWRITES) {
    value = value.replace(pattern, replacement);
  }
  return cleanCustomerBOSCopy(value);
}

/**
 * Present executive-summary body/headline for customer (~25/100).
 * Structural + phrase rewrite only; no fact invention.
 * L4R: pattern-soup headlines use presentPatternHeadlineForCustomer (not bare dim remaps).
 */
export function presentExecutiveSummaryForCustomer(raw = {}) {
  if (!raw) {
    return { headline: '', body: '', key_warning: '', empty: true };
  }
  if (typeof raw === 'string') {
    const body = cleanCustomerBOSCopy(raw);
    return { headline: '', body, key_warning: '', empty: !body };
  }
  const rawHeadline = raw.headline || '';
  const headline = isPatternSoupHeadline(rawHeadline) || /\+|·|Lower\s+/i.test(String(rawHeadline))
    ? presentPatternHeadlineForCustomer(rawHeadline)
    : cleanCustomerBOSCopy(rawHeadline);
  return {
    headline,
    body: cleanCustomerBOSCopy(raw.body || raw.summary || ''),
    key_warning: presentScalingRiskForCustomer(raw.key_warning || ''),
    empty: !raw.headline && !raw.body && !raw.summary,
  };
}

/**
 * Core Operating Pattern: plain pattern headline + meaning.
 * L3R: profileDNA raw/cleaned body is suppressed from customer content by default.
 * Pass includeProfileDnaBody: true only for transitional diagnostics — not customer tabs.
 */
export function presentCoreOperatingPatternForCustomer({
  patternHeadline = '',
  patternMeaning = '',
  profileDnaBody = '',
  includeProfileDnaBody = false,
} = {}) {
  const headline = presentPatternHeadlineForCustomer(patternHeadline);
  const meaning = cleanCustomerBOSCopy(patternMeaning);
  // Suppressed from customer path — raw DNA remains in Advanced Source
  const body = includeProfileDnaBody ? cleanCustomerBOSCopy(profileDnaBody) : '';
  return {
    headline,
    meaning,
    body,
    content: [`**${headline}**`, meaning, body].filter(Boolean).join('\n\n'),
  };
}

/**
 * Scaling / role-fit risk language for customer tabs.
 */
export function presentScalingRiskForCustomer(text) {
  if (!text) return '';
  let value = String(text).trim();
  if (!value) return '';

  // Level-only wrong-seat strings
  if (/^(High|Moderate|Low|None)$/i.test(value)) {
    const level = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    const map = {
      High: 'This role may ask you to operate in a way that does not fit your natural strengths.',
      Moderate: 'Parts of this role may pull you away from how you work best.',
      Low: 'This role is largely aligned with how you naturally operate.',
      None: 'No meaningful role-fit risk stands out from this assessment.',
    };
    return map[level] || cleanCustomerBOSCopy(value);
  }

  return cleanCustomerBOSCopy(value);
}

/**
 * One Move customer projection (headline, move type, body fields).
 */
export function presentOneMoveForCustomer(raw = {}) {
  return makeCustomerSectionContent(raw, { sectionId: 'recommendedNextStep' });
}

/**
 * Future landscape item fields for customer tabs.
 */
export function presentFutureForCustomer(future = {}) {
  if (!future) return future;
  return {
    ...future,
    title: cleanCustomerBOSCopy(future.title || ''),
    trajectory: cleanCustomerBOSCopy(future.trajectory || ''),
    organization_experiences: cleanCustomerBOSCopy(future.organization_experiences || ''),
    likelihood: future.likelihood,
  };
}

/**
 * Team / Leadership Fit (facilitator notes) customer cleanup.
 */
export function presentTeamFitNoteForCustomer(note = {}) {
  return {
    ...note,
    label: cleanCustomerBOSCopy(note.label || ''),
    guidance: cleanCustomerBOSCopy(note.guidance || ''),
    rationale: cleanCustomerBOSCopy(note.rationale || ''),
  };
}

/**
 * Softer customer one-liners for operating score strip (display-time).
 * Keys stay technical for scoring; labels come from mapDimensionNameForCustomer.
 */
export const DIMENSION_CUSTOMER_ONE_LINES = {
  Vector: 'How clearly you set direction and choose a path.',
  Velocity: 'How quickly you move from idea to action.',
  Signal: 'How well you read people, rooms, and context.',
  Fidelity: 'How carefully you protect accuracy when it matters.',
  Leverage: 'How well you multiply effort through systems and others.',
  Flex: 'How readily you adjust when conditions change.',
  Framework: 'How much you rely on structure, rules, and repeatable process.',
  Horizon: 'How far ahead you naturally plan and sequence work.',
};

export function presentDimensionOneLineForCustomer(dimension, fallback = '') {
  if (DIMENSION_CUSTOMER_ONE_LINES[dimension]) {
    return DIMENSION_CUSTOMER_ONE_LINES[dimension];
  }
  return cleanCustomerBOSCopy(fallback || '');
}

// ---------------------------------------------------------------------------
// L3R — Customer-only section body layer (BA-style)
// Build from structured facts. Do not dump raw narrative paragraphs.
// ---------------------------------------------------------------------------

const RAW_NARRATIVE_CUSTOMER_SECTION_IDS = new Set([
  'executiveSummary',
  'profileDNA',
  'recommendedNextStep',
  'fiveFutures',
  'facilitatorNotes',
  'scalingConstraint',
  'strategicCeiling',
  'systemUnderStrain',
  'coachingLeverage',
]);

/**
 * Guard: customer path never returns raw narrative section.body as the customer explanation.
 * Advanced Source uses forCustomer:false / preserveTechnicalSource instead.
 */
export function suppressRawNarrativeFromCustomer(sectionId) {
  if (!sectionId) return false;
  return RAW_NARRATIVE_CUSTOMER_SECTION_IDS.has(String(sectionId));
}

function scoreDisplayName(score) {
  if (!score) return '';
  return score.displayName
    || mapDimensionNameForCustomer(score.dimension)
    || String(score.dimension || '');
}

function joinPlainList(names = []) {
  const list = (names || []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

function sortScoresHighToLow(scores = []) {
  return [...(scores || [])]
    .filter((s) => s && Number.isFinite(Number(s.score)))
    .sort((a, b) => Number(b.score) - Number(a.score));
}

function pickTopScores(scores = [], n = 2) {
  return sortScoresHighToLow(scores).slice(0, n);
}

function pickBottomScores(scores = [], n = 2) {
  return sortScoresHighToLow(scores).slice().reverse().slice(0, n);
}

/**
 * Customer pattern meaning from score cards — not DNA natural_advantage/risk dump.
 */
export function buildCustomerPatternMeaning(topScores = [], bottomScores = []) {
  const topNames = topScores.map(scoreDisplayName).filter(Boolean);
  const bottomNames = bottomScores.map(scoreDisplayName).filter(Boolean);
  const topHelp = String(topScores[0]?.howItHelps || '').trim();

  if (!topNames.length && !bottomNames.length) {
    return 'Your scores show which patterns drive how you think, decide, communicate, and lead.';
  }

  const parts = [];
  if (topNames.length) {
    parts.push(`You operate most naturally through ${joinPlainList(topNames)}.`);
  }
  if (topHelp) {
    parts.push(topHelp);
  }
  if (bottomNames.length) {
    parts.push(
      `${joinPlainList(bottomNames)} take${bottomNames.length === 1 ? 's' : ''} more deliberate effort — structure and follow-through help most here.`,
    );
  }
  return collapseDuplicateCustomerPhrasing(parts.join(' '));
}

/**
 * Single pressure sentence from strength/gap signals (never stack openers).
 */
export function buildCustomerPressureLine(topScores = [], bottomScores = []) {
  const top = scoreDisplayName(topScores[0]) || 'your main strength';
  const bottom = scoreDisplayName(bottomScores[0]) || 'work that fits less naturally';
  return (
    `When pressure rises, you may lean on ${top} first. ` +
    `That helps in the moment, but people may need clearer next steps around ${bottom}.`
  );
}

/**
 * Cap customer prose to roughly maxSentences without inventing content.
 */
function limitCustomerSentences(text, maxSentences = 5) {
  const clean = stripCustomerMarkdown(String(text || '')).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .join(' ')
    .trim();
}

/**
 * R3C — Premium Executive Summary copy maps (display-time only).
 * Keys are canonical technical dimension keys (via normalizeDimensionKey).
 * "when" / "advantage*" used when the dimension is a strength (top).
 * "edge" / "consequence" used when the dimension is a growth gap (bottom).
 * Deliberately high-level — not Core sequence, not Main Constraint essay, not One Move plan.
 */
const EXECUTIVE_DIM_COPY = {
  vector: {
    when: 'set direction quickly and create forward motion',
    advantage: 'direction',
    advantageLine: 'you can see what needs to happen and help people get unstuck',
    edge: 'shared ownership of direction',
    consequence:
      'people may lose the path when you are not personally redirecting the work',
    mapFocus:
      'turn clear direction into something others can follow without constant re-briefing',
  },
  velocity: {
    when: 'move from idea into action without getting stuck',
    advantage: 'tempo',
    advantageLine: 'you restart stalled work and keep projects from sitting in limbo',
    edge: 'paced handoffs',
    consequence:
      'speed can outrun the detail others need, and later correction becomes expensive',
    mapFocus: 'keep your pace while making handoffs clean enough for others to match',
  },
  signal: {
    when: 'read people, rooms, and context accurately',
    advantage: 'relational read',
    advantageLine: 'you pick up what people need and adjust the approach in the moment',
    edge: 'visible decision timing',
    consequence:
      'what you notice may stay implicit while others wait for a clearer call',
    mapFocus: 'convert what you notice into clearer decisions others can act on',
  },
  fidelity: {
    when: 'protect accuracy when the cost of error is high',
    advantage: 'precision',
    advantageLine:
      'accuracy, verification, and clean closure build trust in quality-sensitive work',
    edge: 'selective precision',
    consequence:
      'progress can stall while people wait for perfect certainty on reversible work',
    mapFocus:
      'keep precision where error cost is high without making every step a review gate',
  },
  leverage: {
    when: 'multiply effort through systems and other people',
    advantage: 'scale',
    advantageLine:
      'you can turn repeated judgment into systems, delegation, or broader reach',
    edge: 'systematized transfer',
    consequence:
      'manual repetition can keep consuming high-value judgment that should compound',
    mapFocus: 'convert recurring judgment into repeatable leverage others can own',
  },
  flex: {
    when: 'adjust as reality changes without losing momentum',
    advantage: 'adaptability',
    advantageLine:
      'you keep forward motion alive when plans meet changing conditions',
    edge: 'named boundaries',
    consequence:
      'people may stay unsure what is fixed, what is flexible, or who owns the next decision',
    mapFocus: 'turn flexible judgment into clear boundaries others can run inside',
  },
  framework: {
    when: 'create structure, rules, and repeatable process',
    advantage: 'structure',
    advantageLine:
      'you make work repeatable and reduce dependency on memory or urgency',
    edge: 'transferability',
    consequence:
      'the team may keep waiting for clarification instead of learning the rules behind your decisions',
    mapFocus:
      'turn your fast read of reality into clearer structure others can follow',
  },
  horizon: {
    when: 'place near-term moves inside a longer sequence',
    advantage: 'perspective',
    advantageLine:
      "you can sequence work so today's moves still serve a longer arc",
    edge: 'longer-range structure',
    consequence:
      'near-term motion can stack without a sequence the team can see and prepare for',
    mapFocus:
      'connect practical progress to a longer sequence others can anticipate',
  },
};

/**
 * Known top-pair identities for premium openers (order-insensitive).
 * Falls back to per-dimension composition when no pair match.
 */
const EXECUTIVE_PAIR_IDENTITY = [
  {
    top: ['vector', 'flex'],
    identity:
      'You operate best when you can read the situation quickly, create direction, and adjust as reality changes.',
    advantage: 'movement',
    advantageLine:
      'you can see what needs to happen and help people get unstuck',
  },
  {
    top: ['vector', 'velocity'],
    identity:
      'You operate best when you can set direction and move on it before the work stalls.',
    advantage: 'forward motion',
    advantageLine:
      'you create pace and unstick initiatives that need a clear next step',
  },
  {
    top: ['flex', 'signal'],
    identity:
      'You operate best when you can read people quickly and adjust in the moment.',
    advantage: 'situational read',
    advantageLine:
      'you pick up what the room needs and shift approach before friction hardens',
  },
  {
    top: ['signal', 'velocity'],
    identity:
      'You operate best when you can read the room and convert that read into timely action.',
    advantage: 'responsive motion',
    advantageLine:
      'you notice what is shifting and move before the window closes',
  },
  {
    top: ['vector', 'signal'],
    identity:
      'You operate best when you can set direction while staying tuned to how people are receiving it.',
    advantage: 'guided alignment',
    advantageLine:
      'you create a path and keep people with you as conditions change',
  },
  {
    top: ['fidelity', 'framework'],
    identity:
      'You operate best when accuracy and repeatable structure protect the work.',
    advantage: 'reliable standards',
    advantageLine:
      'you raise the quality bar and make the right way of working easier to repeat',
  },
  {
    top: ['leverage', 'framework'],
    identity:
      'You operate best when systems and structure multiply effort beyond personal bandwidth.',
    advantage: 'compounding systems',
    advantageLine:
      'you turn recurring work into something others can run without you at the center',
  },
  {
    top: ['horizon', 'vector'],
    identity:
      'You operate best when near-term direction still serves a longer arc.',
    advantage: 'sequenced direction',
    advantageLine:
      'you place today\'s moves inside a path the organization can grow into',
  },
];

/**
 * Known bottom-pair growth edges (order-insensitive).
 * Prefer conceptual edge names over raw dimension lists (no score soup).
 */
const EXECUTIVE_PAIR_EDGE = [
  {
    bottom: ['horizon', 'framework'],
    edge: 'transferability',
    consequence:
      'if too much judgment stays inside your head, the team may keep waiting for clarification instead of learning the rules behind your decisions',
    mapFocus:
      'turn your fast read of reality into clearer structure others can follow',
  },
  {
    bottom: ['velocity', 'vector'],
    edge: 'decisive follow-through',
    consequence:
      'if the call stays soft, insight and care may not convert into a path others can run',
    mapFocus:
      'convert what you notice into timely decisions with visible ownership',
  },
  {
    bottom: ['framework', 'velocity'],
    edge: 'repeatable handoffs',
    consequence:
      'if structure stays implicit, people may re-negotiate the same steps every cycle',
    mapFocus:
      'make the path from judgment to execution simple enough for others to own',
  },
  {
    bottom: ['signal', 'fidelity'],
    edge: 'grounded listening under speed',
    consequence:
      'if pace crowds out reading and precision, trust and quality can both erode',
    mapFocus:
      'keep momentum without losing the human and accuracy signals that protect the work',
  },
  {
    bottom: ['leverage', 'framework'],
    edge: 'system transfer',
    consequence:
      'if leverage stays personal, scale still depends on your direct involvement',
    mapFocus:
      'convert personal judgment into systems others can operate',
  },
  {
    bottom: ['horizon', 'leverage'],
    edge: 'future-ready structure',
    consequence:
      'if longer sequencing never leaves your head, the organization stays reactive',
    mapFocus:
      'translate longer-range clarity into structures the team can run ahead of you',
  },
];

function scoreDimensionKey(score) {
  if (!score) return '';
  return normalizeDimensionKey(score.dimension || score.displayName || '');
}

function findExecutivePairMatch(keys, table, side) {
  const list = (keys || []).filter(Boolean).slice(0, 2);
  if (list.length < 2) return null;
  for (const row of table) {
    if (sameDimensionSet(list, row[side] || row.top || row.bottom)) {
      return row;
    }
  }
  return null;
}

function firstSentence(text) {
  const clean = stripCustomerMarkdown(String(text || '')).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/);
  return match ? match[0].trim() : clean;
}

function softenAdvantageHelp(help) {
  let value = stripCustomerMarkdown(String(help || '')).replace(/\s+/g, ' ').trim();
  if (!value) return '';
  // Prefer a single clause; drop score-ish fragments
  value = value.replace(/\(\d+\.\d{2}\)/g, '').replace(/\s{2,}/g, ' ').trim();
  if (value.length > 120) {
    const cut = value.slice(0, 120);
    const lastStop = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(';'), cut.lastIndexOf(' — '));
    value = (lastStop > 40 ? cut.slice(0, lastStop) : cut).trim();
  }
  value = value.replace(/[.;:,\s]+$/g, '');
  // Ensure second-person feel when howItHelps starts with "Strong..." / "You..."
  if (/^you\b/i.test(value)) {
    return value.charAt(0).toLowerCase() + value.slice(1);
  }
  if (/^(strong|accuracy|situational|turning|grounded)\b/i.test(value)) {
    return value.charAt(0).toLowerCase() + value.slice(1);
  }
  return value;
}

/**
 * Executive Summary — premium high-level read (R3C role doctrine).
 *
 * Answers: high-level operating identity, primary strength, growth edge,
 * why the map matters — 4 to 6 sentences max.
 *
 * Must NOT become:
 * - Core Operating Pattern sequence (Trigger / Instinct / …)
 * - Main Constraint bottleneck essay
 * - One Move action plan (First 30 Days, proofSignals, intervention steps)
 * - Future product section dump (communication / conflict / hiring / etc.)
 * - Raw narrative.executiveSummary.body (that stays Advanced Source)
 * - Score soup or markdown
 */
export function buildCustomerExecutiveBody({
  patternHeadline = '',
  topScores = [],
  bottomScores = [],
  oneMove = null,
} = {}) {
  // Reserved for future signal use; action plan stays One Move-owned
  void oneMove;
  // Pattern headline may inform fallback only — do not re-paste as body opener soup
  void patternHeadline;

  const topKeys = (topScores || []).map(scoreDimensionKey).filter(Boolean);
  const bottomKeys = (bottomScores || []).map(scoreDimensionKey).filter(Boolean);
  const top0 = EXECUTIVE_DIM_COPY[topKeys[0]] || null;
  const top1 = EXECUTIVE_DIM_COPY[topKeys[1]] || null;
  const bottom0 = EXECUTIVE_DIM_COPY[bottomKeys[0]] || null;
  const bottom1 = EXECUTIVE_DIM_COPY[bottomKeys[1]] || null;

  const pairIdentity = findExecutivePairMatch(topKeys, EXECUTIVE_PAIR_IDENTITY, 'top');
  const pairEdge = findExecutivePairMatch(bottomKeys, EXECUTIVE_PAIR_EDGE, 'bottom');

  // 1) Operating identity
  let identity = '';
  if (pairIdentity?.identity) {
    identity = pairIdentity.identity;
  } else if (top0 && top1) {
    identity = `You operate best when you can ${top0.when}, and ${top1.when}.`;
  } else if (top0) {
    identity = `You operate best when you can ${top0.when}.`;
  } else {
    identity =
      'You operate best when you can read the situation, choose a direction, and move with intention.';
  }

  // 2) Primary strength — prefer premium second-person advantage lines over third-person score blurbs
  const helpRaw = cleanCustomerBOSCopy(String(topScores?.[0]?.howItHelps || '').trim());
  const helpSoft = softenAdvantageHelp(helpRaw);
  const helpIsPremiumSecondPerson = Boolean(
    helpSoft
      && helpSoft.length >= 24
      && helpSoft.length <= 120
      && /^you\b/i.test(helpSoft),
  );
  let strength = '';
  if (pairIdentity?.advantage) {
    const line = helpIsPremiumSecondPerson
      ? helpSoft
      : pairIdentity.advantageLine;
    strength = `Your strength is ${pairIdentity.advantage}: ${line}.`;
  } else if (top0) {
    const line = helpIsPremiumSecondPerson
      ? helpSoft
      : top0.advantageLine;
    strength = `Your strength is ${top0.advantage}: ${line}.`;
  } else {
    strength =
      'Your strength is creating movement when others need a clear next step.';
  }

  // 3) Growth edge (concept + consequence — not Main Constraint "if this stays unsolved")
  let edgeNoun = '';
  let consequence = '';
  if (pairEdge?.edge) {
    edgeNoun = pairEdge.edge;
    consequence = pairEdge.consequence;
  } else if (bottom0) {
    edgeNoun = bottom0.edge;
    consequence = `if too much of this stays unshared, ${bottom0.consequence}`;
  } else if (bottom1) {
    edgeNoun = bottom1.edge;
    consequence = `if too much of this stays unshared, ${bottom1.consequence}`;
  } else {
    edgeNoun = 'transferability';
    consequence =
      'if too much judgment stays inside your head, the team may keep waiting for clarification instead of learning the rules behind your decisions';
  }
  // Normalize consequence to a clause that can follow "The growth edge is X: …"
  const consequenceClause = String(consequence || '')
    .replace(/^if\s+/i, 'if ')
    .replace(/[.;\s]+$/g, '');
  const edgeLine = `The growth edge is ${edgeNoun}: ${consequenceClause}.`;

  // 4) Why it matters (high-level outcome — not One Move steps)
  const whyLine =
    'When this is handled well, your strongest pattern becomes usable by others — not only when you are in the room.';

  // 5) Map setup (sets up the BOS; does not preview every section)
  const mapFocus = pairEdge?.mapFocus
    || pairIdentity?.mapFocus
    || bottom0?.mapFocus
    || top0?.mapFocus
    || 'turn your natural operating style into clearer structure others can follow';
  const mapLine = `This map shows how to ${mapFocus}.`;

  const body = limitCustomerSentences(
    collapseDuplicateCustomerPhrasing(
      [identity, strength, edgeLine, whyLine, mapLine].filter(Boolean).join(' '),
    ),
    6,
  );

  // Single coherent block — no separate pattern dump that weakens the open
  const content = stripCustomerMarkdown(body);
  const headline = firstSentence(content);

  return {
    headline,
    body: content,
    content,
    sourceStrategy: 'structured_scores_premium_high_level',
    usesRawNarrativeBody: false,
    role: 'executive_summary',
    doctrine: 'bos_r3c_executive_summary',
    sentenceBudget: { min: 4, max: 6 },
  };
}

/**
 * Core Operating Pattern — behavioral sequence (R3B role doctrine).
 * trigger → instinct → strength → risk → needed support
 * Must not re-paste Executive Summary language.
 * No profileDNA paragraph on customer path.
 */
export function buildCustomerCorePatternBody({
  patternHeadline = '',
  topScores = [],
  bottomScores = [],
} = {}) {
  const headline = presentPatternHeadlineForCustomer(patternHeadline)
    || buildCustomerPatternMeaning(topScores, bottomScores);
  const meaning = buildCustomerPatternMeaning(topScores, bottomScores);
  const topHelp = cleanCustomerBOSCopy(String(topScores[0]?.howItHelps || '').trim());
  const bottomRisk = cleanCustomerBOSCopy(String(bottomScores[0]?.howItWorksAgainst || '').trim());
  const topNames = topScores.map(scoreDisplayName).filter(Boolean);
  const bottomNames = bottomScores.map(scoreDisplayName).filter(Boolean);
  const top = topNames[0] || 'your main strength';
  const bottom = bottomNames[0] || 'work that fits less naturally';

  const trigger =
    'Trigger: When load, ambiguity, or speed demand rises, your default system activates first.';
  const instinct = topNames.length
    ? `Instinct: You move through ${joinPlainList(topNames)} — acting from what feels most natural before adding structure.`
    : 'Instinct: You act from what feels most natural before adding structure.';
  const strength = topHelp
    ? `Strength: ${topHelp}`
    : `Strength: ${top} helps you create momentum and keep work moving when others need a clear next step.`;
  const risk = bottomRisk
    ? `Risk: ${bottomRisk}`
    : `Risk: Under pressure, ${bottom} can lag — people may lose the handoff even when direction is clear.`;
  const support = bottomNames.length
    ? `Needed support: Explicit ownership, simple next steps, and visible follow-through around ${joinPlainList(bottomNames)} so others can absorb your pace.`
    : 'Needed support: Explicit ownership, simple next steps, and visible follow-through so others can absorb your pace.';

  const sequence = [trigger, instinct, strength, risk, support];
  const body = collapseDuplicateCustomerPhrasing(sequence.join('\n\n'));

  // Sequence is the content — do not re-open with the same pattern headline as Executive
  const content = stripCustomerMarkdown(body);

  return {
    headline,
    meaning,
    body: content,
    content,
    sequence: {
      trigger,
      instinct,
      strength,
      risk,
      neededSupport: support,
    },
    sourceStrategy: 'behavioral_sequence_scores',
    usesRawNarrativeBody: false,
    usesProfileDnaBody: false,
    role: 'core_operating_pattern',
  };
}

/**
 * Key Advantage — top score customer cards only.
 */
export function buildCustomerKeyAdvantageBody({ topScores = [] } = {}) {
  if (!topScores.length) {
    const body = 'Advantage details will appear when score data is available.';
    return {
      body,
      content: body,
      sourceStrategy: 'score_cards',
      usesRawNarrativeBody: false,
      empty: true,
    };
  }

  const content = topScores.slice(0, 2).map((score) => {
    const name = scoreDisplayName(score);
    const value = Number(score.score);
    const scoreLabel = Number.isFinite(value) ? value.toFixed(2) : '—';
    const help = stripCustomerMarkdown(
      String(score.howItHelps || presentDimensionOneLineForCustomer(score.dimension)).trim(),
    );
    // Plain label line — no markdown bold (UI can still emphasize via structure)
    return `${name} (${scoreLabel})\n${help}`;
  }).join('\n\n');

  return {
    body: content,
    content,
    sourceStrategy: 'score_cards',
    usesRawNarrativeBody: false,
    empty: false,
  };
}

/**
 * Main Scaling Risk — bottom scores + optional role-fit signal. Not raw scalingConstraint body.
 */
export function buildCustomerScalingRiskBody({
  bottomScores = [],
  keyWarning = '',
  wrongSeatRisk = '',
} = {}) {
  const roleFit = presentScalingRiskForCustomer(wrongSeatRisk || keyWarning || '');
  const bottomBlocks = bottomScores.slice(0, 2).map((score) => {
    const name = scoreDisplayName(score);
    const value = Number(score.score);
    const scoreLabel = Number.isFinite(value) ? value.toFixed(2) : '—';
    const risk = stripCustomerMarkdown(String(score.howItWorksAgainst || '').trim())
      || 'Without deliberate support, this area can create drag as complexity rises.';
    return `${name} (${scoreLabel})\n${risk}`;
  }).join('\n\n');

  const intro = roleFit
    || (bottomScores.length
      ? 'As you scale, the work that gets the least natural support from you becomes the place where friction shows up first.'
      : 'Scaling risk details will appear when score data is available.');

  const content = collapseDuplicateCustomerPhrasing(
    [
      roleFit ? `Watch for: ${roleFit}` : null,
      !roleFit ? intro : null,
      bottomBlocks || null,
    ].filter(Boolean).join('\n\n'),
  );

  return {
    body: content,
    content: stripCustomerMarkdown(content),
    preview: roleFit || intro,
    sourceStrategy: 'score_gaps_role_fit',
    usesRawNarrativeBody: false,
  };
}

/**
 * Normalize Narrative V3 recommendedNextStep and BI theOneMove domain shapes.
 * Display-time only; does not invent profile-specific facts beyond available fields.
 */
function normalizeOneMoveSource(oneMove = null) {
  if (!oneMove) return {};
  if (typeof oneMove === 'string') {
    return { body: oneMove, headline: '', intervention: '', interventionType: '' };
  }

  const intervention = oneMove.intervention
    || oneMove.the_move
    || oneMove.theMove
    || oneMove.recommendation
    || '';
  const why = oneMove.whyThisMatters
    || oneMove.why_this_matters
    || oneMove.reasoning
    || oneMove.why
    || '';
  const headline = oneMove.headline
    || (oneMove.title && !/^the one move$/i.test(String(oneMove.title).trim()) ? oneMove.title : '')
    || intervention
    || '';
  const interventionType = oneMove.interventionType
    || oneMove.intervention_type
    || oneMove.type_of_move
    || '';
  const first30 = oneMove.first30Days
    || oneMove.first_30_days
    || (oneMove.timeline ? [oneMove.timeline] : []);
  const proof = oneMove.proofSignals || oneMove.proof_signals || [];
  const caution = oneMove.caution || oneMove.whatHappensIfIgnored || oneMove.what_happens_if_ignored || '';

  return {
    headline,
    body: oneMove.body || oneMove.summary || '',
    intervention,
    interventionType,
    whyThisMatters: why,
    whatHappensIfIgnored: caution,
    futureBottleneck: oneMove.futureBottleneck || oneMove.future_bottleneck || '',
    coreConstraint: oneMove.coreConstraint || oneMove.core_constraint || '',
    highestLeverageLever: oneMove.highestLeverageLever || oneMove.highest_leverage_lever || '',
    lowestValueDrag: oneMove.lowestValueDrag || oneMove.lowest_value_drag || '',
    roleTruth: oneMove.roleTruth || oneMove.role_truth || '',
    first30Days: Array.isArray(first30) ? first30 : [first30].filter(Boolean),
    proofSignals: Array.isArray(proof) ? proof : [],
  };
}

/** Score / technical residual patterns that must not leak into customer One Move. */
const PROOF_SIGNAL_SCORE_LEAK = [
  /\b\d+\.\d{2}\b/,
  /lowest supported signal/i,
  /\bleads,?\s+supported by\b/i,
  /risk pattern:/i,
  /pressure pattern:/i,
  /dimension:\s*/i,
  /score\s*[:=]/i,
  /rescoring_/i,
  /render_ready/i,
  /wrong-?seat/i,
  /install_accountability|transfer_judgment|build_system/i,
  /five futures already points/i,
];

/**
 * Keep only customer-safe proof signals (no raw score soup / technical residual).
 */
export function filterCustomerProofSignals(signals = []) {
  return (signals || [])
    .map((signal) => cleanCustomerBOSCopy(signal))
    .filter(Boolean)
    .filter((signal) => !PROOF_SIGNAL_SCORE_LEAK.some((re) => re.test(signal)))
    .filter((signal) => signal.length > 12)
    .slice(0, 6);
}

/**
 * Strip repeated inline labels that should only appear as block headings.
 */
function stripInlineMoveLabels(text) {
  let value = String(text || '');
  if (!value) return '';
  value = value
    .replace(/^\s*(Recommended move|The move|Future bottleneck|Why this matters|If ignored|First 30 days|How you will know it is working|How you'll know it is working)\s*:\s*/gim, '')
    .replace(/\b(Recommended move|The move|Future bottleneck|Why this matters|If ignored)\s*:\s*/gi, '');
  return stripCustomerMarkdown(value).trim();
}

function softCapWords(text, maxWords = 100) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

/**
 * Main Constraint — bottleneck only (R3B). Replaces Best Next Move action dump.
 * Answers: what is limiting effectiveness, scale, clarity, repeatability, or transfer?
 * Must not include the full One Move action plan.
 */
export function buildCustomerMainConstraintBody(oneMove = null, { bottomScores = [] } = {}) {
  if (!oneMove && !bottomScores.length) {
    const body = 'Main constraint details are not available for this profile yet.';
    return {
      headline: 'Main Constraint',
      body,
      content: body,
      preview: body,
      sourceStrategy: 'structured_constraint_fields',
      usesRawNarrativeBody: false,
      empty: true,
      role: 'main_constraint',
    };
  }

  const normalized = normalizeOneMoveSource(oneMove);
  const coreConstraint = stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.coreConstraint || ''));
  const bottleneck = stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.futureBottleneck || ''));
  const roleTruth = stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.roleTruth || ''));
  // Soften role-truth without dumping wrong-seat jargon
  const roleContext = roleTruth
    ? softCapWords(
      roleTruth
        .replace(/\bwrong-?seat risk\b/gi, 'role-fit risk')
        .replace(/\bthe action plan\b/gi, 'how work is designed'),
      55,
    )
    : '';
  const lowestDrag = stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.lowestValueDrag || ''));

  // Fallback bottleneck from bottom scores only when structured constraint fields empty
  const bottom = scoreDisplayName(bottomScores[0]) || '';
  const scoreFallback = !coreConstraint && !bottleneck && !roleContext && bottom
    ? `As complexity rises, ${bottom} is the area most likely to limit clarity, handoffs, and repeatable execution.`
    : '';

  const primary = coreConstraint
    || bottleneck
    || roleContext
    || lowestDrag
    || scoreFallback
    || 'The main limiter is how clearly others can absorb and repeat your operating pace without rework.';

  const secondaryParts = [];
  if (coreConstraint && bottleneck && bottleneck !== coreConstraint) {
    secondaryParts.push(`If this stays unsolved: ${bottleneck}`);
  }
  if (coreConstraint && roleContext && roleContext !== coreConstraint) {
    secondaryParts.push(roleContext);
  }
  if (!coreConstraint && lowestDrag && lowestDrag !== primary) {
    secondaryParts.push(`Where drag shows up: ${lowestDrag}`);
  }

  const body = collapseDuplicateCustomerPhrasing(
    [primary, ...secondaryParts].filter(Boolean).join('\n\n'),
  );
  const content = stripCustomerMarkdown(softCapWords(body, 120));

  return {
    headline: 'Main Constraint',
    body: content,
    content,
    preview: softCapWords(primary, 28),
    coreConstraint: coreConstraint || '',
    futureBottleneck: bottleneck || '',
    sourceStrategy: coreConstraint || bottleneck || roleContext
      ? 'structured_constraint_fields'
      : (scoreFallback ? 'score_gap_fallback' : 'default_constraint'),
    usesRawNarrativeBody: false,
    empty: !content,
    role: 'main_constraint',
  };
}

/**
 * One Move — clean structured action plan blocks (R3B).
 * Blocks: The Move | What It Means | First 30 Days | How You’ll Know It’s Working
 * Does not own Main Constraint bottleneck essay. Does not dump raw scores.
 */
export function buildCustomerOneMoveBlocks(oneMove = null, { mainConstraintPreview = '' } = {}) {
  if (!oneMove) {
    const body = 'One Move details are not available for this profile yet.';
    return {
      headline: 'Your One Move',
      body,
      content: body,
      preview: body,
      blocks: [],
      interventionType: '',
      interventionTypeRaw: '',
      sourceStrategy: 'structured_one_move_fields',
      usesRawNarrativeBody: false,
      empty: true,
      role: 'one_move',
    };
  }

  const normalized = normalizeOneMoveSource(oneMove);
  const headline = presentOneMoveHeadlineForCustomer(normalized.headline || '') || 'Your One Move';
  const interventionTypeRaw = normalized.interventionType || '';
  const interventionType = mapInterventionTypeForCustomer(interventionTypeRaw);
  const intervention = stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.intervention || ''));
  const why = stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.whyThisMatters || ''));
  const days = (normalized.first30Days || [])
    .map((step) => stripInlineMoveLabels(cleanCustomerBOSCopy(step)))
    .filter(Boolean);
  const signals = filterCustomerProofSignals(normalized.proofSignals || []);

  const defaultMoveLine = interventionType
    ? `Your next move is to ${interventionType.charAt(0).toLowerCase()}${interventionType.slice(1)} so follow-through does not depend only on memory or urgency.`
    : '';

  const theMove = intervention || defaultMoveLine || (
    normalized.body ? stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.body)) : ''
  );

  // One brief bridge to Main Constraint — do not re-paste full constraint
  const constraintBridge = mainConstraintPreview
    ? softCapWords(`This move targets your main constraint: ${mainConstraintPreview}`, 40)
    : '';
  const whatItMeans = collapseDuplicateCustomerPhrasing(
    [why, constraintBridge && why && !why.toLowerCase().includes(mainConstraintPreview.slice(0, 24).toLowerCase())
      ? constraintBridge
      : (!why ? constraintBridge : '')]
      .filter(Boolean)
      .join(' '),
  ) || 'This change makes your judgment easier for others to absorb and repeat.';

  const hasStructured = Boolean(theMove || why || days.length || signals.length);
  const residualBody = !hasStructured && normalized.body
    ? stripInlineMoveLabels(cleanCustomerBOSCopy(normalized.body))
    : '';

  const blocks = [
    {
      id: 'the-move',
      title: 'The Move',
      kind: 'paragraph',
      content: stripCustomerMarkdown(theMove || residualBody || 'A focused operating change for the next 30 days.'),
    },
    {
      id: 'what-it-means',
      title: 'What It Means',
      kind: 'paragraph',
      content: stripCustomerMarkdown(whatItMeans),
    },
    {
      id: 'first-30-days',
      title: 'First 30 Days',
      kind: 'ordered_list',
      items: days.length ? days.map((d) => stripCustomerMarkdown(d)) : [],
      content: days.length
        ? days.map((step, i) => `${i + 1}. ${stripCustomerMarkdown(step)}`).join('\n')
        : 'Work with your coach or leadership partner to sequence the first 30 days around this move.',
    },
    {
      id: 'how-youll-know',
      title: "How You'll Know It's Working",
      kind: 'bullet_list',
      items: signals.length ? signals.map((s) => stripCustomerMarkdown(s)) : [],
      content: signals.length
        ? signals.map((s) => `- ${stripCustomerMarkdown(s)}`).join('\n')
        : 'You will know it is working when handoffs require less rework and others can act without re-asking for intent.',
    },
  ];

  // Combined plain text for previews / legacy binders — no inline "Recommended move:" labels
  const content = collapseDuplicateCustomerPhrasing(
    blocks.map((b) => `${b.title}\n${b.content}`).join('\n\n'),
  );

  return {
    headline,
    body: content,
    content,
    blocks,
    intervention: theMove,
    interventionType,
    interventionTypeRaw: preserveTechnicalSource(interventionTypeRaw),
    preview: softCapWords(theMove || residualBody || headline, 28),
    sourceStrategy: hasStructured ? 'structured_one_move_blocks' : 'thin_profile_residual_body',
    usesRawNarrativeBody: Boolean(residualBody),
    empty: !content,
    role: 'one_move',
  };
}

/**
 * @deprecated R3B: prefer buildCustomerMainConstraintBody + buildCustomerOneMoveBlocks.
 * Kept as thin adapter so older imports still resolve to One Move structured content.
 */
export function buildCustomerBestNextMoveBody(oneMove = null) {
  const constraint = buildCustomerMainConstraintBody(oneMove);
  const move = buildCustomerOneMoveBlocks(oneMove, {
    mainConstraintPreview: constraint.preview || '',
  });
  // Historical callers expected the action blob; return One Move blocks, not constraint
  return {
    ...move,
    // Preserve dual access for transitional audits
    mainConstraint: constraint,
  };
}

/**
 * Single Five Futures card body from structured future fields.
 */
export function buildCustomerFutureBody(future = {}) {
  if (!future) {
    return {
      title: '',
      likelihood: '',
      trajectory: '',
      organization_experiences: '',
      content: '',
      empty: true,
      usesRawNarrativeBody: false,
    };
  }

  const title = cleanCustomerBOSCopy(future.title || '');
  const trajectory = cleanCustomerBOSCopy(future.trajectory || '');
  const organization_experiences = cleanCustomerBOSCopy(
    future.organization_experiences || future.organizationExperiences || '',
  );
  const likelihood = future.likelihood || '';

  const content = collapseDuplicateCustomerPhrasing(
    [
      likelihood ? `Likelihood: ${likelihood}` : null,
      trajectory || null,
      organization_experiences
        ? `What the organization experiences: ${organization_experiences}`
        : null,
    ].filter(Boolean).join('\n\n'),
  );

  return {
    title,
    likelihood,
    trajectory,
    organization_experiences,
    content: stripCustomerMarkdown(content),
    empty: !content,
    usesRawNarrativeBody: false,
    sourceStrategy: 'structured_future_fields',
  };
}

/**
 * Future Landscape summary + per-future customer bodies.
 * Does not format raw fiveFutures free-text dump as primary strategy.
 */
export function buildCustomerFutureLandscapeBody(fiveFutures = null) {
  if (!fiveFutures) {
    const body = 'Five futures content is not available for this profile yet.';
    return {
      summary: body,
      mostLikely: null,
      futures: [],
      content: body,
      empty: true,
      usesRawNarrativeBody: false,
    };
  }

  const mostLikelyRaw = fiveFutures.most_likely || fiveFutures.mostLikely || null;
  const mostLikely = mostLikelyRaw ? buildCustomerFutureBody(mostLikelyRaw) : null;
  const futures = (fiveFutures.futures || []).map((f) => buildCustomerFutureBody(f));

  // Prefer a plain summary built from structured titles over cleaned raw summary alone
  const titles = futures.map((f) => f.title).filter(Boolean);
  const structuredSummary = mostLikely?.title
    ? `Based on your current operating pattern, several paths are possible. The most likely direction right now is ${mostLikely.title}.`
    : titles.length
      ? `Based on your current operating pattern, several paths are possible — including ${joinPlainList(titles.slice(0, 3))}.`
      : '';

  // Summary field is short structured text; clean it but prefer structuredSummary when thin/empty
  const cleanedSummary = cleanCustomerBOSCopy(fiveFutures.summary || '');
  const summary = stripCustomerMarkdown(
    structuredSummary
    || cleanedSummary
    || 'Based on your current operating pattern, several paths are possible. Review each future with your coach or leadership partner.',
  );

  // Landscape map only — do not re-embed full most_likely trajectory (cards own detail)
  const content = collapseDuplicateCustomerPhrasing(summary);

  return {
    summary,
    mostLikely,
    futures,
    content: stripCustomerMarkdown(content),
    empty: false,
    usesRawNarrativeBody: false,
    sourceStrategy: 'structured_future_fields',
  };
}

/**
 * Team / Leadership Fit from facilitator notes fields — not raw body dump.
 */
export function buildCustomerTeamFitBody(facilitatorNotes = null) {
  if (!facilitatorNotes) {
    const body = 'Team and leadership fit guidance is not available for this profile yet.';
    return {
      body,
      content: body,
      empty: true,
      usesRawNarrativeBody: false,
    };
  }

  const notes = (facilitatorNotes.notes || []).map((note) => presentTeamFitNoteForCustomer(note));
  const notesBlock = notes
    .filter((n) => n.label || n.guidance)
    .map((n) => `${n.label || 'Guidance'}: ${n.guidance || ''}${n.rationale ? `\nWhy: ${n.rationale}` : ''}`)
    .join('\n\n');

  const primary = cleanCustomerBOSCopy(facilitatorNotes.primary_guidance || '');
  const caution = cleanCustomerBOSCopy(facilitatorNotes.caution || '');
  // Prefer structured notes/guidance over free-text summary body
  const rawSummary = cleanCustomerBOSCopy(facilitatorNotes.summary || facilitatorNotes.body || '');
  // Drop thin engine summaries like "0 structural guidance notes."
  const summaryIsUseful = rawSummary
    && !/^\d+\s+structural guidance notes\.?$/i.test(rawSummary)
    && !/^highest-leverage intervention\.?$/i.test(rawSummary)
    && rawSummary.length > 24;
  const summary = summaryIsUseful && !(notesBlock || primary) ? rawSummary : (summaryIsUseful ? rawSummary : '');

  const intro = primary
    || 'Design the environment around this operating pattern — clear ownership, simple rhythms, and explicit next steps help others follow your lead.';

  const content = collapseDuplicateCustomerPhrasing(
    [
      summary && summary !== intro && !notesBlock ? summary : null,
      `Primary guidance: ${intro}`,
      notesBlock ? `How to design the environment:\n\n${notesBlock}` : null,
      caution ? `Caution: ${caution}` : null,
    ].filter(Boolean).join('\n\n'),
  );

  return {
    body: content,
    content: stripCustomerMarkdown(content),
    sourceStrategy: 'structured_facilitator_fields',
    usesRawNarrativeBody: false,
    empty: !content,
  };
}

/**
 * Master builder: customer-only section bodies for Premium BOS customer tabs.
 * Inputs are display-time view-model signals; source objects are not mutated.
 */
export function buildCustomerSectionBodies({
  scoreMeaning = null,
  narrative = null,
  patternHeadline = '',
  wrongSeatRisk = '',
  keyWarning = '',
} = {}) {
  const scores = scoreMeaning?.scores || [];
  const topScores = pickTopScores(scores, 2);
  const bottomScores = pickBottomScores(scores, 2);

  const technicalPatternHeadline = patternHeadline
    || scoreMeaning?.patternSummary?.technicalHeadline
    || scoreMeaning?.patternSummary?.headline
    || '';

  const customerPatternHeadline = presentPatternHeadlineForCustomer(technicalPatternHeadline)
    || buildCustomerPatternMeaning(topScores, bottomScores);
  const customerPatternMeaning = buildCustomerPatternMeaning(topScores, bottomScores);

  const oneMove = narrative?.recommendedNextStep || null;
  const fiveFutures = narrative?.fiveFutures || null;
  const facilitatorNotes = narrative?.facilitatorNotes || null;
  const execKeyWarning = keyWarning
    || narrative?.executiveSummary?.key_warning
    || '';

  const customerExecutiveSummary = buildCustomerExecutiveBody({
    patternHeadline: technicalPatternHeadline,
    topScores,
    bottomScores,
    oneMove,
  });

  const customerCorePattern = buildCustomerCorePatternBody({
    patternHeadline: technicalPatternHeadline,
    topScores,
    bottomScores,
  });

  const customerKeyAdvantage = buildCustomerKeyAdvantageBody({ topScores });
  const customerScalingRisk = buildCustomerScalingRiskBody({
    bottomScores,
    keyWarning: execKeyWarning,
    wrongSeatRisk,
  });
  // R3B: split constraint vs action (no longer identical Best Next Move / One Move)
  const customerMainConstraint = buildCustomerMainConstraintBody(oneMove, { bottomScores });
  const customerOneMove = buildCustomerOneMoveBlocks(oneMove, {
    mainConstraintPreview: customerMainConstraint.preview || customerMainConstraint.body || '',
  });
  // Transitional alias — do not use as action dump of constraint
  const customerBestNextMove = customerMainConstraint;
  const customerFutureLandscape = buildCustomerFutureLandscapeBody(fiveFutures);
  const customerTeamFit = buildCustomerTeamFitBody(facilitatorNotes);

  return {
    customerExecutiveSummary,
    customerCorePattern,
    customerKeyAdvantage,
    customerScalingRisk,
    customerMainConstraint,
    customerOneMove,
    customerBestNextMove,
    customerFutureLandscape,
    customerTeamFit,
    customerPatternHeadline,
    customerPatternMeaning,
    topScores,
    bottomScores,
    // Explicit contract for audits
    rawNarrativeSuppressedFromCustomer: true,
    profileDnaSuppressedFromCustomer: true,
    // R3B section roles preserved; R3C strengthens Executive Summary only
    sectionRoleDoctrine: 'bos_r3c',
  };
}

export default {
  mapInterventionTypeForCustomer,
  mapDimensionNameForCustomer,
  mapTechnicalPhraseForCustomer,
  presentPatternHeadlineForCustomer,
  isPatternSoupHeadline,
  cleanCustomerBOSCopy,
  stripCustomerMarkdown,
  collapseDuplicateCustomerPhrasing,
  makeCustomerSectionContent,
  preserveTechnicalSource,
  isTechnicalSourceOnlyLabel,
  presentCustomerFormattedText,
  presentOneMoveHeadlineForCustomer,
  presentExecutiveSummaryForCustomer,
  presentCoreOperatingPatternForCustomer,
  presentScalingRiskForCustomer,
  presentOneMoveForCustomer,
  presentFutureForCustomer,
  presentTeamFitNoteForCustomer,
  presentDimensionOneLineForCustomer,
  suppressRawNarrativeFromCustomer,
  buildCustomerPatternMeaning,
  buildCustomerPressureLine,
  buildCustomerExecutiveBody,
  buildCustomerCorePatternBody,
  buildCustomerKeyAdvantageBody,
  buildCustomerScalingRiskBody,
  buildCustomerMainConstraintBody,
  buildCustomerOneMoveBlocks,
  buildCustomerBestNextMoveBody,
  filterCustomerProofSignals,
  buildCustomerFutureBody,
  buildCustomerFutureLandscapeBody,
  buildCustomerTeamFitBody,
  buildCustomerSectionBodies,
  INTERVENTION_TYPE_CUSTOMER_LABELS,
  DIMENSION_CUSTOMER_LABELS,
  DIMENSION_CUSTOMER_ONE_LINES,
  TECHNICAL_SOURCE_ONLY_LABELS,
};
