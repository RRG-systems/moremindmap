// Founder-approved launch intake. Preserve this version; create a new version for future changes.
export const QUESTIONNAIRE_VERSION = 'youth-bos-v2.1.0';
export const QUESTIONS = [
  {
    "id": "Q01",
    "prompt": "What matters most to you outside sport?",
    "followup": "What would you like more time for, now or in the future?",
    "chapters": [
      "identity",
      "thriving"
    ],
    "vectors": [
      "perspective"
    ]
  },
  {
    "id": "Q02",
    "prompt": "What do people sometimes get wrong about you?",
    "followup": "What would you like them to understand about you?",
    "chapters": [
      "identity",
      "communication",
      "connection"
    ],
    "vectors": []
  },
  {
    "id": "Q03",
    "prompt": "What makes you want to put effort into something?",
    "followup": "Tell us about something you chose to do, and something you found hard to care about.",
    "chapters": [
      "identity",
      "effort"
    ],
    "vectors": []
  },
  {
    "id": "Q04",
    "prompt": "After spending time with other people, how do you usually feel?",
    "followup": "Is it different with close friends and an unfamiliar group?",
    "chapters": [
      "connection",
      "thriving"
    ],
    "vectors": []
  },
  {
    "id": "Q05",
    "prompt": "What do you usually do when you are part of a group?",
    "followup": "When do you speak up, choose a direction, or leave room for someone else?",
    "chapters": [
      "communication",
      "connection"
    ],
    "vectors": [
      "command",
      "tempo"
    ]
  },
  {
    "id": "Q06",
    "prompt": "When you have a hard choice to make, how do you decide?",
    "followup": "Think of a recent choice. What mattered, and how long did you need?",
    "chapters": [
      "mind",
      "identity"
    ],
    "vectors": [
      "command",
      "tempo",
      "perspective"
    ]
  },
  {
    "id": "Q07",
    "prompt": "How do you approach something new or unfamiliar?",
    "followup": "What makes you curious, and what makes you hold back?",
    "chapters": [
      "mind",
      "effort"
    ],
    "vectors": [
      "adaptability"
    ]
  },
  {
    "id": "Q08",
    "prompt": "How much of a plan do you like before you start?",
    "followup": "What happened the last time your plan changed?",
    "chapters": [
      "effort",
      "mind"
    ],
    "vectors": [
      "structure",
      "adaptability"
    ]
  },
  {
    "id": "Q09",
    "prompt": "When something gets boring or difficult, what do you do?",
    "followup": "Describe a time you kept going, changed your approach, or decided to stop.",
    "chapters": [
      "effort",
      "strengths"
    ],
    "vectors": [
      "tempo",
      "adaptability"
    ]
  },
  {
    "id": "Q10",
    "prompt": "When you do not understand something, what do you try?",
    "followup": "What happened the last time? Did another person or a tool help?",
    "chapters": [
      "mind",
      "thriving"
    ],
    "vectors": [
      "leverage",
      "precision"
    ]
  },
  {
    "id": "Q11",
    "prompt": "What kind of feedback is easiest for you to use?",
    "followup": "Describe feedback that helped, and anything that made it harder to take in.",
    "chapters": [
      "communication",
      "mind"
    ],
    "vectors": []
  },
  {
    "id": "Q12",
    "prompt": "When you are upset, what might someone else notice?",
    "followup": "What might they not notice? Share only what you want.",
    "chapters": [
      "pressure",
      "communication"
    ],
    "vectors": []
  },
  {
    "id": "Q13",
    "prompt": "When you disagree with someone, what usually happens?",
    "followup": "Can you remember an example, including what the other person actually said or did?",
    "chapters": [
      "connection",
      "communication",
      "pressure"
    ],
    "vectors": [
      "command",
      "relational_awareness"
    ]
  },
  {
    "id": "Q14",
    "prompt": "When something disappoints you, what helps?",
    "followup": "What happened on one occasion? It is okay if you are still figuring this out.",
    "chapters": [
      "pressure",
      "thriving"
    ],
    "vectors": []
  },
  {
    "id": "Q15",
    "prompt": "What do you do that helps a group?",
    "followup": "Think of school, home, friends or sport. How do you share the work?",
    "chapters": [
      "strengths",
      "connection"
    ],
    "vectors": [
      "leverage",
      "relational_awareness"
    ]
  },
  {
    "id": "Q16",
    "prompt": "When can something you do well cause a problem?",
    "followup": "How do you notice it, and is there a situation where it works differently?",
    "chapters": [
      "strengths",
      "effort"
    ],
    "vectors": [
      "precision"
    ]
  },
  {
    "id": "Q17",
    "prompt": "What makes you feel respected or fairly treated?",
    "followup": "How do you try to offer that to someone else?",
    "chapters": [
      "identity",
      "connection"
    ],
    "vectors": []
  },
  {
    "id": "Q18",
    "prompt": "What changes in how you feel or act when you are under pressure?",
    "followup": "Compare an ordinary situation with a difficult one. What was going on around you?",
    "chapters": [
      "pressure",
      "mind"
    ],
    "vectors": [
      "tempo",
      "precision",
      "relational_awareness"
    ]
  },
  {
    "id": "Q19",
    "prompt": "What uses up your energy, and what helps you feel like yourself again?",
    "followup": "Is anything about your current week making a difference?",
    "chapters": [
      "thriving",
      "effort"
    ],
    "vectors": []
  },
  {
    "id": "Q20",
    "prompt": "What else should MORE understand about you?",
    "followup": "Is there anything your answers have not explained? What are you still figuring out?",
    "chapters": [
      "identity",
      "mind",
      "communication",
      "connection",
      "effort",
      "pressure",
      "strengths",
      "thriving"
    ],
    "vectors": []
  }
];
for (const q of QUESTIONS) { Object.freeze(q.chapters); Object.freeze(q.vectors); Object.freeze(q); }
Object.freeze(QUESTIONS);
