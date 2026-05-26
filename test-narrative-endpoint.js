import fetch from 'node-fetch';

const prompt = {
  systemRule: `You are rendering verified behavioral intelligence based on assessment data.
DO NOT invent traits, diagnoses, or personal conclusions.
Use ONLY the supplied evidence.
Ground every statement to the canonical data provided.`,

  section: "executiveSummary",
  voiceMode: "intelligence-briefing",
  emotionalTemperature: "neutral-observant",

  canonical: {
    primaryDimension: "fidelity",
    primaryScore: 0.67,
    primaryOp: "Detail-oriented analysis",
    secondaryDimension: "signal",
    secondaryOp: "Relational awareness",
    coreSignature: "Precision combined with people-reading",
    intake_answers: {
      q2: { text: "I get stuck in analysis paralysis" },
      q14: { text: "I freeze on decisions when stakes feel high" },
      q24: { text: "Paralysis when deciding. Weight of perfection stops me." }
    }
  },

  instruction: `Generate a compressed executive summary (max 150 words) as JSON.
Format: Asymmetrical prose. Mix short and longer sentences.
DO use: behavioral manifestation + organizational consequence`,

  format: JSON.stringify({
    section: "executiveSummary",
    headline: "(2-3 words, punchy)",
    body: "(max 150 words)",
    micro_scenario: "(one concrete moment)",
    key_warning: "(one overlooked risk)",
    grounding_used: "(list fields used)",
  }),
};

const response = await fetch('https://moremindmap.vercel.app/api/moremindmap/narrative-v3', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, section: "executiveSummary" })
});

console.log('Status:', response.status);
const data = await response.json();
console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
