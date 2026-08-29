# Live frontier evidence

## Representative strongest-condition transcript

### YOU — first move

**Human**

> What should I understand about this person that might not be obvious at first?

**MORE**

> **Insight:** Jordan’s caution may look like resistance, but it is more likely a demand for a clear, worthwhile tradeoff.
>
> **Explanation:** Jordan appears willing to move quickly on a bounded, reversible step. The hesitation comes when a hire or system adds complexity before the real constraint is visible—especially if it could weaken the client experience.
>
> **Question:** What small, reversible test would let Jordan protect client trust while learning whether help would truly create capacity?

Visual: no. Coach latency: 3,186 ms.

### Human correction

**Human**

> That does not quite fit. Jordan is willing to move quickly when the client experience is protected.

**MORE**

> **Insight:** Then Jordan’s real filter may be protected trust, not slower speed.
>
> **Explanation:** Your correction changes the picture: Jordan can act quickly when it is clear who will preserve the client relationship and how quality will be checked.
>
> **Question:** What would Jordan need to see to trust someone else with part of the client experience?

Visual: no. Coach latency: 2,602 ms. This is a genuine semantic update, not a restatement of the prior hypothesis.

### YOUR BUSINESS

**MORE**

> **Insight:** The biggest opportunity may be turning Jordan’s existing relationship strength into a visible, repeatable pipeline; what may be holding Jordan back is that client service and coordination keep pushing opportunity work aside.
>
> **Explanation:** Jordan already has referrals and can convert business, so this does not look like a simple talent or lead problem. But production has declined, the pipeline is unclear, and one observed week showed substantial coordination work plus a missed follow-up block. The next step is to learn whether better operating discipline is enough or whether carefully bounded support would release real growth capacity.
>
> **Question:** If Jordan recovered ten hours a week, what specific client or opportunity work would fill those hours—and what result should that create?

Visual: no. Coach latency: 3,631 ms.

## Context sizes

| Room | Governed world | Purpose-ranked context | Total prompt | Authorities selected |
|---|---:|---:|---:|---|
| YOU, Condition 2 unranked | 15,160 chars | 0 | 16,196–17,192 | none |
| YOU, Condition 3 ranked | 2,202 chars | 29,356–29,958 | 34,078–35,582 | BOS + UK-01/02/16; no BA, no RE |
| YOU, Condition 4 ranked+demos | 2,202 chars | 29,356–29,958 | 36,047–37,551 | same plus 3 demos |
| BUSINESS, Condition 3 ranked | 15,160 chars | 76,067 | 94,430 | BOS + BA + doctrine + RE-05/RE-08 |
| BUSINESS, Condition 4 ranked+demos | 15,160 chars | 76,067 | 96,366 | same plus 3 demos |

Ranking is not merely compression: it removes prohibited room context and selects the relevant authority slices. The complete corpus remains server-side.

## Validation and privacy

- 12 primary ablation frontier turns completed on the first provider attempt.
- Coach repair rate in the primary ablation: 0/9 coach moves.
- Control plan repair rate: 0/3 plans.
- Optional compiler probe: 1 repair across 2 attempts; then valid publication.
- No raw provider request or response persisted.
- No protected first-party answer persisted in the sanitized receipt.
- Coach validator rejects verbatim protected-answer exposure, invented numbers, model mechanics, incomplete questions, and incomplete insight/explanation sentences.
- Client bundle scan found zero Patricia profile IDs, protected synthetic answer phrases, or internal privacy markers.

## Browser observations

- Full authored 15-surface BOS remained clickable behind the conversation rail.
- Full authored Business Twin remained clickable behind the conversation rail.
- Progressive status appeared before completion: “Understanding what matters most now…”
- Browser-completed business coaching chose conversation alone and left the Business Twin visible.
- Switching back after a failed Patricia read initially left a stale error; the UI was repaired so a successful subject/room transition clears the old error.
