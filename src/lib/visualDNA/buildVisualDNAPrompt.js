import { getVisualDNADesignReference } from './designReferences.js';

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

export function buildVisualDNAPrompt(contextPacket, designReference = getVisualDNADesignReference()) {
  const compactPacket = compactPacketForPrompt(contextPacket);
  const profileName = compactPacket.profile?.person_name || 'this profile';
  const prompt = `Create a Visual DNA image that answers: "What does this mind look like?"

DESIGN REFERENCE A - HOW IT SHOULD FEEL
${stableStringify(designReference.reference_a)}

DESIGN REFERENCE B - WHY THE CONCEPT WORKS
${stableStringify(designReference.reference_b)}

CANONICAL PRODUCTION STANDARD
${stableStringify(designReference.canonical_standard)}

NEGATIVE CONSTRAINTS
${(designReference.negative_constraints || []).map((item) => `- ${item}`).join('\n')}

FULL PROFILE INTELLIGENCE PACKET
${JSON.stringify(compactPacket, null, 2)}

IMAGE INTENT
Visualize the behavioral operating system of ${profileName}. The image should represent the whole profile intelligence stack: Behavioral DNA, executive briefing, contradictions, pressure mechanics, scaling constraint, facilitator guidance, team experience, five futures, and one move.

APPROVED MARCUS/NORA QUALITY BAR
- Finished executive intelligence dashboard, not concept art.
- High-contrast black background with bright neon orange/violet/green/blue signal accents.
- Dense information architecture: profile panel, dimension bars, central operating-system map, risk/environment panels, pressure gauge, one-move panel, and operating-sequence strip.
- Crisp panel boundaries, clean score bars, clear diagram hierarchy, luminous but controlled glow.
- No smoky gray wash, no dim low-contrast overlay, no sparse center-only composition.
- No lone brain/shell/orb. The centerpiece must be a behavioral operating system map with connected modules.
- Use only large readable labels for major concepts. If small text would be unreadable, replace it with bars, icons, ticks, or glyphs.

COMPOSITION RULES
- Do not depict the person physically.
- Build a dark enterprise intelligence system map, not a single symbolic object.
- Use a central Behavioral Operating System architecture as the focal point: stacked engine rings, directional pathways, evidence nodes, and operating layers.
- Surround it with evidence-derived widgets: profile identity, ranked dimension bars, primary engine, secondary engine, tension pair, pressure shift, role fit, wrong-seat risk, best environment, worst environment, one move, and future trajectory signals.
- Include a bottom or side operating-sequence strip that shows how this person creates value.
- Use neon accent lighting, precise circuit pathways, luminous nodes, and architectural diagram language.
- Keep text minimal, label-like, and readable. Use real short labels only; do not render fake paragraphs or garbled pseudo-text.
- Preserve the Marcus/Nora quality bar: dense executive intelligence dashboard, crisp panel hierarchy, central operating system map, not simplified brain-shell imagery.
- Every visible visual element must map to the supplied profile packet.
- Avoid generic technology wallpaper; make the image feel like this specific mind has been diagrammed.`;

  return {
    prompt_version: 'visual-dna-prompt-v3-canonical-dashboard',
    prompt,
    prompt_hash: hashVisualDNAPrompt(prompt),
    design_reference_version: 'reference-a-b-marcus-nora-v3',
  };
}

export default buildVisualDNAPrompt;
