export const VISUAL_DNA_DESIGN_REFERENCE_A = {
  name: 'MORE MindMap / LDE visual universe',
  role: 'Defines the visual language, not the layout.',
  principles: [
    'dark enterprise intelligence environment',
    'neon accent lighting with restrained glow',
    'system maps, operating models, and architectural diagrams',
    'dense but legible intelligence dashboard composition',
    'network structures, signal pathways, and decision architecture',
    'premium technical atmosphere without fantasy or portraiture',
  ],
};

export const VISUAL_DNA_DESIGN_REFERENCE_B = {
  name: 'Behavioral Operating System prototype',
  role: 'Defines why the concept works, not a template to copy.',
  principles: [
    'one central behavioral operating system focus',
    'surrounding intelligence widgets that explain the system',
    'profile-to-visual translation through engines, risks, tensions, and environment fit',
    'clear hierarchy between primary engine, constraints, pressure behavior, and one move',
    'information density that feels earned from profile evidence',
    'visualizes the mind as an operating architecture, not a person',
  ],
};

export const VISUAL_DNA_CANONICAL_STANDARD = {
  name: 'Marcus Vale / Nora Bell approved Visual DNA standard',
  role: 'Defines the approved production quality bar and composition family.',
  principles: [
    'wide 3:2 or 16:9 enterprise dashboard composition, not a poster or single-object illustration',
    'central Behavioral Operating System map with stacked engine architecture',
    'surrounding intelligence widgets for profile identity, ranked dimensions, pressure behavior, environment fit, wrong-seat risk, and one move',
    'dense but organized information architecture with crisp labels and visual hierarchy',
    'deep black technical background with bright neon orange, violet, green, and blue accents used as system signals',
    'circuit pathways, luminous nodes, panel outlines, score bars, gauges, and operating-sequence diagrams',
    'finished presentation-quality infographic with strong contrast, readable panel hierarchy, and no foggy gray wash',
    'large readable text only for major labels; smaller details should become clean bars, icons, and glyphs instead of fake words',
    'premium executive intelligence aesthetic; no simplified brain shell, generic AI brain, or abstract tech wallpaper',
  ],
};

export function getVisualDNADesignReference() {
  return {
    reference_a: VISUAL_DNA_DESIGN_REFERENCE_A,
    reference_b: VISUAL_DNA_DESIGN_REFERENCE_B,
    canonical_standard: VISUAL_DNA_CANONICAL_STANDARD,
    negative_constraints: [
      'do not copy either reference layout exactly',
      'do not depict the person, face, body, or avatar',
      'do not create a generic tech wallpaper',
      'do not create a lone brain, shell, orb, head, face, avatar, or abstract neural object',
      'do not use garbled pseudo-text; use short readable labels or abstract glyphs instead',
      'do not simplify into a sparse image; maintain dashboard-level information density',
      'do not make the image dim, low contrast, smoky, blurred, or gray-on-gray',
      'do not render tiny unreadable paragraphs; convert detail into widgets, bars, icons, and short headings',
      'do not invent unsupported traits',
      'do not use medical, diagnostic, or mystical symbolism',
    ],
  };
}
