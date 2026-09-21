export const VERSION = 'youth-bos-v2.0.0';
export const MODEL = 'gpt-5.6-sol';
export const VECTORS = [
  { id: 'command', legacy: 'Vector', title: 'Direction', low: 'Make room for others', high: 'Choose a direction', meaning: 'How readily you choose a path and take ownership.' },
  { id: 'tempo', legacy: 'Velocity', title: 'Pace', low: 'Think before acting', high: 'Think through action', meaning: 'How you move between thinking, speaking and doing.' },
  { id: 'relational_awareness', legacy: 'Signal', title: 'People', low: 'Look for clear messages', high: 'Notice social signals', meaning: 'What you notice and check when you are with other people.' },
  { id: 'precision', legacy: 'Fidelity', title: 'Detail', low: 'Get the essentials right', high: 'Check the fine details', meaning: 'How much detail and checking you naturally bring to a task.' },
  { id: 'leverage', legacy: 'Leverage', title: 'Resourcefulness', low: 'Keep it in your hands', high: 'Bring help and tools together', meaning: 'How you use your own effort, other people and useful tools.' },
  { id: 'adaptability', legacy: 'Flex', title: 'Change', low: 'Stay with a working approach', high: 'Try another approach', meaning: 'How readily you revise an approach when something changes.' },
  { id: 'structure', legacy: 'Framework', title: 'Structure', low: 'Leave room to improvise', high: 'Make a clear plan', meaning: 'How much planning and routine you prefer around you.' },
  { id: 'perspective', legacy: 'Horizon', title: 'Outlook', low: 'Start with what is next', high: 'Think several steps ahead', meaning: 'How near and distant possibilities enter your decisions.' },
];
export const CHAPTERS = [
  { id: 'identity', title: 'What makes you, you', mission: 'Values, belonging, autonomy, motives and interacting tensions. Add depth beyond the opening portrait.' },
  { id: 'mind', title: 'How your mind works', mission: 'Attention, curiosity, learning, decisions, uncertainty and problem solving. Preference does not establish ability or a fixed learning style.' },
  { id: 'communication', title: 'How you communicate', mission: 'Speaking, listening, questions, feedback, intended meaning and possible misunderstandings. Separate reported reactions from possible reactions.' },
  { id: 'connection', title: 'How you connect and belong', mission: 'Friendship, trust, social energy, boundaries, disagreement and differences between familiar and unfamiliar groups.' },
  { id: 'effort', title: 'What brings out your effort', mission: 'Meaning, initiation, commitment, responsibility, structure and follow-through; avoid moral rankings.' },
  { id: 'pressure', title: 'When things get difficult', mission: 'Pressure, mistakes, disappointment, conflict and recovery; show usual versus pressured patterns and context.' },
  { id: 'strengths', title: 'Your strengths, in real life', mission: 'Specific contributions and their conditional costs. Explain combinations, avoid flattering generic lists.' },
  { id: 'thriving', title: 'What helps you thrive', mission: 'Support, freedom, structure, learning, relationships, energy and recovery across everyday life. Practical possibilities without a training or treatment plan.' },
];
export { QUESTIONS, QUESTIONNAIRE_VERSION } from '../questions.js';
