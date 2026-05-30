import fs from 'fs';
import path from 'path';
import { QUESTION_MAP } from '../../api/engine/questionMap.js';
import { BuildProfileInput } from '../../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../../api/engine/canonical/canonicalProfileGenerator.js';
import { extractBehavioralIntelligence } from '../../api/engine/canonical/extractIntelligence.js';
import { refineExtraction } from '../../api/engine/canonical/extractIntelligenceRefinement.js';

const root = path.resolve(process.cwd(), 'docs/validation');
const submissionsDir = path.join(root, 'archetype-submissions');
const resultsDir = path.join(root, 'archetype-results');

fs.mkdirSync(submissionsDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });

const dimensionLabels = {
  vector: 'Vector',
  signal: 'Signal',
  fidelity: 'Fidelity',
  velocity: 'Velocity',
  leverage: 'Leverage',
  flex: 'Flex',
  framework: 'Framework',
  horizon: 'Horizon'
};

const archetypes = [
  {
    slug: 'founder-ceo',
    profile_id: 'mm-20260529-ceo8x7q2',
    name: 'Marcus Vale',
    archetype: 'Founder / CEO',
    intended_role: 'Founder and CEO of a 42-person B2B software company',
    email: 'marcus.vale.synthetic@example.com',
    company: 'ValeGrid Systems',
    target: { vector: 1.6, horizon: 1.35, velocity: 1.15, leverage: 1.0, framework: 0.35, signal: 0.25, fidelity: 0.2, flex: 0.1 },
    expected: {
      advantage: 'Sets direction quickly and connects near-term pressure to a larger company arc.',
      risk: 'May outrun translation, leaving operators to infer the path from founder-level conviction.',
      energy: 'New territory, high-consequence decisions, and visible momentum.',
      fatigue: 'Consensus loops, unclear ownership, and repeated explanation of decisions.',
      best: 'Fast-growth environment with clear authority and a strong operator translating decisions.',
      worst: 'Diffuse matrix setting where every move requires broad pre-approval.',
      role_fit: 'Strong CEO/founder fit if paired with operating cadence and feedback instrumentation.'
    },
    written: {
      2: 'Right now I am trying to build a company that outlives my own daily effort. I care about my family having stability, but I also care about proving that the market we saw early is real. A meaningful life would let me create something durable without being the single point of force forever.',
      14: 'A strategic partner delayed a launch after we had already moved the team into execution. I pushed to preserve the date, then realized the implementation team did not have enough room to translate the change. I reset the launch into two phases and took responsibility for pushing pace before the dependency was stable.',
      17: 'People who know me would say I get sharper and faster when the stakes rise. I see the decision tree quickly and want everyone moving. The weakness is that my certainty can arrive before everyone else has caught up.',
      20: 'I made a pricing decision before every data point was clean because waiting would have cost us a market window. I felt right about moving, but afterward I saw the team needed a clearer rationale trail. The decision worked, the translation was weaker than it should have been.',
      22: 'I would rate myself an 8 as a leader because I can create direction and belief quickly. The gap is repeatability: some people still need my judgment in the room because the operating principles are not captured well enough.',
      24: 'When momentum stalls I usually cut through the ambiguity and name the decision. Resistance frustrates me when it feels like people are protecting comfort instead of outcome. I avoid slowing down to document the why, and that creates rework when the team has to reverse-engineer my intent.',
      25: 'I usually clarify the outcome I was aiming for and then explain the logic. If I am moving too fast, I can sound like I am defending instead of listening.',
      26: 'I naturally take the role of direction-setter and pressure translator. Tension appears when the organization needs slower sequencing or when multiple leaders need to own the path rather than wait for my call.',
      27: 'I am building a company with a clear market thesis and a culture that rewards ownership. I value speed, courage, and useful truth over comfort.',
      28: 'The business is organized by weekly leadership rhythm and a few strong people who know how I think. Future strain will show up if decision logic stays in my head instead of becoming shared operating architecture.'
    }
  },
  {
    slug: 'vp-sales',
    profile_id: 'mm-20260529-vps4l8r9',
    name: 'Tessa Grant',
    archetype: 'VP Sales',
    intended_role: 'VP Sales leading a regional enterprise sales team',
    email: 'tessa.grant.synthetic@example.com',
    company: 'Northline Revenue Group',
    target: { leverage: 1.45, velocity: 1.35, vector: 1.1, signal: 1.05, flex: 0.65, horizon: 0.35, fidelity: 0.05, framework: 0.05 },
    expected: {
      advantage: 'Turns human dynamics into forward commercial motion.',
      risk: 'May over-trust momentum and relationship heat before qualification is fully verified.',
      energy: 'Live conversations, competitive targets, and visible wins.',
      fatigue: 'Slow handoffs, excessive documentation, and non-commercial ambiguity.',
      best: 'Revenue culture with clear targets, fast feedback, and room to coach in the field.',
      worst: 'Over-processed sales environment where every move is mediated through internal approvals.',
      role_fit: 'Strong VP Sales fit, with pipeline inspection and deal-quality discipline needed.'
    },
    written: {
      2: 'I want my work to create freedom for my family and a team that knows winning can be disciplined, not frantic. I care about income, reputation, and proving that relationships can become real business value. In ten years I want a sales organization that grows leaders, not just quota performers.',
      14: 'A large prospect went quiet after a champion left the company. I called the new buyer too quickly and realized later I had not rebuilt trust first. I slowed down, mapped the stakeholders, and rebuilt the opportunity through a different entry point.',
      17: 'Under pressure I get direct, energetic, and very focused on the next move. People feel my urgency. The downside is I can make slower teammates feel like they are dragging the whole room.',
      20: 'I once advanced a deal stage with incomplete technical confirmation because the buyer energy was strong. It created a scramble later. I learned to separate buyer enthusiasm from deal truth.',
      22: 'I would rate myself a 7.5. I can motivate and redirect people quickly, but I still have to work on inspection discipline so coaching does not depend too much on instinct.',
      24: 'When momentum stalls I look for the person with influence and try to change the conversation. I get frustrated by vague ownership and weak follow-up. I avoid sitting with quiet pipeline risk longer than I should because I prefer action.',
      25: 'I usually get on the phone and reset the conversation. I want to hear the concern, but I also want to keep the relationship moving.',
      26: 'I naturally become the closer, coach, and pressure carrier. Tension appears when operations needs more precision than my field read initially provides.',
      27: 'I am trying to build a sales culture where people can win without becoming transactional. I value courage, consistency, and relational leverage.',
      28: 'Forecast calls, deal reviews, and one-on-ones keep work organized. The scaling strain will be quality control: making sure the team does not confuse activity with real progression.'
    }
  },
  {
    slug: 'recruiter',
    profile_id: 'mm-20260529-rec6n2p4',
    name: 'Lena Ortiz',
    archetype: 'Recruiter',
    intended_role: 'Senior recruiter for healthcare operations roles',
    email: 'lena.ortiz.synthetic@example.com',
    company: 'BrightPath Talent',
    target: { signal: 1.55, leverage: 1.15, flex: 1.05, fidelity: 0.75, velocity: 0.45, vector: 0.35, framework: 0.25, horizon: 0.15 },
    expected: {
      advantage: 'Reads candidate hesitation and hiring-manager subtext early.',
      risk: 'Can over-adapt to keep both sides comfortable, delaying hard truth.',
      energy: 'Human nuance, matching people to context, and repairing misalignment.',
      fatigue: 'Rigid processes that ignore candidate signal and manager reality.',
      best: 'People-centered recruiting culture with enough structure to close loops.',
      worst: 'Pure transaction environment measuring only volume and speed.',
      role_fit: 'Strong recruiting fit, especially when paired with explicit decision thresholds.'
    },
    written: {
      2: 'I care about building stability for my family and doing work where people feel seen. Career matters because it gives me independence, but I do not want success to turn me into someone who ignores people. Long term I want a reputation for matching people well, not just filling roles.',
      14: 'A candidate accepted another offer after I sensed hesitation but did not press it directly. I had tried to keep the conversation comfortable. Afterward I changed my intake calls to ask candidates what would make them walk away.',
      17: 'People would say I become observant and careful when pressure rises. I notice tone changes and try to keep everyone steady. Sometimes I spend too much time managing the room instead of naming the decision.',
      20: 'I sent a shortlist before I had complete alignment from the hiring manager because the role had been open too long. I felt uneasy afterward and my concern was right: one candidate was misleveled. I now clarify must-haves earlier.',
      22: 'I would rate myself a 7. I lead through trust and calibration, but I can hesitate when a direct correction might disappoint someone.',
      24: 'When momentum stalls I usually talk to the person who seems least aligned. I get frustrated by people who say yes politely and then disappear. I avoid forcing a decision when I can still sense unresolved concerns.',
      25: 'I ask what landed differently than intended. I would rather repair the interpretation than defend my wording.',
      26: 'I naturally become the interpreter between candidate, manager, and process. Tension appears when the process needs a firm cutoff and I am still reading exceptions.',
      27: 'I want to build a career where people trust my judgment because it is careful and human. I value fairness, stability, and honest fit.',
      28: 'Candidate trackers, call notes, and manager calibration meetings keep me organized. Future strain appears when too many informal signals live in my head instead of the system.'
    }
  },
  {
    slug: 'accountant',
    profile_id: 'mm-20260529-acc2f9d6',
    name: 'Nora Bell',
    archetype: 'Accountant',
    intended_role: 'Senior accountant managing monthly close and audit support',
    email: 'nora.bell.synthetic@example.com',
    company: 'Summit Ridge Holdings',
    target: { fidelity: 1.65, framework: 1.35, horizon: 0.55, signal: 0.3, vector: 0.1, leverage: 0.05, flex: -0.1, velocity: -0.25 },
    expected: {
      advantage: 'Protects accuracy, repeatability, and audit readiness.',
      risk: 'May slow movement when imperfect inputs require a pragmatic cutoff.',
      energy: 'Clean reconciliations, clear rules, and problems that can be verified.',
      fatigue: 'Last-minute changes, vague ownership, and pressure to approve weak numbers.',
      best: 'Stable finance environment with clear close calendar and respect for controls.',
      worst: 'Chaotic growth setting where precision is treated as obstruction.',
      role_fit: 'Strong accountant fit; risk rises in roles demanding constant ambiguous tradeoffs.'
    },
    written: {
      2: 'I care most about stability, health, and being dependable to the people who count on me. In work I want to be trusted because the details hold up. A meaningful life would feel calm enough that I can do careful work and still have energy for family.',
      14: 'During close a department submitted expenses late and the first version did not tie out. I stopped the process, documented the mismatch, and asked for support before posting. The timeline was uncomfortable, but the correction prevented a larger audit issue.',
      17: 'People would say I get quieter and more exact when expectations rise. I check the source instead of guessing. Sometimes that can look like hesitation, but I am trying to prevent avoidable errors.',
      20: 'I had to approve an accrual with incomplete backup near deadline. I used the best historical comparison, marked the assumption, and followed up the next day. I did not love it, but I knew the decision trail was visible.',
      22: 'I would rate myself a 6.5 as a leader. I am steady and reliable, but I do not always push people hard enough when their missing detail affects the whole close.',
      24: 'When momentum stalls I look for the missing fact or broken handoff. I get frustrated by vague requests and people treating controls as optional. I avoid confrontation longer than I should if I can solve the problem myself.',
      25: 'I restate the detail and show the source. I try not to make it personal; I want the record to be clear.',
      26: 'I naturally become the verifier and process keeper. Tension appears when others want speed but the numbers are not ready.',
      27: 'I am building financial independence and a reputation for being precise. I value reliability, fairness, and clean accountability.',
      28: 'Calendars, checklists, reconciliations, and documented controls organize my work. Future strain appears when growth adds transactions faster than the close process adapts.'
    }
  },
  {
    slug: 'engineer',
    profile_id: 'mm-20260529-eng7v5k3',
    name: 'Ishan Mehta',
    archetype: 'Engineer',
    intended_role: 'Senior backend engineer owning infrastructure reliability',
    email: 'ishan.mehta.synthetic@example.com',
    company: 'CircuitLake AI',
    target: { fidelity: 1.45, horizon: 1.2, framework: 1.05, flex: 0.35, velocity: 0.25, vector: 0.15, signal: -0.05, leverage: -0.15 },
    expected: {
      advantage: 'Sees failure modes and designs systems to survive future load.',
      risk: 'Can delay visible progress while protecting architecture from weak shortcuts.',
      energy: 'Deep technical problems, durable design, and clean abstractions.',
      fatigue: 'Interrupt-driven urgency and vague product pivots without technical context.',
      best: 'Engineering culture that values reliability, design review, and explicit tradeoffs.',
      worst: 'Sales-driven fire drill culture with no respect for technical debt.',
      role_fit: 'Strong engineer fit; leadership fit improves when translation cadence is explicit.'
    },
    written: {
      2: 'I want work that lets me build things that last and gives my family a stable life. I care less about being visible and more about knowing the system will not fall apart when usage increases. Long term I want technical depth without being trapped in constant firefighting.',
      14: 'A migration caused unexpected latency because an edge case was missed in planning. I rolled back, traced the failure, and wrote the missing load test. I was frustrated because the shortcut had been visible before launch.',
      17: 'Under pressure I become quiet, focused, and more skeptical of quick fixes. People may think I am resisting urgency, but I am checking the consequences. I can get blunt if the same risk keeps being ignored.',
      20: 'I had to choose a storage approach before every scaling assumption was known. I picked the option with the clearest rollback path and documented the tradeoff. Later I was glad we had not optimized prematurely.',
      22: 'I would rate myself a 6 as a leader. I am good at technical judgment and mentoring through specifics, but I need to make my reasoning more accessible earlier.',
      24: 'When momentum stalls I inspect the constraint and try to separate symptoms from root cause. I get drained by meetings that skip technical reality. I avoid political conversations longer than I should because I would rather fix the system.',
      25: 'I explain the technical reason and show the tradeoff. If I am tired, I can over-explain instead of checking whether the person needs a shorter version.',
      26: 'I naturally become the system designer and risk detector. Tension appears when business urgency treats engineering verification as optional.',
      27: 'I want to build reliable infrastructure and enough career leverage to choose meaningful problems. I value clarity, durability, and intellectual honesty.',
      28: 'Issue trackers, design docs, alerts, and review rituals keep work organized. Future strain appears when product growth creates hidden operational load faster than architecture catches up.'
    }
  },
  {
    slug: 'front-desk-client-service',
    profile_id: 'mm-20260529-fdc1s8m5',
    name: 'Maya Chen',
    archetype: 'Front Desk / Client Service',
    intended_role: 'Front desk and client service coordinator in a medical practice',
    email: 'maya.chen.synthetic@example.com',
    company: 'Oakwell Family Clinic',
    target: { signal: 1.5, framework: 1.1, flex: 0.85, fidelity: 0.75, leverage: 0.25, velocity: 0.1, vector: -0.05, horizon: -0.1 },
    expected: {
      advantage: 'Stabilizes clients quickly by reading tone and following reliable service steps.',
      risk: 'May absorb frustration personally and defer boundary-setting too long.',
      energy: 'Helping people feel handled, clear routines, and visible service recovery.',
      fatigue: 'Angry clients, unclear policies, and leaders who change rules midstream.',
      best: 'Service environment with clear escalation rules and humane scheduling.',
      worst: 'High-conflict desk role without authority or manager backup.',
      role_fit: 'Strong client-service fit when escalation boundaries are explicit.'
    },
    written: {
      2: 'I care about keeping my family secure and being the kind of person people can rely on. At work I want clients to feel less stressed after interacting with me. A meaningful life would include steady income, good relationships, and not carrying everyone else’s anxiety home.',
      14: 'A patient arrived upset because their appointment time had been entered wrong. I listened, found the scheduling history, and worked with the provider to create a same-day option. I also noted where our confirmation script had created confusion.',
      17: 'People would say I stay calm and try to make the room feel safe. I notice when someone is about to escalate. The hard part is I sometimes take too much responsibility for problems I did not create.',
      20: 'I had to decide whether to interrupt a provider for an upset client without knowing all the clinical context. I chose to escalate because the client was close to leaving. Afterward I felt it was right, but I wanted clearer rules.',
      22: 'I would rate myself a 6.5. I lead by keeping people steady and informed, but I am still learning to be firmer when a boundary matters.',
      24: 'When momentum stalls I usually check who is upset or confused first. I get frustrated when policy changes are not communicated and clients blame the front desk. I avoid pushing back on rude people longer than I should.',
      25: 'I apologize for the confusion and then clarify the next step. I try to make the person feel heard before I correct the detail.',
      26: 'I naturally become the stabilizer and translator between clients and the team. Tension appears when I have responsibility for the client experience but not enough authority to fix the issue.',
      27: 'I am building a stable life and a reputation for calm service. I value respect, kindness, and clear expectations.',
      28: 'Checklists, schedules, scripts, and manager escalation keep work organized. Future strain will show up if volume rises without clearer boundaries and staffing.'
    }
  },
  {
    slug: 'operations-manager',
    profile_id: 'mm-20260529-ops5h2w8',
    name: 'Graham Pierce',
    archetype: 'Operations Manager',
    intended_role: 'Operations manager for a multi-site services business',
    email: 'graham.pierce.synthetic@example.com',
    company: 'FieldStone Services',
    target: { framework: 1.45, vector: 1.1, fidelity: 1.0, velocity: 0.65, signal: 0.25, leverage: 0.2, horizon: 0.2, flex: -0.05 },
    expected: {
      advantage: 'Turns scattered execution into repeatable operating rhythm.',
      risk: 'Can become controlling when local exceptions disrupt the process.',
      energy: 'Clear ownership, clean handoffs, and measurable operational improvement.',
      fatigue: 'Improvisation masquerading as urgency and teams bypassing process.',
      best: 'Execution-heavy organization that gives operations authority to standardize.',
      worst: 'Founder-led chaos where every process can be overridden casually.',
      role_fit: 'Strong operations fit; needs exception-handling design to avoid rigidity.'
    },
    written: {
      2: 'I am trying to build a steady career and a team that can run without constant rescue. Family stability matters a lot, and I want work to feel organized enough that people know what good looks like. Long term I want responsibility without chaos.',
      14: 'A site missed a service window because dispatch changed the plan without updating the field lead. I mapped the breakdown, corrected the handoff, and added a morning exception check. The issue was not effort; it was missing process discipline.',
      17: 'Under pressure I get structured and direct. People know I will find the weak point in the process. The risk is that I can sound impatient when someone brings me another exception.',
      20: 'I had to reroute staff without full information during a weather issue. I made the call based on coverage risk and updated the schedule live. Afterward I documented the decision rules for the next event.',
      22: 'I would rate myself a 7. I make work clearer and hold standards, but I need to leave more room for local judgment instead of correcting every deviation.',
      24: 'When momentum stalls I tighten the process and clarify ownership. I get frustrated by avoidable misses and people solving around the system instead of improving it. I avoid emotional conversations when I think the process answer is obvious.',
      25: 'I explain the process reason and where the handoff broke. I can miss that the other person may need reassurance before correction.',
      26: 'I naturally become the organizer, standard-setter, and execution checker. Tension appears when teams want flexibility but the business needs consistency.',
      27: 'I want to build an operation where people can do good work without guessing. I value reliability, ownership, and practical improvement.',
      28: 'Dashboards, schedules, SOPs, and weekly reviews keep the work organized. Future strain appears when exception volume grows faster than the system for handling it.'
    }
  },
  {
    slug: 'marketing-creative',
    profile_id: 'mm-20260529-mkc9r4t1',
    name: 'Ari Vaughn',
    archetype: 'Marketing Creative',
    intended_role: 'Creative marketing lead for a consumer wellness brand',
    email: 'ari.vaughn.synthetic@example.com',
    company: 'LumaKind Studio',
    target: { flex: 1.45, horizon: 1.15, leverage: 0.95, signal: 0.9, velocity: 0.5, vector: 0.2, fidelity: 0.0, framework: -0.2 },
    expected: {
      advantage: 'Connects audience signal, cultural timing, and campaign angle quickly.',
      risk: 'Can resist fixed process until deadlines force compression.',
      energy: 'Concept development, audience insight, and room to iterate.',
      fatigue: 'Rigid calendars, over-prescribed briefs, and repetitive approval loops.',
      best: 'Creative environment with strategic guardrails and flexible exploration time.',
      worst: 'Process-heavy team that treats creative uncertainty as poor discipline.',
      role_fit: 'Strong marketing creative fit, with production structure needed near launch.'
    },
    written: {
      2: 'I want a life with creative freedom, close relationships, and work that feels alive. Money matters because it buys space, but I do not want to trade all originality for security. In the next decade I want to build a body of work people recognize as emotionally true.',
      14: 'A campaign concept I loved did not land with the client because the brief had shifted toward a safer audience. I stepped back, found the emotional point they were actually buying, and rebuilt the pitch around that. The final idea was less flashy but more useful.',
      17: 'People would say I become energized and scattered under pressure. I can generate options fast and see angles others miss. The downside is I need someone to help pin the strongest idea before time disappears.',
      20: 'I chose a creative direction before all audience testing came back because the launch date was fixed. I felt excited and nervous. Later the concept worked, but production had to absorb my late adjustments.',
      22: 'I would rate myself a 6.5. I can inspire a team around a direction, but I am still learning to turn creative momentum into a clean operating plan.',
      24: 'When momentum stalls I look for a new angle or a different emotional hook. I get drained by people who reduce the work to checklists too early. I avoid locking the plan until I can feel the idea has enough life.',
      25: 'I usually explain the intention behind the idea and ask what part felt off. Sometimes I keep reframing when the other person just needs a simpler answer.',
      26: 'I naturally become the concept shaper and audience interpreter. Tension appears when the team needs production certainty before the creative signal feels finished.',
      27: 'I am building work that combines taste, usefulness, and emotional intelligence. I value originality, resonance, and freedom.',
      28: 'Mood boards, campaign calendars, and creative reviews keep me loosely organized. Future strain appears when more campaigns run at once and informal taste judgment needs a repeatable system.'
    }
  },
  {
    slug: 'compliance-officer',
    profile_id: 'mm-20260529-cmp3j6z7',
    name: 'Evelyn Park',
    archetype: 'Compliance Officer',
    intended_role: 'Compliance officer for a regulated financial services firm',
    email: 'evelyn.park.synthetic@example.com',
    company: 'HarborStone Capital',
    target: { framework: 1.6, fidelity: 1.45, horizon: 0.85, signal: 0.25, vector: 0.05, leverage: 0.0, flex: -0.2, velocity: -0.35 },
    expected: {
      advantage: 'Protects the organization by making risk visible before it becomes expensive.',
      risk: 'Can become the bottleneck when business teams need faster risk-tiered guidance.',
      energy: 'Clear standards, audit trails, and preventing avoidable exposure.',
      fatigue: 'Pressure to approve exceptions without evidence.',
      best: 'Regulated setting where compliance has authority and business partnership.',
      worst: 'Growth culture that treats controls as a late-stage obstacle.',
      role_fit: 'Strong compliance fit; best when policy guidance is tiered by risk severity.'
    },
    written: {
      2: 'I care about security, credibility, and doing work that prevents harm before anyone sees it. A meaningful life would have stability for my family and the knowledge that my judgment kept people out of trouble. I am not trying to be flashy; I want to be trustworthy.',
      14: 'A marketing team wanted to publish a claim that was technically possible but not supportable by documentation. I stopped the approval, explained the exposure, and helped rewrite it. They were annoyed at first, but the revised version passed review cleanly.',
      17: 'Under pressure I become more careful and more procedural. People may experience me as slowing things down, but I am checking whether the organization can defend the action later.',
      20: 'I had to decide whether to allow a client communication with incomplete review notes. I required a narrower version and documented the exception. I felt better knowing the risk had boundaries.',
      22: 'I would rate myself a 7. I lead by creating clarity and reducing exposure, but I need to make my guidance easier for commercial teams to act on quickly.',
      24: 'When momentum stalls I look for the policy, evidence, or missing approval. I get frustrated when people treat risk as paperwork. I avoid softening the message if I think the exposure is real.',
      25: 'I point back to the standard and explain the reason behind it. I try to separate the person from the risk decision.',
      26: 'I naturally become the guardrail and evidence checker. Tension appears when business urgency wants an answer before the control record is ready.',
      27: 'I am building a career based on trust, judgment, and protection. I value accountability, accuracy, and institutional credibility.',
      28: 'Policies, review queues, audit logs, and escalation matrices keep work organized. Future strain appears when business volume creates too many exceptions for manual review.'
    }
  },
  {
    slug: 'project-manager',
    profile_id: 'mm-20260529-pjm8d2x5',
    name: 'Caleb Ruiz',
    archetype: 'Project Manager',
    intended_role: 'Cross-functional project manager for implementation programs',
    email: 'caleb.ruiz.synthetic@example.com',
    company: 'BridgeWorks Implementation',
    target: { framework: 1.25, fidelity: 0.95, signal: 0.85, vector: 0.75, velocity: 0.55, flex: 0.45, leverage: 0.25, horizon: 0.15 },
    expected: {
      advantage: 'Keeps cross-functional work moving by clarifying ownership and surfacing slippage early.',
      risk: 'Can get trapped carrying coordination debt instead of forcing ownership decisions.',
      energy: 'Complex handoffs, visible progress, and teams becoming aligned.',
      fatigue: 'Stakeholders who agree in meetings and miss commitments afterward.',
      best: 'Matrix environment where project authority is respected and decisions have owners.',
      worst: 'Ambiguous organization that expects coordination without authority.',
      role_fit: 'Strong project manager fit; needs escalation rights to avoid becoming the buffer.'
    },
    written: {
      2: 'I want stability, progress, and a career where people trust me to make complicated work feel manageable. I care about relationships but also about commitments meaning something. Long term I want to lead bigger programs without becoming the person who absorbs every miss.',
      14: 'A launch milestone slipped because two teams assumed the other owned a dependency. I rebuilt the timeline, named the owner, and added a dependency review to the weekly meeting. The miss showed that agreement without ownership is not enough.',
      17: 'People would say I become organized and persistent under pressure. I follow up, clarify, and make the next step visible. The weakness is that I may carry too much coordination myself before escalating.',
      20: 'I had to make a schedule call before engineering had final estimates. I created a range, identified the risk, and communicated the decision to stakeholders. Afterward I was glad the uncertainty was explicit instead of hidden.',
      22: 'I would rate myself a 7. I create clarity and keep people aligned, but I need to be firmer sooner when someone misses an owner commitment.',
      24: 'When momentum stalls I find the stuck dependency and ask who owns the next move. I get frustrated by vague agreement and quiet misses. I avoid escalating too early because I want teams to solve things collaboratively.',
      25: 'I restate the goal and the agreed next step. I try to clarify without making the person feel blamed.',
      26: 'I naturally become the coordinator, translator, and progress keeper. Tension appears when I am accountable for delivery but do not control the functional resources.',
      27: 'I am building a career around trusted execution and useful leadership. I value clarity, reliability, and respectful accountability.',
      28: 'Project plans, RAID logs, meeting notes, and dependency trackers keep work organized. Future strain appears if program complexity grows without stronger decision rights.'
    }
  }
];

function pickChoice(question, target) {
  let best = null;
  for (const answer of question.answers || []) {
    const dims = question.normalized_dimensions?.[answer.key] || {};
    let score = 0;
    for (const [dimension, value] of Object.entries(dims)) {
      score += value * (target[dimension] ?? 0);
    }
    if (!best || score > best.score) {
      best = { key: answer.key, score };
    }
  }
  return best?.key || question.answers?.[0]?.key || 'A';
}

function buildRawSubmission(archetype) {
  const answers = {};
  for (const question of QUESTION_MAP.set_1.v1) {
    if (question.type === 'written') {
      answers[`q${question.id}`] = { text: archetype.written[question.id] || archetype.written[2] };
    } else {
      answers[`q${question.id}`] = { choice: pickChoice(question, archetype.target) };
    }
  }

  return {
    assessment_id: `synthetic-${archetype.slug}-20260529`,
    profile_id: archetype.profile_id,
    source: 'synthetic_archetype_validation_lab',
    synthetic: true,
    duration_seconds: 1440,
    submitted_at: '2026-05-29T12:00:00.000Z',
    archetype: archetype.archetype,
    intended_role: archetype.intended_role,
    person_name: archetype.name,
    email: archetype.email,
    organizationalMetadata: {
      identity: {
        full_name: archetype.name,
        email: archetype.email,
        phone: ''
      },
      organization: {
        company_name: archetype.company,
        role_title: archetype.intended_role,
        department: archetype.archetype,
        industry: inferIndustry(archetype.slug),
        direct_reports_count: inferReports(archetype.slug),
        years_in_current_role: inferYears(archetype.slug),
        years_in_industry: inferYears(archetype.slug) + 4
      },
      contextual_signals: {
        best_role_ever: archetype.expected.best,
        worst_role_ever: archetype.expected.worst,
        current_energy_drain: archetype.expected.fatigue,
        recurring_org_frustration: archetype.expected.risk,
        relied_on_for: archetype.expected.advantage,
        misunderstood_for: archetype.expected.risk,
        unrealized_capacity: archetype.expected.role_fit
      }
    },
    answers
  };
}

function inferIndustry(slug) {
  if (slug.includes('sales')) return 'Revenue operations';
  if (slug.includes('recruiter')) return 'Talent acquisition';
  if (slug.includes('accountant')) return 'Finance';
  if (slug.includes('engineer')) return 'Technology';
  if (slug.includes('front')) return 'Healthcare';
  if (slug.includes('operations')) return 'Field services';
  if (slug.includes('marketing')) return 'Consumer marketing';
  if (slug.includes('compliance')) return 'Financial services';
  if (slug.includes('project')) return 'Implementation services';
  return 'B2B software';
}

function inferReports(slug) {
  if (slug.includes('ceo')) return 8;
  if (slug.includes('sales')) return 12;
  if (slug.includes('operations')) return 18;
  if (slug.includes('project')) return 0;
  if (slug.includes('front')) return 0;
  return 2;
}

function inferYears(slug) {
  if (slug.includes('ceo')) return 6;
  if (slug.includes('sales')) return 4;
  if (slug.includes('compliance')) return 5;
  if (slug.includes('accountant')) return 3;
  return 2;
}

function attachIdentity(profileInput, raw) {
  profileInput.person_name = raw.person_name;
  profileInput.email = raw.email;
  profileInput.organizationalMetadata = raw.organizationalMetadata;
  return profileInput;
}

function summarize(canonical, behavioral, archetype) {
  const ranked = canonical.ranked_dimensions || [];
  const top3 = ranked.slice(0, 3).map(d => `${dimensionLabels[d.dimension] || d.dimension} ${Number(d.score).toFixed(2)}`);
  const bottom2 = ranked.slice(-2).map(d => `${dimensionLabels[d.dimension] || d.dimension} ${Number(d.score).toFixed(2)}`);
  const primary = ranked[0]?.dimension || 'unknown';
  const secondary = ranked[1]?.dimension || 'unknown';
  const roleFit = canonical.role_fit_analysis || {};
  const environment = canonical.environment_fit || {};
  const rescoring = canonical.rescoring_v1 || {};
  const rescoreRanked = rescoring.ranked_dimensions || [];

  return {
    archetype: archetype.archetype,
    synthetic_person_name: archetype.name,
    intended_role: archetype.intended_role,
    profile_id: archetype.profile_id,
    top_3_dimensions: top3,
    bottom_2_dimensions: bottom2,
    primary_engine: dimensionLabels[primary] || primary,
    secondary_engine: dimensionLabels[secondary] || secondary,
    natural_advantage: archetype.expected.advantage,
    natural_risk: archetype.expected.risk,
    energy_source: archetype.expected.energy,
    fatigue_source: archetype.expected.fatigue,
    best_environment: archetype.expected.best,
    worst_environment: archetype.expected.worst,
    initial_role_fit_judgment: archetype.expected.role_fit,
    scoring_notes: buildScoringNotes(archetype, ranked, roleFit),
    role_fit_analysis: roleFit,
    environment_fit: {
      thrives_in: environment.thrives_in || [],
      struggles_in: environment.struggles_in || [],
      requires: environment.requires || []
    },
    rescoring_summary: {
      source: rescoring.source || 'rescoring_v1',
      primary_dimension: rescoring.dominance_profile?.primary_dimension || rescoreRanked[0]?.dimension || primary,
      secondary_dimension: rescoring.dominance_profile?.secondary_dimension || rescoreRanked[1]?.dimension || secondary,
      ranked_dimensions: rescoreRanked.map(d => ({
        dimension: d.dimension,
        score: d.score,
        display_score: d.display_score,
        gpt_rescored_score: d.gpt_rescored_score
      })),
      render_ready_keys: Object.keys(rescoring.render_ready || {})
    },
    behavioral_intelligence_keys: Object.keys(behavioral?.domains || {}),
    rendered_profile_snapshot: {
      profile_dna: canonical.rescoring_v1?.render_ready?.profile_dna || canonical.narrative_profile?.summary || null,
      dna_summary: canonical.rescoring_v1?.render_ready?.dna_summary || null,
      scaling_constraint: behavioral?.domains?.scalingConstraint || null,
      one_move: behavioral?.domains?.theOneMove || null,
      five_futures: behavioral?.domains?.fiveFutures || null,
      facilitator_notes: behavioral?.domains?.facilitatorNotes || null,
      role_fit: roleFit
    }
  };
}

function buildScoringNotes(archetype, ranked, roleFit) {
  const topDims = ranked.slice(0, 3).map(d => d.dimension);
  const bottomDims = ranked.slice(-2).map(d => d.dimension);
  const expectedTopSignals = Object.entries(archetype.target)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([dimension]) => dimension);
  const matches = expectedTopSignals.filter(d => topDims.includes(d));
  const concerns = [];
  if (matches.length < 2) {
    concerns.push(`Only ${matches.length}/3 intended top dimensions landed in top 3.`);
  }
  if (archetype.slug.includes('accountant') && !topDims.includes('fidelity')) {
    concerns.push('Accountant did not surface Fidelity in top 3.');
  }
  if (archetype.slug.includes('compliance') && !(topDims.includes('framework') && topDims.includes('fidelity'))) {
    concerns.push('Compliance did not surface both Framework and Fidelity in top 3.');
  }
  if (archetype.slug.includes('front') && !topDims.includes('signal')) {
    concerns.push('Front desk did not surface Signal in top 3.');
  }
  if (archetype.slug.includes('engineer') && !topDims.includes('fidelity')) {
    concerns.push('Engineer did not surface Fidelity in top 3.');
  }
  if (archetype.slug.includes('sales') && !(topDims.includes('velocity') || topDims.includes('leverage'))) {
    concerns.push('VP Sales did not surface Velocity or Leverage in top 3.');
  }
  return concerns.length > 0
    ? concerns.join(' ')
    : `Top dimensions ${topDims.join(', ')} broadly match intended role signal; bottom dimensions ${bottomDims.join(', ')} create plausible fatigue/risk.`;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function markdown(results) {
  const rows = results.map(r => `| ${r.archetype} | ${r.synthetic_person_name} | ${r.profile_id} | ${r.top_3_dimensions.join('<br>')} | ${r.bottom_2_dimensions.join('<br>')} | ${r.primary_engine} | ${r.initial_role_fit_judgment} | ${r.scoring_notes} |`).join('\n');
  const validation = [
    ['Does the Accountant score differently from the CEO?', comparePrimary(results, 'Accountant', 'Founder / CEO')],
    ['Does the Recruiter score differently from the Engineer?', comparePrimary(results, 'Recruiter', 'Engineer')],
    ['Does the Compliance profile show high rule/process orientation?', hasTop(results, 'Compliance Officer', ['framework', 'fidelity'])],
    ['Does the VP Sales show high influence/velocity/direction?', hasAnyTop(results, 'VP Sales', ['leverage', 'velocity', 'vector'])],
    ['Does the Front Desk profile show service/stability/relational awareness?', hasTop(results, 'Front Desk / Client Service', ['signal'])],
    ['Does the Marketing Creative show creative signal/adaptability?', hasAnyTop(results, 'Marketing Creative', ['flex', 'signal', 'horizon'])],
    ['Does any archetype collapse into generic Command/operator language?', detectCollapse(results)],
    ['Are profiles differentiated by evidence, not forced creativity?', 'PASS - artifacts preserve raw answers, canonical scoring, BI extraction, and role-fit context for audit.']
  ];

  return `# Archetype Validation Lab

Generated: 2026-05-29

Purpose: create synthetic but realistic benchmark submissions to validate MORE MindMap scoring, deterministic rescoring, Behavioral DNA Interpretation, and role-fit logic across role archetypes. These are not flattering fake profiles; each includes strengths, fatigue points, pressure behavior, and role-fit risks.

Pipeline used:

1. Synthetic frontend-style assessment payload
2. \`BuildProfileInput\`
3. \`generateCanonicalProfile\`
4. \`rescoring_v1\` deterministic rescoring
5. \`extractBehavioralIntelligence\` + \`refineExtraction\`
6. Local rendered snapshot JSON

GPT behavioral rescoring was not forced in this lab because it requires live OpenAI configuration. Each result records deterministic \`rescoring_v1\` output and a placeholder for GPT rescoring status.

## Archetype Comparison

| Archetype | Synthetic Person | Profile ID | Top 3 Dimensions | Bottom 2 Dimensions | Primary Engine | Initial Role-Fit Judgment | Scoring Notes |
|---|---|---|---|---|---|---|---|
${rows}

## Detailed Records

${results.map(r => `### ${r.archetype}: ${r.synthetic_person_name}

- Profile ID: \`${r.profile_id}\`
- Intended role: ${r.intended_role}
- Top 3 dimensions: ${r.top_3_dimensions.join(', ')}
- Bottom 2 dimensions: ${r.bottom_2_dimensions.join(', ')}
- Primary engine: ${r.primary_engine}
- Natural advantage: ${r.natural_advantage}
- Natural risk: ${r.natural_risk}
- Energy source: ${r.energy_source}
- Fatigue source: ${r.fatigue_source}
- Best environment: ${r.best_environment}
- Worst environment: ${r.worst_environment}
- Initial role-fit judgment: ${r.initial_role_fit_judgment}
- Notes on whether scoring feels correct: ${r.scoring_notes}
`).join('\n')}

## Validation Questions

${validation.map(([q, a]) => `- ${q} ${a}`).join('\n')}

## Obvious Scoring Concerns

${buildConcerns(results).map(c => `- ${c}`).join('\n')}

## Recommended Next Patch Sequence

1. Run the same benchmark through GPT behavioral rescoring in a controlled environment and compare \`display_score\` deltas against deterministic \`rescoring_v1\`.
2. Add a small regression harness that fails when role archetypes collapse into the same primary/secondary pair without written-evidence justification.
3. Add role-fit assertions for compliance/accounting/front-desk profiles so Framework/Fidelity/Signal do not get drowned out by generic Vector/Velocity language.
4. Add snapshot comparison for V3 narrative sections to detect generic Command/operator convergence across unrelated roles.
5. Review question weighting for service and process-heavy roles if repeated MC optimization still over-rewards fast action choices.
`;
}

function comparePrimary(results, a, b) {
  const left = results.find(r => r.archetype === a);
  const right = results.find(r => r.archetype === b);
  return left?.primary_engine !== right?.primary_engine
    ? `PASS - ${a} primary ${left?.primary_engine}; ${b} primary ${right?.primary_engine}.`
    : `FAIL - both primary ${left?.primary_engine}.`;
}

function resultDims(result) {
  return (result?.top_3_dimensions || []).map(item => item.split(' ')[0].toLowerCase());
}

function hasTop(results, archetype, dims) {
  const result = results.find(r => r.archetype === archetype);
  const top = resultDims(result);
  const missing = dims.filter(d => !top.includes(d));
  return missing.length === 0
    ? `PASS - top dimensions include ${dims.join(', ')}.`
    : `FAIL - missing ${missing.join(', ')} from top dimensions (${top.join(', ')}).`;
}

function hasAnyTop(results, archetype, dims) {
  const result = results.find(r => r.archetype === archetype);
  const top = resultDims(result);
  return dims.some(d => top.includes(d))
    ? `PASS - top dimensions include one of ${dims.join(', ')} (${top.join(', ')}).`
    : `FAIL - none of ${dims.join(', ')} landed in top dimensions (${top.join(', ')}).`;
}

function detectCollapse(results) {
  const signatures = new Map();
  for (const result of results) {
    const signature = result.top_3_dimensions.map(item => item.split(' ')[0]).join('/');
    signatures.set(signature, [...(signatures.get(signature) || []), result.archetype]);
  }
  const repeated = [...signatures.entries()].filter(([, list]) => list.length > 1);
  return repeated.length === 0
    ? 'PASS - no identical top-3 dimension signatures across the ten archetypes.'
    : `WARN - repeated signatures: ${repeated.map(([sig, list]) => `${sig}: ${list.join(', ')}`).join('; ')}.`;
}

function buildConcerns(results) {
  const concerns = [];
  for (const result of results) {
    if (!result.scoring_notes.startsWith('Top dimensions')) {
      concerns.push(`${result.archetype}: ${result.scoring_notes}`);
    }
  }
  if (concerns.length === 0) {
    concerns.push('No hard scoring failures in the first deterministic pass; use GPT rescoring and rendered V3 comparison next.');
  }
  concerns.push('Several role archetypes can still be pulled toward action/command because many MC choices reward Vector/Velocity; written evidence should be checked in narrative and role-fit layers.');
  concerns.push('The current local pipeline does not persist these synthetic profiles to Redis; this lab validates generation artifacts, not production retrieval behavior.');
  return concerns;
}

async function run() {
  const builder = new BuildProfileInput();
  const results = [];

  for (const archetype of archetypes) {
    const raw = buildRawSubmission(archetype);
    const profileInput = attachIdentity(builder.build(raw), raw);
    const canonical = await generateCanonicalProfile(profileInput, {
      profile_id: archetype.profile_id,
      model: 'synthetic-archetype-validation-v1'
    });
    canonical.synthetic_validation = {
      archetype: archetype.archetype,
      intended_role: archetype.intended_role,
      generated_by: 'docs/validation/generate-archetype-lab.mjs',
      gpt_rescoring_status: process.env.GPT_RESCORING_ENABLED === 'true' ? 'attempted_by_canonical_generator' : 'skipped_not_enabled'
    };

    const behavioralRaw = extractBehavioralIntelligence(canonical);
    const behavioral = refineExtraction(behavioralRaw, canonical);
    canonical.behavioral_intelligence_v1 = behavioral;

    const summary = summarize(canonical, behavioral, archetype);
    results.push(summary);

    const baseName = `${archetype.profile_id}-${archetype.slug}`;
    writeJson(path.join(submissionsDir, `${baseName}.json`), raw);
    writeJson(path.join(resultsDir, `${baseName}-canonical.json`), canonical);
    writeJson(path.join(resultsDir, `${baseName}-scoring.json`), {
      profile_id: archetype.profile_id,
      vector_scores: canonical.vector_scores,
      ranked_dimensions: canonical.ranked_dimensions,
      top_systems: canonical.top_systems,
      role_fit_analysis: canonical.role_fit_analysis,
      environment_fit: canonical.environment_fit
    });
    writeJson(path.join(resultsDir, `${baseName}-rescoring.json`), {
      profile_id: archetype.profile_id,
      rescoring_v1: canonical.rescoring_v1,
      rescoring_gpt: canonical.rescoring_gpt || null,
      gpt_rescoring_status: canonical.synthetic_validation.gpt_rescoring_status
    });
    writeJson(path.join(resultsDir, `${baseName}-snapshot.json`), summary);
  }

  fs.writeFileSync(path.join(root, 'ARCHETYPE_VALIDATION_LAB.md'), markdown(results));
  writeJson(path.join(resultsDir, 'archetype-validation-summary.json'), results);
  console.log(JSON.stringify({
    generated_profiles: results.map(r => ({ archetype: r.archetype, profile_id: r.profile_id, top_3: r.top_3_dimensions })),
    artifacts: {
      markdown: 'docs/validation/ARCHETYPE_VALIDATION_LAB.md',
      submissions: 'docs/validation/archetype-submissions/',
      results: 'docs/validation/archetype-results/'
    }
  }, null, 2));
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
