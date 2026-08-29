# Controlled ablation results

## Fixed inputs

All four synthetic conditions used the same world, model, provider, reasoning effort, and three turns:

1. YOU: “What should I understand about this person that might not be obvious at first?”
2. Correction: “That does not quite fit. Jordan is willing to move quickly when the client experience is protected.”
3. YOUR BUSINESS: “What looks like the biggest opportunity in this business right now—and what might be keeping this person from getting where they want to go?”

## Comparison

| Condition | First-turn latency | Correction | YOU leakage | GU behavior | Finding |
|---|---:|---|---|---|---|
| 1. Clean control | 16,094 ms | Updated, but inside another full surface plan | The one-call world can draw business observations into YOU | Generated 2–3 blocks every turn | Capable, but slow and composition-first |
| 2. Split only | 4,975 ms | Genuine update in 3,028 ms | Yes: the unranked full world still influenced YOU | Conversation for YOU; business visual requested | Splitting causes the major latency and coaching improvement, but does not solve room scope |
| 3. Split + ranked | 2,789 ms | Genuine update in 2,867 ms | No: 2,202-character BOS-only world; no BA/domain context | Conversation chosen on all fixed turns | Ranking removes leakage and keeps coaching focused |
| 4. Split + ranked + demos | 3,186 ms | Clearest update in 2,602 ms | No | Conversation chosen on all fixed turns | Demos improve the correction's simplicity; effect is smaller than the split itself |

Business-turn coach latency was 4,241 ms (Condition 2), 3,500 ms (Condition 3), and 3,631 ms (Condition 4). The control business environment took 17,359 ms.

## Primary Founder question

**What is the first thing MORE helped the human understand that they might not have seen before?**

In the strongest condition:

> Jordan’s caution may look like resistance, but it is more likely a demand for a clear, worthwhile tradeoff.

The useful shift is from “Jordan is slow/resistant” to “Jordan can move quickly when the choice protects trust and makes the tradeoff testable.” The correction then improved the understanding instead of defending the first hypothesis.

## What caused the improvement

1. **The split is the dominant causal change.** It removed simultaneous multi-block composition from the visible coaching task and reduced latency by roughly 70–82% on comparable turns.
2. **Purpose-ranked room scope solves a real correctness problem.** Condition 2 still used business observations in YOU. Conditions 3 and 4 could not because BA and Real Estate context were not supplied.
3. **Demonstrations add polish, not the primary breakthrough.** Condition 4 produced the simplest correction (“protected trust, not slower speed”), but Condition 3 already updated correctly.

## GU findings

- The coach chose no visual for all six ranked-context turns across Conditions 3 and 4. That is a success: GU became optional expression rather than mandatory proof theater.
- The clean control demonstrated visual diversity: PERSON, HYPOTHESIS, QUESTION, TIMELINE, LINE_CHART, and EVIDENCE_GAP.
- A separate split-only compiler probe requested a business visual. The first candidate failed `BLOCK_KIND_INCOMPATIBLE`, repaired on attempt 2, and published TIMELINE, PLAIN_LANGUAGE, EVIDENCE_GAP, and QUESTION blocks in 30,929 ms. The coach remained usable throughout.
- A second probe exposed an incomplete insight at the schema length boundary. The coach validator now refuses insight/explanation strings that are not complete sentences and repairs them before publication.

## Blunt interpretation

The thesis survives synthetic contact with software. “Coach first, GU second” is materially faster, more human, and more selective than forcing coaching and structured composition to emerge in one call. Purpose ranking is necessary for privacy and relevance. DJ demonstrations help, but do not justify a larger rule stack.

The experiment cannot support a two-subject Founder verdict until Patricia's read-only binding is available and the same fixed campaign runs against her governed reality.
