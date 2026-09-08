import { sha256Text } from '../canonicalSha256.js'
import { ATHLETE_APA_PARITY_FIXTURE as fixture } from './parityFixture.js'

const DESTINATIONS = ['where', 'futures', 'move', 'plan', 'evidence']
const TONES = { where: 'green', futures: 'violet', move: 'amber', plan: 'blue', evidence: 'teal' }

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)
  return value
}

const sourceLabel = (sourceClass) => ({
  ATHLETE_REPORT: 'Athlete report', INSTRUCTOR_REPORT: 'Instructor report', INSTRUCTOR_OBSERVATION: 'Instructor observation', SHARED_AGREEMENT: 'Explicit shared agreement', OBJECTIVE_RECORD: 'Qualified record',
})[sourceClass] || 'Bounded interpretation'

const statusFor = (claim) => claim.sourceClass === 'OBJECTIVE_RECORD' ? 'KNOWN' : claim.sourceClass === 'BOUNDED_INFERENCE' ? 'INFERRED' : 'REPORTED'

function drawerSections({ meaning, evidence = [], counter = [], unknown = [], change = [], limits = [], provenance = [] }) {
  const entries = [
    ['What this is', meaning], ['What supports it', evidence], ['What it may mean', ['This is useful for choosing what to inspect or try next. It is not a rating, diagnosis, or prediction.']],
    ['What pushes against it', counter], ['What remains open', unknown], ['What would change it', change], ['Important limits', limits], ['Where it came from', provenance],
  ]
  return entries.map(([title, items], index) => ({ id: `section-${index + 1}`, title, items: (Array.isArray(items) ? items : [items]).filter(Boolean).slice(0, 6) }))
}

export function buildAthleteApaParityV1() {
  const objects = {}
  const internalObjects = {}
  const register = ({ objectId, destination, surface, title, value = null, qualifier = null, epistemicClass = 'INFERRED', confidence = 'Bounded', sourceAuthority, lineageRefs, drawerType = 'evidence', meaning, evidence, counter, unknown, change, limits, provenance }) => {
    if (!DESTINATIONS.includes(destination)) throw new Error('ATHLETE_APA_PARITY_DESTINATION_INVALID')
    if (objects[objectId]) throw new Error('ATHLETE_APA_PARITY_OBJECT_ID_DUPLICATE')
    const drawerPayload = drawerSections({ meaning: meaning || title, evidence, counter, unknown, change, limits, provenance })
    objects[objectId] = {
      object_id: objectId, destination, surface,
      display_payload: { title, value, qualifier, tone: TONES[destination] },
      epistemic_class: epistemicClass, confidence, drawer_type: drawerType, drawer_payload: drawerPayload,
      return_state: { destination, object_id: objectId, exact_scroll_and_focus: true },
    }
    internalObjects[objectId] = {
      object_id: objectId, destination, surface, source_authority: sourceAuthority,
      lineage_refs: [...new Set((lineageRefs || []).filter(Boolean))], epistemic_class: epistemicClass,
      customer_projection_id: objectId,
    }
    return objectId
  }

  const claimById = Object.fromEntries(fixture.claims.map((claim) => [claim.id, claim]))
  const claimObject = (claimId, destination, surface, display = {}) => {
    const claim = claimById[claimId]
    return register({
      objectId: `${destination}-${surface}-${claim.id.toLowerCase()}`, destination, surface,
      title: display.title || claim.topic.replaceAll('_', ' '), value: display.value || claim.statement, qualifier: display.qualifier || sourceLabel(claim.sourceClass),
      epistemicClass: statusFor(claim), confidence: claim.confidence === 'DIRECT_SOURCE' ? 'Direct source' : 'Bounded', sourceAuthority: `${claim.sourceClass}:${claim.actor}`, lineageRefs: [claim.id, claim.questionId], drawerType: display.drawerType || 'evidence',
      meaning: claim.statement, evidence: [`${sourceLabel(claim.sourceClass)} · ${claim.questionId}`, claim.recordRef ? `Qualified record: ${claim.recordRef}` : null],
      counter: claim.comparisonLimit ? [claim.comparisonLimit] : [], unknown: claim.id === 'A16' ? ['Whether this sample represents ordinary match play.'] : ['Whether this pattern holds across different situations.'],
      change: ['New comparable evidence from the athlete, instructor, or a qualified record.'], limits: ['No personality-caused-performance claim.', 'No selection, scholarship, roster, or health meaning.'], provenance: [`Joint APA fixture · ${claim.questionId}`, `Speaker authority: ${sourceLabel(claim.sourceClass)}`],
    })
  }

  const metricSpecs = [
    ['A13', '3 of 4', 'Planned cue sequences', 'Actually attempted together'],
    ['A16', '7 of 10', 'Scans before receiving', 'Small qualified film sample'],
    ['A15', '2 of 3', 'Timely clear cues observed', 'One showed no clear change'],
    ['A20', 'Oct 12', 'Next observation point', 'Fictional league match'],
  ]
  const metrics = metricSpecs.map(([id, value, title, qualifier]) => ({ value, title, qualifier, objectId: claimObject(id, 'where', 'headline_metric', { title, value, qualifier, drawerType: 'number' }) }))

  const domainSpecs = [
    {
      id: 'where-reality-1', key: 'sport', label: 'SPORT', headline: 'A small, mixed performance signal.',
      text: 'Scanning is showing up in the small film sample, and two attempted moments included a timely useful cue. The current evidence still does not show whether that changed decisions or match outcomes.',
      refs: ['A01', 'A02', 'A04', 'A05', 'A14', 'A15', 'A16', 'A17', 'A20'],
      status: 'Current performance · cause open', epistemicClass: 'INFERRED',
    },
    {
      id: 'where-reality-2', key: 'training', label: 'TRAINING', headline: 'One clear cue is being tested.',
      text: 'Mika and Coach Ellis are using one short scanning cue and one communication cue in comparable practice moments. Three of four planned attempts happened, and Mika has room for only one small addition.',
      refs: ['A06', 'A07', 'A12', 'A13', 'A18', 'A19'],
      status: 'Current preparation · bounded test', epistemicClass: 'INFERRED',
    },
    {
      id: 'where-reality-3', key: 'warrior-mentality', label: 'WARRIOR MENTALITY', headline: 'Recovery is visible; pressure response varies.',
      text: 'Both sources describe Mika rejoining play after mistakes. Under higher pressure, communication can become silent or crowded. That is a current pattern—not a fixed trait—and the evidence does not prove why it happens.',
      refs: ['A03', 'A08', 'A09', 'A10', 'A11'],
      status: 'Current behavior · explanation unresolved', epistemicClass: 'CONTRADICTED',
    },
  ]
  const domains = domainSpecs.map((item) => {
    const sourceLabels = [...new Set(item.refs.map((id) => sourceLabel(claimById[id].sourceClass)))]
    return {
      ...item,
      claimCount: item.refs.length,
      sourceLabels,
      objectId: register({
        objectId: item.id, destination: 'where', surface: 'current_reality_domain', title: item.label, value: item.headline, qualifier: item.status,
        epistemicClass: item.epistemicClass, confidence: 'Bounded', sourceAuthority: 'athlete-apa-box1-three-domain-projection-v1', lineageRefs: item.refs, drawerType: 'territory', meaning: item.text,
        evidence: item.refs.map((id) => `${sourceLabel(claimById[id].sourceClass)} · ${claimById[id].statement}`),
        counter: item.key === 'warrior-mentality' ? ['The same pressure pattern could reflect timing, message load, role clarity, confidence, focus, or another condition.'] : ['A different condition may explain the same observations.'],
        unknown: item.key === 'warrior-mentality' ? ['The current evidence does not support a broader judgment about discipline, ownership, persistence, or confidence.'] : [fixture.openEvidence.contradictions[0].statement],
        change: ['New comparable evidence from the athlete, instructor, or a qualified record.'],
        limits: ['Synthetic Beyond-Today-inspired hypothesis pending Lisa’s actual cassette; not canonical Beyond Today doctrine.', 'This domain describes current reality. It is not a rating, fixed trait, development domain, or future prediction.'],
        provenance: item.refs.map((id) => `${id} · ${sourceLabel(claimById[id].sourceClass)}`),
      }),
    }
  })

  const futureSpecs = [
    { role: 'current_course', label: 'Current Course', displayValue: 'Supported now', confidence: 'MODERATE', title: 'Useful cues remain inconsistent', meaning: 'The current small test continues, but the result stays mixed.', summary: 'Mika and Coach Ellis keep using the cue when it fits, without treating early signals as proof.', condition: 'The cue remains occasional and observations stay mixed.', supporting: ['Three of four planned sequences were attempted.', 'Two encouraging observations and one unchanged sequence.'], falsifiers: ['Consistent change across comparable practices or matches.', 'Evidence that another condition explains the difference.'], keyCharacteristics: ['Small test', 'Mixed signal', 'No outcome claim'], refs: ['A12', 'A13', 'A14', 'A15'] },
    { role: 'emerging_future', label: 'Emerging Future', displayValue: 'Emerging', confidence: 'MODERATE', title: 'One clear cue becomes more dependable', meaning: 'Earlier information and one short message begin to repeat across comparable moments.', summary: 'The shared cue could become a dependable routine if it survives different practice and match conditions.', condition: 'Athlete understanding and instructor delivery remain clear while comparable observations accumulate.', supporting: ['The concrete cue is shared.', 'Timely communication appeared twice in the small attempt set.'], falsifiers: ['The signal disappears in comparable situations.', 'The cue adds confusion or burden.'], keyCharacteristics: ['Repeatable cue', 'Shared meaning', 'Evidence still growing'], refs: ['A05', 'A07', 'A12', 'A15'] },
    { role: 'better_future', label: 'Better Future', displayValue: 'Possible', confidence: 'LOW', title: 'Information supports better next actions', meaning: 'Scanning and communication help Mika and teammates choose the next useful action more consistently.', summary: 'This path is possible, but the current evidence does not connect the cue to decision quality yet.', condition: 'Repeated observations must connect earlier information with clearer next actions without assigning cause too soon.', supporting: ['Seven scans appeared in a small film sample.', 'The athlete and instructor share the development direction.'], falsifiers: ['Earlier scans do not change available choices.', 'Communication changes but decisions do not.'], keyCharacteristics: ['Decision quality', 'Transfer test', 'Causal humility'], refs: ['A02', 'A05', 'A16', 'A17'] },
    { role: 'bold_future', label: 'Bold Future', displayValue: 'Open', confidence: 'LOW', title: 'The learning travels across roles and settings', meaning: 'Mika adapts the same simple learning move to new roles, teammates, or other settings.', summary: 'The possibility remains open. Current joint evidence is too narrow to say it is developing.', condition: 'The athlete chooses to test the approach elsewhere and separate evidence supports transfer.', supporting: ['The current move is reversible and understandable.'], falsifiers: ['The approach is useful only in one narrow soccer situation.', 'The athlete does not want this direction.'], keyCharacteristics: ['Athlete choice', 'Transfer remains open', 'No life prediction'], refs: ['A02', 'A18'] },
    { role: 'downside_future', label: 'Downside Future', displayValue: 'Watch', confidence: 'MODERATE', title: 'More instruction creates more noise', meaning: 'Extra cues or an added schedule crowd the moment and reduce useful communication.', summary: 'The main downside to watch is burden: adding too much when Mika has capacity for only one small change.', condition: 'Too many cues, public evaluation, or extra training pressure are added at once.', supporting: ['Mika reports room for one small addition, not a full schedule.', 'High-pressure messages can already become crowded.'], falsifiers: ['The small cue remains easy to sustain.', 'Mika reports that the added step helps without crowding.'], keyCharacteristics: ['Capacity matters', 'No punishment', 'Stop or adjust early'], refs: ['A10', 'A18', 'A19'] },
  ]
  const futureItems = futureSpecs.map((future) => {
    const objectId = register({ objectId: `future-${future.role}`, destination: 'futures', surface: 'conditional_future', title: future.label, value: future.displayValue, qualifier: future.title, epistemicClass: 'INFERRED', confidence: future.confidence, sourceAuthority: 'athlete-futures-v2-synthetic-stage', lineageRefs: future.refs, drawerType: 'future', meaning: future.summary, evidence: future.supporting, counter: future.falsifiers, unknown: ['Conditional path, not a prediction or ranking.'], change: future.falsifiers, limits: ['No numerical likelihood is asserted.', 'No roster, recruiting, scholarship, or career meaning.'], provenance: future.refs.map((id) => `${id} · joint APA evidence`) })
    return { ...future, objectId, layoutWeight: 20 }
  })

  const moveLogicSpecs = [
    ['move-logic-1', 'What may be holding this back', 'Useful information changes shape under pressure.', 'The athlete reports silence or several instructions; the instructor observes late or crowded information.', ['A10', 'A11']],
    ['move-logic-2', 'A reason worth testing', 'One concrete shared cue may reduce message load.', 'This is a bounded hypothesis. Timing, role clarity, or another condition may matter instead.', ['A05', 'A07', 'U01']],
    ['move-logic-3', 'Your One Move', 'Run a four-sequence one-cue clarity check.', 'Keep delivery, receipt, athlete meaning, behavior, and outcome as separate observations.', ['A12', 'A18']],
    ['move-logic-4', 'What this can prove', 'Whether the cue earns another test.', 'It cannot prove a trait, cause, match outcome, or future.', ['A15', 'A17']],
  ]
  const moveLogic = moveLogicSpecs.map(([id, label, value, description, refs]) => ({ label, value, description, objectId: register({ objectId: id, destination: 'move', surface: 'causal_logic', title: label, value, qualifier: description, epistemicClass: 'INFERRED', confidence: 'Bounded', sourceAuthority: 'athlete-one-move-v2-synthetic-stage', lineageRefs: refs, drawerType: 'move', meaning: description, evidence: refs.filter((ref) => claimById[ref]).map((ref) => claimById[ref].statement), counter: [fixture.openEvidence.contradictions[0].statement], unknown: ['Which condition matters most.'], change: ['Comparable attempts with separate athlete, instructor, and record evidence.'], limits: ['Suggestion only; no commitment, execution, or outcome is created by this map.'], provenance: refs.map((ref) => `${ref} · governed joint evidence`) }) }))

  const reasonSpecs = [
    ['move-reason-1', 'It tests the uncertainty.', 'The map does not pretend the cause is settled.', ['U01']],
    ['move-reason-2', 'It fits current capacity.', 'One small addition respects school, work, training, and athlete choice.', ['A18']],
    ['move-reason-3', 'It can be observed.', 'Delivery, understanding, behavior, and outcome can remain separate.', ['A12', 'A13', 'A17']],
  ]
  const reasons = reasonSpecs.map(([id, title, text, refs]) => ({ title, text, objectId: register({ objectId: id, destination: 'move', surface: 'reason', title, value: text, epistemicClass: 'INFERRED', confidence: 'Bounded', sourceAuthority: 'athlete-one-move-v2-synthetic-stage', lineageRefs: refs, drawerType: 'mechanism', meaning: text, evidence: refs.map((ref) => claimById[ref]?.statement || fixture.openEvidence.contradictions[0].statement), counter: ['The cue may not be the condition that matters.'], unknown: ['Whether any observed change repeats.'], change: ['Four comparable observations.'], limits: ['No forced participation and no evaluation use.'], provenance: refs.map((ref) => `${ref} · governed evidence`) }) }))

  const proofSpecs = [
    ['move-proof-1', 'Cue delivered and received separately', ['A12']], ['move-proof-2', 'Athlete can say what the cue means', ['A05']], ['move-proof-3', 'Comparable behavior is observed', ['A15']], ['move-proof-4', 'Continue, adjust, or stop together', ['A18', 'A19']],
  ]
  const proof = proofSpecs.map(([id, label, refs]) => ({
    label,
    objectId: register({
      objectId: id, destination: 'move', surface: 'proof', title: label, value: 'Future observation target', epistemicClass: 'FUTURE_OBSERVATION_TARGET', confidence: 'Not yet observed',
      sourceAuthority: 'athlete-one-move-v2-synthetic-stage', lineageRefs: refs, drawerType: 'evidence', meaning: label,
      evidence: ['This is a proposed observation target, not a completed result.'], counter: [], unknown: ['Not yet observed.'], change: ['A future authorized observation.'], limits: ['No result exists yet.'], provenance: ['One Move proposal · synthetic stage'],
    }),
  }))
  const deepDiveObjectId = register({ objectId: 'move-deep-dive', destination: 'move', surface: 'deep_entrance', title: 'Why this Move is bounded', value: 'Learn before claiming', epistemicClass: 'INFERRED', confidence: 'Bounded', sourceAuthority: 'athlete-one-move-v2-synthetic-stage', lineageRefs: ['A10', 'A11', 'A12', 'A15', 'A17', 'A18', 'U01'], drawerType: 'move', meaning: 'The move is small because the present question is causal and unresolved.', evidence: ['The current attempt set is small and mixed.', 'The athlete has capacity for one small addition.'], counter: ['Timing, role clarity, or another condition may explain the observations.'], unknown: ['Whether the cue changes anything beyond clarity.'], change: ['Repeat comparable observations and keep sources separate.'], limits: ['No commitment, execution, or outcome is inferred.'], provenance: ['Athlete APA One Move v2 · accepted synthetic stage'] })

  const strategySpecs = [
    ['Choose comparable moments', 'Name four situations worth comparing', 'Do not mix unlike roles, drills, or pressure levels.', ['A19']],
    ['Agree on one cue', 'Use words both people understand', 'The athlete may adjust or decline the wording.', ['A05', 'A07']],
    ['Check receipt', 'Ask what the cue meant', 'Delivery is not the same as understanding.', ['A12']],
    ['Observe separately', 'Keep action and outcome apart', 'Record what happened without deciding why.', ['A15', 'A17']],
    ['Review together', 'Continue, adjust, or stop', 'A miss is information, not a character judgment.', ['A18', 'U01']],
  ]
  const strategies = strategySpecs.map(([title, headline, supportingText, refs], index) => ({ order: index + 1, title, headline, supportingText, flow: [], objectId: register({ objectId: `plan-strategy-${index + 1}`, destination: 'plan', surface: 'strategy', title, value: headline, qualifier: supportingText, epistemicClass: 'GOVERNED_STRATEGIC_ACTION', confidence: 'Proposed only', sourceAuthority: 'athlete-plan-v1-deterministic-projection', lineageRefs: refs, drawerType: 'strategy', meaning: supportingText, evidence: refs.filter((ref) => claimById[ref]).map((ref) => claimById[ref].statement), counter: ['The athlete or instructor may decide this is not useful.'], unknown: ['No acceptance or execution is recorded.'], change: ['A scoped human decision.'], limits: ['This is a proposal, not an agreement.'], provenance: ['Deterministic plan from the accepted synthetic One Move'] }) }))

  const evidenceClaims = fixture.claims.map(({ id }) => id)
  const ledger = evidenceClaims.map((id, index) => {
    const claim = claimById[id]
    return { id: `evidence-row-${index + 1}`, reality: claim.topic.replaceAll('_', ' '), value: claim.statement, basis: sourceLabel(claim.sourceClass), status: statusFor(claim), confidence: claim.confidence === 'DIRECT_SOURCE' ? 'Direct source' : 'Bounded', objectId: claimObject(id, 'evidence', 'ledger_row', { title: claim.topic.replaceAll('_', ' '), value: claim.statement, qualifier: sourceLabel(claim.sourceClass), drawerType: 'evidence' }) }
  })
  fixture.openEvidence.missing.forEach((item, index) => ledger.push({ id: `evidence-row-missing-${index + 1}`, reality: item.topic.replaceAll('_', ' '), value: item.statement, basis: 'Missing evidence', status: 'MISSING', confidence: 'Open', objectId: register({ objectId: `evidence-missing-${index + 1}`, destination: 'evidence', surface: 'ledger_row', title: item.topic.replaceAll('_', ' '), value: item.statement, qualifier: 'Missing evidence', epistemicClass: 'MISSING', confidence: 'Open', sourceAuthority: 'athlete-apa-box1-v2', lineageRefs: [item.id], drawerType: 'evidence', meaning: item.statement, evidence: [], counter: [], unknown: [item.statement], change: ['A new comparable qualified observation.'], limits: ['The map abstains while this evidence is absent.'], provenance: [`${item.id} · explicit missingness`] }) }))
  ledger.push({ id: 'evidence-row-contradiction', reality: 'communication timing', value: fixture.openEvidence.contradictions[0].statement, basis: 'Unresolved source difference', status: 'CONTRADICTED', confidence: 'Open', objectId: register({ objectId: 'evidence-contradiction-1', destination: 'evidence', surface: 'ledger_row', title: 'Communication timing', value: 'Cause does not yet reconcile', qualifier: 'Unresolved', epistemicClass: 'CONTRADICTED', confidence: 'Open', sourceAuthority: 'athlete-apa-box1-v2', lineageRefs: ['U01', 'A10', 'A11'], drawerType: 'evidence', meaning: fixture.openEvidence.contradictions[0].statement, evidence: [claimById.A10.statement, claimById.A11.statement], counter: ['Both observations can be true without one explaining the other.'], unknown: ['Primary condition remains unknown.'], change: ['Comparable event evidence.'], limits: ['Do not average the voices or invent agreement.'], provenance: ['U01 · preserved unresolved difference'] }) })

  const categorySpecs = [
    ['known', 'Directly reported or observed', 20, 'Athlete, instructor, shared, and qualified-record evidence'],
    ['inferred', 'Bounded interpretations', 4, 'Useful hypotheses that remain revisable'],
    ['missing', 'Known evidence gaps', 2, 'Important comparisons not yet available'],
    ['contradicted', 'Unresolved differences', 1, 'Evidence that does not yet settle one explanation'],
  ]
  const categories = categorySpecs.map(([id, label, value, summary]) => ({ id, label, value, summary, objectId: register({ objectId: `evidence-summary-${id}`, destination: 'evidence', surface: 'evidence_summary', title: label, value: String(value), qualifier: summary, epistemicClass: id === 'missing' ? 'MISSING' : id === 'contradicted' ? 'CONTRADICTED' : id === 'inferred' ? 'INFERRED' : 'KNOWN', confidence: id === 'known' ? 'Direct sources' : 'Bounded', sourceAuthority: 'athlete-apa-evidence-projection-v1', lineageRefs: id === 'missing' ? ['M01', 'M02'] : id === 'contradicted' ? ['U01'] : fixture.claims.map((claim) => claim.id), drawerType: 'evidence', meaning: summary, evidence: [summary], counter: [], unknown: id === 'missing' ? fixture.openEvidence.missing.map((item) => item.statement) : [], change: ['New governed evidence can revise this count and its meaning.'], limits: ['Counts describe this joint map only.'], provenance: ['Athlete APA evidence projection v1'] }) }))

  const traceSpecs = [
    ['WHY — Current question', 'What changes communication under pressure?', 'The evidence supports a question, not one settled cause.', 'green', 'where-reality-3'],
    ['Five Futures', 'Five conditional paths', 'Each path states support, uncertainty, and what would change it.', 'violet', 'future-current_course'],
    ['One Move', 'Four-sequence one-cue clarity check', 'A reversible observation proposal, not a commitment.', 'amber', 'move-deep-dive'],
    ['Plan', 'One direction → three ways → five steps', 'Way 1 is mapped. The humans have not accepted it.', 'blue', 'plan-strategy-1'],
  ]
  const traceCards = traceSpecs.map(([label, title, summary, tone, ref], index) => ({ label, title, summary, tone, objectId: register({ objectId: `evidence-trace-${index + 1}`, destination: 'evidence', surface: 'athlete_map_trace', title: label, value: title, qualifier: summary, epistemicClass: 'INFERRED', confidence: 'Bounded', sourceAuthority: 'athlete-apa-parity-projection-v1', lineageRefs: [ref], drawerType: 'evidence', meaning: summary, evidence: [`Trace returns to ${ref}.`], counter: [], unknown: ['The map changes only from new governed evidence.'], change: ['Inspect the cited evidence and future observations.'], limits: ['No regeneration occurs during inspection.'], provenance: ['Deterministic customer projection'] }) }))

  const layer0ObjectIds = {
    where: register({ objectId: 'layer0-where', destination: 'where', surface: 'layer0_card', title: 'Where You Are', value: '3', qualifier: 'clear current-reality domains', epistemicClass: 'INFERRED', confidence: 'Source-separated', sourceAuthority: 'athlete-apa-box1-three-domain-projection-v1', lineageRefs: fixture.claims.map((claim) => claim.id), drawerType: 'territory', meaning: 'Sport, Training, and Warrior Mentality compress the current joint reality upward while all 20 source-bound items remain intact underneath.', evidence: ['20 accepted synthetic current-reality items remain source-separated in the Evidence ledger.'], counter: fixture.openEvidence.contradictions.map((item) => item.statement), unknown: fixture.openEvidence.missing.map((item) => item.statement), change: ['New governed Athlete or instructor evidence, or Lisa’s future authorized cassette.'], limits: ['Synthetic Beyond-Today-inspired hypothesis pending Lisa’s actual cassette; not canonical Beyond Today doctrine.', 'Current reality is not personality, a rating, or a future prediction.'], provenance: ['Athlete APA Box 1 three-domain projection v1'] }),
    futures: register({ objectId: 'layer0-futures', destination: 'futures', surface: 'layer0_card', title: 'Five Possible Futures', value: 'Five conditional paths', qualifier: 'No probabilities or predictions', epistemicClass: 'INFERRED', confidence: 'Mixed by path', sourceAuthority: 'athlete-futures-v2-synthetic-stage', lineageRefs: futureSpecs.flatMap((future) => future.refs), drawerType: 'future', meaning: 'Five ways current conditions could develop; none is a promised outcome.', evidence: ['Each path names its support and falsifiers.'], counter: ['A live generator must abstain rather than invent a path when evidence is insufficient.'], unknown: ['Which path, if any, future evidence will support.'], change: ['New observed conditions and outcomes.'], limits: ['No selection or career forecast.'], provenance: ['Athlete Futures v2 accepted synthetic stage'] }),
    move: register({ objectId: 'layer0-move', destination: 'move', surface: 'layer0_card', title: 'Your One Move', value: 'Run a four-sequence one-cue clarity check.', qualifier: 'Suggestion only · not accepted', epistemicClass: 'INFERRED', confidence: 'Bounded', sourceAuthority: 'athlete-one-move-v2-synthetic-stage', lineageRefs: ['A10', 'A11', 'A12', 'A15', 'A17', 'A18', 'U01'], drawerType: 'move', meaning: 'A small reversible experiment to learn whether one shared cue is useful.', evidence: ['Current signal is mixed and capacity is limited.'], counter: ['Another condition may matter more.'], unknown: ['No result exists.'], change: ['A human decision plus future observations.'], limits: ['No commitment or outcome is recorded.'], provenance: ['Athlete One Move v2 accepted synthetic stage'] }),
    plan: register({ objectId: 'layer0-plan', destination: 'plan', surface: 'layer0_card', title: 'Your Plan', value: '1 direction · 1 mapped way · 5 observation steps', qualifier: 'Ways 2 and 3 remain open', epistemicClass: 'GOVERNED_STRATEGIC_ACTION', confidence: 'Proposed only', sourceAuthority: 'athlete-plan-v1-deterministic-projection', lineageRefs: ['A02', 'A05', 'A12', 'A18'], drawerType: 'strategy', meaning: 'A proposed path for learning together.', evidence: ['Derived from the accepted synthetic direction and One Move.'], counter: ['The humans may adjust or decline it.'], unknown: ['No acceptance is recorded.'], change: ['Scoped athlete and instructor decisions.'], limits: ['A rendered plan is not a commitment.'], provenance: ['Deterministic plan projection'] }),
    evidence: register({ objectId: 'layer0-evidence', destination: 'evidence', surface: 'layer0_card', title: 'Evidence', value: '20 direct items', qualifier: '4 bounded interpretations · 3 open items', epistemicClass: 'KNOWN', confidence: 'Source-specific', sourceAuthority: 'athlete-apa-evidence-projection-v1', lineageRefs: fixture.claims.map((claim) => claim.id), drawerType: 'evidence', meaning: 'The ledger keeps source, uncertainty, contradiction, and missingness visible.', evidence: ['20 direct source-bound items.'], counter: fixture.openEvidence.contradictions.map((item) => item.statement), unknown: fixture.openEvidence.missing.map((item) => item.statement), change: ['New evidence or a source correction.'], limits: ['Counts do not imply score or quality.'], provenance: ['Athlete APA evidence projection v1'] }),
  }

  const customerViewModel = {
    identity: { firstName: fixture.subject.displayName, business: `${fixture.subject.displayName}’s Athlete Performance Map`, vertical: `${fixture.subject.sport} · ${fixture.subject.ageBand} · fictional` },
    hero: { eyebrow: `${fixture.subject.displayName}’s Athlete Performance Map`, title: 'Your performance. Seen clearly. Kept open where truth is still forming.', subtitle: 'One map. Five destinations. Both voices intact.', modelDate: 'Synthetic snapshot · September 5, 2026' },
    presentation: {
      brandAria: 'MORE Athlete', brandBottom: 'ATHLETE', railKicker: 'Athlete Performance Assessment', navAria: 'Athlete Performance Map destinations', boundaryCopy: 'This map changes only when accepted Athlete evidence changes.', backLabel: '← Back to Athlete Map', overviewAria: 'Your Athlete Performance Map destinations', bigPictureAria: 'Investigate the most important conditional paths',
      bigPictureLabel: 'The Big Picture', nextStepLabel: 'One useful next step', startPlanLabel: 'Review the plan', snapshotTitle: 'This is a frozen synthetic Athlete snapshot.', snapshotCopy: 'It reflects only the accepted fictional evidence available at the model date.',
      pathwayEyebrow: 'From today to your direction', pathwayIntro: 'A simple view of what is happening now, what Mika wants, and what progress would require.', pathwayLabels: { today: 'Today', goal: 'Athlete Direction', required: 'What Progress Requires' }, pathwayCaptions: { today: 'What the current evidence supports', goal: 'What the athlete wants to build', required: 'Conditions worth testing' }, realitiesCopy: 'The three critical realities shaping this Athlete map.', gapLabel: 'The Current Gap',
      currentScenario: 'Current Athlete state', moveScenario: 'If the One Move helps', currentOdds: 'Current evidence posture', moveOdds: 'If the One Move helps', futuresChartNote: 'The ring keeps five conditional paths visible. It does not encode probability, rank, selection value, or predicted outcome.', selectedFuture: 'Selected Future', probabilityLabel: 'Evidence posture',
      moveWhy: 'Why this Move?', moveProofIcon: '○', moveStartAction: 'Review the proposed plan', moveDeepCopy: 'See the evidence, competing explanations, limits, and what would change this suggestion.',
      planGoalLabel: 'The 1 — Athlete Direction', planWaysLabel: 'The 3 — Three ways progress could be explored', planStrategiesLabel: 'The 5 — Observation steps for Way 1', planWayBuilt: 'Mapped, not accepted', planWayMappedIcon: '◇', planOpenCopy: 'This way stays open until the athlete and instructor choose to explore it.', planMoveLabel: 'Your One Move proposal', planProgressLabel: 'Your Athlete plan so far', planProgress: ['Mapped · athlete direction', 'Mapped · Way 1 + five observation steps', 'Open · Way 2', 'Open · Way 3'], planProgressDoneCount: 0, planCompleteLabel: 'Keep choice with the humans', planBuildAction: 'See the open ways', planLivingAction: 'What could make this map live →', planLivingCopy: 'A future Living Athlete Map could reconnect accepted observations over time. This local build performs no save, coaching, or activation.',
      evidenceHeaders: ['Athlete reality', 'Value / finding', 'Source', 'Confidence'], evidenceUseBasis: true, evidenceBuildLabel: 'How MORE built this Athlete map', evidenceBuildFlow: ['Athlete + instructor evidence', 'Current reality', 'Conditional Futures', 'One Move', 'Proposed plan'], evidenceTrace: 'Trace this Athlete map', missingCopy: 'These are the current evidence gaps most likely to sharpen this frozen Athlete map.', livingLabel: 'Frozen Map → Living Athlete Map',
      drawerSuffix: 'Deep Dive', drawerFooter: 'Layer 2 reveals accepted, source-bound intelligence only. Nothing is regenerated or written here.', howCopy: 'Layer 0 gives the answer. Layer 1 helps you understand it. Layer 2 lets you investigate the evidence, disagreement, and limits. The experience stops there.', livingTitle: 'What a Living Athlete Map would mean', livingCopy: 'A future map could revisit this snapshot as separately authorized Athlete evidence changes. This local parity build does not activate, coach, save, or update anything.', buildTitle: 'The other two ways remain open', buildCopy: 'The map preserves room for athlete and instructor choice. Open ways are not missing content and are not invented strategies.',
    },
    nav: [['where', 'Where You Are'], ['futures', 'Five Possible Futures'], ['move', 'Your One Move'], ['plan', 'Your Plan'], ['evidence', 'Evidence']].map(([id, label], index) => ({ id, label, order: index + 1 })),
    layerContract: { layer_0: 'ANSWER', layer_1: 'UNDERSTAND', layer_2: 'INVESTIGATE', stop_after: 2, layer_3_exists: false },
    layer0: {
      cards: [
        { id: 'where', objectId: layer0ObjectIds.where, title: 'Where You Are', description: 'Three clear views of the Athlete’s current reality—with both voices and every source intact underneath.', value: '3', qualifier: 'current-reality domains', details: [{ value: 'SPORT', label: 'performance now · small, mixed signal', epistemicClass: 'INFERRED' }, { value: 'TRAINING', label: 'preparation now · one bounded test', epistemicClass: 'INFERRED' }, { value: 'WARRIOR MENTALITY', label: 'showing up now · explanation still open', epistemicClass: 'CONTRADICTED' }], cta: 'See where you are' },
        { id: 'futures', objectId: layer0ObjectIds.futures, title: 'Five Possible Futures', description: 'Conditional paths—not predictions—supported, challenged, or still open.', items: futureItems.map(({ label, displayValue }) => ({ label, displayValue })), cta: 'Explore Futures' },
        { id: 'move', objectId: layer0ObjectIds.move, title: 'Your One Move', description: 'The smallest reversible move that can help us learn what matters.', icon: '⌾', value: 'Run a four-sequence one-cue clarity check.', qualifier: 'Suggestion only · not accepted', cta: 'See why this Move' },
        { id: 'plan', objectId: layer0ObjectIds.plan, title: 'Your Plan', description: 'Turn the Move into a clear observation plan while choice stays with the humans.', icon: '◇', value: 'Learn together. Keep sources separate. Adjust from what happens.', qualifier: 'One mapped way · two open ways · no commitment recorded', cta: 'View the proposed plan' },
        { id: 'evidence', objectId: layer0ObjectIds.evidence, title: 'Evidence', description: 'The source, limits, disagreements, and missing truth behind this map.', icon: '▤', items: [{ value: '20', label: 'Direct source items' }, { value: '4', label: 'Bounded interpretations' }, { value: '3', label: 'Open evidence items' }], cta: 'See the Evidence' },
      ],
      bigPicture: 'A shared direction is clear. The reason performance varies under pressure is not.',
      bigPictureQualifier: 'One cue has produced a small mixed signal. That earns a careful next test—not a trait label or causal verdict.',
      nextStep: 'Run a four-sequence one-cue clarity check.',
      nextStepQualifier: 'Small enough to stop. Clear enough to observe. Open enough to teach us something.',
    },
    destinations: {
      where: {
        eyebrow: '1. Where You Are', headline: 'Three ways to understand where you are now.', subhead: 'Sport. Training. Warrior Mentality. A simpler current-reality view with all 20 source-bound items still underneath.',
        mode: 'athlete_three_current_reality_domains', domains, underlyingClaimCount: fixture.claims.length,
        sourceLabels: [...new Set(fixture.claims.map((claim) => sourceLabel(claim.sourceClass)))],
        openReality: {
          headline: 'The pattern under pressure is visible. The cause is not.',
          text: fixture.openEvidence.contradictions[0].statement,
          summary: `${fixture.openEvidence.contradictions.length} unresolved difference · ${fixture.openEvidence.missing.length} missing evidence items`,
        },
        boundary: 'Synthetic Beyond-Today-inspired working hypothesis for Founder review—not canonical Beyond Today doctrine.',
        entrances: [{ label: 'See the qualified film sample', objectId: metrics[1].objectId }, { label: 'See what remains missing', objectId: 'evidence-missing-1' }, { label: 'Inspect the unresolved difference', objectId: 'evidence-contradiction-1' }],
      },
      futures: { eyebrow: `${fixture.subject.displayName}’s Athlete Performance Map`, headline: 'Five Possible Futures', subhead: 'Five conditional paths based on the accepted joint evidence. No path is a prediction, rank, or selection judgment.', displayMode: 'qualitative', centerTop: '5 paths', centerBottom: 'Conditional', valueLabel: 'Evidence posture', items: futureItems, ifMoveWorks: futureItems.map((item) => ({ role: item.role, layoutWeight: 20, displayValue: item.role === 'emerging_future' ? 'Stronger signal' : item.role === 'downside_future' ? 'Less supported' : item.displayValue })) },
      move: { eyebrow: 'Your One Move', headline: 'Run a four-sequence one-cue clarity check.', subhead: 'A reversible way to learn whether one shared cue helps—without turning a hypothesis into truth.', logic: moveLogic, reasons, proof, startHere: { text: 'Choose four comparable moments and one cue both people understand.', qualifier: 'No commitment is recorded. The athlete can adjust, decline, or stop.', objectId: moveLogic[2].objectId }, deepDiveObjectId },
      plan: { eyebrow: 'Your 1–3–5 Athlete Plan', headline: 'Build one useful contribution at a time—without adding a full schedule.', subhead: 'One Athlete direction. Three possible ways. Five observation steps for Way 1.', goal: { display: 'Communicate one useful thing earlier in important moments.' }, ways: [{ status: 'MAPPED_NOT_ACCEPTED', title: 'Test one shared cue in comparable moments', destinationState: 'Learn whether clarity helps without claiming an outcome.' }, { status: 'OPEN', title: 'Build the scan across different pressure levels', destinationState: null }, { status: 'OPEN', title: 'Protect capacity while development continues', destinationState: null }], strategies, oneMove: { status: 'PROPOSED_NOT_ACCEPTED', title: 'Four-sequence one-cue clarity check', intervention: 'Deliver, receive, understand, observe, then review—without collapsing those into one result.', whyAlongside: 'The plan supports the Move. It does not turn the Move into a commitment.', proofBoundary: 'No acceptance, execution, or outcome has been recorded.' }, completion: { goal: 'MAPPED_NOT_ACCEPTED', way1: 'MAPPED_NOT_ACCEPTED', way2: 'OPEN', way3: 'OPEN' } },
      evidence: { eyebrow: 'The Evidence', headline: 'See exactly what MORE knows—and where it stops.', subhead: 'Every important conclusion keeps its speaker, source class, limits, disagreement, and missing evidence.', categories, ledger, coverage: [{ territory: 'Shared direction', confidence: 'Strong', known: 5, inferred: 0, missing: 0 }, { territory: 'Present practice', confidence: 'Moderate', known: 8, inferred: 1, missing: 0 }, { territory: 'Recent change + record', confidence: 'Moderate', known: 3, inferred: 1, missing: 1 }, { territory: 'Cause + transfer', confidence: 'Open', known: 1, inferred: 1, missing: 1 }, { territory: 'Capacity + next event', confidence: 'Moderate', known: 3, inferred: 1, missing: 0 }], counterevidence: ['One of three attempted sequences showed no clear change.', 'A small film sample has no comparable earlier baseline.', 'Timing, role clarity, message load, or another condition may explain the same observations.', 'Scanning before receiving is not the same as making a better decision.'], mindChanges: ['Four comparable observations with separate delivery, understanding, behavior, and outcome notes.', 'Evidence that the cue adds burden or confusion.', 'A repeated match pattern under different pressure and role conditions.', 'A correction from Mika or Coach Ellis.'], truthColumns: [{ label: 'Factual reality', title: 'What MORE knows', items: ['Mika and Coach Ellis share the current direction.', 'Three of four cue sequences were attempted.', 'A small film sample contains seven scans in ten sequences.', 'Mika reports room for one small addition.'] }, { label: 'Interpreted reality', title: 'What MORE thinks may be happening', items: ['One shared cue may reduce crowded information.', 'A small mixed signal earns another careful test.', 'Capacity is part of whether any move is useful.'] }, { label: 'Open questions', title: 'What MORE still needs to know', items: [fixture.openEvidence.contradictions[0].statement, ...fixture.openEvidence.missing.map((item) => item.statement)] }], traceCards, qualityKey: [{ label: 'Known', meaning: 'Directly reported, explicitly agreed, observed, or held in a qualified record.' }, { label: 'Inferred', meaning: 'A supported interpretation that remains revisable.' }, { label: 'To observe', meaning: 'A future evidence target, not a completed result.' }, { label: 'Missing', meaning: 'Important evidence that is not available.' }, { label: 'Contradicted', meaning: 'Accepted sources do not yet support one reconciled explanation.' }], highestValueMissing: fixture.openEvidence.missing.map((item) => item.statement) },
    },
    livingMap: { headline: 'A future Athlete map could learn from what the humans actually try.', copy: 'That later relationship must preserve permission, source, time, attempt, outcome, correction, and uncertainty. This local parity build remains frozen and read-only.', action: 'See the future seam', active: false },
    objects,
    interaction: { drawer: 'CONTEXTUAL_OVER_DIMMED_LAYER_1', exact_return_state: true, provider_calls_on_click: 0, network_calls_on_click: 0, regeneration_on_click: false },
  }

  const internalTrace = {
    contract_id: 'athlete-apa-live-ba-parity-v1-projection', version: '1.0.0-synthetic',
    bindings: { subjectId: fixture.subject.id, relationshipId: fixture.relationship.id, box1StateHash: fixture.stateHash, bosArtifactIdentity: fixture.bosBinding.sourceArtifactIdentity, bosArtifactSha256: fixture.bosBinding.sourceArtifactSha256, bosSourceStateHash: fixture.bosBinding.sourceStateHash, bosJointProjectionStatus: fixture.bosBinding.jointProjection.status },
    stages: [
      { id: 'athlete_current_reality_v2', status: 'ACCEPTED_SYNTHETIC', inputHash: fixture.stateHash, providerCalls: 0 },
      { id: 'athlete_five_futures_v2', status: 'ACCEPTED_SYNTHETIC', inputRefs: fixture.claims.map((claim) => claim.id), providerCalls: 0 },
      { id: 'athlete_one_move_v2', status: 'ACCEPTED_SYNTHETIC', inputRefs: ['A10', 'A11', 'A12', 'A15', 'A17', 'A18', 'U01'], providerCalls: 0 },
      { id: 'athlete_box1_three_domain_compression_v1', status: 'PROVISIONAL_SYNTHETIC', inputRefs: fixture.claims.map((claim) => claim.id), providerCalls: 0, doctrineStatus: 'PENDING_LISA_CASSETTE_NOT_CANONICAL_BEYOND_TODAY' },
      { id: 'athlete_customer_projection_v1', status: 'DETERMINISTIC', providerCalls: 0 },
    ],
    objects: internalObjects, source_object_count: fixture.claims.length + fixture.openEvidence.missing.length + fixture.openEvidence.contradictions.length,
    projected_object_count: Object.keys(objects).length, provider_calls: 0, network_calls: 0, customer_mutation: false, persistence_writes: 0,
    bos_projection: fixture.bosBinding.jointProjection,
    box1_compression: { domains: domains.map(({ key, label, refs }) => ({ key, label, refs })), underlyingClaimCount: fixture.claims.length, provisional: true, canonicalBeyondTodayDoctrine: false },
  }
  const realizationIdentity = sha256Text(JSON.stringify(stable({ contract: internalTrace.contract_id, version: internalTrace.version, bindings: internalTrace.bindings, stages: internalTrace.stages, objects: internalTrace.objects })))
  internalTrace.realization_identity = realizationIdentity

  const result = {
    contract_id: 'athlete-apa-live-ba-parity-v1', version: '1.0.0-synthetic', realizationIdentity,
    customerViewModel, internalTrace,
    validation: { status: 'PASS', destinations: 5, layer3: false, planStrategies: 5, waysOpen: 2, meaningfulObjects: Object.keys(objects).length, numericalYouthProbabilities: 0, bosPrivateClaimsProjected: 0 },
  }
  validateAthleteApaParityV1(result)
  return deepFreeze(result)
}

export function validateAthleteApaParityV1(result) {
  const { customerViewModel: view, internalTrace, validation } = result
  if (view.nav.map((item) => item.id).join('|') !== DESTINATIONS.join('|')) throw new Error('ATHLETE_APA_PARITY_NAV_INVALID')
  if (view.layer0.cards.map((item) => item.id).join('|') !== DESTINATIONS.join('|')) throw new Error('ATHLETE_APA_PARITY_LAYER0_INVALID')
  if (view.layerContract.stop_after !== 2 || view.layerContract.layer_3_exists !== false) throw new Error('ATHLETE_APA_PARITY_LAYER_STOP_INVALID')
  const box1 = view.destinations.where
  if (box1.mode !== 'athlete_three_current_reality_domains' || box1.domains.map((item) => item.label).join('|') !== 'SPORT|TRAINING|WARRIOR MENTALITY') throw new Error('ATHLETE_APA_BOX1_DOMAIN_COMPRESSION_INVALID')
  const compressedClaimIds = [...new Set(box1.domains.flatMap((item) => item.refs))].sort()
  const fixtureClaimIds = fixture.claims.map((claim) => claim.id).sort()
  if (compressedClaimIds.join('|') !== fixtureClaimIds.join('|') || box1.underlyingClaimCount !== 20) throw new Error('ATHLETE_APA_BOX1_CLAIM_COVERAGE_INVALID')
  if (box1.domains.some((item) => /development|direction/iu.test(item.label))) throw new Error('ATHLETE_APA_BOX1_EXTRA_DOMAIN_INVALID')
  if (view.destinations.futures.items.length !== 5 || view.destinations.futures.items.some((item) => Object.hasOwn(item, 'probability'))) throw new Error('ATHLETE_APA_PARITY_FUTURES_SEMANTICS_INVALID')
  if (view.destinations.plan.ways.length !== 3 || view.destinations.plan.strategies.length !== 5 || view.destinations.plan.ways[0].status !== 'MAPPED_NOT_ACCEPTED') throw new Error('ATHLETE_APA_PARITY_PLAN_SHAPE_INVALID')
  if (validation.meaningfulObjects < 30) throw new Error('ATHLETE_APA_PARITY_OBJECTS_INCOMPLETE')
  for (const [id, object] of Object.entries(view.objects)) {
    const trace = internalTrace.objects[id]
    if (!trace || !DESTINATIONS.includes(object.destination) || !object.return_state?.exact_scroll_and_focus || object.drawer_payload.length !== 8 || !trace.source_authority || trace.lineage_refs.length === 0) throw new Error(`ATHLETE_APA_PARITY_OBJECT_INVALID:${id}`)
  }
  if (internalTrace.bos_projection.status !== 'NO_AUTHORIZED_JOINT_CLAIMS' || internalTrace.bos_projection.claims.length !== 0) throw new Error('ATHLETE_APA_PARITY_PRIVATE_BOS_LEAK')
  const customerText = JSON.stringify(view)
  if (/36934ae|21dad929|fb6745f0|sourceArtifact|stateHash|chain.of.thought|scholarship probability|selection score/iu.test(customerText)) throw new Error('ATHLETE_APA_PARITY_INTERNAL_OR_UNSAFE_LANGUAGE')
  if (internalTrace.provider_calls !== 0 || internalTrace.network_calls !== 0 || internalTrace.customer_mutation !== false || internalTrace.persistence_writes !== 0) throw new Error('ATHLETE_APA_PARITY_SIDE_EFFECT_INVALID')
  return true
}

export const ATHLETE_APA_PARITY_V1 = buildAthleteApaParityV1()
