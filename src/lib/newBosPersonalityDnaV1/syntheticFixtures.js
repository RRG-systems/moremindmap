import { RICH_SYNTHETIC_FIXTURE } from './richSyntheticFixture.js';

function inference({ id, statement, evidence, counter = [], confidence = 'SUPPORTED_HYPOTHESIS', change, ...rest }) {
  return Object.freeze({
    id,
    statement,
    evidence_refs: Object.freeze(evidence),
    counterevidence_refs: Object.freeze(counter),
    confounds: Object.freeze(rest.confounds || []),
    confidence,
    what_would_change_it: change,
    ...rest,
  });
}

function evidence(evidenceId, epistemicClass, sourceRef, content) {
  return Object.freeze({
    evidence_id: evidenceId,
    epistemic_class: epistemicClass,
    source_ref: sourceRef,
    exact_content: content,
  });
}

function render({ eyebrow, headline, summary, highlights = [], ...extra }) {
  return Object.freeze({ eyebrow, headline, summary, highlights: Object.freeze(highlights), ...extra });
}

function atlasRenderings() {
  return Object.freeze({
    this_is_you: render({
      eyebrow: 'Recognition',
      headline: 'You create motion by making the unclear usable.',
      summary: 'When a group is circling, you usually find the decision hiding inside the discussion and give everyone a way to move. The relief is immediate. The quieter cost is that people can begin waiting for your clarity instead of building their own.',
      highlights: ['You are comfortable revising a route without surrendering the destination.', 'Your most useful decisiveness can also become the team’s permission system.'],
    }),
    personality_dna: render({
      eyebrow: 'Visual DNA',
      headline: 'Fast commitment, flexible route, selective scaffolding.',
      summary: 'Your map shows a strong pull toward movement and practical adjustment. You use process when it protects handoffs, but you resist process that exists mainly to reassure the process-maker.',
      highlights: ['Movement is a tool, not a need for noise.', 'Clarity matters most at the point of ownership.'],
    }),
    how_you_operate: render({
      eyebrow: 'Operating mechanics',
      headline: 'You decide early enough to learn from reality.',
      summary: 'You prefer a bounded decision that creates new information over a perfect answer that arrives after the useful window. Once evidence changes, you can change the route quickly. Follow-through becomes less reliable when ownership remains conversational instead of visible.',
      highlights: ['Best at turning ambiguity into a testable direction.', 'Needs explicit handoffs when several people share the work.'],
    }),
    how_people_experience_you: render({
      eyebrow: 'Interpersonal experience',
      headline: 'In a healthy room, you feel clarifying. In a stalled room, you can feel final.',
      summary: 'People are likely to appreciate that you name the decision and protect momentum. Under frustration, your compression of a long discussion into one next step may leave slower processors feeling that their unfinished thinking no longer has room.',
      highlights: ['Appreciated for direction without rigidity.', 'Potential misunderstanding: speed can look like certainty.'],
    }),
    communication_dna: render({
      eyebrow: 'Communication',
      headline: 'Direct, concise, and most persuasive when the reasoning is visible.',
      summary: 'You tend to speak in decisions, tradeoffs, and next actions. Your communication becomes easier to follow when you show the two or three facts behind the call before naming the call itself.',
      highlights: ['Natural mode: headline first.', 'Repair move: ask what the other person believes was ruled out.'],
    }),
    strengths_vulnerabilities: render({
      eyebrow: 'Strength and shadow',
      headline: 'The strength is usable clarity. The shadow is borrowed agency.',
      summary: 'You can give a team traction when uncertainty is expensive. If that strength is supplied too often, the team may become excellent at executing your judgment and weak at producing judgment without you.',
      highlights: ['Strength: decisive learning loops.', 'Overuse cost: other people wait for the integrator.'],
    }),
    pressure_conflict: render({
      eyebrow: 'Pressure shift',
      headline: 'Pressure shortens your explanation before it changes your care.',
      summary: 'When the stakes rise, you narrow toward the decision and may omit the relational runway that is normally present. Recovery is strongest when you return to explain the calculation, not merely soften the delivery.',
      highlights: ['Normal: clear and adjustable.', 'Pressure: compressed and harder to question.', 'Recovery: reopen the reasoning.'],
    }),
    work_dna: render({
      eyebrow: 'Work environment',
      headline: 'Give you consequential ambiguity, ownership, and a real feedback loop.',
      summary: 'You are likely to do your best work where decisions matter, iteration is allowed, and progress can be observed. Dense approval chains and ceremonial process consume more energy than difficult work does.',
      highlights: ['Energizers: ownership, motion, visible learning.', 'Drains: permission loops with no decision owner.'],
    }),
    role_seat: render({
      eyebrow: 'Role & seat',
      headline: 'Natural fit: direction-setting builder with bounded operating authority.',
      summary: 'The supportable fit is not “leader” in the abstract. It is a seat where incomplete information must become a coherent path, while another owner helps make the resulting operating rules durable.',
      highlights: ['Fit class: Natural Fit.', 'Condition: explicit partner for durable handoffs.', 'Evidence boundary: based on fictional project history, not a universal role guarantee.'],
    }),
    cognitive_operating_style: render({
      eyebrow: 'Applied reasoning',
      headline: 'You think by converting uncertainty into a sequence of learnable moves.',
      summary: 'The strongest evidence supports practical synthesis: holding a destination, identifying the next consequential variable, and updating after contact with reality. This says nothing about an IQ score or universal ranking.',
      highlights: ['Supported: practical synthesis and scenario adjustment.', 'Still learning: performance in highly abstract, research-only work.'],
    }),
    personal_operating_energy: render({
      eyebrow: 'Operating energy',
      headline: 'Progress activates you; permission debt depletes you.',
      summary: 'Your engagement appears to rise when a decision creates motion and someone owns the result. The current evidence does not establish a stable baseline outside work or a long-term direction of travel.',
      highlights: ['Baseline: still learning.', 'Current state: activated by consequential building.', 'Direction of travel: insufficient longitudinal evidence.'],
    }),
    five_futures: render({
      eyebrow: 'Conditional trajectories',
      headline: 'Five futures turn on whether your clarity becomes transferable.',
      summary: 'These are conditional behavioral trajectories, not forecasts.',
      futures: Object.freeze([
        { label: 'The Multiplier', condition: 'If decision rules become visible', trajectory: 'Others begin producing sound calls without waiting for you.' },
        { label: 'The Bottleneck', condition: 'If every ambiguous issue still rises to you', trajectory: 'Growth increases the volume of decisions only you can finish.' },
        { label: 'The Operator', condition: 'If the feedback loop stays fast and ownership stays bounded', trajectory: 'You remain energized by building and iteration.' },
        { label: 'The Friction Loop', condition: 'If pressure keeps compressing context', trajectory: 'The team executes but stops surfacing unfinished concerns.' },
        { label: 'The Durable Builder', condition: 'If clarity is paired with explicit handoff design', trajectory: 'The organization keeps the standard without borrowing your attention.' },
      ]),
    }),
    one_move: render({
      eyebrow: 'Intervention',
      headline: 'Make one decision rule travel without you.',
      summary: 'Choose one recurring decision that currently comes back to you. Before deciding it, write the threshold, the tradeoff, and the owner who can act. Let that owner run the next three instances and review only the exceptions.',
      experiment: 'For three occurrences, track whether the owner can explain the rule and make the call before asking you.',
      protects: 'Preserves your clarity while testing whether it can become shared judgment.',
    }),
    evidence_certainty: render({
      eyebrow: 'Make your map alive — the validation',
      headline: 'Strong evidence for decisive adjustment; less evidence for sustainable transfer.',
      summary: 'We know the fictional subject reports making bounded calls and revising routes. We strongly believe visible ownership is the governing scaling tension. We are still learning how peers experience the pace, and we do not infer a long-term energy baseline.',
      highlights: ['Known: reported decision and revision episodes.', 'Strongly believe: clarity creates motion and dependency risk.', 'Conflict: values autonomy but often becomes the decision point.', 'Abstention: no clinical, IQ, or long-term energy claim.'],
    }),
    operating_identity: render({
      eyebrow: 'Operating identity',
      headline: 'The Adaptive Pathfinder',
      summary: 'You make the next path visible before every uncertainty is gone. Your next edge is making the path reusable, not merely making it clear.',
      highlights: ['A memorable distillation, not a fixed type.'],
    }),
  });
}

function harborRenderings() {
  return Object.freeze({
    this_is_you: render({
      eyebrow: 'Recognition',
      headline: 'You protect the room by noticing what haste would damage.',
      summary: 'You often see the unspoken dependency, the person not yet ready to agree, and the detail that will matter after the meeting ends. That care makes work safer. It can also keep you in quiet preparation after the group needs a visible recommendation.',
      highlights: ['You lower preventable relational and execution error.', 'Your caution can become invisible labor.'],
    }),
    personality_dna: render({
      eyebrow: 'Visual DNA',
      headline: 'Measured pace, high context, durable follow-through.',
      summary: 'Your map is organized around careful sensing, dependable standards, and long-view consequences. Influence tends to come through trust and preparation rather than force or performance.',
      highlights: ['You prefer earned confidence to fast certainty.', 'Consistency is a form of care.'],
    }),
    how_you_operate: render({
      eyebrow: 'Operating mechanics',
      headline: 'You reduce uncertainty before you ask others to live with a decision.',
      summary: 'You gather context, map dependencies, and look for the downstream burden. This creates reliable execution. The cost appears when additional context no longer changes the choice but still delays your recommendation.',
      highlights: ['Best at seeing second-order effects.', 'Decision edge: name the point where more input stops changing the call.'],
    }),
    how_people_experience_you: render({
      eyebrow: 'Interpersonal experience',
      headline: 'Steady, thoughtful, and sometimes harder to read than you intend.',
      summary: 'People are likely to feel considered because you notice nuance and avoid careless disruption. When you keep a concern private until it is fully formed, they may mistake your calm for agreement.',
      highlights: ['Appreciated for steadiness and care.', 'Potential misunderstanding: quiet processing can look like consent.'],
    }),
    communication_dna: render({
      eyebrow: 'Communication',
      headline: 'Context-rich, low-heat, and strongest when the recommendation arrives earlier.',
      summary: 'You tend to explain the conditions around a choice so others understand its consequences. Your message becomes more usable when you lead with the provisional recommendation, then add the context that could change it.',
      highlights: ['Natural mode: context before conclusion.', 'Repair move: state disagreement while it is still small.'],
    }),
    strengths_vulnerabilities: render({
      eyebrow: 'Strength and shadow',
      headline: 'The strength is dependable stewardship. The shadow is delayed visibility.',
      summary: 'You protect quality and relationships by thinking beyond the immediate win. Overused, that care can hide your judgment until the organization has already begun moving without it.',
      highlights: ['Strength: durable, humane execution.', 'Overuse cost: important dissent arrives late.'],
    }),
    pressure_conflict: render({
      eyebrow: 'Pressure shift',
      headline: 'Pressure makes you contain more, not care less.',
      summary: 'When tension rises, you may absorb the discomfort, collect more context, and wait for a cleaner moment. Recovery improves when you surface the unresolved issue early and explicitly label what is fact, concern, and request.',
      highlights: ['Normal: thoughtful and available.', 'Pressure: inward processing and delayed challenge.', 'Recovery: bounded candor.'],
    }),
    work_dna: render({
      eyebrow: 'Work environment',
      headline: 'Give you meaningful stewardship, real context, and time to make work durable.',
      summary: 'You are likely to thrive where quality, trust, and downstream consequences matter. Constant interruption, performative urgency, and roles that reward volume over care can erode your best contribution.',
      highlights: ['Energizers: stewardship, coherence, useful continuity.', 'Drains: urgency without consequence mapping.'],
    }),
    role_seat: render({
      eyebrow: 'Role & seat',
      headline: 'Adaptable fit: operational steward with explicit decision rights.',
      summary: 'The evidence supports roles that combine continuity, human context, and quality ownership. The fit improves when the seat also requires visible recommendations; otherwise your best judgment may remain advisory and late.',
      highlights: ['Fit class: Adaptable Fit.', 'Condition: clear authority to recommend, not only support.', 'Evidence boundary: one fictional work domain is represented.'],
    }),
    cognitive_operating_style: render({
      eyebrow: 'Applied reasoning',
      headline: 'You reason through dependencies, consequences, and human context.',
      summary: 'The evidence supports careful integration and second-order thinking in familiar operating situations. It does not support an IQ estimate, universal ranking, or a claim about every cognitive domain.',
      highlights: ['Supported: consequence mapping and integrative judgment.', 'Still learning: rapid reasoning in unfamiliar high-noise domains.'],
    }),
    personal_operating_energy: render({
      eyebrow: 'Operating energy',
      headline: 'Meaningful continuity sustains you; unresolved relational debt accumulates.',
      summary: 'Your effort appears steady when you can see that careful work protects people or prevents downstream harm. The fictional evidence suggests recovery through quiet consolidation, but does not establish current wellbeing.',
      highlights: ['Baseline: steady task engagement is supported.', 'Current state: not measured.', 'Direction of travel: insufficient evidence.'],
    }),
    five_futures: render({
      eyebrow: 'Conditional trajectories',
      headline: 'Five futures turn on whether care becomes visible authority.',
      summary: 'These are conditional behavioral trajectories, not forecasts.',
      futures: Object.freeze([
        { label: 'The Trusted Steward', condition: 'If recommendations become visible earlier', trajectory: 'Care and judgment shape the decision before rework begins.' },
        { label: 'The Quiet Buffer', condition: 'If discomfort stays privately contained', trajectory: 'The system feels calm while you absorb an increasing share of its friction.' },
        { label: 'The Durable Operator', condition: 'If decision rights match accountability', trajectory: 'Your attention to consequences becomes an operating advantage.' },
        { label: 'The Late Dissenter', condition: 'If context gathering has no stopping rule', trajectory: 'Correct concerns arrive after momentum has hardened.' },
        { label: 'The Human System Builder', condition: 'If care is translated into visible standards', trajectory: 'Reliability becomes shared practice rather than personal vigilance.' },
      ]),
    }),
    one_move: render({
      eyebrow: 'Intervention',
      headline: 'State the provisional recommendation before the full explanation.',
      summary: 'In one recurring meeting, name your recommendation in the first five minutes, identify the one fact that could change it, and then provide the context. This tests whether earlier visibility improves the decision without sacrificing care.',
      experiment: 'For four meetings, record whether the group engages your judgment earlier and whether the recommendation changes after discussion.',
      protects: 'Preserves nuance while reducing the cost of late clarity.',
    }),
    evidence_certainty: render({
      eyebrow: 'Make your map alive — the validation',
      headline: 'Strong evidence for careful stewardship; limited evidence about external perception.',
      summary: 'We know the fictional subject reports dependency mapping and deliberate recommendations. We strongly believe quiet processing can delay visible dissent. We are still learning whether colleagues experience that as calm, ambiguity, or both.',
      highlights: ['Known: reported examples of consequence mapping.', 'Strongly believe: care improves quality and can delay visibility.', 'Conflict: wants inclusion but sometimes withholds unfinished concerns.', 'Abstention: no claim about current wellbeing or broad intellect.'],
    }),
    operating_identity: render({
      eyebrow: 'Operating identity',
      headline: 'The Consequence Keeper',
      summary: 'You notice what the room will have to live with after the decision. Your next edge is letting that judgment enter the room sooner.',
      highlights: ['A memorable distillation, not a fixed type.'],
    }),
  });
}

function lanternRenderings() {
  return Object.freeze({
    this_is_you: render({
      eyebrow: 'Recognition',
      headline: 'You create possibility quickly—and your evidence is still catching up with your range.',
      summary: 'The available fictional answers show someone who generates options, recruits energy, and changes routes readily. They do not yet show how you behave through a long ownership cycle, so the honest map stays open there.',
      highlights: ['You make stalled work feel possible again.', 'We do not yet know which forms of responsibility you sustain best.'],
    }),
    personality_dna: render({
      eyebrow: 'Visual DNA',
      headline: 'High motion, social activation, open routes—and explicit blank space.',
      summary: 'Your map shows strong initial movement and option creation. Several coordinates are well supported; work context, recovery, and durable follow-through remain deliberately unfilled rather than guessed.',
      highlights: ['Possibility comes quickly.', 'Blank space is evidence discipline, not a defect.'],
    }),
    how_you_operate: render({
      eyebrow: 'Operating mechanics',
      headline: 'You discover the route by starting, sharing, and revising.',
      summary: 'You appear to learn through active trials and live response. This can unlock work that is stuck in analysis. The current packet cannot establish what happens when novelty fades or maintenance becomes the main job.',
      highlights: ['Supported: rapid option generation and route change.', 'Unknown: long-cycle maintenance and completion under repetition.'],
    }),
    how_people_experience_you: render({
      eyebrow: 'Interpersonal experience',
      headline: 'Likely energizing at the beginning; later-state experience is unknown.',
      summary: 'The evidence supports a hypothesis that your visible enthusiasm helps people enter uncertain work. There is no external observer evidence, so claims about how coworkers experience you remain tentative.',
      highlights: ['Hypothesis: possibility feels contagious.', 'Abstention: no factual coworker-perception claim.'],
    }),
    communication_dna: render({
      eyebrow: 'Communication',
      headline: 'Fast, generative, and oriented toward what could work.',
      summary: 'You report thinking aloud and building on live reactions. That style may help ideation; the packet does not establish listening behavior, conflict repair, or detail calibration.',
      highlights: ['Supported: idea-forward, interactive communication.', 'Unknown: disagreement, repair, and precision under stakes.'],
    }),
    strengths_vulnerabilities: render({
      eyebrow: 'Strength and shadow',
      headline: 'The strength is ignition. The possible shadow is unfinished transfer.',
      summary: 'You can create options and social momentum quickly. It is plausible—but not yet established—that the next owner may receive energy without enough closure conditions.',
      highlights: ['Strength: starting movement.', 'Tentative overuse cost: novelty outruns completion design.'],
    }),
    pressure_conflict: render({
      eyebrow: 'Pressure shift',
      headline: 'Insufficient evidence for a pressure or recovery pattern.',
      summary: 'The packet contains no credible pressure episode, conflict example, or recovery history. The responsible result is an open question, not a generic stress profile.',
      highlights: ['Needed: one consequential conflict episode.', 'Needed: what changed during recovery.'],
    }),
    work_dna: render({
      eyebrow: 'Work environment',
      headline: 'Early evidence favors generative, interactive work; durable fit is unknown.',
      summary: 'Option creation and live iteration appear activating. There is not enough role history to distinguish a natural work fit from a short-term preference or a context-specific response.',
      highlights: ['Tentative energizer: generative collaboration.', 'Abstention: no claim about ideal job or management environment.'],
    }),
    role_seat: render({
      eyebrow: 'Role & seat',
      headline: 'Insufficient Evidence',
      summary: 'No governed role-success envelope can be selected from the available fictional packet. A title, industry, and at least two outcome-bearing work episodes are required before fit can be responsibly classified.',
      highlights: ['Fit class: Insufficient Evidence.', 'No role recommendation is being made.'],
    }),
    cognitive_operating_style: render({
      eyebrow: 'Applied reasoning',
      headline: 'Tentative evidence for divergent option generation.',
      summary: 'The answers support idea fluency in one low-stakes context. They do not establish synthesis quality, learning velocity, broad creativity, or any IQ-like conclusion.',
      highlights: ['Tentative: divergent option generation.', 'Unknown: decomposition, synthesis, and transfer across domains.'],
    }),
    personal_operating_energy: render({
      eyebrow: 'Operating energy',
      headline: 'Activation is visible; baseline and recovery are not.',
      summary: 'The fictional subject reports gaining energy from new possibilities and live exchange. We cannot infer stable drive, resilience, optimism, current state, or direction of travel from that alone.',
      highlights: ['Supported: situational activation.', 'Abstention: stable energy and recovery profile.'],
    }),
    five_futures: render({
      eyebrow: 'Conditional trajectories',
      headline: 'Five futures remain deliberately provisional.',
      summary: 'With thin history, each trajectory is a question to validate—not a forecast.',
      futures: Object.freeze([
        { label: 'The Igniter', condition: 'If others reliably own completion', trajectory: 'Your option-making creates repeated starts that reach useful outcomes.' },
        { label: 'The Serial Restart', condition: 'If novelty repeatedly replaces closure', trajectory: 'Movement stays high while finished value remains inconsistent.' },
        { label: 'The Creative Partner', condition: 'If listening and synthesis are externally confirmed', trajectory: 'Live ideation becomes a shared problem-solving asset.' },
        { label: 'The Overextended Explorer', condition: 'If every interesting route remains open', trajectory: 'Attention fragments across too many promising paths.' },
        { label: 'The Evidence-Built Operator', condition: 'If completion and recovery episodes are captured', trajectory: 'The map becomes specific enough to guide role and intervention choices.' },
      ]),
    }),
    one_move: render({
      eyebrow: 'Intervention',
      headline: 'Close one loop before opening the next.',
      summary: 'For one week, choose a single small idea and define “done,” the owner, and the evidence of usefulness before beginning. Do not treat success as proof of a permanent trait; use it to collect the missing follow-through evidence.',
      experiment: 'Record whether the loop closed, what changed after novelty faded, and who carried the final step.',
      protects: 'Keeps possibility alive while testing completion mechanics.',
    }),
    evidence_certainty: render({
      eyebrow: 'Make your map alive — the validation',
      headline: 'The strongest finding is where the map refuses to pretend.',
      summary: 'We know the fictional subject reports fast option generation and live experimentation. Most pressure, role, leadership, recovery, and long-cycle claims remain unknown.',
      highlights: ['Known: self-reported option generation.', 'Tentative: social activation and rapid learning through action.', 'Conflict: freedom is valued, but one answer also asks for clear milestones.', 'Abstention: role fit, leadership, conflict, recovery, and durable persistence.'],
    }),
    operating_identity: render({
      eyebrow: 'Operating identity',
      headline: 'The Possibility Starter — provisionally',
      summary: 'You help work begin by making more routes visible. The rest of the identity remains open until completed cycles show what you can reliably carry.',
      highlights: ['A provisional distillation, not a fixed type.'],
    }),
  });
}

const ATLAS_RAW = Object.freeze({
  version: 'synthetic_raw_evidence_v1',
  synthetic: true,
  subject_token: 'SYNTH-PDNV1-ATLAS',
  source_artifact_ids: Object.freeze(['fixture_atlas_assessment_v1', 'fixture_atlas_history_v1']),
  identity_context: Object.freeze({ display_name: 'Atlas', role: 'Fictional product studio lead', context: 'Synthetic validation fixture; not a real person.' }),
  scores: Object.freeze({ command: 84, tempo: 78, relational_awareness: 55, precision: 62, leverage: 71, adaptability: 76, structure: 39, perspective: 67 }),
  score_source_refs: Object.freeze(Object.fromEntries(['command', 'tempo', 'relational_awareness', 'precision', 'leverage', 'adaptability', 'structure', 'perspective'].map((id) => [id, ['fixture_atlas_assessment_v1']]))),
  questions: Object.freeze([
    { question_id: 'q01', exact_question: 'When a group cannot agree on a next step, what do you do?', exact_answer: 'I name the decision we are actually avoiding, choose a reversible route, and put a review point on the calendar.' },
    { question_id: 'q02', exact_question: 'Describe a time you changed course.', exact_answer: 'A prototype contradicted our plan, so I kept the outcome and changed the sequence the same afternoon.' },
    { question_id: 'q03', exact_question: 'What work keeps returning to you?', exact_answer: 'Decisions with fuzzy ownership. People wait for me to turn the conversation into a call.' },
    { question_id: 'q04', exact_question: 'What operating habit do you resist?', exact_answer: 'Documentation before we know which decision is worth documenting.' },
  ]),
  structured_inputs: Object.freeze([{ field: 'preferred_decision_window', exact_value: 'same_day_when_reversible' }]),
  evidence: Object.freeze([
    evidence('e01', 'self_report', 'q01', 'Names avoided decision, selects reversible route, schedules review.'),
    evidence('e02', 'observed_history', 'q02', 'Changed sequence after prototype evidence while retaining intended outcome.'),
    evidence('e03', 'self_report', 'q03', 'Fuzzy-ownership decisions repeatedly return to the subject.'),
    evidence('e04', 'self_report', 'q04', 'Resists premature documentation.'),
    evidence('e05', 'contradiction', 'cross_answer:q01:q04', 'Uses explicit review points while resisting early process.'),
    evidence('e06', 'outcome_evidence', 'fixture_atlas_history_v1:event_02', 'A fictional project shipped after decision ownership was made explicit.'),
  ]),
  contradictions: Object.freeze([{ contradiction_id: 'c01', evidence_refs: ['e04', 'e05'], statement: 'Resists premature process but voluntarily creates bounded checkpoints.' }]),
  uncertainties: Object.freeze(['No external observer evidence for interpersonal impact.', 'No non-work energy history.']),
  abstentions: Object.freeze(['No clinical inference.', 'No IQ inference.', 'No stable wellbeing or recovery claim.']),
});

const ATLAS_DRAFT = Object.freeze({
  topology: Object.freeze([
    inference({ id: 't01', statement: 'Early commitment and route flexibility work together as a learning loop.', evidence: ['e01', 'e02'], confidence: 'STRONGLY_SUPPORTED', change: 'Repeated examples of waiting for complete certainty before reversible decisions.', dimensions: ['command', 'tempo', 'adaptability'], dynamic_roles: ['initiating_driver', 'sequencing_regulator', 'contextual_moderator'] }),
    inference({ id: 't02', statement: 'Selective process acts as a handoff brake only after useful uncertainty has been reduced.', evidence: ['e01', 'e04', 'e05'], counter: ['e06'], change: 'Evidence that durable process is consistently created before ownership problems emerge.', dimensions: ['structure', 'precision', 'perspective'], dynamic_roles: ['delayed_capability', 'quality_qualifier', 'boundary_regulator'] }),
  ]),
  attributes: Object.freeze([
    inference({ id: 'a01', statement: 'Decision speed is high when the choice is reversible.', evidence: ['e01', 'e02'], confidence: 'STRONGLY_SUPPORTED', change: 'Examples of comparable reversible choices being delayed.', subdimensions: { activation_speed: 'high', revision_latency: 'low' } }),
    inference({ id: 'a02', statement: 'Follow-through is strongest when ownership and review conditions are visible.', evidence: ['e01', 'e03', 'e06'], confidence: 'SUPPORTED_HYPOTHESIS', change: 'Projects with ambiguous ownership completing reliably without subject intervention.', subdimensions: { personal_completion: 'supported', transfer_completion: 'still_learning' } }),
  ]),
  dynamics: Object.freeze([
    inference({ id: 'd01', statement: 'The subject converts ambiguity into a reversible call, producing movement while risking dependency on personal judgment.', evidence: ['e01', 'e03', 'e06'], counter: ['e02'], confidence: 'STRONGLY_SUPPORTED', change: 'Other owners repeatedly making comparable calls without escalation.', trigger: 'group ambiguity', private_calculation: 'A workable direction now creates better information than another abstract discussion.', action: 'name and bound the decision', payoff: 'movement and learning', delayed_cost: 'judgment may remain person-dependent' }),
    inference({ id: 'd02', statement: 'Premature process is avoided to protect learning speed, but delayed codification can create transfer debt.', evidence: ['e04', 'e05'], counter: ['e01'], confidence: 'SUPPORTED_HYPOTHESIS', change: 'Early lightweight rules proving equally adaptive and more transferable.', trigger: 'process before evidence', private_calculation: 'Do not harden a rule before reality teaches us what matters.', action: 'defer codification', payoff: 'preserved flexibility', delayed_cost: 'repeat decisions return to the subject' }),
  ]),
  specialized: Object.freeze({ pressure: { confidence: 'TENTATIVE', state: 'explanation_compression' }, communication: { confidence: 'SUPPORTED_HYPOTHESIS', style: 'headline_and_action_first' }, work: { confidence: 'STRONGLY_SUPPORTED', environment: 'consequential ambiguity with bounded authority' }, role: { confidence: 'SUPPORTED_HYPOTHESIS', fit: 'NATURAL_FIT', envelope: 'direction-setting builder with handoff partner' }, leadership: { confidence: 'SUPPORTED_HYPOTHESIS', pattern: 'creates clarity; must distribute judgment' }, cognition: { confidence: 'SUPPORTED_HYPOTHESIS', indicators: ['practical synthesis', 'scenario adjustment'] }, energy: { confidence: 'INSUFFICIENT_EVIDENCE', state: 'situational activation only' } }),
  sequences: Object.freeze([{ sequence_id: 's01', steps: ['ambiguity appears', 'decision is bounded', 'route begins', 'new evidence arrives', 'route adjusts'] }]),
  strengths_and_overuse: Object.freeze([{ strength: 'usable clarity', overuse: 'borrowed agency', dynamic_ref: 'd01' }]),
  compensation: Object.freeze([{ statement: 'Review points compensate for resistance to premature process.', evidence_refs: ['e01', 'e04', 'e05'] }]),
  whole_person: Object.freeze({
    core_explanation: 'This person creates movement by turning uncertainty into a bounded choice, then learns from what reality returns.',
    central_tension: 'The same clarity that frees a group to move can teach the group to wait for one person to create clarity.',
    mechanisms: Object.freeze(['When discussion stops producing information, a reversible call creates a live learning loop.', 'Rules are welcomed after their usefulness is visible, which preserves movement but can delay transfer.']),
    identity_tensions: Object.freeze(['Wants other people to own outcomes while often becoming the fastest route to a usable decision.']),
    goal_conflicts: Object.freeze(['Wants scalable ownership while repeatedly solving the ambiguity that would force others to build judgment.']),
    private_calculations: Object.freeze(['A workable move now is more valuable than an elegant answer after the window closes.']),
    pressure_and_recovery: 'Under strain, explanation may shorten before care changes; reopening the reasoning is the likely repair.',
    work_and_relationships: 'Best evidence supports consequential, iterative work with bounded authority and an explicit handoff partner.',
    identity_distillation: 'The Adaptive Pathfinder',
    evidence_refs: Object.freeze(['e01', 'e02', 'e03', 'e04', 'e05', 'e06']),
    confidence: 'SUPPORTED_HYPOTHESIS',
    what_would_change_it: 'External observation showing that decisions and handoffs routinely succeed without this person becoming the integrator.',
  }),
  abstentions: Object.freeze(['External coworker experience remains hypothesis only.', 'Long-term energy and recovery remain unknown.']),
  validation_backlog: Object.freeze(['Observe three handoffs without subject intervention.', 'Collect one external description of decision pace.']),
  surface_claims: Object.freeze({ five_futures: ['d01', 'd02', 'a02'], one_move: ['d01', 'a02'], role_seat: ['a02', 'd01'] }),
  surface_renderings: atlasRenderings(),
});

const HARBOR_RAW = Object.freeze({
  version: 'synthetic_raw_evidence_v1',
  synthetic: true,
  subject_token: 'SYNTH-PDNV1-HARBOR',
  source_artifact_ids: Object.freeze(['fixture_harbor_assessment_v1', 'fixture_harbor_history_v1']),
  identity_context: Object.freeze({ display_name: 'Harbor', role: 'Fictional service operations coordinator', context: 'Synthetic validation fixture; not a real person.' }),
  scores: Object.freeze({ command: 31, tempo: 28, relational_awareness: 86, precision: 81, leverage: 43, adaptability: 52, structure: 79, perspective: 84 }),
  score_source_refs: Object.freeze(Object.fromEntries(['command', 'tempo', 'relational_awareness', 'precision', 'leverage', 'adaptability', 'structure', 'perspective'].map((id) => [id, ['fixture_harbor_assessment_v1']]))),
  questions: Object.freeze([
    { question_id: 'q01', exact_question: 'What do you notice before a decision?', exact_answer: 'Who has to live with it, what breaks later, and whether the person who is quiet actually agrees.' },
    { question_id: 'q02', exact_question: 'Describe a difficult recommendation.', exact_answer: 'I mapped three dependencies, then waited too long to say which option I thought we should choose.' },
    { question_id: 'q03', exact_question: 'How do you handle disagreement?', exact_answer: 'I try to understand every side. Sometimes people think I agree because I have not said my concern yet.' },
    { question_id: 'q04', exact_question: 'What creates satisfying work?', exact_answer: 'Leaving something more reliable and less confusing for the next person.' },
  ]),
  structured_inputs: Object.freeze([{ field: 'preferred_review_mode', exact_value: 'prepared_context_then_discussion' }]),
  evidence: Object.freeze([
    evidence('e01', 'self_report', 'q01', 'Tracks downstream consequences and quiet disagreement.'),
    evidence('e02', 'observed_history', 'q02', 'Mapped dependencies but delayed a recommendation.'),
    evidence('e03', 'self_report', 'q03', 'Seeks multiple views and sometimes leaves own concern unstated.'),
    evidence('e04', 'self_report', 'q04', 'Values reliability and reduced confusion for future operators.'),
    evidence('e05', 'contradiction', 'cross_answer:q01:q03', 'Notices disagreement while sometimes making personal disagreement difficult to detect.'),
    evidence('e06', 'outcome_evidence', 'fixture_harbor_history_v1:event_01', 'A fictional handoff checklist reduced repeat clarification in one service workflow.'),
  ]),
  contradictions: Object.freeze([{ contradiction_id: 'c01', evidence_refs: ['e01', 'e03', 'e05'], statement: 'Protects inclusion while sometimes withholding unfinished dissent.' }]),
  uncertainties: Object.freeze(['Only one work domain is represented.', 'No external observer account of interpersonal experience.']),
  abstentions: Object.freeze(['No clinical inference.', 'No IQ inference.', 'No current wellbeing claim.']),
});

const HARBOR_DRAFT = Object.freeze({
  topology: Object.freeze([
    inference({ id: 't01', statement: 'Relational sensing and consequence mapping slow commitment until downstream burden feels understood.', evidence: ['e01', 'e02', 'e03'], confidence: 'STRONGLY_SUPPORTED', change: 'Comparable decisions routinely made before dependencies are mapped.', dimensions: ['relational_awareness', 'perspective', 'precision', 'tempo'], dynamic_roles: ['initiating_driver', 'contextual_moderator', 'quality_qualifier', 'sequencing_regulator'] }),
    inference({ id: 't02', statement: 'Low-force influence is amplified by durable operating artifacts.', evidence: ['e04', 'e06'], confidence: 'SUPPORTED_HYPOTHESIS', change: 'Reliable outcomes depending primarily on positional authority or forceful persuasion.', dimensions: ['leverage', 'structure', 'relational_awareness'], dynamic_roles: ['delayed_capability', 'amplifier', 'boundary_regulator'] }),
  ]),
  attributes: Object.freeze([
    inference({ id: 'a01', statement: 'Decision latency rises when human and downstream consequences remain unresolved.', evidence: ['e01', 'e02'], confidence: 'STRONGLY_SUPPORTED', change: 'High-consequence recommendations arriving early without full dependency mapping.', subdimensions: { activation_speed: 'deliberate', consequence_mapping: 'high' } }),
    inference({ id: 'a02', statement: 'Follow-through emphasizes durability for the next operator.', evidence: ['e04', 'e06'], confidence: 'STRONGLY_SUPPORTED', change: 'Repeated preference for personal completion without transferable artifacts.', subdimensions: { durability: 'high', visible_recommendation: 'variable' } }),
  ]),
  dynamics: Object.freeze([
    inference({ id: 'd01', statement: 'The subject gathers context to protect people and downstream quality, which improves durability but can delay visible judgment.', evidence: ['e01', 'e02', 'e04'], counter: ['e06'], confidence: 'STRONGLY_SUPPORTED', change: 'Evidence that earlier recommendations reduce care or durability.', trigger: 'consequential decision', private_calculation: 'A fast answer is not useful if other people inherit avoidable harm.', action: 'map dependencies and perspectives', payoff: 'safer, more durable choice', delayed_cost: 'recommendation arrives after momentum forms' }),
    inference({ id: 'd02', statement: 'Containing disagreement preserves short-term calm while making the subject harder to read.', evidence: ['e03', 'e05'], confidence: 'SUPPORTED_HYPOTHESIS', change: 'External evidence that concerns are consistently visible early.', trigger: 'unfinished disagreement', private_calculation: 'Do not create friction before the concern is coherent.', action: 'continue processing privately', payoff: 'lower immediate heat', delayed_cost: 'others may infer agreement' }),
  ]),
  specialized: Object.freeze({ pressure: { confidence: 'SUPPORTED_HYPOTHESIS', state: 'contain_and_process' }, communication: { confidence: 'STRONGLY_SUPPORTED', style: 'context_before_recommendation' }, work: { confidence: 'STRONGLY_SUPPORTED', environment: 'meaningful stewardship with decision rights' }, role: { confidence: 'SUPPORTED_HYPOTHESIS', fit: 'ADAPTABLE_FIT', envelope: 'operational steward with visible recommendation authority' }, leadership: { confidence: 'TENTATIVE', pattern: 'protective stewardship; formal leadership evidence thin' }, cognition: { confidence: 'SUPPORTED_HYPOTHESIS', indicators: ['dependency mapping', 'second-order consequence reasoning'] }, energy: { confidence: 'TENTATIVE', state: 'steady engagement around meaningful continuity' } }),
  sequences: Object.freeze([{ sequence_id: 's01', steps: ['consequence appears', 'dependencies are mapped', 'perspectives are gathered', 'recommendation waits', 'durable action follows'] }]),
  strengths_and_overuse: Object.freeze([{ strength: 'dependable stewardship', overuse: 'delayed visibility', dynamic_ref: 'd01' }]),
  compensation: Object.freeze([{ statement: 'Durable artifacts allow quiet influence to travel after the conversation.', evidence_refs: ['e04', 'e06'] }]),
  whole_person: Object.freeze({
    core_explanation: 'This person protects decisions from the harm that haste, missing context, and unspoken disagreement can create.',
    central_tension: 'The care used to make a recommendation responsible can keep the recommendation invisible until the room has already moved.',
    mechanisms: Object.freeze(['Downstream burden is mapped before a choice is endorsed.', 'Unfinished concern is privately contained to reduce immediate heat, which can make disagreement hard to detect.']),
    identity_tensions: Object.freeze(['Wants people included in decisions while sometimes excluding the room from unfinished personal judgment.']),
    goal_conflicts: Object.freeze(['Wants durable coordination but can delay the visible signal that coordination needs.']),
    private_calculations: Object.freeze(['A decision is not complete until the people inheriting it can live with its consequences.']),
    pressure_and_recovery: 'Under strain, more is likely to be contained internally; recovery requires separating fact, concern, and request in the open.',
    work_and_relationships: 'Best evidence supports stewardship work where context, quality, and human consequences matter and recommendation rights are explicit.',
    identity_distillation: 'The Consequence Keeper',
    evidence_refs: Object.freeze(['e01', 'e02', 'e03', 'e04', 'e05', 'e06']),
    confidence: 'SUPPORTED_HYPOTHESIS',
    what_would_change_it: 'External evidence that early visible recommendations are routine or that dependency mapping does not improve outcomes.',
  }),
  abstentions: Object.freeze(['Formal leadership capability is not established.', 'Current wellbeing and direction of travel are unknown.']),
  validation_backlog: Object.freeze(['Observe timing of four recommendations.', 'Collect external evidence about how quiet processing is perceived.']),
  surface_claims: Object.freeze({ five_futures: ['d01', 'd02', 'a02'], one_move: ['d01', 'd02'], role_seat: ['a02', 'd01'] }),
  surface_renderings: harborRenderings(),
});

const LANTERN_RAW = Object.freeze({
  version: 'synthetic_raw_evidence_v1',
  synthetic: true,
  subject_token: 'SYNTH-PDNV1-LANTERN',
  source_artifact_ids: Object.freeze(['fixture_lantern_assessment_v1']),
  identity_context: Object.freeze({ display_name: 'Lantern', role: null, context: 'Synthetic thin-evidence fixture; not a real person.' }),
  scores: Object.freeze({ command: 58, tempo: 91, relational_awareness: 63, precision: 27, leverage: 82, adaptability: 88, structure: 24, perspective: 46 }),
  score_source_refs: Object.freeze(Object.fromEntries(['command', 'tempo', 'relational_awareness', 'precision', 'leverage', 'adaptability', 'structure', 'perspective'].map((id) => [id, ['fixture_lantern_assessment_v1']]))),
  questions: Object.freeze([
    { question_id: 'q01', exact_question: 'What happens when work is stuck?', exact_answer: 'I throw out five ways we could start and see which one gets people talking.' },
    { question_id: 'q02', exact_question: 'How do you learn something new?', exact_answer: 'Try a small version, show someone, and change it while the response is fresh.' },
    { question_id: 'q03', exact_question: 'What conditions help you?', exact_answer: 'Freedom to explore, but I also want clear milestones so the idea actually becomes something.' },
  ]),
  structured_inputs: Object.freeze([{ field: 'role_history_supplied', exact_value: false }]),
  evidence: Object.freeze([
    evidence('e01', 'self_report', 'q01', 'Generates multiple starting options and uses live discussion.'),
    evidence('e02', 'self_report', 'q02', 'Prefers small trials and rapid revision from feedback.'),
    evidence('e03', 'self_report', 'q03', 'Values exploration and asks for clear milestones.'),
    evidence('e04', 'contradiction', 'cross_answer:q03', 'Freedom preference coexists with a request for explicit milestones.'),
    evidence('e05', 'unknown', 'fixture_lantern_assessment_v1:missing_role_history', 'No role, career, outcome, pressure, or recovery history supplied.'),
  ]),
  contradictions: Object.freeze([{ contradiction_id: 'c01', evidence_refs: ['e03', 'e04'], statement: 'Exploration and explicit completion markers are both requested.' }]),
  uncertainties: Object.freeze(['No role history.', 'No outcome-bearing completion episode.', 'No pressure, conflict, or recovery episode.', 'No external observer evidence.']),
  abstentions: Object.freeze(['No role fit.', 'No leadership claim.', 'No stable persistence claim.', 'No recovery claim.', 'No clinical or IQ inference.']),
});

const LANTERN_DRAFT = Object.freeze({
  topology: Object.freeze([
    inference({ id: 't01', statement: 'Rapid option generation and live revision jointly support early exploration.', evidence: ['e01', 'e02'], confidence: 'STRONGLY_SUPPORTED', change: 'Examples of comparable work beginning only after extended private planning.', dimensions: ['tempo', 'adaptability', 'leverage'], dynamic_roles: ['initiating_driver', 'contextual_moderator', 'amplifier'] }),
    inference({ id: 't02', statement: 'Requested milestones may regulate a highly open exploration loop.', evidence: ['e03', 'e04'], confidence: 'TENTATIVE', change: 'Evidence that milestones are ignored or reduce useful completion.', dimensions: ['structure', 'precision', 'perspective'], dynamic_roles: ['delayed_capability', 'quality_qualifier', 'sequencing_regulator'] }),
  ]),
  attributes: Object.freeze([
    inference({ id: 'a01', statement: 'Idea fluency is supported in one low-stakes context.', evidence: ['e01'], confidence: 'SUPPORTED_HYPOTHESIS', change: 'Repeated inability to generate options in similar contexts.', subdimensions: { divergent_options: 'supported', originality: 'unknown', usefulness: 'unknown' } }),
    inference({ id: 'a02', statement: 'Long-cycle follow-through cannot be evaluated.', evidence: ['e03', 'e05'], confidence: 'INSUFFICIENT_EVIDENCE', change: 'At least two outcome-bearing completion histories.', subdimensions: { activation: 'supported', sustained_completion: 'unknown' } }),
  ]),
  dynamics: Object.freeze([
    inference({ id: 'd01', statement: 'The subject creates movement by widening options and making a small live trial.', evidence: ['e01', 'e02'], confidence: 'STRONGLY_SUPPORTED', change: 'Observed preference for narrowing privately before any trial.', trigger: 'stalled or unfamiliar work', private_calculation: 'A live response will teach more than another private pass.', action: 'generate options and expose a small trial', payoff: 'energy and fast feedback', delayed_cost: 'completion mechanics remain untested' }),
    inference({ id: 'd02', statement: 'Clear milestones may be requested to keep exploration connected to completion.', evidence: ['e03', 'e04'], confidence: 'TENTATIVE', change: 'Outcome history showing self-generated closure without external milestones.', trigger: 'open-ended exploration', private_calculation: 'Freedom works better when there is a visible finish line.', action: 'ask for milestones', payoff: 'possible closure support', delayed_cost: 'unknown' }),
  ]),
  specialized: Object.freeze({ pressure: { confidence: 'INSUFFICIENT_EVIDENCE', state: 'unknown' }, communication: { confidence: 'SUPPORTED_HYPOTHESIS', style: 'fast_and_idea_forward' }, work: { confidence: 'TENTATIVE', environment: 'generative interaction; durability unknown' }, role: { confidence: 'INSUFFICIENT_EVIDENCE', fit: 'INSUFFICIENT_EVIDENCE', envelope: null }, leadership: { confidence: 'INSUFFICIENT_EVIDENCE', pattern: null }, cognition: { confidence: 'TENTATIVE', indicators: ['divergent option generation in one context'] }, energy: { confidence: 'TENTATIVE', state: 'situational activation only' } }),
  sequences: Object.freeze([{ sequence_id: 's01', steps: ['work stalls', 'options widen', 'small trial begins', 'live response arrives', 'route changes'] }]),
  strengths_and_overuse: Object.freeze([{ strength: 'ignition', overuse: 'possible unfinished transfer', dynamic_ref: 'd01' }]),
  compensation: Object.freeze([{ statement: 'Requested milestones may compensate for open exploration.', evidence_refs: ['e03', 'e04'] }]),
  whole_person: Object.freeze({
    core_explanation: 'This person appears to create possibility by making several routes visible and learning through a small live attempt.',
    central_tension: 'Starting energy is well supported; the evidence does not yet show what happens through a long, repetitive, or high-stakes ownership cycle.',
    mechanisms: Object.freeze(['A stalled problem becomes easier to enter when several possible starts are made visible.', 'A small attempt creates fresh response that guides the next move.']),
    identity_tensions: Object.freeze(['Values open exploration and also asks for a visible finish line.']),
    goal_conflicts: Object.freeze(['No durable goal conflict can be established from the current packet.']),
    private_calculations: Object.freeze(['A small live attempt is more informative than another private pass.']),
    pressure_and_recovery: 'Unknown: no consequential strain or recovery episode was supplied.',
    work_and_relationships: 'Early evidence favors generative interaction; role, leadership, conflict, and long-cycle contribution remain unknown.',
    identity_distillation: 'The Possibility Starter — provisionally',
    evidence_refs: Object.freeze(['e01', 'e02', 'e03', 'e04', 'e05']),
    confidence: 'TENTATIVE',
    what_would_change_it: 'Outcome-bearing work history showing either durable completion or repeated abandonment after initial activation.',
  }),
  abstentions: Object.freeze(['Role and seat classification is unavailable.', 'Pressure, conflict, recovery, leadership, and durable persistence are unavailable.']),
  validation_backlog: Object.freeze(['Capture two completed work cycles.', 'Capture one consequential conflict and recovery episode.', 'Add role context and external observation.']),
  surface_claims: Object.freeze({ five_futures: ['d01', 'd02', 'a02'], one_move: ['d01', 'a02'], role_seat: ['a02'] }),
  surface_renderings: lanternRenderings(),
});

export const SYNTHETIC_FIXTURES = Object.freeze([
  Object.freeze({ fixture_id: 'atlas', rawEvidence: ATLAS_RAW, interpretationDraft: ATLAS_DRAFT }),
  Object.freeze({ fixture_id: 'harbor', rawEvidence: HARBOR_RAW, interpretationDraft: HARBOR_DRAFT }),
  Object.freeze({ fixture_id: 'lantern', rawEvidence: LANTERN_RAW, interpretationDraft: LANTERN_DRAFT }),
  RICH_SYNTHETIC_FIXTURE,
]);
