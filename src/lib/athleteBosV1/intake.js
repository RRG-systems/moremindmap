// Founder-review candidate for the New BOS parity rebuild. This is still a
// synthetic evidence-elicitation contract, not a psychometrically validated
// youth assessment.
export const INTAKE_VERSION = 'athlete-intake-v1.21-new-bos-parity-20260905';
export const MISSINGNESS = Object.freeze({
  UNKNOWN: "I don't know yet", NOT_EXPERIENCED: "I haven't experienced this",
  NOT_APPLICABLE: 'Not applicable', DECLINED: "I'd rather not answer", DEFERRED: 'Save for later',
});
const question = (id, title, text, options = null, extra = {}) => Object.freeze({ id, title, text, kind: options ? 'structured' : 'narrative', options, ...extra });
export const EVENT_QUESTION_IDS = Object.freeze(['C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14']);
export const QUESTIONS = Object.freeze([
  question('C01', 'Your life ahead', 'When you think about your future, what do you dream about doing or becoming — in sport and in life beyond sport?', null, { adultText: 'When you picture the life you want to build, what matters most to you — in sport, school or work, relationships, and who you want to become?', helper: "You don't need a fixed plan. ‘I don't know yet’ is a real answer." }),
  question('C02', 'What you want from sport now', 'What do you want from your sport right now, and why does that matter to you?'),
  question('C03', 'Whose goal is it?', 'Thinking about the sport goal you just described, whose goal does it feel like?', ['Mine', "Mine and someone else's", "Mostly someone else's", "I haven't chosen a goal", "I'm not sure", 'Prefer not to say'], { emptyText: 'Have you chosen a sport goal of your own?', emptyOptions: ['Yes', 'Not yet', 'Unsure', 'Prefer not to say'] }),
  question('C04', 'Getting ready', 'Think of a practice or competition that mattered to you. What did you do to get ready, and which parts were your choice?', null, { helper: 'You can include practical, physical or mental preparation. One example is enough; private health details are not needed.' }),
  question('C05', 'A plan meeting reality', 'Tell me about something you meant to follow through on recently. What happened when it was time to do it?'),
  question('C06', 'Learning something new', 'Tell me about a time you were learning something unfamiliar. What helped you understand it, and what was still difficult?'),
  question('C07', 'Feedback in practice', 'Tell me about some feedback you received. What did you make of it, and what happened next?'),
  question('C08', 'When it mattered', 'Think of a moment when you felt under pressure. What, if anything, changed in what you noticed or how you chose what to do next?'),
  question('C09', 'Sport and the rest of your week', 'Tell me about a week when sport and school — or other responsibilities — were both demanding. How did you decide what got your time and attention, and how did it go?'),
  question('C10', 'Leading yourself', 'Tell me about a time you chose what to do without a coach, parent or teammate telling you. What did you do?'),
  question('C11', 'Working something out with someone', 'Tell me about a time you worked something out with another person. What did you do, what did they actually say or do, and how did it go?'),
  question('C12', 'After something was difficult', "Think of a time something was hard or didn't go your way. What did you do next, and what helped — if anything?"),
  question('C13', 'Keep what works', 'What is working for you that you would like to keep? Tell me about a recent time it helped. If that same strength or habit has ever got in your way, you can include that too.'),
  question('C14', 'Different this time', "Has something changed recently, or have you had a moment that doesn't fit the usual story about you? Tell me about it."),
  question('C15', 'Conditions around one moment', 'For the moment you want MORE to understand best, were the conditions usual for you?', ['Mostly usual', 'Something was different', 'Too new to compare', "I don't know", 'Prefer not to say'], { conditionOptions: ['people or instructions', 'time or place', 'equipment or access', 'school, work or other demands', 'how I felt', 'something else'] }),
  question('C16', 'Confidence in one actual task', 'For the task you named, how sure do you feel about doing it right now?', ['Very sure', 'Fairly sure', 'Unsure', 'Not very sure', "I haven't tried it", 'Prefer not to say']),
  question('C17', 'Room right now', 'How much room do you have for anything extra right now?', ['None', 'A little', 'Some', 'Plenty', 'It changes', "I'm not sure", 'Prefer not to say']),
  question('C18', 'Support and limits to respect', 'Is there any support you need, or a limit MORE should respect, when thinking about next steps?', ['practical help or access', 'instructions from a qualified professional', 'time or other responsibilities', "someone else's decision", 'something else', 'nothing I know of', 'unsure', 'prefer not to say'], { multiple: true }),
  question('C19', 'What people may miss', 'What is something people sometimes get wrong about you — or a label that does not fit? What would they understand better if they saw the situation from your side?'),
  question('C20', 'Choose the useful next step', 'What would be useful to you next?', ['Understand this better', 'Explore a possible way forward', 'Think about one small next step', 'Keep what is working', 'Pause here', "I'm not sure"]),
]);
export function wording(q, ageBand, answers = {}) {
  if (q.id === 'C01' && ageBand === '18–20') return q.adultText;
  if (q.id === 'C03' && !answers.C02?.text) return q.emptyText;
  return q.text;
}
export function optionsFor(q, answers) { return q.id === 'C03' && !answers.C02?.text ? q.emptyOptions : q.options; }
export function priorEventChoices(questionId, answers = {}) {
  const current = EVENT_QUESTION_IDS.indexOf(questionId);
  if (current < 0) return [];
  return EVENT_QUESTION_IDS.slice(0, current)
    .filter(id => String(answers[id]?.text || '').trim())
    .map(id => ({ id, label: String(answers[id].text).trim() }));
}
// Retained for read compatibility with historical v1.20 draft envelopes. New
// v1.21 intake uses C19 as direct athlete evidence and validates generated
// claims in the reading itself.
export function factualReview(answers) { return answers.C02?.text ? `You said: “${answers.C02.text}”` : 'There isn’t enough to describe a pattern yet. You can correct a fact here.'; }
