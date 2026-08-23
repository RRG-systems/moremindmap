export function selectRecruitingCandidate(candidates, selectedCandidateId = '') {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return candidates.find((candidate) => candidate?.candidate_id === selectedCandidateId)
    || candidates.find((candidate) => candidate?.ba_readiness === 'BA_INTELLIGENCE_READY')
    || candidates[0];
}
