// questionMap.js - COMPLETE MoreMindMap Scoring Map
// Locked dimension scoring for all 28 frontend questions
// 14 MC single_choice (Q1,Q3,Q5,Q7,Q8,Q9,Q10,Q11,Q13,Q15,Q16,Q19,Q21,Q23)
// 3 ranking (Q6,Q12,Q18)
// 11 written_response (Q2,Q14,Q17,Q20,Q22,Q24,Q25,Q26,Q27,Q28)
// Version: canonical-v2-guarded
// Updated: May 26, 2026

export const QUESTION_MAP = {
  set_1: {
    v1: [
      // Q1 - Initial choice under multiple pressures
      {
        id: 1,
        type: 'mc',
        text: 'You walk into your business earlier than usual, thinking you might get a quiet start to the day. Within minutes, three things collide. A message comes in about a deal that could affect revenue today. A team member pulls you aside and clearly needs attention. You also remember you are already late for a planning session you said you would lead. There is no clean way to do all three at once. What do you do first?',
        answers: [
          { key: 'D', text: 'Pause briefly, take in all three, then move based on what feels most urgent' },
          { key: 'A', text: 'Handle the revenue decision immediately and clear it' },
          { key: 'E', text: 'Address the team member so the situation does not escalate' },
          { key: 'B', text: 'Go straight into the planning session and maintain structure' },
          { key: 'C', text: 'Ask for quick context on all three before deciding' }
        ],
        normalized_dimensions: {
          D: { flex: 1, signal: 1, fidelity: 1, horizon: 1 },      // balanced, adaptive
          A: { velocity: 1, vector: 1, framework: -0.5 },         // speed + command
          E: { signal: 1, leverage: 0.5, flex: 0.5 },             // relational, influence
          B: { framework: 1, fidelity: 0.5, velocity: -0.5 },     // structure over speed
          C: { fidelity: 1, signal: 0.5, flex: 0.5 }              // thorough, relational
        }
      },

      // Q2 - Written response (no scores, passed through)
      {
        id: 2,
        type: 'written',
        text: 'What matters most to you in life right now? Describe in detail: family, relationships, children, career, freedom, money, stability, legacy, purpose, health, impact, personal growth. What are you ultimately trying to build, protect, or become? Where do you want your personal life and work to go over the next 5–10 years? What would a meaningful life actually look like for you if things worked?',
        normalized_dimensions: {}
      },

      // Q3 - Challenge in group setting
      {
        id: 3,
        type: 'mc',
        text: 'You are in a group setting and someone challenges a decision you made. It is not aggressive, but it is direct enough that people notice. The room quiets slightly and attention shifts toward you. What do you do?',
        answers: [
          { key: 'B', text: 'Respond immediately and defend your position' },
          { key: 'D', text: 'Stay composed and ask them to explain their concern' },
          { key: 'A', text: 'Pause and consider whether they might be right' },
          { key: 'E', text: 'Let it pass and address it later in private' },
          { key: 'C', text: 'Redirect the conversation back to the main objective' }
        ],
        normalized_dimensions: {
          B: { vector: 1, velocity: 0.5, flex: -0.5 },           // defensive, command
          D: { signal: 1, fidelity: 0.5, flex: 0.5 },            // relational, thoughtful
          A: { fidelity: 1, signal: 0.5, horizon: 0.5 },         // open, reflective
          E: { flex: 0.5, signal: 0.5, velocity: -0.5 },         // adaptive avoidance
          C: { framework: 0.5, velocity: 0.5, vector: 0.5 }      // control via structure
        }
      },

      // Q4 - Post-decision reflection
      {
        id: 4,
        type: 'mc',
        text: 'You wrap up a deal or project and later realize there was a better way to handle it. The outcome was fine, no one is complaining, but you know it could have been stronger. What do you do?',
        answers: [
          { key: 'A', text: 'Move on quickly and focus forward' },
          { key: 'D', text: 'Go back through it and analyze what you missed' },
          { key: 'C', text: 'Talk it through with someone to get perspective' },
          { key: 'B', text: 'Adjust your approach for next time' },
          { key: 'E', text: 'Let it go unless it becomes a pattern' }
        ],
        normalized_dimensions: {
          A: { velocity: 1, flex: -0.5, fidelity: -0.5 },       // forward momentum, low introspection
          D: { fidelity: 1, horizon: 0.5, framework: 0.5 },     // deep analysis, reflective
          C: { signal: 1, fidelity: 0.5, leverage: 0.5 },       // seek perspective, relational
          B: { flex: 1, fidelity: 0.5, horizon: 0.5 },          // adaptive, learning
          E: { velocity: 0.5, flex: 0.5, fidelity: -0.5 }       // pragmatic, low rumination
        }
      },

      // Q5 - Mid-day pivot under pressure
      {
        id: 5,
        type: 'mc',
        text: 'You start your day with a clear plan, but by midday everything shifts. New priorities show up, timelines compress, and the pressure increases. What looked structured now feels fluid and unpredictable. What do you naturally do?',
        answers: [
          { key: 'E', text: 'Adapt in real time and shift with what is happening' },
          { key: 'A', text: 'Cut anything non-essential and protect core priorities' },
          { key: 'C', text: 'Stop and reorganize before continuing' },
          { key: 'B', text: 'Push harder and try to keep everything moving' },
          { key: 'D', text: 'Accept the shift and respond as needed' }
        ],
        normalized_dimensions: {
          E: { flex: 1, velocity: 0.5, framework: -0.5 },       // adaptive, fast-flowing
          A: { vector: 1, framework: 0.5, fidelity: 0.5 },      // decisive prioritization
          C: { framework: 1, fidelity: 0.5, flex: -0.5 },       // structured re-approach
          B: { velocity: 1, vector: 0.5, flex: -0.5 },          // push harder, accelerate
          D: { flex: 0.5, signal: 0.5, velocity: 0.5 }          // balanced responsiveness
        }
      },

      // Q6 - Ranking: What matters MOST in high-pressure moment
      {
        id: 6,
        type: 'ranking',
        text: 'You are stepping into a situation where multiple things matter at once. There is pressure, limited time, and people are looking to you for direction. There is no perfect answer, only trade-offs. Rank what matters MOST in that moment:',
        answers: [
          { key: '1', text: 'Getting to a clear result quickly' },
          { key: '2', text: 'Keeping people aligned and stable' },
          { key: '3', text: 'Understanding the situation fully before acting' },
          { key: '4', text: 'Maintaining control of how things unfold' }
        ],
        normalized_dimensions: {
          '1': { velocity: 1.5, vector: 0.5, framework: -0.5 },        // speed first (rank 1)
          '2': { signal: 1.5, flex: 0.5, horizon: 0.5 },              // people/stability (rank 2)
          '3': { fidelity: 1.5, horizon: 0.5, framework: 0.5 },       // understanding (rank 3)
          '4': { vector: 1.5, framework: 0.5, flex: -0.5 }            // control (rank 4)
        }
      },

      // Q7 - Social entry (unfamiliar room)
      {
        id: 7,
        type: 'mc',
        text: 'You walk into a room where you do not know anyone. People are already in conversation, and you are not sure how the dynamics work yet. It is not uncomfortable, but it is unfamiliar. What do you do first?',
        answers: [
          { key: 'D', text: 'Observe and understand how people are interacting' },
          { key: 'A', text: 'Introduce yourself and establish your presence' },
          { key: 'C', text: 'Start one conversation and build from there' },
          { key: 'E', text: 'Look for patterns in how the room operates' },
          { key: 'B', text: 'Wait for a natural opening' }
        ],
        normalized_dimensions: {
          D: { signal: 1, fidelity: 0.5, flex: 0.5 },           // observe people
          A: { vector: 1, velocity: 0.5, leverage: 0.5 },       // assert presence
          C: { signal: 1, leverage: 0.5, flex: 0.5 },           // relational building
          E: { framework: 0.5, fidelity: 0.5, horizon: 0.5 },   // pattern seeking
          B: { flex: 0.5, signal: 0.5, velocity: -0.5 }         // passive wait
        }
      },

      // Q8 - Mid-conversation misalignment
      {
        id: 8,
        type: 'mc',
        text: 'You are midway through a conversation and can feel the other person is not fully aligned. They are polite, but something is off. There is a pause where either of you could shift direction. What do you do?',
        answers: [
          { key: 'B', text: 'Adjust your approach and try to bring them along' },
          { key: 'E', text: 'Let the silence sit and see if they reveal more' },
          { key: 'A', text: 'Push forward and maintain control' },
          { key: 'D', text: 'Address it directly and ask what they are thinking' },
          { key: 'C', text: 'Step back and reassess your own position' }
        ],
        normalized_dimensions: {
          B: { flex: 1, signal: 0.5, leverage: 0.5 },           // adjust, influence
          E: { signal: 1, flex: 0.5, fidelity: 0.5 },           // listen, patient
          A: { vector: 1, velocity: 0.5, flex: -0.5 },          // push, maintain
          D: { signal: 1, fidelity: 0.5, flex: 0.5 },           // direct, clear
          C: { fidelity: 1, horizon: 0.5, flex: 0.5 }           // reassess, reflect
        }
      },

      // Q9 - Undefined opportunity
      {
        id: 9,
        type: 'mc',
        text: 'You are offered an opportunity that could be meaningful, but it is loosely defined. There is upside, but also uncertainty. No one is giving you a clear path forward. What do you do?',
        answers: [
          { key: 'A', text: 'Ask questions and try to define it first' },
          { key: 'D', text: 'Move toward it and figure it out as you go' },
          { key: 'C', text: 'Think about how it fits long-term' },
          { key: 'B', text: 'Weigh the risks carefully before acting' }
        ],
        normalized_dimensions: {
          A: { fidelity: 1, signal: 0.5, framework: 0.5 },      // clarify
          D: { velocity: 1, flex: 1, horizon: -0.5 },           // move fast, figure it
          C: { horizon: 1, fidelity: 0.5, framework: 0.5 },     // strategic fit
          B: { fidelity: 1, framework: 0.5, velocity: -0.5 }    // risk assessment
        }
      },

      // Q10 - Team underperformance
      {
        id: 10,
        type: 'mc',
        text: 'You are responsible for a result, and the people around you are not performing at the level you expect. You can feel the gap, and time matters more than comfort. What do you do?',
        answers: [
          { key: 'C', text: 'Step in and raise the standard immediately' },
          { key: 'A', text: 'Talk to someone to understand what is happening' },
          { key: 'D', text: 'Change the structure so performance improves' },
          { key: 'B', text: 'Adjust expectations and move forward anyway' },
          { key: 'E', text: 'Focus on your own output and let others adjust' }
        ],
        normalized_dimensions: {
          C: { vector: 1, velocity: 0.5, framework: 0.5 },      // direct action
          A: { signal: 1, fidelity: 0.5, leverage: 0.5 },       // understand people
          D: { framework: 1, fidelity: 0.5, flex: 0.5 },        // structural fix
          B: { flex: 1, signal: 0.5, velocity: -0.5 },          // adapt expectations
          E: { velocity: 0.5, vector: 0.5, signal: -0.5 }       // individual drive
        }
      },

      // Q11 - Family trip hotel problem
      {
        id: 11,
        type: 'mc',
        text: 'You are on a family trip you have been looking forward to. When you arrive, the hotel room is not what you booked. The front desk is not helpful, and your kids are already asking to go to the pool. Everyone is looking to you for direction. What do you do first?',
        answers: [
          { key: 'B', text: 'Address the issue directly and push for a solution' },
          { key: 'E', text: 'Take care of your family first and revisit the problem' },
          { key: 'C', text: 'Accept it for now and adjust expectations' },
          { key: 'A', text: 'Ask questions to understand what happened' },
          { key: 'D', text: 'Pause and decide if escalation is worth it' }
        ],
        normalized_dimensions: {
          B: { vector: 1, velocity: 0.5, leverage: 0.5 },       // push, command
          E: { signal: 1, flex: 0.5, vector: -0.5 },            // family over problem
          C: { flex: 1, signal: 0.5, velocity: -0.5 },          // accept, adapt
          A: { fidelity: 0.5, signal: 0.5, framework: 0.5 },    // understand first
          D: { fidelity: 1, horizon: 0.5, flex: 0.5 }           // calculate worth
        }
      },

      // Q12 - Ranking: Sales/client conversation priorities
      {
        id: 12,
        type: 'ranking',
        text: 'You are in a conversation with a potential client. The opportunity is real, but the path forward is not fully clear. You can feel that how you handle this moment matters. Rank what you prioritize MOST:',
        answers: [
          { key: '1', text: 'Moving the conversation toward a decision' },
          { key: '2', text: 'Building trust and connection' },
          { key: '3', text: 'Fully understanding their situation' },
          { key: '4', text: 'Positioning yourself effectively' }
        ],
        normalized_dimensions: {
          '1': { velocity: 1.5, vector: 0.5, leverage: 0.5 },     // drive to close (rank 1)
          '2': { signal: 1.5, leverage: 0.5, flex: 0.5 },        // relational first (rank 2)
          '3': { fidelity: 1.5, signal: 0.5, framework: 0.5 },   // understand (rank 3)
          '4': { leverage: 1.5, vector: 0.5, fidelity: -0.5 }    // positioning (rank 4)
        }
      },

      // Q13 - Choose two: Dinner party positioning
      {
        id: 13,
        type: 'mc',
        text: 'You are at a private dinner with people you do not know well. The conversation is intelligent, but there is an underlying sense of positioning. People are listening, but also subtly competing. (Choose TWO)',
        answers: [
          { key: 'F', text: 'Stay quiet at first and read the room' },
          { key: 'A', text: 'Speak early to establish your presence' },
          { key: 'D', text: 'Focus on building one or two strong connections' },
          { key: 'B', text: 'Ask a question that shifts the conversation' },
          { key: 'E', text: 'Wait until you have something meaningful to say' },
          { key: 'C', text: 'Observe how people interact before engaging' }
        ],
        normalized_dimensions: {
          F: { signal: 0.8, fidelity: 0.5, flex: 0.5 },         // read room
          A: { vector: 0.8, velocity: 0.5, leverage: 0.5 },     // assert presence
          D: { signal: 0.8, leverage: 0.5, flex: 0.5 },         // connection
          B: { leverage: 0.8, fidelity: 0.5, signal: 0.5 },     // shift dynamic
          E: { fidelity: 0.8, signal: 0.5, horizon: 0.5 },      // meaningful
          C: { framework: 0.5, fidelity: 0.5, signal: 0.5 }     // observe pattern
        }
      },

      // Q14 - Written response (no scores)
      {
        id: 14,
        type: 'written',
        text: 'Think about a recent situation where something did not go your way. It could be a deal, a conversation, or a decision that did not land how you expected. Where were you, what happened, and what did you do next? (3–5 sentences)',
        normalized_dimensions: {}
      },

      // Q15 - Decision under incomplete information
      {
        id: 15,
        type: 'mc',
        text: 'You are in a situation where a decision needs to be made, but you do not have all the information you want. Waiting would help, but it would slow everything down. What do you do?',
        answers: [
          { key: 'C', text: 'Make the best decision you can and move forward' },
          { key: 'A', text: 'Delay until you can get more clarity' },
          { key: 'D', text: 'Trust instinct and act quickly' },
          { key: 'B', text: 'Look for patterns or past experience to guide you' }
        ],
        normalized_dimensions: {
          C: { velocity: 1, flex: 0.5, fidelity: 0.5 },        // decide, move
          A: { fidelity: 1, framework: 0.5, velocity: -0.5 },  // wait for clarity
          D: { velocity: 1, vector: 0.5, horizon: 0.5 },       // trust, act
          B: { framework: 0.5, horizon: 0.5, fidelity: 0.5 }   // pattern match
        }
      },

      // Q16 - Unstructured time
      {
        id: 16,
        type: 'mc',
        text: 'You wake up on a day where nothing is scheduled. No meetings, no obligations, no expectations. The time is completely yours. What do you naturally do?',
        answers: [
          { key: 'A', text: 'Find something productive to work on' },
          { key: 'D', text: 'Let the day unfold without structure' },
          { key: 'B', text: 'Plan how to use the time effectively' },
          { key: 'C', text: 'Reach out or spend time with people' }
        ],
        normalized_dimensions: {
          A: { velocity: 1, vector: 0.5, horizon: -0.5 },      // productive push
          D: { flex: 1, signal: 0.5, velocity: -0.5 },         // flow, unstructured
          B: { framework: 1, fidelity: 0.5, velocity: -0.5 },  // plan first
          C: { signal: 1, leverage: 0.5, flex: 0.5 }           // relational, people
        }
      },

      // Q17 - Written response (no scores)
      {
        id: 17,
        type: 'written',
        text: 'When things get intense, deadlines are tight, or expectations are high, how would someone who knows you well describe you? (Be honest. 3–5 sentences)',
        normalized_dimensions: {}
      },

      // Q18 - Ranking: Team underperformance response priority
      {
        id: 18,
        type: 'ranking',
        text: 'You are leading a group and performance is not where it needs to be. Expectations are rising, and time is becoming a factor. You can feel pressure building. Rank what you focus on first:',
        answers: [
          { key: '1', text: 'Raising the standard immediately' },
          { key: '2', text: 'Understanding what is causing the gap' },
          { key: '3', text: 'Adjusting structure or roles' },
          { key: '4', text: 'Maintaining morale and stability' }
        ],
        normalized_dimensions: {
          '1': { vector: 1.5, velocity: 0.5, flex: -0.5 },       // command (rank 1)
          '2': { signal: 1.5, fidelity: 0.5, framework: 0.5 },   // understand (rank 2)
          '3': { framework: 1.5, fidelity: 0.5, signal: -0.5 },  // structure (rank 3)
          '4': { signal: 1.5, flex: 0.5, horizon: 0.5 }          // stability (rank 4)
        }
      },

      // Q19 - Different pace/communication style
      {
        id: 19,
        type: 'mc',
        text: 'You are working with someone whose pace and communication style feel very different from yours. It starts to affect progress, even if nothing is openly wrong. What do you do?',
        answers: [
          { key: 'B', text: 'Adjust your approach to work better with them' },
          { key: 'A', text: 'Address the difference directly' },
          { key: 'D', text: 'Work around it without making it a focus' },
          { key: 'E', text: 'Stay consistent and expect them to adjust' },
          { key: 'C', text: 'Limit interaction and focus on your role' }
        ],
        normalized_dimensions: {
          B: { flex: 1, signal: 0.5, leverage: 0.5 },          // adapt
          A: { vector: 1, signal: 0.5, fidelity: 0.5 },        // direct
          D: { flex: 0.5, velocity: 0.5, signal: -0.5 },       // work around
          E: { vector: 0.5, framework: 0.5, flex: -0.5 },      // consistent, rigid
          C: { velocity: 0.5, flex: 0.5, signal: -0.5 }        // isolate
        }
      },

      // Q20 - Written response (no scores)
      {
        id: 20,
        type: 'written',
        text: 'Describe a time when you had to make a decision without having all the information you wanted. What did you do, and how did you feel about it after? (3–5 sentences)',
        normalized_dimensions: {}
      },

      // Q21 - Solo reflection time (driving)
      {
        id: 21,
        type: 'mc',
        text: 'You are driving alone with no music, no calls, and nowhere urgent to be. Your attention is completely open. What naturally happens?',
        answers: [
          { key: 'A', text: 'You start thinking ahead or solving problems' },
          { key: 'C', text: 'You replay past conversations' },
          { key: 'D', text: 'Your mind wanders freely' },
          { key: 'B', text: 'You begin organizing or planning something' }
        ],
        normalized_dimensions: {
          A: { horizon: 1, vector: 0.5, flex: -0.5 },          // forward-thinking
          C: { signal: 1, fidelity: 0.5, flex: -0.5 },         // relational rumination
          D: { flex: 1, signal: 0.5, framework: -0.5 },        // open, wandering
          B: { framework: 1, fidelity: 0.5, horizon: -0.5 }    // organize, plan
        }
      },

      // Q22 - Written response (no scores)
      {
        id: 22,
        type: 'written',
        text: 'You are leading people in some capacity. Think about how you actually show up, not how you would like to. On a scale from 1 to 10, how would you rate yourself as a leader, and why? (Be specific. 3–5 sentences)',
        normalized_dimensions: {}
      },

      // Q23 - Failed conversation recovery
      {
        id: 23,
        type: 'mc',
        text: 'You are in a conversation that is not going well. The other person is not responding how you expected, and the interaction feels slightly off. What do you do?',
        answers: [
          { key: 'D', text: 'Change your approach and try something different' },
          { key: 'A', text: 'Push forward and maintain control' },
          { key: 'C', text: 'Slow down and try to understand their perspective' },
          { key: 'B', text: 'Step back and reset the interaction' },
          { key: 'E', text: 'End it and revisit later' }
        ],
        normalized_dimensions: {
          D: { flex: 1, signal: 0.5, velocity: 0.5 },          // pivot
          A: { vector: 1, velocity: 0.5, flex: -0.5 },         // maintain control
          C: { signal: 1, fidelity: 0.5, flex: 0.5 },          // understand
          B: { flex: 1, framework: 0.5, signal: 0.5 },         // reset
          E: { flex: 0.5, velocity: 0.5, signal: -0.5 }        // defer
        }
      },

      // Q24 - Written response (no scores)
      {
        id: 24,
        type: 'written',
        text: 'When momentum stalls, pressure rises, or people resist your direction, what do you usually do first? Describe what frustrates you most, what kinds of people energize or drain you, what you avoid dealing with longer than you should, and what pattern you keep repeating even though you know it slows you down. Do not worry about sounding impressive, strategic, or self-aware. Write naturally and answer the way you actually think about these situations in real life.',
        normalized_dimensions: {}
      },

      // Q25 - Written response (no scores)
      {
        id: 25,
        type: 'written',
        text: 'When someone misunderstands your intentions, how do you usually respond?',
        normalized_dimensions: {}
      },

      // Q26 - Written response (no scores)
      {
        id: 26,
        type: 'written',
        text: 'When working on or inside your business, whether independently or with a team, what role do you naturally take on, and where does tension usually appear?',
        normalized_dimensions: {}
      },

      // Q27 - Written response (no scores)
      {
        id: 27,
        type: 'written',
        text: 'What are you trying to build long-term, and what values drive the way you operate?',
        normalized_dimensions: {}
      },

      // Q28 - Written response (no scores)
      {
        id: 28,
        type: 'written',
        text: 'What currently keeps your life or work organized, and where do you think future strain or scaling problems could appear?',
        normalized_dimensions: {}
      }
    ]
  }
};

// Validation
export const VALIDATION = {
  version: 'set_1_v1',
  createdAt: '2026-05-09',
  updatedAt: '2026-05-26',
  questionCount: 28,
  mcQuestionCount: 17,  // 14 single_choice + 3 ranking
  writtenQuestionCount: 11,
  dimensionsRequired: ['vector', 'signal', 'fidelity', 'velocity', 'leverage', 'flex', 'framework', 'horizon']
};

export default QUESTION_MAP;
