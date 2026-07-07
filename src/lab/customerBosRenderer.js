/**
 * MMB11 lab-only Customer BOS rendering layer.
 * Static customer-readable rewrite of GPT-5.5 technical BOS — same depth, clearer language.
 */

const SECTION_ORDER = ['executiveSummary', 'fiveFutures', 'recommendedNextStep', 'facilitatorNotes'];

export const customerBosSectionsDarrenMmb11 = {
  executiveSummary: {
    headline: 'You Create Momentum',
    body: `Darren, you create value by taking stalled work, giving it direction, and pushing it toward visible progress. You are at your best in rainmaking roles — unblocking initiatives, restarting motion, and leading early-stage movement where the next step matters more than perfect process.

Your edge shows up when revenue, model clarity, or a stuck project needs someone who can decide, explain intent, and get things moving again. You said you hyper-focus and get the job done, and you usually take the rainmaker role. That is not generic leadership language — it matches how you actually operate.

The limit is not your drive. It is scale without scaffolding. As the business grows, your pace can confuse newer team members. Doubts may stay hidden too long. Progress can start depending on you personally stepping in to clarify, restart, or redirect the work. At 5x scale, the business will need decision frameworks, escalation paths, and clearer structure around your momentum.

Under pressure, you double down: more decisive, faster, less reading of detail. Prolonged load is your break point. Roles that require constant permission-seeking, repeated process failure without correction, or heavy coordination without clear escalation paths will drain you.

You are not built for indefinite coordination layers. You are built to set direction, create opportunity, and define the model — especially for a business you want to become subscription-based, residual, and eventually able to operate mostly on its own.

The highest-leverage insight: do not slow yourself down with vague consensus. Give the business written 30-day success criteria, clear decision rules, and escalation paths so progress does not have to wait for you every time friction appears.`,
    micro_scenario:
      'In a meeting where a project is looping, you ask why momentum stalled, change the path, and push the room toward action.',
    key_warning:
      'The overlooked risk is growth without external structure. Momentum that depends on your personal unblock will conflict with your goal of building a business that can run without you.',
    evidenceUsed: [
      'You describe yourself as a rainmaker who hyper-focuses and gets the job done.',
      'You prefer moving forward over asking for permission when repetition frustrates you.',
      'You want a subscription-based company with long-term residual effect.',
      'Your operating scores: Vector 0.88, Velocity 0.75, Framework 0.17, Horizon 0.00.',
      'Scaling breakpoint identified as coordination — momentum risk tied to your personal unblock.',
    ],
  },

  fiveFutures: {
    summary: `Darren, your future is not shaped by "being decisive" alone. It is shaped by a specific combination: very high direction (Vector 0.88), strong speed (Velocity 0.75), very low natural structure (Framework 0.17), and near-zero long-range planning instinct (Horizon 0.00), plus your stated rainmaker role and preference to move forward rather than keep asking for permission.

The central tension in your profile is the gap between what you want — a residual, subscription-based company that can operate on its own — and what happens today: momentum still depends on your personal direction, model ownership, and speed.`,
    most_likely: {
      title: 'Most Likely Path: Momentum With Rising Coordination Cost',
      likelihood: 'Likely',
      trajectory:
        'If nothing changes, you keep creating forward motion through personal direction and pace. You step in when work stalls, change the process, and push things back toward motion. Action is your stabilizer — when the same ineffective pattern repeats, moving forward feels cleaner than waiting for permission or consensus.',
      organization_experiences:
        'The MORE Companies gets strong early momentum in founder-led sales, product direction, and opportunity creation. The cost shows up as coordination load: new people may not understand your pace, and teams hesitate when unsure whether to use your model exactly or adapt it. Tension appears when someone interprets your model and makes it work for them instead of using it as designed.',
    },
    futures: [
      {
        title: 'Momentum With Rising Coordination Cost',
        likelihood: 'Likely',
        trajectory:
          'You continue leading through direction, speed, and intervention. Under pressure, decisiveness increases and you move faster while reading less. When momentum stalls, you try to understand why, then change the process to restart motion. Forward movement is how you reduce frustration when others repeat the same ineffective pattern.',
        organization_experiences:
          'The organization gets movement, but movement increasingly depends on your interpretation of what should happen next. At 2x scale, your pace may confuse new team members. You leave people to work independently so their creative side shows up — but sometimes they stall until you re-enter and redirect. Initiative becomes uneven: strong contributors run, unclear contributors wait.',
      },
      {
        title: 'Thirty-Day Clarity Transfers Momentum',
        likelihood: 'Possible',
        trajectory:
          'If you adopt the One Move — clarify what success looks like in the next 30 days, write it down, commit publicly — your hyper-focus becomes aimed at a defined outcome rather than repeatedly re-solving what stalled. You already say that moving forward doing things is beneficial for you; structure channels that instinct productively.',
        organization_experiences:
          'Less founder interpretation in the middle of work. People know the outcome you committed to for 30 days, which reduces the tension of others reinterpreting your model. This matters especially for a subscription business: recurring value needs repeatable execution after the initial rainmaker push, not just you personally restarting momentum whenever the team slows.',
      },
      {
        title: 'Speed Becomes Rework',
        likelihood: 'Risk',
        trajectory:
          'Under prolonged pressure, your pattern intensifies: more decisive, faster, less reading. Doing the same thing repeatedly with the same result drains you. Speed is both relief and risk — the faster you move to escape stalled momentum, the more likely you skip information that later changes the decision.',
        organization_experiences:
          'The organization feels abrupt course changes. Your cruise decision is the personal version: decide fast, research more, then reverse when new information changes the picture. In business, fast product, partnership, or hiring commitments can reverse later. Teams lose confidence about whether a decision is final or just the first fast move.',
      },
      {
        title: 'Judgment Becomes Shareable',
        likelihood: 'Possible',
        trajectory:
          'You keep decisiveness but make your reasoning easier for others to use. You are listening-first but decisive, and you try to explain intentions several ways when misunderstood. Maturation here is not becoming less directive — it is making your model teachable before people are left alone to execute.',
        organization_experiences:
          'A shift from Darren as rainmaker to Darren as builder of owners. Team members receive enough of your judgment to act without waiting for you to unblock momentum. Faith-based values that drive your company thinking are protected as the business grows, rather than depending on you being present for every important interpretation.',
      },
      {
        title: 'Scale Exposes Founder Dependency',
        likelihood: 'Likely',
        trajectory:
          'If the scaling constraint stays unresolved, growth exposes the coordination break. At 5x scale you need external structure, escalation processes, and decision frameworks. Vector plus velocity creates strong personal motion; low Framework and Horizon leave the broader system less able to carry that motion without you.',
        organization_experiences:
          'Revenue or opportunity can grow faster than operating independence. That threatens your goal of a subscription-based or saleable business. Instead of becoming a residual asset, the company risks becoming founder-responsive: teams wait for your read, your model, or your permission. Value stays tied to your personal unblock.',
      },
    ],
  },

  recommendedNextStep: {
    headline: 'Move From Personal Unblocker to Transferable Decision Authority',
    body: `Darren, your One Move is to transfer judgment — not work harder or move faster.

Your future bottleneck is founder-dependent execution: the company needing you to clarify the model, grant permission, restart momentum, or correct decisions every time complexity rises. That directly conflicts with building a subscription or residual business that can operate without you.

You are the right person to define direction, standards, and decision logic. You are not the right person to remain the recurring coordination layer or daily permission source. Your highest-value role is owner of vision, rainmaking, strategic decisions, and key relationships. The execution system needs to carry more judgment without you.`,
    futureBottleneck:
      'Growth will cap when execution slows, the model is misread, or a decision feels unclear — and the team waits for you to personally step in. That keeps the business dependent on you rather than building a transferable asset.',
    interventionType: 'Transfer judgment',
    intervention:
      'Create a decision-rights and accountability structure that lets the team execute your model without needing you to personally clarify, approve, or restart momentum every time friction appears.',
    whyThisMatters:
      'If you want a business that can be sold, leveraged, or largely operate on its own, the company must prove its judgment is transferable. A business that still needs the founder to interpret the model and restart momentum is not yet a scalable asset.',
    whatHappensIfIgnored:
      'Growth increases pressure on you rather than reducing it. The team waits for approval, misinterprets the model, or moves in directions you later correct. Time strain rises, frustration builds, and the company stays dependent on your personal pace.',
    first30Days: [
      'Pick one business function where momentum most often stalls. Name a single accountable owner for outcomes, decisions, and escalation.',
      'Write a one-page decision guide: the 30-day success target, decisions the owner can make without you, decisions that require escalation, and standards that must not be violated.',
      'Run a weekly 30-minute accountability review: progress, autonomous decisions made, blocked issues, and judgment gaps to add to the guide.',
    ],
    proofSignals: [
      'The team makes correct decisions without waiting for your approval.',
      'You spend less time re-explaining intentions, correcting interpretation, or restarting stalled work.',
      'Momentum continues for at least two weeks in the selected function even when you are not directly involved.',
    ],
    confidence: 'High',
    evidenceUsed: [
      'You describe yourself as the rainmaker and note tension when others reinterpret your model instead of using it as designed.',
      'Scaling read identifies coordination as the breakpoint, with risk that momentum becomes dependent on your unblock.',
      'Strong directional drive and speed paired with low structure scores point to future strain around repeatable process at scale.',
    ],
  },

  facilitatorNotes: {
    summary:
      'Darren functions best where he owns direction and rainmaking while a structured operating layer translates his model into delegated execution, decision rights, accountability, and escalation paths.',
    primary_guidance:
      'Do not make Darren the recurring coordination layer. Install an operator, chief of staff, or accountable integrator who converts his direction into owned workstreams, clear decision rights, milestones, and escalation rules.',
    notes: [
      {
        label: 'Reporting',
        guidance:
          'Place Darren in a direction-setting, rainmaker, or founder/strategic lead seat with a direct operational counterpart for execution coordination. Routine clarification and permission questions should not route through Darren once the model is defined. Separate strategic direction from day-to-day operational management.',
        rationale:
          'Darren enters situations with direction already forming and stabilizes direction for the team. Without external structure, the organization can become dependent on his unblock.',
      },
      {
        label: 'Delegation',
        guidance:
          'Build delegation around decision-right transfer, not task handoff alone. For each workstream, define the owner, non-negotiable standards, autonomous decisions, escalation triggers, and expected output. Document operating principles so others execute the design as intended rather than reinterpret it informally.',
        rationale:
          'Tension appears when others interpret his model and make it work for them. Leaving people to work independently sometimes produces no progress — autonomy without clarity becomes ambiguity.',
      },
      {
        label: 'Accountability',
        guidance:
          'Use visible accountability: named owners, weekly commitments, milestone dates, and status categories (on-track, blocked, at-risk, decision-needed). Focus on whether the agreed model and output were executed. Missed progress should trigger a recovery path rather than waiting for Darren to restart momentum.',
        rationale:
          'Momentum loss comes from unclear next steps. Frustration rises when teams repeat the same process with the same results.',
      },
      {
        label: 'Meetings',
        guidance:
          'Keep meetings structured and decision-oriented: weekly execution review led by the operational counterpart, separate strategic alignment with Darren, and short escalation windows for blocked decisions. Start with decisions needed, blockers, and owner updates — avoid open-ended deliberation without a decision pathway.',
        rationale:
          'Darren favors direction and action. Under pressure he moves faster and reads less — meetings must preserve alignment without unnecessary drag.',
      },
      {
        label: 'Communication',
        guidance:
          'Use concise written briefs before key conversations: context, recommendation, tradeoffs, decision requested, deadline. Follow verbal discussion with a written decision log. Frame feedback against the agreed model and outcomes, not generalized opinion.',
        rationale:
          'Darren is listening-first but decisive. Written artifacts reduce ambiguity and make it easier to evaluate whether a challenge is about the model, execution, or assumptions.',
      },
      {
        label: 'Decisions',
        guidance:
          'Install three decision tiers: reversible decisions owned by workstream leads, material operational decisions reviewed by the operator, strategic/model-changing decisions reviewed by Darren. Keep a decision log with owner, date, rationale, and review date. High-speed decisions get a brief risk check when safety, capital, brand, or long-term direction is affected.',
        rationale:
          'Darren forms direction quickly and validates through action. Under strain, decisiveness increases and detail drops — tiered decisions preserve speed while preventing over-centralization.',
      },
      {
        label: 'Organizational fit',
        guidance:
          'Best fit is growth-stage, founder-led, mission-aligned environments where Darren sets direction and defines the model while execution infrastructure carries the operating rhythm. Value decisive movement, clear standards, faith-aligned principles where relevant, and practical progress over repeated theoretical debate.',
        rationale:
          'Darren identifies as a rainmaker, wants long-term residual effect, and is frustrated by repeated ineffective patterns.',
      },
      {
        label: 'Support structure',
        guidance:
          'Provide an external operating backbone: documented operating model, role clarity, escalation rules, decision frameworks, dashboard visibility, and an integrator empowered to manage follow-through. Clarify the next 30 days of success in writing and translate that into workstream commitments.',
        rationale:
          'The One Move is to transfer judgment. Scaling requires external structures, decision frameworks, and clear escalation paths.',
      },
      {
        label: 'Pressure design',
        guidance:
          'Under load, route Darren toward fewer, higher-value decisions. When pressure rises, the operator should filter issues, summarize risks, and present options rather than pulling Darren into raw coordination. Prolonged load triggers workload triage and decision consolidation.',
        rationale:
          'Under pressure Darren becomes more decisive, moves faster, and reads less. The environment must prevent pressure from converting him into the bottleneck or emergency coordinator.',
      },
    ],
    caution:
      'Do not assume broad independence produces execution. This environment should not force Darren to choose between total control and unstructured delegation.',
  },
};

export function formatCustomerSectionContent(sectionId, payload) {
  if (!payload) return 'No section data available.';

  if (sectionId === 'executiveSummary') {
    const evidence = (payload.evidenceUsed || []).map((e) => `- ${e}`).join('\n');
    return [
      payload.headline ? `**${payload.headline}**` : null,
      payload.body ? `\n${payload.body}` : null,
      payload.micro_scenario ? `\n\n**A moment that shows this:** ${payload.micro_scenario}` : null,
      payload.key_warning ? `\n\n**Watch for:** ${payload.key_warning}` : null,
      evidence ? `\n\n**Evidence used:**\n${evidence}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'fiveFutures') {
    const futures = (payload.futures || []).map((f, i) => (
      `${i + 1}. **${f.title}** (${f.likelihood})\n${f.trajectory}\n\n_What the organization experiences:_ ${f.organization_experiences}`
    )).join('\n\n');
    return [
      payload.summary ? `${payload.summary}` : null,
      payload.most_likely
        ? `\n\n**${payload.most_likely.title || payload.most_likely.headline}** (${payload.most_likely.likelihood})\n${payload.most_likely.trajectory}\n\n_What the organization experiences:_ ${payload.most_likely.organization_experiences}`
        : null,
      futures ? `\n\n**All five futures:**\n\n${futures}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'recommendedNextStep') {
    const days = (payload.first30Days || []).map((d, i) => `${i + 1}. ${d}`).join('\n');
    const evidence = (payload.evidenceUsed || []).map((e) => `- ${e}`).join('\n');
    const signals = (payload.proofSignals || []).map((s) => `- ${s}`).join('\n');
    return [
      payload.headline ? `**${payload.headline}**` : null,
      payload.body ? `\n\n${payload.body}` : null,
      payload.futureBottleneck ? `\n\n**Future bottleneck:** ${payload.futureBottleneck}` : null,
      payload.interventionType ? `\n\n**Type of move:** ${payload.interventionType}` : null,
      payload.intervention ? `\n\n**The move:** ${payload.intervention}` : null,
      payload.whyThisMatters ? `\n\n**Why this matters:** ${payload.whyThisMatters}` : null,
      payload.whatHappensIfIgnored ? `\n\n**If ignored:** ${payload.whatHappensIfIgnored}` : null,
      payload.confidence ? `\n\n**Confidence:** ${payload.confidence}` : null,
      days ? `\n\n**First 30 days:**\n${days}` : null,
      signals ? `\n\n**How you will know it is working:**\n${signals}` : null,
      evidence ? `\n\n**Evidence used:**\n${evidence}` : null,
    ].filter(Boolean).join('');
  }

  if (sectionId === 'facilitatorNotes') {
    const notes = (payload.notes || []).map((n) => `**${n.label}:** ${n.guidance}\n_Why:_ ${n.rationale}`).join('\n\n');
    return [
      payload.summary ? `${payload.summary}` : null,
      payload.primary_guidance ? `\n\n**Primary guidance:** ${payload.primary_guidance}` : null,
      notes ? `\n\n**Environment design:**\n\n${notes}` : null,
      payload.caution ? `\n\n**Caution:** ${payload.caution}` : null,
    ].filter(Boolean).join('');
  }

  return JSON.stringify(payload, null, 2);
}

export function formatCustomerBosFullText(sections = customerBosSectionsDarrenMmb11) {
  return SECTION_ORDER.map((id) => formatCustomerSectionContent(id, sections[id])).join('\n\n---\n\n');
}

export { SECTION_ORDER as CUSTOMER_SECTION_ORDER };