import { getVisualDNADesignReference } from './designReferences.js';
import { buildVisualNarrative } from './buildVisualNarrative.js';
import { buildVisualOperatingSystem } from './buildVisualOperatingSystem.js';

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  return `{${Object.keys(value).sort().map((key) => {
    return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
  }).join(',')}}`;
}

export function hashVisualDNAPrompt(prompt) {
  const input = String(prompt || '');
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `vdna_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function compactPacketForPrompt(packet) {
  const stack = packet?.intelligence_stack || {};

  return {
    profile: packet?.profile || {},
    scoring: packet?.scoring || {},
    behavioral_dna: stack.behavioral_dna || null,
    executive_summary: stack.executive_summary || null,
    hidden_contradictions: stack.hidden_contradictions || null,
    strategic_ceiling: stack.strategic_ceiling || null,
    team_experience: stack.team_experience || null,
    pressure_mechanics: stack.pressure_mechanics || null,
    scaling_constraint: stack.scaling_constraint || null,
    facilitator_notes: stack.facilitator_notes || null,
    five_futures: stack.five_futures || null,
    one_move: stack.one_move || null,
  };
}

function getDimensionLabel(dimension) {
  const labels = {
    vector: 'VECTOR',
    velocity: 'VELOCITY',
    flex: 'FLEX',
    horizon: 'HORIZON',
    fidelity: 'FIDELITY',
    framework: 'FRAMEWORK',
    signal: 'SIGNAL',
    leverage: 'LEVERAGE',
  };

  return labels[String(dimension || '').toLowerCase()] || String(dimension || '').toUpperCase();
}

function formatScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return '';
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(2)}`;
}

function buildVisualBrief(packet) {
  const profile = packet.profile || {};
  const scoring = packet.scoring || {};
  const dna = packet.behavioral_dna || {};
  const ranked = Array.isArray(scoring.ranked_dimensions) ? scoring.ranked_dimensions : [];
  const top = ranked.slice(0, 5).map((dimension) => {
    return `${getDimensionLabel(dimension.dimension)} ${formatScore(dimension.score)}`.trim();
  });
  const lowest = ranked[ranked.length - 1];
  const tensionKey = Object.keys(scoring.tension_pairs || {})[0] || '';
  const tension = tensionKey
    ? tensionKey.split('_vs_').map(getDimensionLabel).join(' VS ')
    : 'PRIMARY TENSION';
  const oneMove = packet.one_move?.headline || packet.one_move?.body || 'ONE MOVE';

  return {
    visible_labels_only: [
      String(profile.person_name || 'PROFILE SUBJECT').toUpperCase(),
      String(profile.company || '').toUpperCase(),
      String(profile.profile_type || '').toUpperCase(),
      `PRIMARY ENGINE: ${String(dna.primary_engine || 'OPERATING SYSTEM').toUpperCase()}`,
      `TOP DIMENSIONS: ${top.join(' / ')}`,
      lowest?.dimension ? `LOWEST SIGNAL: ${getDimensionLabel(lowest.dimension)} ${formatScore(lowest.score)}` : null,
      `TENSION: ${tension}`,
      dna.wrong_seat_risk ? `WRONG-SEAT RISK: ${String(dna.wrong_seat_risk).toUpperCase()}` : null,
      `ONE MOVE: ${String(oneMove).split('\n')[0].toUpperCase()}`,
    ].filter(Boolean),
    visual_story: [
      dna.primary_engine,
      dna.natural_advantage,
      dna.natural_risk,
      dna.best_environment,
      dna.worst_environment,
      oneMove,
    ].filter(Boolean),
  };
}

export function buildVisualDNAPrompt(contextPacket, designReference = getVisualDNADesignReference()) {
  const compactPacket = compactPacketForPrompt(contextPacket);
  const profileName = compactPacket.profile?.person_name || 'this profile';
  const visualNarrative = buildVisualNarrative(compactPacket);
  const visualOperatingSystem = buildVisualOperatingSystem(compactPacket, visualNarrative);
  const visualBrief = buildVisualBrief(compactPacket);
  const prompt = `Create a Visual DNA image that answers: "What does this mind look like?"

DESIGN REFERENCE A - HOW IT SHOULD FEEL
${stableStringify(designReference.reference_a)}

DESIGN REFERENCE B - WHY THE CONCEPT WORKS
${stableStringify(designReference.reference_b)}

CANONICAL PRODUCTION STANDARD
${stableStringify(designReference.canonical_standard)}

NEGATIVE CONSTRAINTS
${(designReference.negative_constraints || []).map((item) => `- ${item}`).join('\n')}

VISUAL OPERATING SYSTEM MODEL - BUILD FROM THIS FIRST
The image must be conceptualized as Profile -> Meaning -> Metaphor -> Operating System Model -> Image.
This is the primary creative source. The final image should explain how the behavioral machine works, not just who the person is.
${JSON.stringify(visualOperatingSystem, null, 2)}

VISUAL NARRATIVE LAYER - USE AS MEANING AND SYMBOLISM
Use this narrative layer to translate the operating system into metaphor, symbolism, and visual architecture.
${JSON.stringify(visualNarrative, null, 2)}

IMAGE GENERATION PRIORITY
1. Operating system model
2. Visual metaphor
3. Primary engine
4. Tension / bottleneck
5. One Move as system evolution
6. Labels

FULL PROFILE INTELLIGENCE PACKET - SOURCE MATERIAL ONLY
Use this as evidence for the narrative layer and visual choices. Do not render raw prose, JSON keys, or section text from this packet.
${JSON.stringify(compactPacket, null, 2)}

CANONICAL VISUAL BRIEF
Use this brief only for the small set of visible image labels. Labels are the final accent layer, not the explanation.
${JSON.stringify(visualBrief, null, 2)}

IMAGE INTENT
Visualize the behavioral operating system of ${profileName}. The image should represent the whole profile intelligence stack through metaphor, architecture, pathways, modules, pressure points, and transfer patterns. Do not try to explain the profile through paragraphs of text.

OPERATING SYSTEM QUESTIONS THE IMAGE MUST ANSWER
- What powers the system?
- What constrains the system?
- What outputs does the system create?
- What loop keeps the system running?
- What evolves the system if the One Move is executed?
- Where does flow transfer from the central engine into the organization?

APPROVED MARCUS/NORA QUALITY BAR
- Finished executive intelligence dashboard, not concept art.
- High-contrast black background with bright neon orange/violet/green/blue signal accents.
- Dense information architecture: profile panel, dimension bars, central operating-system map, risk/environment panels, pressure gauge, one-move panel, and operating-sequence strip.
- Crisp panel boundaries, clean score bars, clear diagram hierarchy, luminous but controlled glow.
- No smoky gray wash, no dim low-contrast overlay, no sparse center-only composition.
- No lone brain/shell/orb. The centerpiece must be a behavioral operating system map with connected modules.
- Use only large readable labels for major concepts. If small text would be unreadable, replace it with bars, icons, ticks, or glyphs.
- Visible text must come from CANONICAL VISUAL BRIEF.visible_labels_only. Do not invent other words. Do not paint JSON keys.

VISUAL STORYTELLING RULES
- First build the operating system: inputs -> engine -> loop -> outputs -> bottleneck -> evolution path.
- Show the primary engine as the main force, not merely as a label.
- Show the secondary engine as the way the system moves, stabilizes, senses, adapts, or verifies.
- Show the tension as visual pressure: bottleneck, gate, overloaded junction, missing stabilizer, drift zone, or transfer gap.
- Show the future bottleneck as the place where the system would cap growth if unchanged.
- Show the one move as the architectural intervention that changes the flow.
- Use symbols, pathways, gates, grids, gauges, routing maps, rings, and decision networks more than text.
- Keep labels sparse, large, and readable. Do not rely on text to carry meaning.
- Avoid profile-card behavior: the image should not feel like a scoreboard, trait report, or personality chart.
- Favor machine, network, engine, operating loop, transfer architecture, feedback systems, and evolution path.

COMPOSITION RULES
- Do not depict the person physically.
- Build a dark enterprise intelligence system map, not a single symbolic object.
- Use a central Behavioral Operating System architecture as the focal point: stacked engine rings, directional pathways, evidence nodes, and operating layers.
- Surround it with evidence-derived widgets: profile identity, ranked dimension bars, primary engine, secondary engine, tension pair, pressure shift, role fit, wrong-seat risk, best environment, worst environment, one move, and future trajectory signals.
- Include a bottom or side operating-sequence strip that shows how this person creates value.
- Use neon accent lighting, precise circuit pathways, luminous nodes, and architectural diagram language.
- Keep text minimal, label-like, and readable. Use real short labels only; do not render fake paragraphs or garbled pseudo-text.
- Prefer abstract glyphs, icons, color bars, gauges, and node patterns over small text.
- Preserve the Marcus/Nora quality bar: dense executive intelligence dashboard, crisp panel hierarchy, central operating system map, not simplified brain-shell imagery.
- Every visible visual element must map to the supplied profile packet.
- Avoid generic technology wallpaper; make the image feel like this specific mind has been diagrammed.`;

  return {
    prompt_version: 'visual-dna-prompt-v6-operating-system',
    prompt,
    prompt_hash: hashVisualDNAPrompt(prompt),
    design_reference_version: 'reference-a-b-marcus-nora-v6',
    visual_narrative: visualNarrative,
    visual_operating_system: visualOperatingSystem,
  };
}

export default buildVisualDNAPrompt;
