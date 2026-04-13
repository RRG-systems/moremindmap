import { DIMENSIONS, DIMENSION_LABELS, QUESTION_MAP } from "./dimensionMap.js";

function emptyScores() {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, 0]));
}

function addScores(target, source, multiplier = 1) {
  for (const [dimension, points] of Object.entries(source || {})) {
    target[dimension] += points * multiplier;
  }
}

function normalizeScores(rawScores) {
  const total = Object.values(rawScores).reduce((sum, n) => sum + n, 0);

  if (total === 0) {
    return Object.fromEntries(DIMENSIONS.map((d) => [d, 0]));
  }

  const normalized = {};
  for (const d of DIMENSIONS) {
    normalized[d] = Number(((rawScores[d] / total) * 100).toFixed(1));
  }

  return normalized;
}

function rankScores(normalizedScores) {
  return Object.entries(normalizedScores)
    .map(([key, percent]) => ({
      key,
      label: DIMENSION_LABELS[key],
      percent
    }))
    .sort((a, b) => b.percent - a.percent);
}

function detectFlatDistribution(ranked) {
  const percents = ranked.map((r) => r.percent);
  const max = Math.max(...percents);
  const min = Math.min(...percents);
  const spread = max - min;

  return {
    spread,
    isFlat: spread < 12
  };
}

function detectLowSignal(responses) {
  const written = responses.filter((r) => r.type === "written");
  const weakWrittenCount = written.filter((r) => {
    const text = (r.answer || "").trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    return words < 25;
  }).length;

  return {
    weakWrittenCount,
    lowWrittenSignal: weakWrittenCount >= 2
  };
}

function detectContradictionPlaceholder() {
  return {
    contradictionScore: 0,
    contradictionFlag: false
  };
}

/*
responses format example:
[
  { questionId: 1, type: "multiple_choice", answer: "A" },
  { questionId: 11, type: "multi_select", answer: ["B", "D"] },
  { questionId: 12, type: "written", answer: "..." }
]
*/

export function scoreAssessment(setId, responses) {
  const setMap = QUESTION_MAP[setId];
  if (!setMap) {
    throw new Error(`Unknown setId: ${setId}`);
  }

  const rawScores = emptyScores();
  const writtenResponses = [];

  for (const response of responses) {
    const { questionId, type, answer } = response;

    if (type === "written") {
      writtenResponses.push({
        questionId,
        answer
      });
      continue;
    }

    const questionMap = setMap[questionId];
    if (!questionMap) continue;

    if (type === "multi_select" && Array.isArray(answer)) {
      for (const selected of answer) {
        addScores(rawScores, questionMap[selected], 0.7);
      }
      continue;
    }

    if (type === "multiple_choice" && typeof answer === "string") {
      addScores(rawScores, questionMap[answer], 1);
    }
  }

  const normalizedScores = normalizeScores(rawScores);
  const ranked = rankScores(normalizedScores);

  const flatCheck = detectFlatDistribution(ranked);
  const lowSignalCheck = detectLowSignal(
    responses.map((r) => ({
      ...r,
      answer: typeof r.answer === "string" ? r.answer : r.answer
    }))
  );
  const contradictionCheck = detectContradictionPlaceholder();

  const invalid =
    flatCheck.isFlat ||
    lowSignalCheck.lowWrittenSignal ||
    contradictionCheck.contradictionFlag;

  return {
    setId,
    rawScores,
    normalizedScores,
    ranked,
    primary: ranked.slice(0, 2),
    secondary: ranked.slice(2),
    writtenResponses,
    diagnostics: {
      flatSpread: flatCheck.spread,
      flatDistribution: flatCheck.isFlat,
      weakWrittenCount: lowSignalCheck.weakWrittenCount,
      contradictionScore: contradictionCheck.contradictionScore
    },
    invalid,
    nextStep: invalid
      ? "Ask 2 additional long-form written questions"
      : "Proceed to OpenAI interpretation layer"
  };
}
