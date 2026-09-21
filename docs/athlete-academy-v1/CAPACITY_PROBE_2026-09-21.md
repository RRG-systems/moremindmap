# Academy capacity probe — 2026-09-21

## Purpose and boundary

This is a local synthetic scenario measurement for starter-plan operations. It is not a validated 10,000-participant benchmark or a capacity guarantee. It made no Production, provider, customer, mail, or payment connection.

The disposable probe script was `/private/tmp/academy_capacity_probe.mjs` with SHA-256 `a2dfe01a225c36c9b9c92f5f144630dabc531d8072d38e0783a2db25693b5b11`. It used the existing local Redis test server and an isolated namespace, `more:athlete-academy:{test-capacity-6f4d100d-6d97-404a-a485-a628afad7929}`. All keys in that exact namespace were deleted by the probe after measurement.

## Fixture and retention assumptions

- one fictional adult participant;
- one fictional 17-year-old participant plus one separate fictional guardian account and accepted guardian authorization;
- each participant completed one BOS and one APA using the existing Sofia structural replay fixture;
- each participant saved one BOS feedback entry;
- each participant started coaching and completed ten synthetic coaching message turns;
- no repeated assessment attempt, provider retry, uncertain outcome, repair job, password-recovery sequence, or long-running consultation history;
- the synthetic coach returned no plan, so this probe does not measure an accepted-plan payload;
- the current candidate retains assessment jobs, idempotent operation results, and immutable provider evidence without a destructive retention job.

Subsequent consultation growth was not separately measured and remains unknown.

## Exact measured result

- Redis keys: `215`
- total Redis `MEMORY USAGE`: `9,779,504` bytes
- two completed participants plus one guardian account: approximately `4.9 MB` per completed-participant scenario when shared/unattributed operation and evidence keys are allocated evenly;
- directly person-addressable keys measured `3,217,856` bytes for the adult, `3,219,712` bytes for the youth, and `3,024` bytes for the guardian account; request-ID-keyed operations and evidence account for the difference and cannot be safely assigned by key name alone.

### Key-class totals

| Class | Bytes | Classification |
|---|---:|---|
| `account` | 2,400 | canonical account |
| `dossier` | 30,336 | canonical participant dossier and intake |
| `feedback` | 768 | canonical BOS feedback |
| `coach` | 12,544 | current coaching state and messages; no accepted plan in this probe |
| `report` | 754,432 | immutable canonical BOS/APA reports |
| `guardian` | 208 | guardian relationship |
| `job` | 885,376 | durable assessment workflow, source inputs, and stage records |
| `operation` | 3,085,024 | durable idempotency/response snapshots |
| `evidence` | 2,446,848 | immutable assessment-provider evidence |
| `coach-evidence` | 2,554,112 | immutable coaching-provider evidence for ten turns per participant |
| auth, mail, rate, session, token, and queues | 7,456 | supporting runtime state |

The largest measured values were approximately `196–328 KB`. Redis Flex documentation recommends avoiding large values over about `10 KB`; therefore this probe identifies a performance and long-term storage-design question, not only a byte-capacity question.

## Starter-plan operating envelope

The verified direct starter configuration is Redis Cloud Essentials Flex at `$6/month`: `1 GB` total, `512 MB` dataset, `512 MB` replica, `200 ops/sec`, `50 GB/month` network, and `1,024` connections. The `$8/month` RAM-only option has only `125 MB` dataset plus `125 MB` replica, so it is not the preferred starter.

For the initial controlled stage:

- keep the first cohort at or below 25 active participants;
- review actual dataset growth after the first 10 completed participants;
- alert when total dataset size reaches 40% of the plan limit;
- schedule an upgrade by 60%, or earlier when projected 30-day growth would cross 70%;
- also review at 100 ops/sec, 25 GB monthly network, 500 concurrent connections, persistent latency over 10 ms, or any eviction;
- do not extrapolate unmeasured consultation growth from this two-participant probe.

The December 10,000-student target requires a separate architecture and retention decision for large immutable artifacts/evidence. That design is not part of this bounded release and does not require purchasing December capacity on launch day.

