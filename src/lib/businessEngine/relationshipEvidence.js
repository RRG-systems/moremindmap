/**
 * Relationship-structure evidence shared by BA generation and the read-time
 * Business Engine compatibility projection.
 *
 * This is deterministic evidence classification, not generated intelligence.
 * Explicit negation always wins over keyword presence.
 */

function normalizedText(...values) {
  return values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

const SEGMENTATION_NEGATION_PATTERNS = [
  /\b(?:do not|don['’]t|does not|doesn['’]t|did not|didn['’]t)\s+have\s+(?:an?\s+|any\s+|official\s+)?(?:contact\s+|database\s+|relationship\s+)?(?:segmentation|segments?|segmented|tiers?|categor(?:y|ies|ized|ization)|tags?)\b/i,
  /\b(?:have not|haven['’]t|without|no)\s+(?:an?\s+|any\s+|official\s+)?(?:contact\s+|database\s+|relationship\s+)?(?:segmentation|segments?|segmented|tiers?|categor(?:y|ies|ized|ization)|tags?)\b/i,
  /\bnot\s+(?:yet\s+|currently\s+)?(?:segmented|categorized|tiered|tagged)\b/i,
  /\bsegmentation\s+(?:is\s+)?(?:not|missing|absent|none)\b/i,
];

const SEGMENTATION_POSITIVE_PATTERNS = [
  /\b(?:a\+?|b|c|d)\s*(?:\/|,|and|-)\s*(?:a\+?|b|c|d)\b.{0,80}\b(?:contacts?|database|relationships?)\b/i,
  /\b(?:contacts?|database|relationships?)\b.{0,80}\b(?:a\+?|b|c|d)\s*(?:\/|,|and|-)\s*(?:a\+?|b|c|d)\b/i,
  /\bsegment(?:ed|ation|ing)?\s+(?:by|into|exists|is set up|set up|in place)\b/i,
  /\b(?:tiered|categorized|tagged)\s+(?:contacts?|database|relationships?)\b/i,
];

const VENDOR_NEGATION_PATTERNS = [
  /\b(?:do not|don['’]t|does not|doesn['’]t)\s+have\s+(?:an?\s+|any\s+|official\s+)?(?:preferred\s+)?vendor\s+(?:database|list|system)\b/i,
  /\b(?:have not|haven['’]t|without|no)\s+(?:an?\s+|any\s+|official\s+)?(?:preferred\s+)?vendor\s+(?:database|list|system)\b/i,
];

const CRM_NEGATION_PATTERNS = [
  /\b(?:do not|don['’]t|does not|doesn['’]t)\s+have\s+(?:(?:an?|any|active|official|working)\s+)*crm\b/i,
  /\b(?:have not|haven['’]t|without|no)\s+(?:(?:an?|any|active|official|working)\s+)*crm\b/i,
  /\bnot\s+(?:currently\s+)?using\s+(?:(?:an?|any|active|official|working)\s+)*crm\b/i,
];

export function deriveRelationshipStructureEvidence({ q3 = '', q5 = '' } = {}) {
  const source = normalizedText(q3, q5);
  const segmentationNegated = SEGMENTATION_NEGATION_PATTERNS.some((pattern) => pattern.test(source));
  const segmentationPresent =
    !segmentationNegated &&
    SEGMENTATION_POSITIVE_PATTERNS.some((pattern) => pattern.test(source));
  const trueRelationshipsPresent = /\btrue relationships?\b/i.test(source);
  const databasePresent = /\b(?:database|crm|contacts?|sphere|soi|relationships?)\b/i.test(source);
  const vendorNegated = VENDOR_NEGATION_PATTERNS.some((pattern) => pattern.test(source));
  const vendorPresent = !vendorNegated && /\bvendor(?:s|\s+(?:database|list|system))?\b/i.test(source);
  const crmNegated = CRM_NEGATION_PATTERNS.some((pattern) => pattern.test(source));
  const crmPresent =
    !crmNegated &&
    /\b(?:crm|follow[\s-]*up boss|intelliagent)\b/i.test(source);

  const segmentationStatus = segmentationNegated
    ? 'absent'
    : segmentationPresent
      ? 'present'
      : 'unknown';

  let lakeHealth = 'unclear';
  if (trueRelationshipsPresent && segmentationStatus === 'present') {
    lakeHealth = 'organized_lake_signal';
  } else if (trueRelationshipsPresent && segmentationStatus === 'absent') {
    lakeHealth = 'relationship_asset_present_unorganized';
  } else if (trueRelationshipsPresent) {
    lakeHealth = 'relationship_asset_present';
  } else if (databasePresent && segmentationStatus === 'present') {
    lakeHealth = 'organized_database_signal';
  } else if (databasePresent) {
    lakeHealth = 'database_asset_present_structure_unconfirmed';
  }

  return {
    segmentation_status: segmentationStatus,
    segmentation_present: segmentationPresent,
    segmentation_negated: segmentationNegated,
    true_relationship_count_mentioned: trueRelationshipsPresent,
    database_mentioned: databasePresent,
    vendor_database_present: vendorPresent,
    vendor_database_negated: vendorNegated,
    crm_status: crmNegated ? 'absent' : crmPresent ? 'present' : 'unknown',
    crm_present: crmPresent,
    crm_negated: crmNegated,
    lake_health: lakeHealth,
    evidence_source: 'answers.q3|answers.q5',
  };
}

export default deriveRelationshipStructureEvidence;
