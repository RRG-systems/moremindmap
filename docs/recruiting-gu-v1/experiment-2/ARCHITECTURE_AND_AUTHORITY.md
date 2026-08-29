# Architecture and authority

## Checkpoint custody

- Worktree: `/Users/rrg/.openclaw/workspace/moremindmap-sidebar-future-lab-v1`
- Active branch: `codex/recruiting-gu-v1-build`
- Promotion-capable pre-Experiment-1 checkpoint: `af1c1f3e50fc9a34f30a4c29ed5900438e049ba0`
- Checkpoint tree: `e3ceb7d78d44d61d30ff3788aa7718f5adeee756`
- Experiment 1 historical custody: local branch `codex/recruiting-gu-v1-free-frontier-evidence`, commit `a163867`

## Implemented flow

1. A human turn is appended to the existing revision-bound Shared Business Session.
2. Conditions 2–4 call the new lightweight coach stage. It returns only:
   - one insight;
   - one explanation;
   - one self-discovery question;
   - visual yes/no;
   - a semantic visual idea when yes.
3. The coach move is validated for completeness, grounded numbers, protected-answer leakage, and model-mechanics exposure, then stored as a separate session event and conversation turn.
4. The coaching response becomes usable immediately.
5. Only when the coach returns visual=yes does the client request `COMPILE_GU`.
6. The existing Creation Language planner and strict validator compile the already-decided meaning with a purpose-ranked governed world. A stale revision, stale coach move, invalid reference, incompatible block, or validator failure refuses publication; the coaching response remains intact.

Condition 1 remains the clean current one-call control. It does not pass through the new coach stage.

## Fixed frontier configuration

- Gateway/provider: OpenAI Responses API / OpenAI
- Model requested and returned: `gpt-5.6-sol`
- Reasoning effort: `low`
- Strict JSON Schema: on
- Provider fallback: none
- `store`: false
- Background mode: false
- Output ceiling: 4,200 tokens
- Timeout: 120 seconds

The same configuration was held constant across all four synthetic conditions.

## Context ranking

### YOU

- Complete governed BOS semantic authority.
- Four governed synthetic BOS first-party answers in the known-control fixture.
- Relevant DJ doctrine/lenses.
- Room-scoped current session context.
- BA artifact: absent.
- BA first-party answers: absent.
- Real Estate Bible excerpts: absent.
- Compiler world: person/evidence dependencies only.

### YOUR BUSINESS

- Governed BOS and complete Business Twin semantics.
- Governed synthetic BOS answers.
- No separate raw synthetic BA answer fixture exists at the clean checkpoint; this is reported as a gap, not filled with invented answers.
- Relevant DJ doctrine/lenses.
- Two purpose-selected, SHA-256-verified Real Estate authorities for the fixed business question: `RE-05` and `RE-08`.
- Room-scoped current session/evidence.
- Compiler world: at most six purpose-relevant objects plus their governed dependencies.

The full 16-Bible corpus stays server-side. It is verified before retrieval and never sent wholesale by Experiment 2.

## DJ demonstrations

Three examples are supplied only in Condition 4:

- strong reasonable inference → simple explanation → one useful question;
- human correction → curiosity → genuine update;
- an evidenced time comparison where a visual helps while cause remains unresolved.

They are examples, not rules, scripts, dialogue trees, or required sequences.

## Patricia authority

The profile binding exists only in the server-side demo runtime. The browser tab list omits the profile ID. The local subject uses an in-memory Shared Business Session and has no canonical write authority.

The exact intended reader is the existing `readCurrentAuthoredSurfaces` path plus the existing canonical BOS/BA authority readers. That path requires Redis. The available Production environment metadata exposes a blank Redis credential, so Patricia fails with `RECRUITING_GU_V1_PATRICIA_READ_ONLY_REDIS_REQUIRED` before any session or provider call.

Read-only external diagnostics established:

- BOS: customer-active, compatibility A, current, healthy, 15 surfaces.
- BA: customer-active, compatibility A, completeness PASS, compatible prior available.

The public BA artifact GET path was not used because its route also calls Recruiting reconciliation after serving a canonical artifact. That would exceed this campaign's no-external-mutation authority.

## Preserved boundaries

- Frozen HOME → YOU → YOUR BUSINESS → PLAN.
- Full authored BOS and BA renderers remain primary and independently usable.
- One durable Shared Business Session, CAS, revision binding, and stale refusal.
- Existing evidence/provenance validator and safe interactions.
- Canonical and external mutation flags remain false.
- Recruiting V1 source files were not modified.
- No authored Recruiting V2 product route was modified.
- No web search or runtime tools.
