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
 * Executive Summary customer body from scores + pattern + one-move signals.
 * Does not use narrative.executiveSummary.body.
 */
export function buildCustomerExecutiveBody({
  patternHeadline = '',
  topScores = [],
  bottomScores = [],
  oneMove = null,
} = {}) {
  const pattern = presentPatternHeadlineForCustomer(patternHeadline)
    || buildCustomerPatternMeaning(topScores, bottomScores);
  const topNames = topScores.map(scoreDisplayName).filter(Boolean);
  const bottomNames = bottomScores.map(scoreDisplayName).filter(Boolean);
  const pressure = buildCustomerPressureLine(topScores, bottomScores);
  const normalizedMove = normalizeOneMoveSource(oneMove);

  const interventionType = mapInterventionTypeForCustomer(
    normalizedMove.interventionType || '',
  );
  const moveHeadline = presentOneMoveHeadlineForCustomer(normalizedMove.headline || '');
  const focus = moveHeadline && moveHeadline !== 'Your One Move' && moveHeadline !== 'The One Move'
    ? `Best next focus: ${moveHeadline}.`
    : (interventionType
      ? `Your next move is to ${interventionType.charAt(0).toLowerCase()}${interventionType.slice(1)} so follow-through does not depend only on memory or urgency.`
      : (normalizedMove.intervention
        ? `Best next focus: ${normalizedMove.intervention}`
        : 'Focus on one clear operating change for the next 30 days.'));

  const strengthLine = topNames.length
    ? `You are strongest when you can use ${joinPlainList(topNames)} together — reading the situation, choosing a direction, and moving.`
    : 'You are strongest when you can read the situation, choose a direction, and move.';

  const gapLine = bottomNames.length
    ? `Where growth gets harder: ${joinPlainList(bottomNames)} need more deliberate support so follow-through does not depend only on memory or urgency.`
    : 'Where growth gets harder: add simple structure so follow-through does not depend only on memory or urgency.';

  // Body does not restate the pattern headline sentence (avoids duplicate openers)
  const body = collapseDuplicateCustomerPhrasing(
    [strengthLine, pressure, gapLine, focus].filter(Boolean).join('\n\n'),
  );

  return {
    headline: pattern,
    body,
    content: [`**${pattern}**`, body].filter(Boolean).join('\n\n'),
    sourceStrategy: 'structured_scores_pattern_one_move',
    usesRawNarrativeBody: false,
  };
}

/**
 * Core Operating Pattern — customer only. No profileDNA paragraph.
 */
export function buildCustomerCorePatternBody({
  patternHeadline = '',
  topScores = [],
  bottomScores = [],
} = {}) {
  const headline = presentPatternHeadlineForCustomer(patternHeadline)
    || buildCustomerPatternMeaning(topScores, bottomScores);
  const meaning = buildCustomerPatternMeaning(topScores, bottomScores);
  const pressure = buildCustomerPressureLine(topScores, bottomScores);
  const topHelp = String(topScores[0]?.howItHelps || '').trim();
  const bottomRisk = String(bottomScores[0]?.howItWorksAgainst || '').trim();
  const topNames = topScores.map(scoreDisplayName).filter(Boolean);
  const bottomNames = bottomScores.map(scoreDisplayName).filter(Boolean);

  // Body complements the headline — does not re-paste the full pattern meaning when headline already states it
  const body = collapseDuplicateCustomerPhrasing(
    [
      topHelp
        ? `This strength helps you build trust and keep work moving. ${topHelp}`
        : (topNames.length
          ? `This strength helps you build trust and keep work moving through ${joinPlainList(topNames)}.`
          : 'This strength helps you build trust and keep work moving when others need clarity.'),
      pressure,
      bottomRisk
        ? `The risk is that flexibility can make priorities less clear if others need structure. ${bottomRisk}`
        : (bottomNames.length
          ? `The risk is that flexibility can make priorities less clear if others need structure — especially around ${joinPlainList(bottomNames)}.`
          : 'The risk is that flexibility can make priorities less clear if others need structure.'),
    ].filter(Boolean).join('\n\n'),
  );

  return {
    headline,
    meaning,
    body,
    content: [`**${headline}**`, body].filter(Boolean).join('\n\n'),
    sourceStrategy: 'structured_scores_pattern',
    usesRawNarrativeBody: false,
    usesProfileDnaBody: false,
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
    const help = String(score.howItHelps || presentDimensionOneLineForCustomer(score.dimension)).trim();
    return `**${name} (${scoreLabel})**\n${help}`;
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
    const risk = String(score.howItWorksAgainst || '').trim()
      || 'Without deliberate support, this area can create drag as complexity rises.';
    return `**${name} (${scoreLabel})**\n${risk}`;
  }).join('\n\n');

  const intro = roleFit
    || (bottomScores.length
      ? 'As you scale, the work that gets the least natural support from you becomes the place where friction shows up first.'
      : 'Scaling risk details will appear when score data is available.');

  const content = collapseDuplicateCustomerPhrasing(
    [
      roleFit ? `**Watch for:** ${roleFit}` : null,
      !roleFit ? intro : null,
      bottomBlocks || null,
    ].filter(Boolean).join('\n\n'),
  );

  return {
    body: content,
    content,
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
    first30Days: Array.isArray(first30) ? first30 : [first30].filter(Boolean),
    proofSignals: Array.isArray(proof) ? proof : [],
  };
}

/**
 * Best Next Move / One Move — structured field projection only.
 * Does not dump narrative.recommendedNextStep.body as primary content.
 */
export function buildCustomerBestNextMoveBody(oneMove = null) {
  if (!oneMove) {
    const body = 'One Move details are not available for this profile yet.';
    return {
      headline: 'Your One Move',
      body,
      content: body,
      interventionType: '',
      interventionTypeRaw: '',
      sourceStrategy: 'structured_one_move_fields',
      usesRawNarrativeBody: false,
      empty: true,
    };
  }

  const normalized = normalizeOneMoveSource(oneMove);
  const headline = presentOneMoveHeadlineForCustomer(normalized.headline || '') || 'Your One Move';
  const interventionTypeRaw = normalized.interventionType || '';
  const interventionType = mapInterventionTypeForCustomer(interventionTypeRaw);
  const intervention = cleanCustomerBOSCopy(normalized.intervention || '');
  const why = cleanCustomerBOSCopy(normalized.whyThisMatters || '');
  const ifIgnored = cleanCustomerBOSCopy(normalized.whatHappensIfIgnored || '');
  const bottleneck = cleanCustomerBOSCopy(normalized.futureBottleneck || '');

  const days = (normalized.first30Days || [])
    .map((step) => cleanCustomerBOSCopy(step))
    .filter(Boolean);
  const signals = (normalized.proofSignals || [])
    .map((signal) => cleanCustomerBOSCopy(signal))
    .filter(Boolean);

  // Customer explanation when structured move fields exist; never lead with raw body
  const defaultMoveLine = interventionType
    ? `Your next move is to ${interventionType.charAt(0).toLowerCase()}${interventionType.slice(1)} so follow-through does not depend only on memory or urgency.`
    : (intervention
      ? `Your next move is to ${intervention.charAt(0).toLowerCase()}${intervention.slice(1)}.`
      : '');

  const hasStructured = Boolean(
    interventionType || intervention || why || days.length || signals.length || bottleneck,
  );

  // Thin-profile residual only: if no structured fields, lightly present raw body (last resort)
  const residualBody = !hasStructured && normalized.body
    ? cleanCustomerBOSCopy(normalized.body)
    : '';

  const content = collapseDuplicateCustomerPhrasing(
    [
      `**${headline}**`,
      residualBody || null,
      interventionType ? `**Recommended move:** ${interventionType}` : null,
      intervention ? `**The move:** ${intervention}` : (!intervention && defaultMoveLine ? defaultMoveLine : null),
      bottleneck ? `**Future bottleneck:** ${bottleneck}` : null,
      why ? `**Why this matters:** ${why}` : null,
      ifIgnored && !/^not advice/i.test(ifIgnored) ? `**If ignored:** ${ifIgnored}` : null,
      days.length
        ? `**First 30 days:**\n${days.map((step, i) => `${i + 1}. ${step}`).join('\n')}`
        : null,
      signals.length
        ? `**How you will know it is working:**\n${signals.map((s) => `- ${s}`).join('\n')}`
        : null,
    ].filter(Boolean).join('\n\n'),
  );

  return {
    headline,
    body: content,
    content,
    intervention,
    interventionType,
    interventionTypeRaw: preserveTechnicalSource(interventionTypeRaw),
    preview: intervention || defaultMoveLine || headline,
    sourceStrategy: hasStructured ? 'structured_one_move_fields' : 'thin_profile_residual_body',
    usesRawNarrativeBody: Boolean(residualBody),
    empty: !content,
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
      likelihood ? `**Likelihood:** ${likelihood}` : null,
      trajectory || null,
      organization_experiences
        ? `_What the organization experiences:_ ${organization_experiences}`
        : null,
    ].filter(Boolean).join('\n\n'),
  );

  return {
    title,
    likelihood,
    trajectory,
    organization_experiences,
    content,
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
    ? `Based on your current operating pattern, several paths are possible. The most likely direction right now is **${mostLikely.title}**.`
    : titles.length
      ? `Based on your current operating pattern, several paths are possible — including ${joinPlainList(titles.slice(0, 3))}.`
      : '';

  // Summary field is short structured text; clean it but prefer structuredSummary when thin/empty
  const cleanedSummary = cleanCustomerBOSCopy(fiveFutures.summary || '');
  const summary = structuredSummary
    || cleanedSummary
    || 'Based on your current operating pattern, several paths are possible. Review each future with your coach or leadership partner.';

  const content = collapseDuplicateCustomerPhrasing(
    [
      summary,
      mostLikely && !mostLikely.empty
        ? `\n\n**${mostLikely.title || 'Most likely path'}** (${mostLikely.likelihood || 'likely'})\n${mostLikely.trajectory || ''}\n\n_What the organization experiences:_ ${mostLikely.organization_experiences || ''}`
        : null,
    ].filter(Boolean).join(''),
  );

  return {
    summary,
    mostLikely,
    futures,
    content,
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
    .map((n) => `**${n.label || 'Guidance'}:** ${n.guidance || ''}${n.rationale ? `\n_Why:_ ${n.rationale}` : ''}`)
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
      `**Primary guidance:** ${intro}`,
      notesBlock ? `**How to design the environment:**\n\n${notesBlock}` : null,
      caution ? `**Caution:** ${caution}` : null,
    ].filter(Boolean).join('\n\n'),
  );

  return {
    body: content,
    content,
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
  const customerBestNextMove = buildCustomerBestNextMoveBody(oneMove);
  const customerFutureLandscape = buildCustomerFutureLandscapeBody(fiveFutures);
  const customerTeamFit = buildCustomerTeamFitBody(facilitatorNotes);

  return {
    customerExecutiveSummary,
    customerCorePattern,
    customerKeyAdvantage,
    customerScalingRisk,
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
  };
}

export default {
  mapInterventionTypeForCustomer,
  mapDimensionNameForCustomer,
  mapTechnicalPhraseForCustomer,
  presentPatternHeadlineForCustomer,
  isPatternSoupHeadline,
  cleanCustomerBOSCopy,
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
  buildCustomerBestNextMoveBody,
  buildCustomerFutureBody,
  buildCustomerFutureLandscapeBody,
  buildCustomerTeamFitBody,
  buildCustomerSectionBodies,
  INTERVENTION_TYPE_CUSTOMER_LABELS,
  DIMENSION_CUSTOMER_LABELS,
  DIMENSION_CUSTOMER_ONE_LINES,
  TECHNICAL_SOURCE_ONLY_LABELS,
};
