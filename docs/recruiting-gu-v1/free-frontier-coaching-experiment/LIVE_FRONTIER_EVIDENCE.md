# Live frontier evidence

## Exact runtime

| Field | Value |
|---|---|
| Gateway | OpenRouter |
| Requested model | `openai/gpt-5.6-luna` |
| Returned provider | OpenAI |
| Reasoning effort | `low` |
| Structured output | strict JSON schema |
| Output limit | 4,200 tokens |
| Provider fallbacks | disabled |
| Provider persistence | `store: false` |
| Timeout | 75 seconds |
| Web search | absent |

This was the strongest practically available model in the existing latency-bounded experimental configuration. It was a real provider run, not the deterministic test transport.

## Sealed four-turn run

| Turn | Total | Provider / attempts | Context proof | Accepted composition | Human-understanding result |
|---|---:|---|---|---|---|
| YOU initial | 12,245 ms | 5,257 ms on accepted repair / 2 | BOS available; BA not requested | PERSON, HYPOTHESIS, PLAIN_LANGUAGE | One bounded hypothesis and one short question |
| YOU correction | 7,256 ms | first attempt | BOS-only; human correction present | compact revised environment | Superseded the prior hypothesis instead of defending it |
| YOUR BUSINESS initial | 7,389 ms | first attempt | BOS + BA answers available; full RE cassette | PERSON, CONSTRAINT, METRIC_STRIP, DECISION | Connected person, constraint, business numbers, and next decision |
| First-party materiality | 11,259 ms | first attempt | BOS + BA protected answers available | RELATIONSHIP, COMPARISON, EVIDENCE_GAP | Abstracted why help may feel risky without revealing the protected source statement |

- Sealed run range: **7.256–12.245 seconds**.
- Mean: **9.537 seconds**.
- Median: **9.324 seconds**.
- Three plans validated on the first attempt; one repaired safely on the second attempt.
- Raw provider request/response persisted: **false**.
- Protected raw answer exposed: **false**.

The accepted materiality environment used the private answer to shift the coaching frame toward ownership/trust, while public evidence and missingness controlled every rendered claim. It explicitly preserved that the inference was not a fixed trait and that business economics remained unresolved.

## Browser-visible acceptance

Using `http://127.0.0.1:5197/recruiting-gu-v1/demo` in the in-app browser:

1. Cold HOME opened with synthetic-only and admin/unlimited boundaries.
2. YOU displayed the complete authored BOS and the exact new questions.
3. A real frontier turn immediately displayed the progressive state before projection.
4. The YOU projection stayed person/BOS-scoped.
5. A direct correction changed the headline and hypothesis from reversibility to client-quality ownership while preserving conversation.
6. YOUR BUSINESS displayed the complete authored BA/Business Twin beside the same conversation.
7. A real fused frontier turn selected a production trend, service-load comparison, opportunity flow, and revisable hypotheses.
8. A follow-up about why help may feel risky selected constraint, comparison, missing-evidence, and hypothesis primitives without exposing the protected synthetic source phrase.
9. The browser-local synthetic session was reset through the synthetic-only API and the cold HOME baseline was re-verified.

## Useful fail-closed evidence

Exploratory runs were not erased from the assessment:

- Invented internal evidence IDs were rejected; the repair reused only governed public IDs.
- Incompatible block/object pairs were rejected.
- More than four blocks were rejected after the progressive-understanding cap was added.
- Validator/schema commentary in human-facing copy was rejected after the mechanics-language guard was added.
- A changed state-binding field was rejected; JSON property ordering alone is now correctly accepted.
- One browser BUSINESS plan failed closed under the strict schema; a subsequent fresh synthetic session produced a valid fused environment without weakening validation.
- A stale-session retry was refused after the failed browser request changed custody, proving CAS/state binding remained active.

An exploratory provider outlier reached roughly **41 seconds**. The sealed accepted range is materially better, but latency variance and occasional repair/fail-closed turns remain real product concerns.

