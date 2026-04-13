/**
 * LOCKED 24-QUESTION ASSESSMENT FOR MORE MINDMAP
 * 
 * Exact wording, order, and answer formats preserved.
 * Anti-gaming variation is intentional.
 * Do not rewrite, reorder, simplify, or standardize.
 */

const MOREMINDMAP_QUESTIONS = [
  {
    id: 1,
    type: "single_choice",
    question: `You walk into your business earlier than usual, thinking you might get a quiet start to the day. Within minutes, three things collide. A message comes in about a deal that could affect revenue today. A team member pulls you aside and clearly needs attention. You also remember you are already late for a planning session you said you would lead. There is no clean way to do all three at once.

What do you do first?`,
    answers: [
      { key: "D", text: "Pause briefly, take in all three, then move based on what feels most urgent" },
      { key: "A", text: "Handle the revenue decision immediately and clear it" },
      { key: "E", text: "Address the team member so the situation does not escalate" },
      { key: "B", text: "Go straight into the planning session and maintain structure" },
      { key: "C", text: "Ask for quick context on all three before deciding" }
    ]
  },
  {
    id: 2,
    type: "single_choice",
    question: `You are sitting in a meeting that was supposed to be productive, but it has turned into a loop. People are repeating the same ideas, no one is making a decision, and energy is slowly dropping. You can tell the room is waiting for someone to shift it, but no one is stepping in.

What do you naturally do?`,
    answers: [
      { key: "C", text: "Let it continue and see if it resolves on its own" },
      { key: "A", text: "Step in and push toward a clear decision" },
      { key: "E", text: "Ask a question that changes the direction of the conversation" },
      { key: "B", text: "Try to align everyone so the group feels heard first" },
      { key: "D", text: "Mentally disengage and wait it out" }
    ]
  },
  {
    id: 3,
    type: "single_choice",
    question: `You are in a group setting and someone challenges a decision you made. It is not aggressive, but it is direct enough that people notice. The room quiets slightly and attention shifts toward you.

What do you do?`,
    answers: [
      { key: "B", text: "Respond immediately and defend your position" },
      { key: "D", text: "Stay composed and ask them to explain their concern" },
      { key: "A", text: "Pause and consider whether they might be right" },
      { key: "E", text: "Let it pass and address it later in private" },
      { key: "C", text: "Redirect the conversation back to the main objective" }
    ]
  },
  {
    id: 4,
    type: "single_choice",
    question: `You wrap up a deal or project and later realize there was a better way to handle it. The outcome was fine, no one is complaining, but you know it could have been stronger.

What do you do?`,
    answers: [
      { key: "A", text: "Move on quickly and focus forward" },
      { key: "D", text: "Go back through it and analyze what you missed" },
      { key: "C", text: "Talk it through with someone to get perspective" },
      { key: "B", text: "Adjust your approach for next time" },
      { key: "E", text: "Let it go unless it becomes a pattern" }
    ]
  },
  {
    id: 5,
    type: "single_choice",
    question: `You start your day with a clear plan, but by midday everything shifts. New priorities show up, timelines compress, and the pressure increases. What looked structured now feels fluid and unpredictable.

What do you naturally do?`,
    answers: [
      { key: "E", text: "Adapt in real time and shift with what is happening" },
      { key: "A", text: "Cut anything non-essential and protect core priorities" },
      { key: "C", text: "Stop and reorganize before continuing" },
      { key: "B", text: "Push harder and try to keep everything moving" },
      { key: "D", text: "Accept the shift and respond as needed" }
    ]
  },
  {
    id: 6,
    type: "ranking",
    question: `You are stepping into a situation where multiple things matter at once. There is pressure, limited time, and people are looking to you for direction. There is no perfect answer, only trade-offs.

Rank what matters MOST in that moment:`,
    answers: [
      { key: "1", text: "Getting to a clear result quickly" },
      { key: "2", text: "Keeping people aligned and stable" },
      { key: "3", text: "Understanding the situation fully before acting" },
      { key: "4", text: "Maintaining control of how things unfold" }
    ]
  },
  {
    id: 7,
    type: "single_choice",
    question: `You walk into a room where you do not know anyone. People are already in conversation, and you are not sure how the dynamics work yet. It is not uncomfortable, but it is unfamiliar.

What do you do first?`,
    answers: [
      { key: "D", text: "Observe and understand how people are interacting" },
      { key: "A", text: "Introduce yourself and establish your presence" },
      { key: "C", text: "Start one conversation and build from there" },
      { key: "E", text: "Look for patterns in how the room operates" },
      { key: "B", text: "Wait for a natural opening" }
    ]
  },
  {
    id: 8,
    type: "single_choice",
    question: `You are midway through a conversation and can feel the other person is not fully aligned. They are polite, but something is off. There is a pause where either of you could shift direction.

What do you do?`,
    answers: [
      { key: "B", text: "Adjust your approach and try to bring them along" },
      { key: "E", text: "Let the silence sit and see if they reveal more" },
      { key: "A", text: "Push forward and maintain control" },
      { key: "D", text: "Address it directly and ask what they are thinking" },
      { key: "C", text: "Step back and reassess your own position" }
    ]
  },
  {
    id: 9,
    type: "single_choice",
    question: `You are offered an opportunity that could be meaningful, but it is loosely defined. There is upside, but also uncertainty. No one is giving you a clear path forward.

What do you do?`,
    answers: [
      { key: "A", text: "Ask questions and try to define it first" },
      { key: "D", text: "Move toward it and figure it out as you go" },
      { key: "C", text: "Think about how it fits long-term" },
      { key: "B", text: "Weigh the risks carefully before acting" }
    ]
  },
  {
    id: 10,
    type: "single_choice",
    question: `You are responsible for a result, and the people around you are not performing at the level you expect. You can feel the gap, and time matters more than comfort.

What do you do?`,
    answers: [
      { key: "C", text: "Step in and raise the standard immediately" },
      { key: "A", text: "Talk to someone to understand what is happening" },
      { key: "D", text: "Change the structure so performance improves" },
      { key: "B", text: "Adjust expectations and move forward anyway" },
      { key: "E", text: "Focus on your own output and let others adjust" }
    ]
  },
  {
    id: 11,
    type: "single_choice",
    question: `You are on a family trip you have been looking forward to. When you arrive, the hotel room is not what you booked. The front desk is not helpful, and your kids are already asking to go to the pool. Everyone is looking to you for direction.

What do you do first?`,
    answers: [
      { key: "B", text: "Address the issue directly and push for a solution" },
      { key: "E", text: "Take care of your family first and revisit the problem" },
      { key: "C", text: "Accept it for now and adjust expectations" },
      { key: "A", text: "Ask questions to understand what happened" },
      { key: "D", text: "Pause and decide if escalation is worth it" }
    ]
  },
  {
    id: 12,
    type: "ranking",
    question: `You are in a conversation with a potential client. The opportunity is real, but the path forward is not fully clear. You can feel that how you handle this moment matters.

Rank what you prioritize MOST:`,
    answers: [
      { key: "1", text: "Moving the conversation toward a decision" },
      { key: "2", text: "Building trust and connection" },
      { key: "3", text: "Fully understanding their situation" },
      { key: "4", text: "Positioning yourself effectively" }
    ]
  },
  {
    id: 13,
    type: "choose_two",
    question: `You are at a private dinner with people you do not know well. The conversation is intelligent, but there is an underlying sense of positioning. People are listening, but also subtly competing.

(Choose TWO)`,
    answers: [
      { key: "F", text: "Stay quiet at first and read the room" },
      { key: "A", text: "Speak early to establish your presence" },
      { key: "D", text: "Focus on building one or two strong connections" },
      { key: "B", text: "Ask a question that shifts the conversation" },
      { key: "E", text: "Wait until you have something meaningful to say" },
      { key: "C", text: "Observe how people interact before engaging" }
    ]
  },
  {
    id: 14,
    type: "written_response",
    question: `Think about a recent situation where something did not go your way. It could be a deal, a conversation, or a decision that did not land how you expected.

Where were you, what happened, and what did you do next?

(3–5 sentences)`,
    answers: []
  },
  {
    id: 15,
    type: "single_choice",
    question: `You are in a situation where a decision needs to be made, but you do not have all the information you want. Waiting would help, but it would slow everything down.

What do you do?`,
    answers: [
      { key: "C", text: "Make the best decision you can and move forward" },
      { key: "A", text: "Delay until you can get more clarity" },
      { key: "D", text: "Trust instinct and act quickly" },
      { key: "B", text: "Look for patterns or past experience to guide you" }
    ]
  },
  {
    id: 16,
    type: "single_choice",
    question: `You wake up on a day where nothing is scheduled. No meetings, no obligations, no expectations. The time is completely yours.

What do you naturally do?`,
    answers: [
      { key: "A", text: "Find something productive to work on" },
      { key: "D", text: "Let the day unfold without structure" },
      { key: "B", text: "Plan how to use the time effectively" },
      { key: "C", text: "Reach out or spend time with people" }
    ]
  },
  {
    id: 17,
    type: "written_response",
    question: `When things get intense, deadlines are tight, or expectations are high, how would someone who knows you well describe you?

(Be honest. 3–5 sentences)`,
    answers: []
  },
  {
    id: 18,
    type: "ranking",
    question: `You are leading a group and performance is not where it needs to be. Expectations are rising, and time is becoming a factor. You can feel pressure building.

Rank what you focus on first:`,
    answers: [
      { key: "1", text: "Raising the standard immediately" },
      { key: "2", text: "Understanding what is causing the gap" },
      { key: "3", text: "Adjusting structure or roles" },
      { key: "4", text: "Maintaining morale and stability" }
    ]
  },
  {
    id: 19,
    type: "single_choice",
    question: `You are working with someone whose pace and communication style feel very different from yours. It starts to affect progress, even if nothing is openly wrong.

What do you do?`,
    answers: [
      { key: "B", text: "Adjust your approach to work better with them" },
      { key: "A", text: "Address the difference directly" },
      { key: "D", text: "Work around it without making it a focus" },
      { key: "E", text: "Stay consistent and expect them to adjust" },
      { key: "C", text: "Limit interaction and focus on your role" }
    ]
  },
  {
    id: 20,
    type: "written_response",
    question: `Describe a time when you had to make a decision without having all the information you wanted.

What did you do, and how did you feel about it after?

(3–5 sentences)`,
    answers: []
  },
  {
    id: 21,
    type: "single_choice",
    question: `You are driving alone with no music, no calls, and nowhere urgent to be. Your attention is completely open.

What naturally happens?`,
    answers: [
      { key: "A", text: "You start thinking ahead or solving problems" },
      { key: "C", text: "You replay past conversations" },
      { key: "D", text: "Your mind wanders freely" },
      { key: "B", text: "You begin organizing or planning something" }
    ]
  },
  {
    id: 22,
    type: "written_response",
    question: `You are leading people in some capacity. Think about how you actually show up, not how you would like to.

On a scale from 1 to 10, how would you rate yourself as a leader, and why?

(Be specific. 3–5 sentences)`,
    answers: []
  },
  {
    id: 23,
    type: "single_choice",
    question: `You are in a conversation that is not going well. The other person is not responding how you expected, and the interaction feels slightly off.

What do you do?`,
    answers: [
      { key: "D", text: "Change your approach and try something different" },
      { key: "A", text: "Push forward and maintain control" },
      { key: "C", text: "Slow down and try to understand their perspective" },
      { key: "B", text: "Step back and reset the interaction" },
      { key: "E", text: "End it and revisit later" }
    ]
  },
  {
    id: 24,
    type: "written_response",
    question: `Think about how people who interact with you regularly would describe you — not in a formal setting, but in real conversations when you're not in the room.

Describe what they would likely say in four areas:
- what they rely on you for
- what they get frustrated with
- what they tend to expect from you in stressful situations
- what tends to trigger tension, pushback, or conflict with you

Be specific. Use real patterns, not general traits.

Do not describe how you want to be seen. Describe how you are actually experienced by others.`,
    answers: []
  }
];

export default MOREMINDMAP_QUESTIONS;
