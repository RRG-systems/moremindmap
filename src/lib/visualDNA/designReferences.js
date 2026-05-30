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

export function getVisualDNADesignReference() {
  return {
    reference_a: VISUAL_DNA_DESIGN_REFERENCE_A,
    reference_b: VISUAL_DNA_DESIGN_REFERENCE_B,
    negative_constraints: [
      'do not copy either reference layout exactly',
      'do not depict the person, face, body, or avatar',
      'do not create a generic tech wallpaper',
      'do not invent unsupported traits',
      'do not use medical, diagnostic, or mystical symbolism',
    ],
  };
}
