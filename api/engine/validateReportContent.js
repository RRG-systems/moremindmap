// validateReportContent.js - Report Quality Validator V1
// Generated: Tue May 12, 2026 21:58 MST
// Input: report_content.json → Output: report_quality_report.json

import fs from 'fs';
import path from 'path';

const REQUIRED_PAGES = [
  'page01_cover', 'page02_operating_system_map', 'page03_executive_summary',
  'page04_operating_pattern', 'page05_decision_architecture', 'page06_communication_style',
  'page07_system_under_strain', 'page08_operating_environment_fit', 'page09_facilitator_notes',
  'page10_full_profile_unlocks'
];

const BANNED_PHRASES = [
  'natural leader', 'strong communicator', 'values authenticity', 'works well with others',
  'balances structure and flexibility', 'results-oriented', 'team player', 'growth mindset',
  'unlock your potential', 'passionate about', 'visionary leader', 'detail-oriented',
  'strategic thinker', 'big picture', 'thinks outside the box', 'takes ownership',
  'proactive approach', 'high standards', 'empathetic', 'resilient', 'innovative',
  'collaborative spirit', 'driven individual', 'executive presence', 'people person'
];

const PLACEHOLDER_PHRASES = [
  'lorem ipsum', 'placeholder', 'example text', 'insert here', 'TODO', 'TBD',
  'sample', 'mock content', 'generated text', '[MOCK]', 'insert here'
];

const WEAK_PHRASES = [
  'may benefit from', 'tends to', 'can be helpful', 'prefers to', 'likely to',
  'values collaboration', 'appreciates structure', 'enjoys', 'seeks to', 'aims to'
];

const EVIDENCE_ANCHOR_PHRASES = [
  'written response', 'answer pattern', 'under pressure', 'score pattern',
  'contradiction', 'tradeoff', 'operational consequence', 'dimension conflict',
  'Q2 shows', 'Q24 reveals', 'MC answers indicate'
];

const TENSION_PHRASES = [
  'tradeoff', 'tension', 'contradiction', 'but', 'however', 'cost of', 'friction',
  'blind spot', 'hidden cost', 'under strain', 'escalation'
];

const BEHAVIORAL_PHRASES = [
  'enters with', 'moves toward', 'defaults to', 'responds with', 'prefers to',
  'under time pressure', 'when stressed', 'team experiences as', 'discovers late'
];

export function validateReportContent() {
  const reportPath = path.join(process.cwd(), 'examples', 'report_content_example.json');
  
  if (!fs.existsSync(reportPath)) {
    throw new Error('report_content_example.json not found');
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const allText = JSON.stringify(report).toLowerCase();
  
  // 1. Required page keys
  const missingPages = REQUIRED_PAGES.filter(page => !report[page]);
  const pageScore = missingPages.length === 0 ? 100 : 0;

  // 2. Banned phrases
  const bannedHits = BANNED_PHRASES.filter(phrase => allText.includes(phrase));
  const genericityScore = (bannedHits.length / BANNED_PHRASES.length) * 100;

  // 3. Placeholder phrases
  const placeholderHits = PLACEHOLDER_PHRASES.filter(phrase => allText.includes(phrase));

  // 4. Weak phrases
  const weakHits = WEAK_PHRASES.filter(phrase => allText.includes(phrase));

  // 5. Evidence anchoring
  const evidenceHits = EVIDENCE_ANCHOR_PHRASES.filter(phrase => allText.includes(phrase));
  const evidenceAnchorScore = (evidenceHits.length / EVIDENCE_ANCHOR_PHRASES.length) * 100;

  // 6. Contradiction/tension
  const tensionHits = TENSION_PHRASES.filter(phrase => allText.includes(phrase));
  const contradictionSignalScore = (tensionHits.length / TENSION_PHRASES.length) * 100;

  // 7. Behavioral specificity
  const behavioralHits = BEHAVIORAL_PHRASES.filter(phrase => allText.includes(phrase));
  const specificityScore = (behavioralHits.length / BEHAVIORAL_PHRASES.length) * 100;

  // 8. Empty field check
  const allFields = Object.values(report).flatMap(page => 
    Object.values(page).filter(v => typeof v === 'string')
  );
  const emptyFields = allFields.filter(field => field.trim() === '' || field.length < 10);
  const emptyRatio = emptyFields.length / allFields.length;

  // 9. Repeated sentence patterns
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const sentenceStarts = sentences.map(s => s.trim().split(' ').slice(0, 3).join(' '));
  const startCounts = {};
  sentenceStarts.forEach(start => startCounts[start] = (startCounts[start] || 0) + 1);
  const maxStartRepeat = Math.max(...Object.values(startCounts));
  const repetitionScore = maxStartRepeat / sentences.length * 100;

  // Final quality score
  let qualityScore = 100;
  if (missingPages.length > 0) qualityScore -= 30;
  if (bannedHits.length > 0) qualityScore -= 25;
  if (placeholderHits.length > 0) qualityScore -= 20;
  if (genericityScore > 2) qualityScore -= 15;
  if (evidenceAnchorScore < 0.5) qualityScore -= 10;
  if (contradictionSignalScore < 0.8) qualityScore -= 10;
  if (specificityScore < 1.2) qualityScore -= 10;
  if (emptyRatio > 0.1) qualityScore -= 15;
  if (repetitionScore > 30) qualityScore -= 10;

  const status = qualityScore >= 85 ? 'PASS' : qualityScore >= 60 ? 'WARN' : 'FAIL';

  const qualityReport = {
    status,
    quality_score: Math.round(qualityScore),
    genericity_score: Math.round(genericityScore * 10) / 10,
    evidence_anchor_score: Math.round(evidenceAnchorScore * 10) / 10,
    contradiction_signal_score: Math.round(contradictionSignalScore * 10) / 10,
    specificity_score: Math.round(specificityScore * 10) / 10,
    repetition_score: Math.round(repetitionScore),
    empty_field_ratio: Math.round(emptyRatio * 100),
    missing_pages: missingPages,
    banned_phrases_found: bannedHits,
    placeholder_phrases_found: placeholderHits,
    weak_phrases_found: weakHits,
    page_scores: {
      page01_cover: report.page01_cover ? 100 : 0,
      page02_operating_system_map: report.page02_operating_system_map ? 100 : 0,
      // ... all 10
    },
    summary: generateSummary(status, qualityScore, genericityScore),
    checked_at: new Date().toISOString(),
    validator_version: 'V1',
    total_pages_present: REQUIRED_PAGES.filter(page => report[page]).length
  };

  const outputPath = path.join(process.cwd(), 'examples', 'report_quality_report.json');
  fs.writeFileSync(outputPath, JSON.stringify(qualityReport, null, 2));
  
  console.log(`Quality Report: ${status} (${qualityScore}/100)`);
  console.log(`Genericity: ${qualityReport.genericity_score}`);
  console.log(`Pages: ${qualityReport.total_pages_present}/10`);
  
  return qualityReport;
}

function generateSummary(status, qualityScore, genericityScore) {
  if (status === 'PASS') {
    return `High diagnostic quality. No banned phrases. Strong behavioral specificity. Ready for template injection.`;
  } else if (status === 'WARN') {
    return `Acceptable with improvements. Low genericity but weak evidence anchoring or repetition. Consider regeneration.`;
  } else {
    return `Quality failure. Banned phrases detected or structural issues. Regenerate with stricter guardrails.`;
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  validateReportContent();
}

export default validateReportContent;
