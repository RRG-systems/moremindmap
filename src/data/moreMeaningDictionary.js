export const universalTranslatorDoctrine = {
  version: "more_meaning_dictionary_v1",
  purpose:
    "Translate MORE MindMap intelligence into practical human meaning without replacing the original output.",
  method: [
    "Extract the technical claim.",
    "Identify the human behavior underneath it.",
    "Translate the consequence.",
    "Say it like a person.",
    "Add one coaching sentence or next action."
  ],
  outputShape: [
    "what_it_says",
    "what_it_means",
    "why_it_matters",
    "what_to_do_next"
  ],
  sourceOfTruthPolicy:
    "The original profile, assessment, strategy, ledger, and draft output remains the source of truth.",
  recordMutationPolicy:
    "The translator is a comprehension layer only. It does not write records, alter outputs, or create evidence."
};

const term = ({
  label,
  category,
  technical,
  plain,
  does,
  doesNot,
  rule,
  example,
  warning = ""
}) => ({
  label,
  category,
  technical_meaning: technical,
  plain_english_meaning: plain,
  what_it_does: does,
  what_it_does_not_mean: doesNot,
  user_facing_translation_rule: rule,
  example_translation: example,
  overclaim_warning: warning
});

export const moreMeaningDictionary = [
  term({
    label: "Behavior Operating System",
    category: "MORE system terms",
    technical: "The behavioral intelligence layer that explains how a person tends to decide, communicate, execute, and respond under pressure.",
    plain: "Your personal operating manual.",
    does: "Helps a user understand the behavior underneath their patterns.",
    doesNot: "It is not a diagnosis, fixed identity, or prediction of every action.",
    rule: "Translate it as how the person naturally operates and where that helps or hurts.",
    example: "This means your best work happens when your energy has a clear target and a simple execution path."
  }),
  term({
    label: "Business Assessment",
    category: "MORE system terms",
    technical: "A business-context intake and analysis layer that combines business reality with behavioral reality.",
    plain: "A map of what is happening in the business and what behavior is driving it.",
    does: "Shows constraints, leverage points, future paths, and the next practical move.",
    doesNot: "It does not prove revenue, guarantee outcomes, or replace business judgment.",
    rule: "Explain what the assessment reveals about the business in everyday terms.",
    example: "Your business is not just short on leads; it is short on a repeatable relationship system."
  }),
  term({
    label: "Canonical Dossier",
    category: "MORE system terms",
    technical: "The internal structured profile record used as a stable source for interpretation.",
    plain: "The saved source file the system reads from.",
    does: "Keeps profile intelligence consistent across outputs.",
    doesNot: "It should not be shown directly to users as raw internal data.",
    rule: "Refer to the meaning derived from the source, not the source structure.",
    example: "The profile source indicates a strong action bias; in plain English, you move faster when the goal is concrete."
  }),
  term({
    label: "Profile ID",
    category: "MORE system terms",
    technical: "A stable identifier used to retrieve a saved profile or linked business assessment.",
    plain: "The lookup code for a user's saved map.",
    does: "Connects the right profile to the right output.",
    doesNot: "It is not a password or payment proof by itself.",
    rule: "Explain it as the user's retrieval key.",
    example: "Use this ID when you want MORE MindMap to pull up the same saved profile again."
  }),
  term({
    label: "Five Futures",
    category: "MORE system terms",
    technical: "A set of possible future business paths generated from the current evidence and constraints.",
    plain: "Five realistic directions the business could go from here.",
    does: "Helps compare likely paths and the behavior required for each.",
    doesNot: "It does not guarantee that any one future will happen.",
    rule: "Explain futures as possible paths, not predictions.",
    example: "This future is saying that the business can grow if the relationship channel becomes repeatable.",
    warning: "Do not translate a future path as a promised outcome."
  }),
  term({
    label: "One Move",
    category: "MORE system terms",
    technical: "The single next action selected as the highest-leverage move from the current strategy.",
    plain: "The one thing to do next.",
    does: "Reduces complexity into a practical action.",
    doesNot: "It is not the only thing that matters forever.",
    rule: "Translate it as today's focused move.",
    example: "Do not try to fix the whole business this week. Make the lender follow-up specific."
  }),
  term({
    label: "Business Intelligence Draft",
    category: "MORE system terms",
    technical: "An analysis draft that interprets business inputs before final user-facing packaging.",
    plain: "The system's working business readout.",
    does: "Organizes business signals into an interpretable draft.",
    doesNot: "It is not a final legal, financial, or guaranteed business plan.",
    rule: "Translate it as an analysis draft with limits.",
    example: "The draft is pointing to a follow-up gap, not declaring that the business is broken."
  }),
  term({
    label: "Executive Diagnostic",
    category: "MORE system terms",
    technical: "A user-facing summary of the business assessment's core diagnosis and evidence.",
    plain: "The executive summary of what is really going on.",
    does: "Highlights constraints, signals, and the next useful focus.",
    doesNot: "It does not replace direct business evidence.",
    rule: "Translate it as the clearest business read, with evidence limits intact.",
    example: "The diagnostic says your biggest constraint is not ambition; it is conversion consistency."
  }),
  term({
    label: "Business Assessment Map",
    category: "MORE system terms",
    technical: "A visual artifact showing the structure of the business assessment analysis.",
    plain: "A visual version of the business map.",
    does: "Makes the assessment easier to inspect and discuss.",
    doesNot: "It is not a separate assessment or new source of truth.",
    rule: "Translate it as a visual aid for the same underlying result.",
    example: "This map shows how your relationship base, lead flow, and execution pattern connect."
  }),
  term({
    label: "Visual DNA",
    category: "MORE system terms",
    technical: "A visual representation of profile or assessment intelligence.",
    plain: "A picture of the pattern.",
    does: "Helps the user see structure faster.",
    doesNot: "It is not proof by itself.",
    rule: "Explain the meaning behind the visual, not just the design.",
    example: "The visual is showing concentrated drive with a need for cleaner follow-through."
  }),
  term({
    label: "Since Last Snapshot",
    category: "MORE system terms",
    technical: "A comparison layer showing what changed since the previous strategy snapshot.",
    plain: "What changed since last time.",
    does: "Separates new evidence from unchanged strategy context.",
    doesNot: "It does not mean the future moved automatically.",
    rule: "Translate changes and non-changes separately.",
    example: "Something was logged, but it is still early evidence, so the strategy should not overreact."
  }),
  term({
    label: "Outcome Ledger",
    category: "MORE system terms",
    technical: "A durable record of evidence events linked to a strategy or action.",
    plain: "The proof log.",
    does: "Stores what happened so coaching can use evidence later.",
    doesNot: "It does not automatically prove progress.",
    rule: "Explain the event and the strength of evidence.",
    example: "This entry records interest from a partner, but interest is not the same as adoption.",
    warning: "Do not translate a ledger event as validated progress unless the evidence supports it."
  }),
  term({
    label: "Evidence Weight",
    category: "MORE system terms",
    technical: "The strength band assigned to an evidence event.",
    plain: "How strong the proof is.",
    does: "Controls how much the system should trust a signal.",
    doesNot: "It is not a numeric probability.",
    rule: "Translate the band into practical caution.",
    example: "Early evidence means pay attention, but do not change the whole strategy yet."
  }),
  term({
    label: "Future Movement Gate",
    category: "MORE system terms",
    technical: "The evidence rule that decides whether a future path can move bands.",
    plain: "The guardrail that stops the system from overreacting.",
    does: "Keeps movement tied to evidence.",
    doesNot: "It does not score futures with percentages.",
    rule: "Explain why movement is allowed or not allowed.",
    example: "The future can be watched, but it should not be called validated."
  }),
  term({
    label: "Adaptive Strategy Draft",
    category: "MORE system terms",
    technical: "A new strategy recommendation generated from current evidence and saved for review.",
    plain: "A suggested update, not a replacement.",
    does: "Shows how the strategy might adapt.",
    doesNot: "It does not replace the active strategy automatically.",
    rule: "Always preserve pending-review language.",
    example: "This draft suggests a better next move, but the current strategy remains active until reviewed."
  }),
  term({
    label: "Proof Target",
    category: "MORE system terms",
    technical: "The specific evidence needed to validate or invalidate a strategic claim.",
    plain: "What would prove this is real.",
    does: "Turns vague progress into testable proof.",
    doesNot: "It is not the same as hope, interest, or excitement.",
    rule: "Translate into a concrete thing to ask for or measure.",
    example: "A proof target here is a committed pilot date, not a positive conversation."
  }),
  term({
    label: "Truth Boundary",
    category: "MORE system terms",
    technical: "A limit on what the system or user can honestly claim from the evidence.",
    plain: "The line between true and too much.",
    does: "Prevents overclaiming.",
    doesNot: "It is not pessimism.",
    rule: "State the limit plainly and usefully.",
    example: "You can say there is interest. You cannot say there is validated adoption yet."
  }),
  term({
    label: "What Not To Overclaim",
    category: "MORE system terms",
    technical: "A section identifying claims that would exceed the current evidence.",
    plain: "What not to say yet.",
    does: "Protects credibility.",
    doesNot: "It does not mean the idea is weak.",
    rule: "Translate as confidence discipline.",
    example: "Do not say lenders are adopting this. Say one lender showed early interest."
  }),
  term({
    label: "Constraint Detection",
    category: "MORE system terms",
    technical: "Identification of the limiting pattern or bottleneck in a profile or business.",
    plain: "Finding what is actually holding things back.",
    does: "Points attention to the real bottleneck.",
    doesNot: "It is not blame.",
    rule: "Translate the constraint into a fixable pattern.",
    example: "The constraint is not effort; it is that effort is not being converted into a repeatable system."
  }),
  term({
    label: "Confidence Reality",
    category: "MORE system terms",
    technical: "The system's evidence-based confidence in an interpretation.",
    plain: "How sure the system can honestly be.",
    does: "Keeps recommendations calibrated.",
    doesNot: "It is not certainty.",
    rule: "Translate confidence as what is known, what is likely, and what is still missing.",
    example: "The pattern is clear enough to act on, but not strong enough to declare proof."
  }),
  term({
    label: "Recursive Coaching",
    category: "MORE system terms",
    technical: "A coaching loop that uses prior strategy, evidence, outcomes, and summaries to guide the next action.",
    plain: "Coaching that remembers what happened.",
    does: "Improves guidance over time through structured evidence.",
    doesNot: "It is not fully autonomous learning unless explicitly live.",
    rule: "Translate as a loop, not magic.",
    example: "The system is using what happened last time to keep the next move honest."
  }),
  term({
    label: "MORE Monthly Intelligence",
    category: "MORE system terms",
    technical: "A subscription product for ongoing strategy tracking and adaptive coaching.",
    plain: "A monthly way to keep the map alive.",
    does: "Supports continued tracking, evidence logging, and strategy drafts.",
    doesNot: "It does not mean automatic strategy replacement is live.",
    rule: "Explain the ongoing loop without overstating automation.",
    example: "Each month, the system helps you see what changed and choose the next useful move."
  }),
  term({
    label: "Keep improving over time",
    category: "MORE system terms",
    technical: "The promise of ongoing interpretation, tracking, and adaptive review.",
    plain: "Use the map repeatedly, not once.",
    does: "Sets the expectation of an ongoing improvement loop.",
    doesNot: "It does not promise guaranteed outcomes.",
    rule: "Translate as disciplined repetition.",
    example: "The point is not one perfect answer; it is a better next move each time."
  }),
  term({
    label: "You have your map. Now keep it alive.",
    category: "MORE system terms",
    technical: "Subscription positioning that connects the initial result to ongoing use.",
    plain: "The first map is done; now use it in real life.",
    does: "Explains why ongoing intelligence matters after the result.",
    doesNot: "It does not claim payment creates intelligence.",
    rule: "Translate as continued application.",
    example: "Your result gives direction. Monthly Intelligence helps you act, record, and adjust."
  }),
  term({
    label: "Momentum Machine",
    category: "BOS behavior terms",
    technical: "A high-drive pattern oriented toward motion, opportunity, and forward pressure.",
    plain: "You create energy by moving.",
    does: "Helps a user understand speed and initiative as strengths.",
    doesNot: "It does not mean the person should skip structure.",
    rule: "Translate drive into practical momentum plus guardrails.",
    example: "Your momentum is an advantage when it has a clear finish line."
  }),
  term({
    label: "Command",
    category: "BOS behavior terms",
    technical: "A behavioral pattern that tends to lead, decide, and set direction.",
    plain: "You naturally take the wheel.",
    does: "Explains leadership pressure and decisiveness.",
    doesNot: "It does not mean control is always effective.",
    rule: "Translate command as useful direction with listening requirements.",
    example: "You can move people quickly, but the message needs room for buy-in."
  }),
  term({
    label: "Flex",
    category: "BOS behavior terms",
    technical: "A behavioral pattern that adapts quickly to changing people, pressure, or opportunities.",
    plain: "You adjust fast.",
    does: "Explains adaptability and situational intelligence.",
    doesNot: "It does not mean the user lacks discipline.",
    rule: "Translate flexibility as an advantage that needs anchors.",
    example: "You can read the room quickly, but you still need one fixed next step."
  }),
  term({
    label: "Stabilizer",
    category: "BOS behavior terms",
    technical: "A behavioral pattern that creates consistency, caution, and operational steadiness.",
    plain: "You help things stay grounded.",
    does: "Explains patience, reliability, and risk awareness.",
    doesNot: "It does not mean the user cannot grow.",
    rule: "Translate stability as a strength that should not become delay.",
    example: "Your caution protects quality, but it cannot become a reason to avoid the ask."
  }),
  term({
    label: "Builder",
    category: "BOS behavior terms",
    technical: "A behavioral pattern oriented toward systems, construction, and repeatable execution.",
    plain: "You turn ideas into working structure.",
    does: "Explains system-building and follow-through capacity.",
    doesNot: "It does not mean every problem needs a complex system.",
    rule: "Translate building into useful structure with simplicity.",
    example: "Build the smallest repeatable follow-up system before expanding the whole model."
  }),
  term({
    label: "pressure response",
    category: "BOS behavior terms",
    technical: "How a user tends to behave when stakes, conflict, or urgency increase.",
    plain: "What you do when things get tense.",
    does: "Shows predictable stress patterns.",
    doesNot: "It is not a permanent flaw.",
    rule: "Translate pressure behavior into a practical countermeasure.",
    example: "Under pressure, you may move faster than the room can follow. Slow the explanation before making the ask."
  }),
  term({
    label: "decision style",
    category: "BOS behavior terms",
    technical: "The user's preferred way of choosing, prioritizing, and committing.",
    plain: "How you decide.",
    does: "Explains speed, caution, data needs, and confidence patterns.",
    doesNot: "It does not mean one decision mode is always best.",
    rule: "Translate into how to make the next decision cleaner.",
    example: "You do not need more ideas right now; you need one decision with a deadline."
  }),
  term({
    label: "communication style",
    category: "BOS behavior terms",
    technical: "The user's natural way of explaining, persuading, listening, and responding.",
    plain: "How your message lands.",
    does: "Shows how others may experience the user.",
    doesNot: "It does not judge personality.",
    rule: "Translate into a real-world communication adjustment.",
    example: "Say the outcome first, then explain the system after they ask."
  }),
  term({
    label: "execution risk",
    category: "BOS behavior terms",
    technical: "A predictable way the user's strengths can create implementation problems.",
    plain: "Where your strength can trip you up.",
    does: "Identifies the behavior to watch during action.",
    doesNot: "It does not mean failure is expected.",
    rule: "Translate risk as a guardrail.",
    example: "Your risk is starting three paths before one path has proof."
  }),
  term({
    label: "operating advantage",
    category: "BOS behavior terms",
    technical: "A behavioral strength that reliably creates leverage when used well.",
    plain: "What naturally works for you.",
    does: "Shows what to lean into.",
    doesNot: "It is not permission to ignore constraints.",
    rule: "Translate into where the user should use their strength today.",
    example: "Your advantage is turning uncertainty into action; use it to secure the next meeting."
  }),
  term({
    label: "operating risk",
    category: "BOS behavior terms",
    technical: "A behavioral pattern that can reduce effectiveness if unmanaged.",
    plain: "What to watch out for.",
    does: "Names the risk before it becomes a problem.",
    doesNot: "It is not a character judgment.",
    rule: "Translate into a practical self-check.",
    example: "Before you pitch the big vision, check whether the other person has agreed to the small next step."
  }),
  term({
    label: "purposeful scale",
    category: "BOS behavior terms",
    technical: "Growth that is directed by clear purpose, capacity, and operating fit.",
    plain: "Grow in a way you can actually carry.",
    does: "Connects ambition to sustainable execution.",
    doesNot: "It does not mean growth at any cost.",
    rule: "Translate scale as focused expansion.",
    example: "The next scale move should make the system stronger, not just bigger."
  }),
  term({
    label: "entrepreneurial energy",
    category: "BOS behavior terms",
    technical: "A drive pattern that seeks opportunity, creation, movement, and ownership.",
    plain: "The part of you that wants to build.",
    does: "Explains initiative and opportunity sensitivity.",
    doesNot: "It does not replace evidence or discipline.",
    rule: "Translate energy into useful motion.",
    example: "Use the energy to make the ask, then let the proof decide what comes next."
  }),
  term({
    label: "no hubris",
    category: "BOS behavior terms",
    technical: "A truth-boundary instruction to avoid inflated claims or superiority framing.",
    plain: "Stay confident without pretending proof exists.",
    does: "Keeps interpretation credible.",
    doesNot: "It does not mean hiding strength.",
    rule: "Translate as grounded confidence.",
    example: "Say this is promising and early, not that the market has already chosen it."
  }),
  term({
    label: "lead flow",
    category: "Business and real estate terms",
    technical: "The volume and consistency of potential business opportunities entering the pipeline.",
    plain: "How many real chances are coming in.",
    does: "Shows whether the business has enough opportunity volume.",
    doesNot: "It does not mean those leads will convert.",
    rule: "Translate lead flow separately from conversion.",
    example: "You may not only need more leads; you may need better follow-up on the leads already present."
  }),
  term({
    label: "database",
    category: "Business and real estate terms",
    technical: "The organized list of contacts, clients, partners, and relationships a business can activate.",
    plain: "The people who could become business or referrals.",
    does: "Shows relationship inventory.",
    doesNot: "It does not mean those people are active relationships.",
    rule: "Translate database size into relationship quality.",
    example: "A large database only matters if people remember you when the need appears."
  }),
  term({
    label: "MET count",
    category: "Business and real estate terms",
    technical: "A count of meaningful engagement touches or meetings, depending on local business usage.",
    plain: "How many real relationship actions happened.",
    does: "Tracks activity with people, not just intention.",
    doesNot: "It is not proof of conversion by itself.",
    rule: "Translate as relationship motion.",
    example: "The count shows you are creating contact, but the next question is whether it creates commitments."
  }),
  term({
    label: "referral base",
    category: "Business and real estate terms",
    technical: "The people or partners likely to introduce new business.",
    plain: "The people who can send opportunity your way.",
    does: "Shows relationship leverage.",
    doesNot: "It is not guaranteed business.",
    rule: "Translate as a trust asset that must be activated.",
    example: "Your referral base is only an asset if you give people a clear reason and moment to refer."
  }),
  term({
    label: "conversion gap",
    category: "Business and real estate terms",
    technical: "The difference between opportunity volume and closed or committed results.",
    plain: "People are entering the funnel, but not enough are turning into outcomes.",
    does: "Identifies where business leaks.",
    doesNot: "It does not always mean lead quality is bad.",
    rule: "Translate into the missing step between interest and commitment.",
    example: "The gap may be follow-up clarity, not lead volume."
  }),
  term({
    label: "paid conversion",
    category: "Business and real estate terms",
    technical: "A conversion that produces payment, revenue, or paid access.",
    plain: "Someone actually paid.",
    does: "Creates stronger evidence than interest.",
    doesNot: "It does not prove repeatable scale by itself.",
    rule: "Translate payment as stronger proof, still bounded by sample size.",
    example: "A paid conversion proves willingness to pay once; now test whether it repeats."
  }),
  term({
    label: "channel distribution",
    category: "Business and real estate terms",
    technical: "A path for reaching customers through partners, networks, institutions, or repeatable channels.",
    plain: "A way to reach people through someone else's trusted lane.",
    does: "Creates leverage beyond one-to-one selling.",
    doesNot: "It is not validated until the channel commits or performs.",
    rule: "Translate interest as early unless there is a specific commitment.",
    example: "A lender liking the idea is early channel evidence; a committed pilot is stronger proof."
  }),
  term({
    label: "partner capital",
    category: "Business and real estate terms",
    technical: "Strategic value contributed by partners through access, trust, distribution, money, or credibility.",
    plain: "What a partner brings besides encouragement.",
    does: "Shows why a partner could accelerate the business.",
    doesNot: "It is not real until the partner commits something specific.",
    rule: "Translate partner value into concrete contribution.",
    example: "The question is not whether they like it; it is what they will put behind it."
  }),
  term({
    label: "RRG opportunity",
    category: "Business and real estate terms",
    technical: "A business opportunity related to the user's real estate growth context and relationship strategy.",
    plain: "A possible growth path in the real estate business.",
    does: "Frames a strategic opportunity for evaluation.",
    doesNot: "It does not mean the opportunity is already validated.",
    rule: "Translate as a path to test.",
    example: "This looks like an RRG opportunity if it can produce partner-backed distribution."
  }),
  term({
    label: "funded pilot",
    category: "Business and real estate terms",
    technical: "A limited test where someone commits money or resources to try the offer.",
    plain: "A real trial with commitment behind it.",
    does: "Creates stronger evidence than a conversation.",
    doesNot: "It does not prove the whole market.",
    rule: "Translate as meaningful proof, not final proof.",
    example: "A funded pilot would move this from interest to real evidence."
  }),
  term({
    label: "adoption signal",
    category: "Business and real estate terms",
    technical: "Evidence that a target user, partner, or market is beginning to use or commit to the offer.",
    plain: "Someone is actually starting to use it.",
    does: "Shows movement from interest toward behavior.",
    doesNot: "It is not validated adoption unless repeated and specific.",
    rule: "Translate the signal according to strength and repeatability.",
    example: "One person trying it is an early signal; several committed users is stronger."
  }),
  term({
    label: "revenue signal",
    category: "Business and real estate terms",
    technical: "Evidence that the offer can produce money through payment, sponsorship, or committed spend.",
    plain: "Evidence that money can move.",
    does: "Helps test business viability.",
    doesNot: "It is not a revenue trend unless repeated and tracked.",
    rule: "Translate revenue carefully by amount, source, and repeatability.",
    example: "A single paid test is useful proof, but not yet predictable revenue."
  })
];

export const moreMeaningDictionaryCategories = [
  "MORE system terms",
  "BOS behavior terms",
  "Business and real estate terms"
];
