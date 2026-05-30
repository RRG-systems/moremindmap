# Archetype Validation Lab

Generated: 2026-05-29

Purpose: create synthetic but realistic benchmark submissions to validate MORE MindMap scoring, deterministic rescoring, Behavioral DNA Interpretation, and role-fit logic across role archetypes. These are not flattering fake profiles; each includes strengths, fatigue points, pressure behavior, and role-fit risks.

Pipeline used:

1. Synthetic frontend-style assessment payload
2. `BuildProfileInput`
3. `generateCanonicalProfile`
4. `rescoring_v1` deterministic rescoring
5. `extractBehavioralIntelligence` + `refineExtraction`
6. Local rendered snapshot JSON

GPT behavioral rescoring was not forced in this lab because it requires live OpenAI configuration. Each result records deterministic `rescoring_v1` output and a placeholder for GPT rescoring status.

## Archetype Comparison

| Archetype | Synthetic Person | Profile ID | Top 3 Dimensions | Bottom 2 Dimensions | Primary Engine | Initial Role-Fit Judgment | Scoring Notes |
|---|---|---|---|---|---|---|---|
| Founder / CEO | Marcus Vale | mm-20260529-ceo8x7q2 | Vector 0.89<br>Velocity 0.73<br>Fidelity 0.67 | Framework 0.30<br>Flex -0.50 | Vector | Strong CEO/founder fit if paired with operating cadence and feedback instrumentation. | Top dimensions vector, velocity, fidelity broadly match intended role signal; bottom dimensions framework, flex create plausible fatigue/risk. |
| VP Sales | Tessa Grant | mm-20260529-vps4l8r9 | Velocity 0.83<br>Signal 0.79<br>Vector 0.78 | Horizon 0.17<br>Framework -0.25 | Velocity | Strong VP Sales fit, with pipeline inspection and deal-quality discipline needed. | Top dimensions velocity, signal, vector broadly match intended role signal; bottom dimensions horizon, framework create plausible fatigue/risk. |
| Recruiter | Lena Ortiz | mm-20260529-rec6n2p4 | Signal 0.96<br>Velocity 0.75<br>Horizon 0.67 | Framework 0.00<br>Vector -0.50 | Signal | Strong recruiting fit, especially when paired with explicit decision thresholds. | Only 1/3 intended top dimensions landed in top 3. |
| Accountant | Nora Bell | mm-20260529-acc2f9d6 | Vector 1.00<br>Fidelity 0.82<br>Framework 0.77 | Velocity -0.50<br>Leverage 0.00 | Vector | Strong accountant fit; risk rises in roles demanding constant ambiguous tradeoffs. | Top dimensions vector, fidelity, framework broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk. |
| Engineer | Ishan Mehta | mm-20260529-eng7v5k3 | Vector 1.00<br>Fidelity 0.81<br>Framework 0.75 | Velocity -0.50<br>Leverage 0.00 | Vector | Strong engineer fit; leadership fit improves when translation cadence is explicit. | Top dimensions vector, fidelity, framework broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk. |
| Front Desk / Client Service | Maya Chen | mm-20260529-fdc1s8m5 | Signal 0.99<br>Fidelity 0.63<br>Framework 0.63 | Velocity 0.00<br>Vector -0.50 | Signal | Strong client-service fit when escalation boundaries are explicit. | Top dimensions signal, fidelity, framework broadly match intended role signal; bottom dimensions velocity, vector create plausible fatigue/risk. |
| Operations Manager | Graham Pierce | mm-20260529-ops5h2w8 | Vector 1.00<br>Fidelity 0.73<br>Framework 0.69 | Horizon 0.00<br>Flex -0.50 | Vector | Strong operations fit; needs exception-handling design to avoid rigidity. | Top dimensions vector, fidelity, framework broadly match intended role signal; bottom dimensions horizon, flex create plausible fatigue/risk. |
| Marketing Creative | Ari Vaughn | mm-20260529-mkc9r4t1 | Signal 0.88<br>Flex 0.78<br>Fidelity 0.63 | Framework -0.50<br>Vector 0.00 | Signal | Strong marketing creative fit, with production structure needed near launch. | Only 1/3 intended top dimensions landed in top 3. |
| Compliance Officer | Evelyn Park | mm-20260529-cmp3j6z7 | Fidelity 0.81<br>Framework 0.77<br>Vector 0.50 | Velocity -0.50<br>Leverage 0.00 | Fidelity | Strong compliance fit; best when policy guidance is tiered by risk severity. | Top dimensions fidelity, framework, vector broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk. |
| Project Manager | Caleb Ruiz | mm-20260529-pjm8d2x5 | Vector 1.00<br>Signal 0.82<br>Fidelity 0.72 | Velocity -0.50<br>Leverage 0.00 | Vector | Strong project manager fit; needs escalation rights to avoid becoming the buffer. | Top dimensions vector, signal, fidelity broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk. |

## Detailed Records

### Founder / CEO: Marcus Vale

- Profile ID: `mm-20260529-ceo8x7q2`
- Intended role: Founder and CEO of a 42-person B2B software company
- Top 3 dimensions: Vector 0.89, Velocity 0.73, Fidelity 0.67
- Bottom 2 dimensions: Framework 0.30, Flex -0.50
- Primary engine: Vector
- Natural advantage: Sets direction quickly and connects near-term pressure to a larger company arc.
- Natural risk: May outrun translation, leaving operators to infer the path from founder-level conviction.
- Energy source: New territory, high-consequence decisions, and visible momentum.
- Fatigue source: Consensus loops, unclear ownership, and repeated explanation of decisions.
- Best environment: Fast-growth environment with clear authority and a strong operator translating decisions.
- Worst environment: Diffuse matrix setting where every move requires broad pre-approval.
- Initial role-fit judgment: Strong CEO/founder fit if paired with operating cadence and feedback instrumentation.
- Notes on whether scoring feels correct: Top dimensions vector, velocity, fidelity broadly match intended role signal; bottom dimensions framework, flex create plausible fatigue/risk.

### VP Sales: Tessa Grant

- Profile ID: `mm-20260529-vps4l8r9`
- Intended role: VP Sales leading a regional enterprise sales team
- Top 3 dimensions: Velocity 0.83, Signal 0.79, Vector 0.78
- Bottom 2 dimensions: Horizon 0.17, Framework -0.25
- Primary engine: Velocity
- Natural advantage: Turns human dynamics into forward commercial motion.
- Natural risk: May over-trust momentum and relationship heat before qualification is fully verified.
- Energy source: Live conversations, competitive targets, and visible wins.
- Fatigue source: Slow handoffs, excessive documentation, and non-commercial ambiguity.
- Best environment: Revenue culture with clear targets, fast feedback, and room to coach in the field.
- Worst environment: Over-processed sales environment where every move is mediated through internal approvals.
- Initial role-fit judgment: Strong VP Sales fit, with pipeline inspection and deal-quality discipline needed.
- Notes on whether scoring feels correct: Top dimensions velocity, signal, vector broadly match intended role signal; bottom dimensions horizon, framework create plausible fatigue/risk.

### Recruiter: Lena Ortiz

- Profile ID: `mm-20260529-rec6n2p4`
- Intended role: Senior recruiter for healthcare operations roles
- Top 3 dimensions: Signal 0.96, Velocity 0.75, Horizon 0.67
- Bottom 2 dimensions: Framework 0.00, Vector -0.50
- Primary engine: Signal
- Natural advantage: Reads candidate hesitation and hiring-manager subtext early.
- Natural risk: Can over-adapt to keep both sides comfortable, delaying hard truth.
- Energy source: Human nuance, matching people to context, and repairing misalignment.
- Fatigue source: Rigid processes that ignore candidate signal and manager reality.
- Best environment: People-centered recruiting culture with enough structure to close loops.
- Worst environment: Pure transaction environment measuring only volume and speed.
- Initial role-fit judgment: Strong recruiting fit, especially when paired with explicit decision thresholds.
- Notes on whether scoring feels correct: Only 1/3 intended top dimensions landed in top 3.

### Accountant: Nora Bell

- Profile ID: `mm-20260529-acc2f9d6`
- Intended role: Senior accountant managing monthly close and audit support
- Top 3 dimensions: Vector 1.00, Fidelity 0.82, Framework 0.77
- Bottom 2 dimensions: Velocity -0.50, Leverage 0.00
- Primary engine: Vector
- Natural advantage: Protects accuracy, repeatability, and audit readiness.
- Natural risk: May slow movement when imperfect inputs require a pragmatic cutoff.
- Energy source: Clean reconciliations, clear rules, and problems that can be verified.
- Fatigue source: Last-minute changes, vague ownership, and pressure to approve weak numbers.
- Best environment: Stable finance environment with clear close calendar and respect for controls.
- Worst environment: Chaotic growth setting where precision is treated as obstruction.
- Initial role-fit judgment: Strong accountant fit; risk rises in roles demanding constant ambiguous tradeoffs.
- Notes on whether scoring feels correct: Top dimensions vector, fidelity, framework broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk.

### Engineer: Ishan Mehta

- Profile ID: `mm-20260529-eng7v5k3`
- Intended role: Senior backend engineer owning infrastructure reliability
- Top 3 dimensions: Vector 1.00, Fidelity 0.81, Framework 0.75
- Bottom 2 dimensions: Velocity -0.50, Leverage 0.00
- Primary engine: Vector
- Natural advantage: Sees failure modes and designs systems to survive future load.
- Natural risk: Can delay visible progress while protecting architecture from weak shortcuts.
- Energy source: Deep technical problems, durable design, and clean abstractions.
- Fatigue source: Interrupt-driven urgency and vague product pivots without technical context.
- Best environment: Engineering culture that values reliability, design review, and explicit tradeoffs.
- Worst environment: Sales-driven fire drill culture with no respect for technical debt.
- Initial role-fit judgment: Strong engineer fit; leadership fit improves when translation cadence is explicit.
- Notes on whether scoring feels correct: Top dimensions vector, fidelity, framework broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk.

### Front Desk / Client Service: Maya Chen

- Profile ID: `mm-20260529-fdc1s8m5`
- Intended role: Front desk and client service coordinator in a medical practice
- Top 3 dimensions: Signal 0.99, Fidelity 0.63, Framework 0.63
- Bottom 2 dimensions: Velocity 0.00, Vector -0.50
- Primary engine: Signal
- Natural advantage: Stabilizes clients quickly by reading tone and following reliable service steps.
- Natural risk: May absorb frustration personally and defer boundary-setting too long.
- Energy source: Helping people feel handled, clear routines, and visible service recovery.
- Fatigue source: Angry clients, unclear policies, and leaders who change rules midstream.
- Best environment: Service environment with clear escalation rules and humane scheduling.
- Worst environment: High-conflict desk role without authority or manager backup.
- Initial role-fit judgment: Strong client-service fit when escalation boundaries are explicit.
- Notes on whether scoring feels correct: Top dimensions signal, fidelity, framework broadly match intended role signal; bottom dimensions velocity, vector create plausible fatigue/risk.

### Operations Manager: Graham Pierce

- Profile ID: `mm-20260529-ops5h2w8`
- Intended role: Operations manager for a multi-site services business
- Top 3 dimensions: Vector 1.00, Fidelity 0.73, Framework 0.69
- Bottom 2 dimensions: Horizon 0.00, Flex -0.50
- Primary engine: Vector
- Natural advantage: Turns scattered execution into repeatable operating rhythm.
- Natural risk: Can become controlling when local exceptions disrupt the process.
- Energy source: Clear ownership, clean handoffs, and measurable operational improvement.
- Fatigue source: Improvisation masquerading as urgency and teams bypassing process.
- Best environment: Execution-heavy organization that gives operations authority to standardize.
- Worst environment: Founder-led chaos where every process can be overridden casually.
- Initial role-fit judgment: Strong operations fit; needs exception-handling design to avoid rigidity.
- Notes on whether scoring feels correct: Top dimensions vector, fidelity, framework broadly match intended role signal; bottom dimensions horizon, flex create plausible fatigue/risk.

### Marketing Creative: Ari Vaughn

- Profile ID: `mm-20260529-mkc9r4t1`
- Intended role: Creative marketing lead for a consumer wellness brand
- Top 3 dimensions: Signal 0.88, Flex 0.78, Fidelity 0.63
- Bottom 2 dimensions: Framework -0.50, Vector 0.00
- Primary engine: Signal
- Natural advantage: Connects audience signal, cultural timing, and campaign angle quickly.
- Natural risk: Can resist fixed process until deadlines force compression.
- Energy source: Concept development, audience insight, and room to iterate.
- Fatigue source: Rigid calendars, over-prescribed briefs, and repetitive approval loops.
- Best environment: Creative environment with strategic guardrails and flexible exploration time.
- Worst environment: Process-heavy team that treats creative uncertainty as poor discipline.
- Initial role-fit judgment: Strong marketing creative fit, with production structure needed near launch.
- Notes on whether scoring feels correct: Only 1/3 intended top dimensions landed in top 3.

### Compliance Officer: Evelyn Park

- Profile ID: `mm-20260529-cmp3j6z7`
- Intended role: Compliance officer for a regulated financial services firm
- Top 3 dimensions: Fidelity 0.81, Framework 0.77, Vector 0.50
- Bottom 2 dimensions: Velocity -0.50, Leverage 0.00
- Primary engine: Fidelity
- Natural advantage: Protects the organization by making risk visible before it becomes expensive.
- Natural risk: Can become the bottleneck when business teams need faster risk-tiered guidance.
- Energy source: Clear standards, audit trails, and preventing avoidable exposure.
- Fatigue source: Pressure to approve exceptions without evidence.
- Best environment: Regulated setting where compliance has authority and business partnership.
- Worst environment: Growth culture that treats controls as a late-stage obstacle.
- Initial role-fit judgment: Strong compliance fit; best when policy guidance is tiered by risk severity.
- Notes on whether scoring feels correct: Top dimensions fidelity, framework, vector broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk.

### Project Manager: Caleb Ruiz

- Profile ID: `mm-20260529-pjm8d2x5`
- Intended role: Cross-functional project manager for implementation programs
- Top 3 dimensions: Vector 1.00, Signal 0.82, Fidelity 0.72
- Bottom 2 dimensions: Velocity -0.50, Leverage 0.00
- Primary engine: Vector
- Natural advantage: Keeps cross-functional work moving by clarifying ownership and surfacing slippage early.
- Natural risk: Can get trapped carrying coordination debt instead of forcing ownership decisions.
- Energy source: Complex handoffs, visible progress, and teams becoming aligned.
- Fatigue source: Stakeholders who agree in meetings and miss commitments afterward.
- Best environment: Matrix environment where project authority is respected and decisions have owners.
- Worst environment: Ambiguous organization that expects coordination without authority.
- Initial role-fit judgment: Strong project manager fit; needs escalation rights to avoid becoming the buffer.
- Notes on whether scoring feels correct: Top dimensions vector, signal, fidelity broadly match intended role signal; bottom dimensions velocity, leverage create plausible fatigue/risk.


## Validation Questions

- Does the Accountant score differently from the CEO? FAIL - both primary Vector.
- Does the Recruiter score differently from the Engineer? PASS - Recruiter primary Signal; Engineer primary Vector.
- Does the Compliance profile show high rule/process orientation? PASS - top dimensions include framework, fidelity.
- Does the VP Sales show high influence/velocity/direction? PASS - top dimensions include one of leverage, velocity, vector (velocity, signal, vector).
- Does the Front Desk profile show service/stability/relational awareness? PASS - top dimensions include signal.
- Does the Marketing Creative show creative signal/adaptability? PASS - top dimensions include one of flex, signal, horizon (signal, flex, fidelity).
- Does any archetype collapse into generic Command/operator language? WARN - repeated signatures: Vector/Fidelity/Framework: Accountant, Engineer, Operations Manager.
- Are profiles differentiated by evidence, not forced creativity? PASS - artifacts preserve raw answers, canonical scoring, BI extraction, and role-fit context for audit.

## Regression Checks

- PASS: Founder / CEO primary has evidence - Vector evidence_count=16
- PASS: VP Sales primary has evidence - Velocity evidence_count=12
- PASS: Recruiter primary has evidence - Signal evidence_count=17
- PASS: Accountant primary has evidence - Vector evidence_count=1
- PASS: Engineer primary has evidence - Vector evidence_count=1
- PASS: Front Desk / Client Service primary has evidence - Signal evidence_count=16
- PASS: Operations Manager primary has evidence - Vector evidence_count=9
- PASS: Marketing Creative primary has evidence - Signal evidence_count=14
- PASS: Compliance Officer primary has evidence - Fidelity evidence_count=17
- PASS: Project Manager primary has evidence - Vector evidence_count=2
- PASS: Accountant does not rank zero-evidence Leverage primary - primary=Vector; Leverage.evidence_count=0
- PASS: Engineer does not rank zero-evidence Leverage primary - primary=Vector; Leverage.evidence_count=0
- PASS: Compliance Officer does not rank zero-evidence Leverage primary - primary=Fidelity; Leverage.evidence_count=0
- PASS: Marketing Creative does not rank zero-evidence Vector primary - primary=Signal; Vector.evidence_count=0

## Obvious Scoring Concerns

- Recruiter: Only 1/3 intended top dimensions landed in top 3.
- Marketing Creative: Only 1/3 intended top dimensions landed in top 3.
- Several role archetypes can still be pulled toward action/command because many MC choices reward Vector/Velocity; written evidence should be checked in narrative and role-fit layers.
- The current local pipeline does not persist these synthetic profiles to Redis; this lab validates generation artifacts, not production retrieval behavior.

## Recommended Next Patch Sequence

1. Run the same benchmark through GPT behavioral rescoring in a controlled environment and compare `display_score` deltas against deterministic `rescoring_v1`.
2. Add a small regression harness that fails when role archetypes collapse into the same primary/secondary pair without written-evidence justification.
3. Add role-fit assertions for compliance/accounting/front-desk profiles so Framework/Fidelity/Signal do not get drowned out by generic Vector/Velocity language.
4. Add snapshot comparison for V3 narrative sections to detect generic Command/operator convergence across unrelated roles.
5. Review question weighting for service and process-heavy roles if repeated MC optimization still over-rewards fast action choices.
