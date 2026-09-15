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
const q = (id, prompt, followup, chapters, vectors = []) => ({ id, prompt, followup, chapters, vectors });
export const QUESTIONS = [
  q('Q01', 'What matters most to you outside sport?', 'What would you like your life to make room for, now or later?', ['identity', 'thriving'], ['perspective']),
  q('Q02', 'What do people sometimes get wrong about you?', 'What would they understand better if they heard your side?', ['identity', 'communication', 'connection']),
  q('Q03', 'What makes you want to put effort into something?', 'Tell us about something you chose to do, and something you found hard to care about.', ['identity', 'effort']),
  q('Q04', 'After spending time with other people, how do you usually feel?', 'Is it different with close friends and an unfamiliar group?', ['connection', 'thriving']),
  q('Q05', 'In a group, how do you usually get involved?', 'When do you speak up, choose a direction, or leave room for someone else?', ['communication', 'connection'], ['command', 'tempo']),
  q('Q06', 'When a choice is difficult, how do you decide?', 'Think of a recent choice. What mattered, and how long did you need?', ['mind', 'identity'], ['command', 'tempo', 'perspective']),
  q('Q07', 'How do you approach something new or unfamiliar?', 'What makes you curious, and what makes you hold back?', ['mind', 'effort'], ['adaptability']),
  q('Q08', 'How much of a plan do you like before you start?', 'What happened the last time your plan changed?', ['effort', 'mind'], ['structure', 'adaptability']),
  q('Q09', 'When something gets boring or difficult, what do you do?', 'Describe a time you kept going, changed your approach, or decided to stop.', ['effort', 'strengths'], ['tempo', 'adaptability']),
  q('Q10', 'When you do not understand something, what do you try?', 'What happened the last time? Did another person or a tool help?', ['mind', 'thriving'], ['leverage', 'precision']),
  q('Q11', 'What kind of feedback is easiest for you to use?', 'Describe feedback that helped, and anything that made it harder to take in.', ['communication', 'mind']),
  q('Q12', 'When you are upset, what might someone else notice?', 'What might they miss? Only tell us what you want to share.', ['pressure', 'communication']),
  q('Q13', 'When you disagree with someone, what usually happens?', 'Can you remember an example, including what the other person actually said or did?', ['connection', 'communication', 'pressure'], ['command', 'relational_awareness']),
  q('Q14', 'After a disappointment, what helps you find your footing?', 'What happened on one occasion? It is okay if you are still figuring this out.', ['pressure', 'thriving']),
  q('Q15', 'What do you bring to a group that is useful?', 'Think of school, home, friends or sport. How do you share the work?', ['strengths', 'connection'], ['leverage', 'relational_awareness']),
  q('Q16', 'When can one of your strengths get in your way?', 'How do you notice it, and is there a situation where it works differently?', ['strengths', 'effort'], ['precision']),
  q('Q17', 'What makes you feel respected or fairly treated?', 'How do you try to offer that to someone else?', ['identity', 'connection']),
  q('Q18', 'What changes about you when the pressure rises?', 'Compare an ordinary situation with a difficult one. What was going on around you?', ['pressure', 'mind'], ['tempo', 'precision', 'relational_awareness']),
  q('Q19', 'What drains you, and what helps you feel like yourself again?', 'Is anything about your current week making a difference?', ['thriving', 'effort']),
  q('Q20', 'What else should MORE understand about you?', 'Where have your answers missed the full picture? What are you still figuring out?', ['identity', 'mind', 'communication', 'connection', 'effort', 'pressure', 'strengths', 'thriving']),
];
export const RUBRIC = [
  { id: 'language', title: 'Simple language', weight: .20 },
  { id: 'clarity', title: 'Immediate understanding', weight: .20 },
  { id: 'coverage', title: 'Personality coverage', weight: .25 },
  { id: 'specificity', title: 'Personal recognition', weight: .15 },
  { id: 'usefulness', title: 'Useful everyday insight', weight: .15 },
  { id: 'navigation', title: 'Reading and navigation', weight: .05 },
];
