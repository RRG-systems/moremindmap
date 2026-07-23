/**
 * BA Visual Renderer V2 — surface projection.
 *
 * BusinessEngineContract → display view-model for BusinessEngineVisualV2.
 *
 * Allowed: select contract fields, summarize for executive display, mark unavailable / fallback honesty.
 * Forbidden: classify trajectory, invent money, rewrite intelligence,
 *            create new constraint meaning, expose internal model names,
 *            silent substitution of missing intelligence,
 *            semantic side channels (normalized / currentMetrics / targetMetrics),
 *            generate new intelligence at expansion time.
 *
 * Executive doctrine (MMM8 Information Architecture):
 * - Summarize; do not mid-thought truncate with "..."
 * - Expansion reveals existing projected contract content only
 */

import { hasMeaningfulValue, textFrom } from './intelligenceField.js';
import { formatContractDisplayRows } from './contractDisplaySemantics.js';

const UNAVAILABLE = 'Not available for this assessment';
const STRUCTURAL = {
  brand_line: 'MORE MindMap',
  product_title: 'Business Engine Diagnostic',
  tagline: 'Your Business. Your Numbers. Your Future.',
  diagnosis_ribbon: ['Diagnosis Today.', 'Systems Tomorrow.', 'Results for Life.'],
  // Executive hierarchy: Current → Engine → Future (no explanation needed).
  left_column_title: 'YOUR CURRENT BUSINESS',
  center_title: 'YOUR BUSINESS DASHBOARD',
  center_subtitle: 'The system currently producing your results.',
  right_column_title: 'YOUR FUTURE BUSINESS',
  lake_title_re: 'THE RELATIONSHIP LAKE',
  lake_title_generic: 'RELATIONSHIP SYSTEM',
  // Panel titles under column hierarchy (secondary, not competing headers).
  reality_title: 'YOUR CURRENT BUSINESS',
  future_title: 'YOUR FUTURE BUSINESS',
  trajectory_current_title: 'CURRENT TRAJECTORY',
  trajectory_potential_title: 'POTENTIAL TRAJECTORY',
  pattern_title: 'GOVERNING BUSINESS PATTERN',
  behavioral_title: 'BEHAVIORAL MODIFIER',
  one_move_title: 'THE ONE MOVE',
  opportunity_title: 'MODELED OPPORTUNITY',
  confidence_title: 'CONFIDENCE REALITY',
  primary_constraint_title: 'PRIMARY CONSTRAINT',
  subscription_next_action_title: 'Next Action for Subscription',
  snapshot_label: 'Assessment Snapshot',
  last_updated_label: 'Last Updated',
  modeled_not_guaranteed: 'Modeled, not guaranteed.',
  fallback_streams_note: 'Illustrative streams — personalized stream intelligence not available.',
  fallback_outflow_note: 'Illustrative outflow — personalized outflow intelligence not available.',
  absent_note: 'Unavailable',
  // Progressive disclosure labels (renderer presents; does not invent content).
  expand_explain: 'Explain →',
  expand_continue: 'Continue →',
  expand_reasoning: 'Show reasoning →',
  expand_collapse: 'Show less ←',
};

/** Future-compatible expansion kinds (subscription-ready architecture). */
const EXPANSION_KINDS = Object.freeze({
  EXPLAIN: 'explain',
  CONTINUE: 'continue',
  REASONING: 'show_reasoning',
  EXPLAIN_RECOMMENDATION: 'explain_recommendation',
  SUPPORTING_EVIDENCE: 'supporting_evidence',
  WHY_ONE_MOVE: 'why_this_one_move',
  BEHAVIOR_MODIFIER: 'behavior_modifier',
  CONSTRAINT_HISTORY: 'constraint_history',
  EVIDENCE_TIMELINE: 'evidence_timeline',
});

const CONSTRAINT_STATES = Object.freeze([
  'ACTIVE',
  'IMPROVING',
  'STABILIZED',
  'EMERGING',
  'RESOLVED',
]);

function normalizeConstraintState(raw) {
  if (!hasMeaningfulValue(raw)) return 'ACTIVE';
  const normalized = String(raw)
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .trim();
  if (CONSTRAINT_STATES.includes(normalized)) return normalized;
  const compact = normalized.replace(/_/g, '');
  const match = CONSTRAINT_STATES.find((state) => state.replace(/_/g, '') === compact);
  return match || 'ACTIVE';
}

function compactKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Strip repeated subtype heading when category restates constraint name. */
function displayConstraintCategory(category, name) {
  if (!hasMeaningfulValue(category)) return null;
  const human = String(category).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!human) return null;
  const nameKey = compactKey(name);
  const catKey = compactKey(human);
  if (nameKey && (nameKey === catKey || nameKey.includes(catKey) || catKey.includes(nameKey))) {
    return null;
  }
  return human;
}

function formatOperatingModelField(value, max = 200) {
  if (!hasMeaningfulValue(value)) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.display) return displayText(value.display, max);
    if (Number.isFinite(value.value)) {
      const prefix = value.display_prefix || (value.estimated ? '~' : '');
      const unit = value.unit && value.unit !== 'usd' ? ` ${String(value.unit).replace(/_/g, ' ')}` : '';
      return displayText(`${prefix}${new Intl.NumberFormat('en-US').format(Math.round(value.value))}${unit}`, max);
    }
  }
  return displayText(value, max);
}

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Remove decorative trailing ellipsis so cards never look CSS-clipped.
 * If stripping leaves a mid-sentence fragment, prefer the last complete sentence.
 */
function stripTrailingEllipsis(text) {
  let cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?:\s*\.{3,}|\s*…)+\s*$/g, '')
    .trim();
  if (!cleaned) return '';
  if (!/[.!?]$/.test(cleaned)) {
    const finished = cleaned.match(/^([\s\S]+[.!?])(?:\s+|$)/);
    if (finished && finished[1].trim().length >= 24) {
      return finished[1].trim();
    }
  }
  return cleaned;
}

/**
 * Bound text at a complete thought boundary. Never appends "...".
 * Prefer sentence end; else word boundary. Incomplete cards are forbidden.
 */
function completeBound(text, maxChars) {
  const source = stripTrailingEllipsis(text);
  if (!source) return null;
  if (source.length <= maxChars) return source;

  const slice = source.slice(0, maxChars);
  const sentenceEnds = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let best = -1;
  for (const end of sentenceEnds) {
    const idx = slice.lastIndexOf(end);
    if (idx > best) best = idx;
  }
  if (best > maxChars * 0.35) {
    return stripTrailingEllipsis(slice.slice(0, best + 1));
  }
  // Word boundary — no ellipsis, no mid-word cut.
  const atWord = slice.replace(/\s+\S*$/, '').trim();
  if (atWord && atWord.length >= Math.min(24, maxChars * 0.4)) {
    return stripTrailingEllipsis(atWord);
  }
  return stripTrailingEllipsis(slice);
}

/**
 * Executive summary: target complete thought within word budget (default ~40–80 words).
 * Never ends with "..." — expansion holds remaining projected content when needed.
 */
function summarizeComplete(text, { minWords = 40, maxWords = 80, hardChars = 1200 } = {}) {
  const source = stripTrailingEllipsis(text);
  if (!source) return { summary: null, full: null, expandable: false };

  const full = source.length > hardChars ? completeBound(source, hardChars) : source;
  if (!full) return { summary: null, full: null, expandable: false };

  const words = full.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return { summary: full, full, expandable: false };
  }

  const sentences = full.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [full];
  let acc = '';
  let count = 0;
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const sc = wordCount(sentence);
    if (count > 0 && count + sc > maxWords && count >= Math.min(minWords, maxWords)) break;
    if (count > 0 && count + sc > Math.ceil(maxWords * 1.2) && count >= 12) break;
    acc = acc ? `${acc} ${sentence}` : sentence;
    count += sc;
    if (count >= maxWords) break;
  }

  if (!acc) {
    acc = words.slice(0, maxWords).join(' ');
  }

  // Prefer a finished sentence when the pack overran mid-thought.
  if (acc && !/[.!?]$/.test(acc)) {
    const finished = acc.match(/^([\s\S]+[.!?])(?:\s|$)/);
    if (finished && wordCount(finished[1]) >= Math.min(12, minWords)) {
      acc = finished[1].trim();
    } else {
      const first = firstSentence(full);
      if (first) acc = first;
    }
  }

  const summary = stripTrailingEllipsis(acc);
  const expandable = Boolean(summary && full && full !== summary && full.length > summary.length + 8);
  return { summary, full: stripTrailingEllipsis(full), expandable };
}

/**
 * Project prose for executive surface + optional progressive disclosure payload.
 * Expansion content is existing projected contract text only — never generated.
 */
function projectExpandableProse(
  value,
  {
    minWords = 40,
    maxWords = 80,
    hardChars = 1200,
    expansionLabel = STRUCTURAL.expand_continue,
    expansionKind = EXPANSION_KINDS.CONTINUE,
  } = {}
) {
  const raw = textFrom(value);
  if (!raw) return { text: null, expansion: null };
  const pack = summarizeComplete(raw, { minWords, maxWords, hardChars });
  if (!pack.summary) return { text: null, expansion: null };
  return {
    text: pack.summary,
    expansion: pack.expandable
      ? {
          available: true,
          label: expansionLabel,
          collapse_label: STRUCTURAL.expand_collapse,
          kind: expansionKind,
          content: pack.full,
          content_type: 'projected_contract_text',
          // Subscription-compatible handoff flags (no runtime fetch).
          subscription_compatible: true,
        }
      : null,
  };
}

/**
 * Short labels / chips: bound without ellipsis. Not used for executive prose cards.
 */
function displayText(value, max = 280) {
  const text = stripTrailingEllipsis(textFrom(value));
  if (!text) return null;
  return completeBound(text, max);
}

function formatConfidence(value) {
  if (!hasMeaningfulValue(value)) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 1) return `${Math.round(value * 100)}%`;
    if (value <= 100) return `${Math.round(value)}%`;
    return String(value);
  }
  return displayText(value, 48);
}

function formatMetricValue(metric) {
  if (metric === null || metric === undefined) return null;
  if (typeof metric === 'string') {
    const t = metric.trim();
    return t && !/^not provided$/i.test(t) ? t : null;
  }
  if (typeof metric === 'number' && Number.isFinite(metric)) {
    return new Intl.NumberFormat('en-US').format(Math.round(metric));
  }
  if (typeof metric === 'object') {
    if (metric.display) return String(metric.display);
    if (metric.range && Number.isFinite(metric.low) && Number.isFinite(metric.high)) {
      // Legitimate TR ranges only — caller must not pass true×total conflation.
      const prefix = metric.estimated ? 'Approx. ' : '';
      return `${prefix}${new Intl.NumberFormat('en-US').format(Math.round(metric.low))}–${new Intl.NumberFormat('en-US').format(Math.round(metric.high))}`;
    }
    if (Number.isFinite(metric.value)) {
      const prefix =
        metric.display_prefix ||
        (metric.estimated || metric.source === 'goal_doctrine_model' || metric.source === 'inferred_goal_doctrine_model'
          ? '~'
          : '');
      return `${prefix}${new Intl.NumberFormat('en-US').format(Math.round(metric.value))}`;
    }
  }
  return null;
}

function listFrom(value, max = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : textFrom(item?.name || item?.label || item?.value || item)))
    .filter(Boolean)
    .slice(0, max);
}

function evidenceSummary(items, max = 4) {
  return listFrom(items, max).map((item) => displayText(item, 120)).filter(Boolean);
}

function firstSentence(text) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) return null;
  const match = source.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : source.slice(0, 72);
}

/**
 * Project trajectory text + contract-owned visualization (no direction inference).
 */
function trajectoryView(node, { unavailableCaption, unavailableLine }) {
  const current = node?.current;
  const visualization =
    node?.visualization ||
    (current && typeof current === 'object' ? current.visualization : null) ||
    null;

  if (!hasMeaningfulValue(current)) {
    return {
      available: false,
      caption: unavailableCaption,
      line: unavailableLine,
      summary: null,
      direction: null,
      persistence_risk: null,
      confidence: formatConfidence(node?.confidence),
      fallback_used: true,
      intelligence_status: node?.intelligence_status || 'absent',
      visualization: visualization || {
        availability: 'unavailable',
        direction: 'unknown',
        shape: 'none',
        stage_labels: [],
        points: null,
        emphasis: null,
        start_state: null,
        end_state: null,
        uncertainty: 'high',
        summary: null,
        accessibility_label: unavailableCaption,
      },
    };
  }

  const rawLabel =
    typeof current === 'string' ? null : displayText(current.label || current.title, 72);
  const summaryPack = projectExpandableProse(
    typeof current === 'string' ? current : current.summary || current.explanation || current,
    {
      minWords: 24,
      maxWords: 70,
      expansionLabel: STRUCTURAL.expand_continue,
      expansionKind: EXPANSION_KINDS.CONTINUE,
    }
  );
  const summary = summaryPack.text;
  // Trajectory explains movement. Drop pure constraint restatements as captions.
  const looksLikeConstraintRestate =
    rawLabel &&
    /constraint$/i.test(rawLabel) &&
    !/\b(ris|declin|stable|momentum|trend|trajectory|path|growth)\b/i.test(rawLabel);
  const label = looksLikeConstraintRestate
    ? firstSentence(summary) || 'Current trajectory'
    : rawLabel;
  const direction = typeof current === 'string' ? null : displayText(current.direction, 80);
  // Trajectory risk is persistence/momentum risk only — not structural-change prose
  // (that belongs to Future / What Changes The Future / One Move).
  const riskPack =
    typeof current === 'string'
      ? { text: null, expansion: null }
      : projectExpandableProse(current.persistence_risk, {
          minWords: 12,
          maxWords: 55,
          expansionLabel: STRUCTURAL.expand_explain,
          expansionKind: EXPANSION_KINDS.EXPLAIN,
        });
  const risk = riskPack.text;

  // Visualization is contract-owned. Projection only passes through / layout-safe formats.
  // Stage labels and points are preserved without semantic rewriting.
  const viz = visualization
    ? {
        availability: visualization.availability || 'unavailable',
        direction: visualization.direction || 'unknown',
        shape: visualization.shape || 'none',
        stage_labels: Array.isArray(visualization.stage_labels)
          ? visualization.stage_labels
              .map((item) => {
                if (item === null || item === undefined) return null;
                const text = String(item).replace(/\s+/g, ' ').trim();
                return text || null;
              })
              .filter(Boolean)
          : [],
        points: Array.isArray(visualization.points)
          ? visualization.points.map((point) => ({
              x: Number(point.x),
              y: Number(point.y),
            }))
          : null,
        emphasis: visualization.emphasis || null,
        start_state: displayText(visualization.start_state, 48),
        end_state: displayText(visualization.end_state, 48),
        uncertainty: visualization.uncertainty || null,
        summary: displayText(visualization.summary, 200),
        accessibility_label:
          displayText(visualization.accessibility_label, 160) ||
          label ||
          unavailableCaption,
      }
    : {
        availability: 'text_only',
        direction: 'unknown',
        shape: 'none',
        stage_labels: [],
        points: null,
        emphasis: null,
        start_state: null,
        end_state: null,
        uncertainty: 'high',
        summary: null,
        accessibility_label: label || unavailableCaption,
      };

  return {
    available: true,
    caption: label || firstSentence(summary) || unavailableCaption,
    line: summary || risk || direction || unavailableLine,
    summary,
    summary_expansion: summaryPack.expansion,
    direction,
    persistence_risk: risk,
    persistence_risk_expansion: riskPack.expansion,
    confidence: formatConfidence(node?.confidence || (typeof current === 'object' ? current.confidence : null)),
    fallback_used: Boolean(node?.fallback_used),
    intelligence_status: node?.intelligence_status || null,
    visualization: viz,
  };
}

function pillarList(dimensionsNode) {
  const pillars = dimensionsNode?.current?.pillars;
  if (!pillars || typeof pillars !== 'object') return [];

  const order = ['models', 'systems', 'tools', 'accountability', 'education'];
  const labels = {
    models: 'Models',
    systems: 'Systems',
    tools: 'Tools',
    accountability: 'Accountability',
    education: 'Education',
  };

  return order
    .map((key) => {
      const item = pillars[key];
      if (!item) return null;
      const score = item.score ?? item.value ?? null;
      const classification = displayText(item.label || item.summary || item.description, 96);
      const evidence = listFrom(item.evidence, 2);
      const explanation = displayText(
        evidence.length ? evidence.join(' ') : item.caution || classification,
        180
      );
      return {
        key,
        title: labels[key],
        score: score === null || score === undefined ? null : String(score),
        label: explanation || (score !== null ? `${score} / 10` : UNAVAILABLE),
        classification,
        source_type: item.source_type || null,
        fallback_used: Boolean(item.fallback_used),
        fallback_reason: item.fallback_reason || null,
      };
    })
    .filter(Boolean);
}

function realityExtras(contract) {
  const current = contract?.current_business_reality?.current;
  if (!current || typeof current !== 'object') return [];
  const extras = [];
  if (current.stage) extras.push({ label: 'Business condition', value: displayText(current.stage, 80) });
  if (current.summary) extras.push({ label: 'Condition summary', value: displayText(current.summary, 160) });
  return extras.filter((row) => row.value);
}

function lakeItems(node) {
  const items = Array.isArray(node?.current) ? node.current : [];
  return items
    .map((item) => (typeof item === 'string' ? item : textFrom(item?.name || item?.label)))
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * @param {object} contract - Business Engine Contract (sole semantic source)
 * @param {object} [options]
 * @param {object} [options.identity] - optional identity-only display defaults (non-semantic)
 *
 * Semantic side channels are not accepted as inputs to this projection:
 * no parallel normalized map, no metric panel arrays, no raw business map,
 * no parallel trajectory objects, no separate One Move / confidence reinterpretation.
 *
 * Only `options.identity` is read. Any other option keys are ignored.
 */
export function projectBusinessEngineVisualV2(contract, options = {}) {
  // Identity-only. Never read legacy metric side channels from options.
  const identityDefaults =
    options && typeof options === 'object' && options.identity && typeof options.identity === 'object'
      ? options.identity
      : {};

  const lake = contract?.relationship_lake || {};
  const isRealEstate = Boolean(lake.vertical_specific || contract?.vertical_context?.vertical === 'real_estate');

  const realityCurrent = contract?.current_business_reality?.current;
  const potentialFuture = contract?.potential_business_future?.current;

  // Contract-owned display rows only — never parallel metric panels.
  const realityMetrics = formatContractDisplayRows(
    typeof realityCurrent === 'object' ? realityCurrent?.rows : null,
    8
  );
  const futureMetrics = formatContractDisplayRows(
    typeof potentialFuture === 'object' ? potentialFuture?.rows : null,
    8
  );

  const streamsFallback = Boolean(lake.streams?.fallback_used);
  const outflowFallback = Boolean(lake.outflow?.fallback_used);

  const pattern = contract?.governing_business_pattern?.current || null;
  const behavioral = contract?.behavioral_modifier?.current || null;
  const constraint = contract?.primary_constraint?.current || null;
  const oneMove = contract?.one_move?.current || null;
  const opportunity = contract?.modeled_opportunity?.current || null;
  const confidence = contract?.confidence_reality?.current || null;
  const footer = contract?.footer_intelligence?.current || null;

  const identity = contract?.identity || {};
  const meta = contract?.contract_metadata || {};

  const lastUpdated =
    displayText(meta.generated_at || lake.last_updated || contract?.current_trajectory?.last_updated, 48) ||
    null;

  const assessmentVersion = displayText(meta.assessment_version, 40);
  const assessmentDate = lastUpdated;

  const realityAvailable =
    realityMetrics.length > 0 || hasMeaningfulValue(realityCurrent);
  const futureHasContractPayload = hasMeaningfulValue(potentialFuture);
  // Honest absence: future metrics cannot make the region available without contract future.
  const futureAvailable = futureHasContractPayload;
  const futureHonestAbsence = !futureHasContractPayload;

  return {
    structural: STRUCTURAL,
    identity: {
      owner_name:
        displayText(identity.owner_name || identityDefaults.owner_name, 64) || 'Customer',
      role:
        displayText(identity.owner_profile_type || identityDefaults.owner_profile_type, 64) ||
        displayText(identity.assessment_type || identityDefaults.assessment_type, 64) ||
        'Business Assessment',
      profile_id:
        displayText(identity.profile_id || identityDefaults.profile_id, 64) || '—',
      assessment_type: displayText(identity.assessment_type || identityDefaults.assessment_type, 48),
      assessment_version: assessmentVersion,
      assessment_date: assessmentDate,
      last_updated: lastUpdated,
      snapshot_mode: meta.snapshot_mode !== false,
    },
    current_business_reality: (() => {
      const summaryPack = projectExpandableProse(
        typeof realityCurrent === 'object' ? realityCurrent?.summary : realityCurrent,
        {
          minWords: 24,
          maxWords: 70,
          expansionLabel: STRUCTURAL.expand_continue,
          expansionKind: EXPANSION_KINDS.CONTINUE,
        }
      );
      return {
        title: STRUCTURAL.reality_title,
        column_role: 'current',
        metrics: realityMetrics,
        extras: realityExtras(contract),
        summary: summaryPack.text,
        summary_expansion: summaryPack.expansion,
        available: realityAvailable,
        confidence: formatConfidence(contract?.current_business_reality?.confidence),
        fallback_used: Boolean(contract?.current_business_reality?.fallback_used),
        availability:
          typeof realityCurrent === 'object'
            ? realityCurrent?.availability || (realityAvailable ? 'available' : 'absent')
            : realityAvailable
              ? 'available'
              : 'absent',
      };
    })(),
    potential_business_future: (() => {
      const futureObj = typeof potentialFuture === 'object' && potentialFuture ? potentialFuture : {};
      const operating = futureObj.operating_model || {};
      const requiredStructuralPack = projectExpandableProse(
        futureObj.required_structural_change || operating.required_systems,
        {
          minWords: 20,
          maxWords: 70,
          expansionLabel: STRUCTURAL.expand_explain,
          expansionKind: EXPANSION_KINDS.EXPLAIN,
        }
      );
      const requiredStructural = requiredStructuralPack.text;
      // Avoid duplicate intelligence: if structural change is already the One Move body,
      // keep it off the Future surface and leave it to One Move / What Changes The Future.
      const oneMoveRec = displayText(oneMove?.recommendation, 420);
      const oneMoveTitle = displayText(oneMove?.title, 140);
      const structuralDuplicatesOneMove =
        requiredStructural &&
        ((oneMoveRec && compactKey(requiredStructural) === compactKey(oneMoveRec)) ||
          (oneMoveTitle && compactKey(requiredStructural) === compactKey(oneMoveTitle)));

      const explanationPack = projectExpandableProse(
        typeof potentialFuture === 'string'
          ? potentialFuture
          : futureObj.summary || futureObj.explanation,
        {
          minWords: 30,
          maxWords: 75,
          expansionLabel: STRUCTURAL.expand_continue,
          expansionKind: EXPANSION_KINDS.CONTINUE,
        }
      );
      const systemsPack = projectExpandableProse(
        futureObj.required_systems || operating.required_systems || requiredStructural,
        {
          minWords: 20,
          maxWords: 70,
          expansionLabel: STRUCTURAL.expand_explain,
          expansionKind: EXPANSION_KINDS.EXPLAIN,
        }
      );
      const stabPack = projectExpandableProse(
        futureObj.expected_stabilization || operating.expected_stabilization,
        {
          minWords: 16,
          maxWords: 60,
          expansionLabel: STRUCTURAL.expand_continue,
          expansionKind: EXPANSION_KINDS.CONTINUE,
        }
      );
      const rhythmPack = projectExpandableProse(
        futureObj.expected_business_rhythm || operating.expected_business_rhythm,
        {
          minWords: 16,
          maxWords: 55,
          expansionLabel: STRUCTURAL.expand_continue,
          expansionKind: EXPANSION_KINDS.CONTINUE,
        }
      );
      const productionPack = projectExpandableProse(
        futureObj.expected_production_effect || operating.expected_production_effect,
        {
          minWords: 16,
          maxWords: 70,
          expansionLabel: STRUCTURAL.expand_continue,
          expansionKind: EXPANSION_KINDS.CONTINUE,
        }
      );

      return {
        title: STRUCTURAL.future_title,
        column_role: 'future',
        metrics: futureHasContractPayload ? futureMetrics : [],
        explanation: explanationPack.text,
        explanation_expansion: explanationPack.expansion,
        // Prefer expanded operating-model doctrine fields when present.
        target_lake: formatOperatingModelField(
          futureObj.target_lake || operating.target_lake || lake?.target_true_relationships || lake?.target_size,
          64
        ),
        required_systems: systemsPack.text,
        required_systems_expansion: systemsPack.expansion,
        expected_stabilization: stabPack.text,
        expected_stabilization_expansion: stabPack.expansion,
        expected_business_rhythm: rhythmPack.text,
        expected_business_rhythm_expansion: rhythmPack.expansion,
        expected_production_effect: productionPack.text,
        expected_production_effect_expansion: productionPack.expansion,
        time_to_effect: displayText(futureObj.time_to_effect || operating.time_to_effect, 80),
        supported_doctrine_tokens: listFrom(
          futureObj.supported_doctrine_tokens || operating.supported_doctrine_tokens,
          4
        ),
        // Only surface standalone structural change when it is not already One Move.
        required_structural_change: structuralDuplicatesOneMove ? null : requiredStructural,
        required_structural_change_expansion: structuralDuplicatesOneMove
          ? null
          : requiredStructuralPack.expansion,
        assumptions: listFrom(futureObj.assumptions, 4),
        available: futureAvailable,
        confidence: formatConfidence(
          contract?.potential_business_future?.confidence || futureObj.confidence
        ),
        honest_absence: futureHonestAbsence,
        absence_message: 'Potential business future intelligence was not available for this assessment.',
      };
    })(),
    current_trajectory: trajectoryView(contract?.current_trajectory, {
      unavailableCaption: 'Current trajectory unavailable',
      unavailableLine: 'Trajectory intelligence was not available for this assessment.',
    }),
    potential_trajectory: (() => {
      const view = trajectoryView(contract?.potential_trajectory, {
        unavailableCaption: 'Potential trajectory unavailable',
        unavailableLine: 'Modeled future trajectory was not available for this assessment.',
      });
      if (!hasMeaningfulValue(contract?.potential_trajectory?.current)) {
        view.available = false;
        view.caption = 'Potential trajectory unavailable';
        view.line = 'Modeled future trajectory was not available for this assessment.';
        view.fallback_used = true;
        view.visualization = {
          availability: 'unavailable',
          direction: 'unknown',
          shape: 'none',
          stage_labels: [],
          points: null,
          emphasis: null,
          start_state: null,
          end_state: null,
          uncertainty: 'high',
          summary: null,
          accessibility_label: 'Potential trajectory unavailable',
        };
      }
      return view;
    })(),
    business_engine: {
      title: STRUCTURAL.center_title,
      subtitle: STRUCTURAL.center_subtitle,
      column_role: 'engine',
      pillars: pillarList(contract?.business_engine_dimensions),
      pillars_fallback: Boolean(contract?.business_engine_dimensions?.fallback_used),
      pillars_note: displayText(contract?.business_engine_dimensions?.current?.interpretation_note, 160),
      intelligence_confidence: formatConfidence(
        contract?.business_engine_dimensions?.confidence || contract?.confidence_reality?.confidence
      ),
    },
    governing_business_pattern: (() => {
      const summaryPack = projectExpandableProse(pattern?.summary, {
        minWords: 30,
        maxWords: 75,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.CONTINUE,
      });
      return {
        title: STRUCTURAL.pattern_title,
        pattern_title: displayText(pattern?.title, 96),
        summary: summaryPack.text,
        summary_expansion: summaryPack.expansion,
        momentum_sources: listFrom(pattern?.momentum_sources, 5),
        drag_sources: listFrom(pattern?.drag_sources, 5),
        reinforcing_loops: listFrom(pattern?.reinforcing_loops, 3),
        conflicting_loops: listFrom(pattern?.conflicting_loops, 3),
        available: hasMeaningfulValue(pattern),
        confidence: formatConfidence(contract?.governing_business_pattern?.confidence),
        absence_message: 'Governing business pattern intelligence was not available for this assessment.',
      };
    })(),
    relationship_lake: (() => {
      const currentTrue =
        lake.current_true_relationships != null ? lake.current_true_relationships : lake.current_size;
      const targetTrue =
        lake.target_true_relationships != null ? lake.target_true_relationships : lake.target_size;
      const currentDisplay = formatMetricValue(currentTrue);
      const targetDisplay = formatMetricValue(targetTrue);
      // Never present a merged true-relationships × total-contacts range as the center.
      const centerLabel = isRealEstate ? 'TRUE RELATIONSHIPS' : 'RELATIONSHIPS';
      const goalSource = displayText(lake.goal_source, 24);
      const goalSourceLabel =
        goalSource === 'declared'
          ? 'declared'
          : goalSource === 'inferred'
            ? 'inferred'
            : goalSource && goalSource !== 'unavailable'
              ? goalSource
              : null;
      return {
        title: isRealEstate ? STRUCTURAL.lake_title_re : STRUCTURAL.lake_title_generic,
        subtitle:
          displayText(lake.subtext, 96) ||
          (isRealEstate ? 'Your business runs on relationships.' : 'Relationship system for this business.'),
        // Explicit doctrine flow: Current True → Target True → Gap
        flow: {
          current_true_relationships: currentDisplay,
          target_true_relationships: targetDisplay,
          gap: formatMetricValue(lake.gap),
        },
        current_size: currentDisplay,
        target_size: targetDisplay,
        gap: formatMetricValue(lake.gap),
        current_true_relationships: currentDisplay,
        target_true_relationships: targetDisplay,
        // Supporting context only — never merged into lake center.
        total_contacts: formatMetricValue(lake.total_contacts),
        goal_summary: displayText(lake.goal_summary, 80),
        goal_source: goalSourceLabel,
        goal_confidence: formatConfidence(lake.goal_confidence),
        target_basis: displayText(lake.target_basis, 80),
        supporting_evidence: evidenceSummary(
          lake.supporting_evidence ||
            lake.evidence ||
            (Array.isArray(lake.provenance?.notes) ? lake.provenance.notes : null),
          4
        ),
        quality: displayText(lake.current_quality || lake.lake_health, 80),
        label: displayText(lake.label, 48) || centerLabel,
        center_unit_label: centerLabel,
        streams: lakeItems(lake.streams),
        outflow: lakeItems(lake.outflow),
        streams_fallback: streamsFallback,
        outflow_fallback: outflowFallback,
        streams_note: streamsFallback ? STRUCTURAL.fallback_streams_note : null,
        outflow_note: outflowFallback ? STRUCTURAL.fallback_outflow_note : null,
        vertical_specific: isRealEstate,
        fallback_used: Boolean(lake.fallback_used),
        fallback_reason: displayText(lake.fallback_reason, 120),
        modeled_not_guaranteed: lake.modeled_not_guaranteed !== false,
        available: true,
      };
    })(),
    future_alignment: {
      active_future_key: displayText(contract?.future_alignment?.active_future_key, 48),
      active_future_title: displayText(contract?.future_alignment?.active_future_title, 96),
      dominant_future_key: displayText(contract?.future_alignment?.dominant_future_key, 48),
      dominant_future_title: displayText(contract?.future_alignment?.dominant_future_title, 96),
      one_move_title: displayText(contract?.future_alignment?.one_move?.title, 96),
      available: Boolean(contract?.future_alignment?.available),
    },
    goal_intelligence: {
      goal_summary: displayText(contract?.goal_intelligence?.goal_summary, 64),
      goal_source: displayText(contract?.goal_intelligence?.goal_source, 24),
      goal_confidence: formatConfidence(contract?.goal_intelligence?.goal_confidence),
      goal_type: displayText(contract?.goal_intelligence?.goal_type, 32),
      available: contract?.goal_intelligence?.goal_source
        ? contract.goal_intelligence.goal_source !== 'unavailable'
        : false,
    },
    behavioral_modifier: (() => {
      const leadPack = projectExpandableProse(behavioral?.concise_customer_facing_explanation, {
        minWords: 30,
        maxWords: 75,
        expansionLabel: STRUCTURAL.expand_explain,
        expansionKind: EXPANSION_KINDS.BEHAVIOR_MODIFIER,
      });
      const assetPack = projectExpandableProse(behavioral?.behavioral_asset, {
        minWords: 12,
        maxWords: 50,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.CONTINUE,
      });
      const riskPack = projectExpandableProse(behavioral?.business_distortion_or_risk, {
        minWords: 12,
        maxWords: 55,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.CONTINUE,
      });
      const implPack = projectExpandableProse(behavioral?.implementation_implication, {
        minWords: 12,
        maxWords: 60,
        expansionLabel: STRUCTURAL.expand_explain,
        expansionKind: EXPANSION_KINDS.EXPLAIN,
      });
      return {
        title: STRUCTURAL.behavioral_title,
        behavioral_asset: assetPack.text,
        behavioral_asset_expansion: assetPack.expansion,
        business_distortion_or_risk: riskPack.text,
        business_distortion_or_risk_expansion: riskPack.expansion,
        implementation_implication: implPack.text,
        implementation_implication_expansion: implPack.expansion,
        concise_explanation: leadPack.text,
        concise_explanation_expansion: leadPack.expansion,
        available: hasMeaningfulValue(behavioral),
        confidence: formatConfidence(contract?.behavioral_modifier?.confidence),
        absence_message: 'Behavioral modifier intelligence was not available for this assessment.',
      };
    })(),
    primary_constraint: (() => {
      const explanationPack = projectExpandableProse(constraint?.explanation, {
        minWords: 30,
        maxWords: 80,
        expansionLabel: STRUCTURAL.expand_reasoning,
        expansionKind: EXPANSION_KINDS.REASONING,
      });
      const downstreamPack = projectExpandableProse(constraint?.downstream_effects, {
        minWords: 16,
        maxWords: 65,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.CONTINUE,
      });
      return {
        title: STRUCTURAL.primary_constraint_title,
        name: displayText(constraint?.name, 120),
        // Prefer display_category (already de-duplicated); never restate name as subtype.
        category: displayConstraintCategory(
          constraint?.display_category || constraint?.category,
          constraint?.name
        ),
        state: normalizeConstraintState(constraint?.state || constraint?.constraint_state),
        explanation: explanationPack.text,
        explanation_expansion: explanationPack.expansion
          ? {
              ...explanationPack.expansion,
              kind: EXPANSION_KINDS.REASONING,
              label: STRUCTURAL.expand_reasoning,
              subscription_hooks: ['constraint_history', 'evidence_timeline'],
            }
          : null,
        supporting_evidence: evidenceSummary(constraint?.supporting_evidence, 6),
        supporting_evidence_expansion:
          Array.isArray(constraint?.supporting_evidence) && constraint.supporting_evidence.length > 4
            ? {
                available: true,
                label: STRUCTURAL.expand_explain,
                collapse_label: STRUCTURAL.expand_collapse,
                kind: EXPANSION_KINDS.SUPPORTING_EVIDENCE,
                content: listFrom(constraint.supporting_evidence, 12),
                content_type: 'projected_contract_list',
                subscription_compatible: true,
              }
            : null,
        downstream_effects: downstreamPack.text,
        downstream_effects_expansion: downstreamPack.expansion,
        confidence: formatConfidence(contract?.primary_constraint?.confidence),
        available: hasMeaningfulValue(constraint),
        absence_message: 'Primary constraint intelligence was not available for this assessment.',
      };
    })(),
    // Causal chain keeps unique intelligence only — Primary Constraint + One Move
    // already have dedicated surfaces. Modeled Opportunity is archived (not rendered).
    causal_chain: (() => {
      const whyPack = projectExpandableProse(contract?.causal_explanation?.current, {
        minWords: 28,
        maxWords: 70,
        expansionLabel: STRUCTURAL.expand_explain,
        expansionKind: EXPANSION_KINDS.EXPLAIN,
      });
      const noChangePack = projectExpandableProse(contract?.no_change_consequence?.current, {
        minWords: 28,
        maxWords: 70,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.CONTINUE,
      });
      const futureChangeSource =
        contract?.future_change_logic?.current || oneMove?.why_selected || oneMove?.recommendation;
      const futurePack = projectExpandableProse(futureChangeSource, {
        minWords: 28,
        maxWords: 70,
        expansionLabel: STRUCTURAL.expand_reasoning,
        expansionKind: EXPANSION_KINDS.WHY_ONE_MOVE,
      });
      return [
        {
          key: 'why_this_is_happening',
          title: 'WHY THIS IS HAPPENING',
          body: whyPack.text || 'Diagnosis unavailable',
          expansion: whyPack.expansion,
          detail: null,
          from_contract: true,
          fallback_used: Boolean(contract?.causal_explanation?.fallback_used),
          available: hasMeaningfulValue(contract?.causal_explanation?.current),
        },
        {
          key: 'what_happens_if_nothing_changes',
          title: 'WHAT HAPPENS IF NOTHING CHANGES',
          body: noChangePack.text || 'Impact not modeled yet.',
          expansion: noChangePack.expansion,
          detail: null,
          from_contract: true,
          fallback_used: Boolean(contract?.no_change_consequence?.fallback_used),
          available: hasMeaningfulValue(contract?.no_change_consequence?.current),
        },
        {
          key: 'what_changes_the_future',
          title: 'WHAT CHANGES THE FUTURE',
          body: futurePack.text || 'Future-change logic unavailable',
          expansion: futurePack.expansion
            ? {
                ...futurePack.expansion,
                label: STRUCTURAL.expand_reasoning,
                kind: EXPANSION_KINDS.WHY_ONE_MOVE,
                subscription_hooks: ['why_this_one_move', 'explain_recommendation'],
              }
            : null,
          detail: null,
          from_contract: true,
          fallback_used: Boolean(contract?.future_change_logic?.fallback_used),
          available:
            hasMeaningfulValue(contract?.future_change_logic?.current) ||
            hasMeaningfulValue(oneMove?.why_selected) ||
            hasMeaningfulValue(oneMove?.recommendation),
          emphasis: true,
        },
      ];
    })(),
    one_move: (() => {
      const recPack = projectExpandableProse(oneMove?.recommendation, {
        minWords: 30,
        maxWords: 80,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.EXPLAIN_RECOMMENDATION,
      });
      const whyPack = projectExpandableProse(oneMove?.why_selected, {
        minWords: 24,
        maxWords: 70,
        expansionLabel: STRUCTURAL.expand_reasoning,
        expansionKind: EXPANSION_KINDS.WHY_ONE_MOVE,
      });
      const behaviorPack = projectExpandableProse(oneMove?.behavioral_fit, {
        minWords: 16,
        maxWords: 65,
        expansionLabel: STRUCTURAL.expand_explain,
        expansionKind: EXPANSION_KINDS.BEHAVIOR_MODIFIER,
      });
      const structuralPack = projectExpandableProse(oneMove?.structural_fit || oneMove?.root_constraint, {
        minWords: 16,
        maxWords: 65,
        expansionLabel: STRUCTURAL.expand_explain,
        expansionKind: EXPANSION_KINDS.EXPLAIN,
      });
      const effectsPack = projectExpandableProse(oneMove?.expected_downstream_effects, {
        minWords: 20,
        maxWords: 75,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.CONTINUE,
      });
      const implementationSource =
        oneMove?.implementation ||
        (Array.isArray(oneMove?.first_30_days) && oneMove.first_30_days.length
          ? oneMove.first_30_days.join(' → ')
          : null);
      const implPack = projectExpandableProse(implementationSource, {
        minWords: 24,
        maxWords: 80,
        expansionLabel: STRUCTURAL.expand_continue,
        expansionKind: EXPANSION_KINDS.CONTINUE,
      });
      return {
        title: STRUCTURAL.one_move_title,
        move_title: displayText(oneMove?.title, 160),
        recommendation: recPack.text,
        recommendation_expansion: recPack.expansion
          ? {
              ...recPack.expansion,
              label: STRUCTURAL.expand_continue,
              kind: EXPANSION_KINDS.EXPLAIN_RECOMMENDATION,
              subscription_hooks: ['explain_recommendation', 'why_this_one_move'],
            }
          : null,
        why_selected: whyPack.text,
        why_selected_expansion: whyPack.expansion
          ? {
              ...whyPack.expansion,
              label: STRUCTURAL.expand_reasoning,
              kind: EXPANSION_KINDS.WHY_ONE_MOVE,
              subscription_hooks: ['why_this_one_move', 'show_reasoning'],
            }
          : null,
        behavioral_fit: behaviorPack.text,
        behavioral_fit_expansion: behaviorPack.expansion,
        structural_fit: structuralPack.text,
        structural_fit_expansion: structuralPack.expansion,
        proof_target: listFrom(oneMove?.proof_target, 8),
        review_period: displayText(oneMove?.review_period, 80),
        expected_downstream_effects: effectsPack.text,
        expected_downstream_effects_expansion: effectsPack.expansion,
        implementation: implPack.text,
        implementation_expansion: implPack.expansion,
        first_30_days: listFrom(oneMove?.first_30_days, 8),
        confidence: formatConfidence(contract?.one_move?.confidence),
        available: hasMeaningfulValue(oneMove),
        absence_message: 'One Move intelligence was not available for this assessment.',
      };
    })(),
    // Archived from executive surface. Contract domain retained for honesty / fixtures.
    // Unique concepts covered by One Move + Future Operating Model + Future Trajectory.
    modeled_opportunity: {
      title: STRUCTURAL.opportunity_title,
      value_or_range: displayText(opportunity?.value_or_range, 80),
      narrative: displayText(opportunity?.narrative, 400),
      time_horizon: displayText(opportunity?.time_horizon, 48),
      assumptions: listFrom(opportunity?.assumptions, 4),
      confidence: formatConfidence(contract?.modeled_opportunity?.confidence),
      modeled_not_guaranteed:
        opportunity?.modeled_not_guaranteed !== false ? STRUCTURAL.modeled_not_guaranteed : null,
      available: hasMeaningfulValue(opportunity),
      absence_message: 'No modeled opportunity value was available. Financial values are never invented.',
      archived: true,
      render: false,
      archive_reason:
        'Superseded on executive surface by One Move, Future Operating Model, and Future Trajectory.',
    },
    confidence_reality: {
      title: STRUCTURAL.confidence_title,
      role: 'supporting_evidence',
      confidence_band: displayText(confidence?.confidence_band || confidence?.evidence_quality, 40),
      confidence_score: formatConfidence(confidence?.confidence_score),
      // Preserve core truth buckets for Subscription readiness.
      known: listFrom(confidence?.known, 8),
      observed: listFrom(confidence?.observed, 8),
      inferred: listFrom(confidence?.inferred, 8),
      assumed: listFrom(confidence?.assumed, 6),
      missing: listFrom(confidence?.missing, 8),
      contradictions: listFrom(confidence?.contradictions, 4),
      // Architecture handoff fields for living engine (not runtime).
      subscription_ready: true,
      subscription_hooks: [
        'show_supporting_evidence',
        'evidence_timeline',
        'explain_recommendation',
      ],
      previous: null,
      trend: meta.trend || 'baseline_snapshot',
      available: hasMeaningfulValue(confidence),
      absence_message: 'Confidence intelligence was not available for this assessment.',
    },
    // Architectural handoff retained for fixtures / contract honesty.
    // Visible UI replaced by Make Your Map Alive conversion panel (renderer).
    subscription_placeholder: {
      title: STRUCTURAL.subscription_next_action_title,
      next_action: 'Next Action for Subscription',
      role: 'future_intelligence_handoff',
      available: true,
      ui_archived: true,
      render: false,
      replaced_by: 'make_your_map_alive_panel',
    },
    // Footer intelligence still projected for honesty / fixtures.
    // Visible UI no longer echoes One Move title; conversion panel owns the footer region.
    footer: {
      headline: displayText(footer?.headline, 120),
      subline: displayText(footer?.subline, 200),
      personalized: Boolean(footer?.personalized),
      available: hasMeaningfulValue(footer),
      ui_archived: true,
      render: false,
      replaced_by: 'make_your_map_alive_panel',
      absence_message:
        'Personalized closing insight will appear when governing pattern or One Move intelligence is present.',
    },
    temporal: {
      last_updated: lastUpdated,
      assessment_snapshot: true,
      trend: meta.trend || 'baseline_snapshot',
      reason_for_change: meta.reason_for_change || 'initial_assessment_snapshot',
      previous: null,
      evidence_sources_count: Array.isArray(meta.legacy_fallbacks_used)
        ? meta.legacy_fallbacks_used.length
        : 0,
    },
    meta: {
      contract_version: meta.contract_version || null,
      contract_name: meta.contract_name || null,
      snapshot_mode: meta.snapshot_mode !== false,
      customer_facing_model_names_exposed: false,
      visualization_semantics: meta.visualization_semantics || null,
      semantic_sources: {
        normalized: false,
        currentMetrics: false,
        targetMetrics: false,
        contract_only: true,
      },
    },
  };
}

export default projectBusinessEngineVisualV2;
