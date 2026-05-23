# CONTEXT_SYSTEM_MEMORY.md

**Purpose:** 5-minute project recovery. Read this first.

**Last Updated:** 2026-05-23 01:43 MST

---

## What MORE MindMap Is

**MORE MindMap** is a behavioral profile generation system that:

1. Ingests structured psychological assessment (28 questions)
2. Generates multi-perspective behavioral narrative
3. Creates "canonical dossier" (comprehensive profile document)
4. Persists profile in Redis Vault
5. Renders profile as HTML/PDF/Markdown

**Not:** A personality test. **Is:** A behavioral operating system analyzer.

**Output:** Narrative explanation of how someone moves under pressure, what they avoid, what they defend, how they make decisions, what they don't see about themselves.

---

## Current Architecture (Simplified)

```
Frontend Assessment (28 questions)
    ↓
API /start endpoint (payload validation)
    ↓
Mini V2 Job Pipeline (7 stages)
    ↓
Stage: CANONICAL_GENERATION
    ├─ Generate profile_id (MM-YYYYMMDD-XXXXXXXX)
    ├─ Execute canonical engine (buildNarrativeProfile)
    ├─ Generate 12+ narrative sections
    ├─ Save to Redis Vault
    └─ Return success/failure
    ↓
Vault: Redis (Upstash provider)
    ├─ Key: vault:profile:{profile_id}
    ├─ Key: vault:markdown:{profile_id}
    └─ Indexes: date, email, company, role, industry, org_context
    ↓
Retrieval: /api/diagnostic/get-vault-profile?id={profile_id}
    ├─ GET from Redis
    ├─ Parse JSON
    ├─ Return full profile + markdown
    └─ Log diagnostics (provider, host, bytes)
    ↓
Render: HTML/PDF/Markdown templates (frozen)
```

---

## Canonical Dossier Doctrine

**Single Source of Truth:** `vault:profile:{profile_id}` is authoritative.

**Everything else is downstream:**
- PDFs are renders of canonical JSON
- HTML reports are renders of canonical JSON
- Markdown exports are renders of canonical JSON
- Frontend displays are reads of canonical JSON

**Quality happens at canonical layer, not render layer.**

Change narrative logic → regenerate profile → all renders update automatically.

---

## Current Production Status

✅ **STABLE:**
- Intake validation
- Profile generation (12+ narrative sections)
- Redis persistence (Upstash, ioredis client)
- Retrieval accuracy (verified end-to-end)
- Diagnostics logging (save-side + retrieval-side)
- Benchmark locking (first verified profile: MM-20260523-mqlev9c9)

⚠️ **EXPERIMENTAL:**
- Phase 3A narrative upgrades (selectively integrated, baseline fallback)
- Quality scoring (83/100 baseline, target 85+)
- Contradiction analysis depth
- Organizational consequence modeling

❌ **NOT READY:**
- Phase 1-2 integration (designed, not deployed)
- Behavioral state graph
- Latent variable modeling
- Predictive trajectories
- Advanced clustering
- Org topology engine

---

## Current Known Strengths

1. **Infrastructure Stability:** Crash vectors eliminated, defensive guards deployed (30+ places)
2. **Data Integrity:** Profile ID consistency verified, save/retrieval proven end-to-end
3. **Diagnostics:** Complete visibility into Redis operations (provider, host, bytes, operations log)
4. **Benchmark:** First verified profile locked with full proof chain (commit e9c8d52)
5. **Narrative Realism:** 83/100 baseline, strongest sections: Strategic Ceiling, Hidden Risks, Leadership

---

## Current Known Weaknesses

1. **Narrative Compression:** Some sections too thin (Contradiction Analysis 185→1,847 chars needed)
2. **Generic Language Leakage:** 4 sections still using "typically" / "often" patterns
3. **Operator Specificity:** Needs more domain-specific examples (behavioral mechanisms, not traits)
4. **Contradiction Depth:** Why patterns persist not fully explained in all profiles
5. **Organizational Consequence:** Missing relational cost quantification
6. **Confidence Calibration:** Some sections over-confident on limited evidence

---

## What Is VERIFIED vs EXPERIMENTAL

**VERIFIED (locked, production-safe):**
- Profile generation pipeline (7 stages)
- Redis Vault persistence (Upstash + ioredis)
- Profile retrieval accuracy
- Benchmark locking infrastructure
- Diagnostics capture and logging
- Core canonical architecture

**EXPERIMENTAL (deployed but optional):**
- Phase 3A narrative upgrades (Executive Summary, Leadership, Decision only; 3 conditions)
- Quality scoring rubric
- Selective narrative improvements

**FROZEN (do not touch):**
- Frontend UI/styling
- PDF rendering templates
- Payment flow
- MOLTmarket system
- Landing page

---

## Redis/Vault Architecture

**Provider:** Upstash (managed Redis)  
**Connection:** via ioredis module, REDIS_URL env var  
**Storage:** 256 MB (≈4,800 profiles at 50KB each)  
**Retention:** Permanent (no TTL set)

**Key Schema:**
```
vault:profile:{profile_id}           → Full profile JSON (40KB avg)
vault:markdown:{profile_id}          → Markdown export (optional)
vault:index:date:{YYYY-MM-DD}        → Set of profile IDs by date
vault:index:email:{email}            → Set of profile IDs by email
vault:index:company:{slug}           → Set of profile IDs by company
vault:index:role:{slug}              → Set of profile IDs by role
vault:index:department:{slug}        → Set of profile IDs by department
vault:index:industry:{slug}          → Set of profile IDs by industry
vault:index:org_context:{slug}       → Set of profile IDs by org context
vault:metadata:count                 → Total profile count (int)
```

**Operations:**
- SET: Profile write + verification read on same client
- SADD: Index updates (9 types)
- GET: Profile retrieval + byte verification
- EXISTS: Key presence check
- INCR: Metadata counter

---

## Benchmark Profile Location

**Path:**
```
/Users/rrg/.openclaw/workspace/moremindmap-live/benchmark_profiles/MM-20260523-mqlev9c9/
```

**Profile ID:** MM-20260523-mqlev9c9

**Status:** LOCKED (verified end-to-end)

**Files:**
- CANONICAL_PROFILE.json (43 KB)
- CANONICAL_PROFILE.md (417 B)
- FULL_RENDERED_REPORT.html (53 KB)
- RAW_JOB_DIAGNOSTICS.json (1.4 KB)
- VAULT_RETRIEVAL_PROOF.json (37 KB)
- PROFILE_SUMMARY.md (1.3 KB)
- BENCHMARK_PROFILE_LOCK.md (6.4 KB, documents proof chain)

**Quality:** 72% (baseline, for scoring reference)

**Proof Chain:**
- Save: 37,303 bytes written, verified
- Retrieval: 37,353 bytes returned, parsed successfully
- Provider match: Both sides ioredis + Upstash
- ID consistency: MM-20260523-mqlev9c9 throughout

---

## Current Active Roadmap

**IMMEDIATE (next sprint):**
1. Human testing on new profiles (10-20 samples)
2. Render layer realism audit (HTML/PDF look-and-feel)
3. Contradiction analysis expansion (deepen WHY patterns persist)
4. Narrative compression improvements (reduce generic language)
5. Operator specificity tuning (behavioral mechanisms, not traits)

**NEAR-TERM (2-3 weeks):**
1. Quality dashboard (automated scoring on all dimensions)
2. A/B comparison system (Phase 3A vs baseline)
3. Operator playbook (extract from highest-scoring profiles)
4. Phase 1 integration (contradiction depth globally)
5. Phase 2 integration (organizational consequence modeling)

**DEFERRED (not ready, explicit rationale below):**
1. Behavioral state graph (requires clean state representation first)
2. Latent variable modeling (needs more data + validation framework)
3. Org topology engine (complex graph logic, premature optimization)
4. Predictive trajectories (depends on validated latent states)
5. Advanced clustering (depends on state graph)

---

## Why Deferred Items Are Deferred

**Behavioral state graph:** 
- Requires defining what "state" means precisely
- Risk: Over-complex representation that doesn't map to behavior
- Blocker: No clean way to test accuracy without years of follow-up data

**Latent variable modeling:**
- Current system: descriptive (what IS)
- Latent modeling: predictive (what WILL BE)
- Risk: Hallucinate latent factors that don't exist
- Blocker: Need validation data, don't have it yet

**Org topology engine:**
- Would map org structures + profiles + friction points
- Risk: Build Ferrari system nobody uses
- Blocker: Need 50+ org profiles first to understand patterns

**Premature optimization trap:**
- Current system runs in 0.04-0.05s per profile
- Scaling not a bottleneck yet
- Cost: 2 weeks engineering + maintenance debt

---

## What NOT To Touch (Yet)

❌ **Frontend UI/styling** — frozen, locked in place
❌ **PDF rendering templates** — frozen, locked in place
❌ **Payment flow** — frozen, locked in place
❌ **MOLTmarket system** — separate system, do not touch
❌ **Landing page copy** — frozen, locked in place
❌ **Benchmark profiles** — immutable, reference only

---

## Immediate Next Steps (Exact Order)

1. **Human testing:** Generate profiles on 5-10 real assessments
2. **Quality grading:** Score each on 8 dimensions
3. **Identify patterns:** Which narrative sections need improvement?
4. **Prioritize fixes:** Fix contradiction depth first (highest ROI)
5. **Iterate:** Regenerate, measure, repeat

---

## Critical Production Facts

- **Profile ID format:** MM-YYYYMMDD-[a-z0-9]{8} (generated once, passed through pipeline)
- **Redis host:** detail-ultraswift-vessel-11189.db.redis.io
- **Redis client:** ioredis module
- **Generation time:** 40-50 ms per profile
- **Vault size:** 37-40 KB per profile
- **Retrieval latency:** <10 ms
- **Success rate:** 100% on valid assessments
- **Quality baseline:** 72-83% (current benchmark)
- **Target quality:** 85+%

---

## Five-Minute Recovery Checklist

If you're new to this project:

- [ ] Read this file (now)
- [ ] Read SYSTEM_ARCHITECTURE.md (understand data flow)
- [ ] Read QUALITY_MEMORY.md (understand quality doctrine)
- [ ] Look at benchmark profile: /project_memory/BENCHMARK_INDEX.md
- [ ] Check current git: `git log --oneline | head -10`
- [ ] Check production status: `curl https://moremindmap.com/api/diagnostic/list-recent-jobs?limit=1`
- [ ] Read LESSONS_LEARNED.md (understand what went wrong + how to prevent it)
- [ ] Read GIT_STATE_MEMORY.md (understand rollback points)

You now have the project in your head.

---

**Last verified:** 2026-05-23 01:43 MST  
**Benchmark profile:** MM-20260523-mqlev9c9  
**Redis host:** Upstash (production)  
**Critical status:** ✅ STABLE
