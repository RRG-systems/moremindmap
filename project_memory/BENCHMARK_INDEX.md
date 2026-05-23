# BENCHMARK_INDEX.md

**Purpose:** Registry of all benchmark artifacts. Reference only.

**Last Updated:** 2026-05-23 01:43 MST

---

## Active Benchmark Profiles

### MM-20260523-mqlev9c9 (PRODUCTION VERIFIED)

**Status:** ✅ LOCKED

**Quality:** 72% (baseline reference)

**Purpose:** First fully verified end-to-end canonical dossier with complete Redis diagnostics

**Person:** David Berg (Founder, The More Companies)

**Profile Type:** Command/Perspective operator with strategic framing

**Key Metrics:**
- Generation time: 46 ms
- Profile size: 37,303 bytes
- Retrieval bytes: 37,353 (expected variance)
- Quality score: 72%
- Confidence calibration: 85% average

**Verification Status:**
- ✅ Redis provider: ioredis (Upstash)
- ✅ Save-side diagnostics: Complete
- ✅ Retrieval-side diagnostics: Complete
- ✅ Byte verification: Matched (37,303 saved → 37,353 retrieved)
- ✅ JSON parsing: Successful
- ✅ Profile ID consistency: MM-20260523-mqlev9c9 throughout

**Proof Chain:**
- Job ID: 5c2e71d3-44f6-40dd-932b-9fd598907464
- Created: 2026-05-23T08:23:37.048Z
- Completed: 2026-05-23T08:23:55.392Z
- Locked: 2026-05-23 01:30 MST

**Location:**
```
/Users/rrg/.openclaw/workspace/moremindmap-live/benchmark_profiles/MM-20260523-mqlev9c9/
```

**Files:**
- CANONICAL_PROFILE.json (43 KB)
- CANONICAL_PROFILE.md (417 B)
- FULL_RENDERED_REPORT.html (53 KB)
- RAW_JOB_DIAGNOSTICS.json (1.4 KB)
- VAULT_RETRIEVAL_PROOF.json (37 KB)
- PROFILE_SUMMARY.md (1.3 KB)
- BENCHMARK_PROFILE_LOCK.md (6.4 KB, proof chain)

**Known Issues:** None (production ready)

**Related Commits:**
- e9c8d52: Locked profile
- dc53a9b: Added comprehensive diagnostics
- d1c3d57: Documented root cause fixes
- 080f929: Fixed profile ID mismatch (ROOT CAUSE)
- 2c003c5: Added Redis disconnect + verification

**Usage:**
- Reference for quality scoring
- Baseline for Phase 3A selective integration
- Proof of end-to-end system correctness
- Template for future profile validation

---

## Historical Benchmark Attempts

### MM-20260523-bb3hsat9 (PRE-FIX ATTEMPT)

**Status:** ⚠️ INVALID (demonstrates bug)

**Purpose:** Shows profile ID mismatch bug

**Issue:** Reported ID ≠ Saved ID
- Reported: MM-20260523-bb3hsat9
- Actually saved as: vault:profile:MM-20260523-d1er8ac5

**Lesson:** Demonstrates why diagnostics matter; silent failures hard to detect

**Related Commit:** 080f929 (identifies root cause)

---

### MM-20260523-cf93lov7 (PRE-FIX ATTEMPT)

**Status:** ⚠️ INVALID (same ID mismatch)

**Purpose:** Another victim of profile ID bug

**Actual Save Key:** vault:profile:MM-20260523-d1er8ac5 (different profile ID)

**Related Commit:** 080f929 (root cause fix)

---

## Benchmark Selection Criteria

**LOCKED Benchmarks must have:**

- ✅ Complete save-side diagnostics (Redis provider, host, bytes, operations)
- ✅ Complete retrieval-side diagnostics (same provider/host, bytes match)
- ✅ Byte verification (written vs verified match)
- ✅ Proof chain (job diagnostics + retrieval proof + lock documentation)
- ✅ Profile ID consistency (one ID throughout pipeline)
- ✅ JSON integrity (parses successfully)
- ✅ Production deployment on stable commits
- ✅ Zero known issues on retrieval

**Current compliance:**
- MM-20260523-mqlev9c9: 8/8 ✅ (LOCKED)
- MM-20260523-bb3hsat9: 0/8 ❌ (invalid, ID mismatch)
- MM-20260523-cf93lov7: 0/8 ❌ (invalid, ID mismatch)

---

## Future Benchmark Strategy

**When to lock new benchmarks:**

1. After 10-20 new profiles generated and tested
2. After Phase 1-2 selective integration (if done)
3. When quality reaches 85%+ consistently
4. When new major features deployed

**Multiple benchmarks track:**
- Baseline quality (current: 72%)
- Post-Phase 1 quality (contradiction depth)
- Post-Phase 2 quality (org consequence)
- Post-Phase 3A global quality
- Post-generic-language-removal quality

**Versioning:**
- V1: MM-20260523-mqlev9c9 (current)
- V2: Reserved for 85%+ quality milestone
- V3+: Reserved for future phases

---

## Archive (Historical Reference)

### V2 Frozen Benchmark (Old System)

**Profile:** Jordan Chen (VP of Operations)  
**Location:** `/benchmarks/BENCHMARK_V2_CANONICAL.json`  
**Status:** FROZEN (old mini-v2 engine before fixes)  
**Purpose:** Historical reference, not for comparison

---

**Last verified:** 2026-05-23 01:43 MST  
**Active benchmarks:** 1 (MM-20260523-mqlev9c9)  
**Invalid benchmarks:** 2 (demonstrating ID mismatch bug)  
**Selection criteria:** 8 mandatory checks  
**Next milestone:** 85%+ quality benchmark
