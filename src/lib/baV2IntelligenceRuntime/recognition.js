import { deepFreeze, invariant } from './utils.js'
import { validateBusinessTwin, projectCustomerSafeBusinessTwin } from './businessTwin.js'

const RECOGNITION_CHECKS = Object.freeze([
  ['RELATIONSHIP_REALITY', /relationship|database/i],
  ['OPPORTUNITY_REALITY', /opportunit|demand|lead/i],
  ['CONVERSION_REALITY', /follow-up|conversion|pipeline/i],
  ['OPERATING_REALITY', /workflow|system|operat/i],
  ['ACCOUNTABILITY_REALITY', /accountability|ownership|inspect/i],
  ['ECONOMIC_REALITY', /financial|economic|profit|gross|expense/i],
  ['CAPACITY_REALITY', /capacity|team|delegat|leverage/i],
  ['DIRECTION_REALITY', /goal|future|business model|closings/i],
  ['GOVERNING_MECHANISM', /leader-centered|governing|mechanism/i],
  ['FIVE_FUTURES', /relative support/i],
  ['ONE_MOVE', /ownership transfer|bounded intervention|trial/i],
  ['EVIDENCE_BOUNDARY', /still needed|unresolved|change this view/i],
  ['LIVING_MAP_BOUNDARY', /governed new evidence|frozen baseline/i],
])

export function evaluateBusinessRecognition(twin) {
  validateBusinessTwin(twin)
  const customerView = projectCustomerSafeBusinessTwin(twin)
  const text = JSON.stringify(customerView)
  const checks = RECOGNITION_CHECKS.map(([check_id, pattern]) => ({ check_id, pass: pattern.test(text) }))
  const businessSpecificStatements = twin.projection_trace.filter((item) => item.source_artifact !== 'WHOLE_PERSON_EXECUTION').length
  const verdict = checks.every((item) => item.pass) && businessSpecificStatements >= 30 ? 'PASS' : 'FAIL'
  invariant(verdict === 'PASS', 'BUSINESS_RECOGNITION', 'Business Twin failed the governed recognition gate.', { checks, businessSpecificStatements })
  return deepFreeze({
    verdict,
    checks,
    passed: checks.filter((item) => item.pass).length,
    total: checks.length,
    business_specific_statement_count: businessSpecificStatements,
    territory_count: twin.domain_nodes.length,
    destination_count: twin.destinations.length,
  })
}

