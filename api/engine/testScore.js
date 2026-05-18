import { scoreAssessment } from "./scoreAssessment.js";

const sampleResponses = [
  { questionId: 1, type: "multiple_choice", answer: "A" },
  { questionId: 2, type: "multiple_choice", answer: "C" },
  { questionId: 3, type: "multiple_choice", answer: "A" },
  { questionId: 4, type: "multiple_choice", answer: "C" },
  { questionId: 5, type: "multiple_choice", answer: "B" },
  { questionId: 6, type: "multiple_choice", answer: "A" },
  { questionId: 7, type: "multiple_choice", answer: "B" },
  { questionId: 8, type: "multiple_choice", answer: "D" },
  { questionId: 9, type: "multiple_choice", answer: "A" },
  { questionId: 10, type: "multiple_choice", answer: "D" },
  { questionId: 12, type: "written", answer: "I took ownership of the situation, looked at what failed, and adjusted quickly. I do not like drifting when results matter. I usually try to get clear on what actually happened and then move fast." },
  { questionId: 15, type: "written", answer: "Under pressure I get more focused, more direct, and usually less patient. I tend to make decisions quickly and care more about progress than comfort in those moments. People who know me would say I get intense but effective." }
];

const result = scoreAssessment("set_1", sampleResponses);
console.log(JSON.stringify(result, null, 2));
