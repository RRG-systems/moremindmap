# Deployment Evidence

Status: `CONTROLLED_PREVIEW_READY_FOR_HUMAN_REVIEW`

## Current production observed during campaign

- active deployment at final production audit: `dpl_9dYhnA6f3LnChjCTbaD4QfNhQiyA`
- immutable URL: `https://moremindmap-or7i0l5s6-rrg-systems-projects.vercel.app`
- production alias: `https://moremindmap.com`
- state: READY
- reconciled source: `88e54de6c767ec7ff63b21219775c959967344b5`
- current production bundle has no Layer 2 or Layer 3 markers

Production was not changed by this continuation.

## Campaign preview

- branch: `bos-universal-retrieval-time-v1`
- original integration commit: `0099a5c2dcbcb9783808cc08eff1ba0da502b018`
- provider-bound calibration commit: `8dc73ba5cc41db31a00558b189e7726013b3f6d6`
- controlled feature-enabled preview: `dpl_3fdeFzTM1Erat1hKiTCk9iHw1DdA`
- immutable preview URL: `https://moremindmap-1ndgtfcmj-rrg-systems-projects.vercel.app`
- state: READY
- production activation: prohibited until human review approval

## Provider entitlement

- model: `gpt-5.6-sol`
- direct entitlement check: accepted
- Responses API status: `completed`
- output: `entitlement_ok`
- total tokens: 18
- secrets printed: none

The restored entitlement exposed one bounded integration defect: the valid full-profile response required about 38 seconds and the first wording used a certainty token rejected by the existing validator. The validator was not weakened. The prompt now explicitly forbids certainty tokens even when negated, the model request timeout is 60 seconds, the distributed lock is 70 seconds, and the client abort is 65 seconds.

## Controlled preview results

| Profile | Source hash | Model result | Validator | Provider latency | Durable replay |
| --- | --- | --- | --- | ---: | ---: |
| User | `fnv1a64:1cd7df225a47505c` | 17 translations | pass | 39,772 ms | cache, 17 ms |
| Darren | `fnv1a64:ebd2eea0cf347d35` | 17 translations | pass | 41,100 ms | cache, 3 ms |
| Wally | `fnv1a64:feafb96bf7381abf` | 17 translations | pass | 41,955 ms | cache, 4 ms |

For every bundle:

- model was exactly `gpt-5.6-sol`
- source semantic hash matched
- validator failures: 0
- claim IDs remained bound to supplied claims
- score, rank, classification, confidence, sufficiency, provenance, and abstention contracts remained exact
- all confidence remained `calibrated:false`
- One Move remained `Hypothesis`
- Team and Five Futures abstentions remained preserved
- translated view model completed with 8 tabs and 5 Overview sections
- executive summary and One Move were populated
- stored Visual DNA URL and protected score topology remained unchanged

## Persistence and failback

- durable translation and lock/rate keys are contractually restricted to `bos:l3:`
- `vault:profile:*` is not used by the cache adapter
- repeated server-route requests returned `source: cache`
- exact canonical dossier SHA-256 was unchanged before and after translation for all three profiles
- stored Visual DNA was unchanged before and after translation
- only retrieval-time extraction timestamp/duration metadata varied, as expected
- exact Layer 2 object identity was preserved when no approved validated bundle was supplied
- customer/Vault writes: none
- canonical regeneration: none
- customer profile changes: none

## Human review artifact

Private, non-repository packet:

`/Users/rrg/Desktop/MORE_BOS_LAYER3_HUMAN_REVIEW_V1/HUMAN_REVIEW_PACKET.md`

Production deployment remains gated on explicit human ratings and approval.
