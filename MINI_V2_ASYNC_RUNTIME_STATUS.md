# MINI V2 ASYNC RUNTIME STATUS

**Last Updated:** Tue May 19, 2026 12:06 MST  
**Current HEAD:** `f0ee4af`  
**Status:** ✅ ASYNC ARCHITECTURE OPERATIONAL, ⚠️ PIPELINE STATE MACHINE BUG BLOCKING COMPLETION

---

## ASYNC ARCHITECTURE STATUS: OPERATIONAL ✅

### Problem Solved

**Original issue:** Browser timeout after 60-180 seconds waiting for synchronous report generation

**Solution:** Redis-backed async job polling with staged execution

**Result:**
- Job creation: <1 second ✅
- Browser never waits on OpenAI calls ✅
- Poll-driven advancement every 3 seconds ✅
- No serverless function timeouts ✅
- Proper error visibility ✅

---

## OPERATIONAL COMPONENTS

### Redis Storage ✅
**Client:** ioredis  
**Environment variable:** REDIS_URL (Vercel/Upstash integration)  
**Test endpoint:** `/api/test-redis` returns HTTP 200  
**Verification:** All CRUD operations (set/get/delete) proven working  
**Job TTL:** 24 hours

### Start Endpoint ✅
**Path:** `POST /api/moremindmap/start`  
**Behavior:**
- Validates answers
- Formats answers for backend compatibility
- Creates job in Redis with status `queued`, stage `received`
- Returns job_id instantly
- Does NOT start background execution (poll-driven model)

**Test result:** Returns job_id in <1 second consistently

### Status Endpoint ✅
**Path:** `GET /api/moremindmap/status?job_id=...`  
**Behavior:**
- Checks if job complete/failed → return final result
- Checks if locked by another poll → return current state
- Locks job
- Executes next stage (bounded work, <180s)
- Unlocks job
- Returns updated state

**Lock protection:**
- Prevents duplicate execution
- Stale lock timeout: 5 minutes
- Auto-unlock after completion/error

### Staged Execution Pipeline ✅ (Architecture)
**File:** `api/engine/miniV2StagedExecutor.js`

**Stages:**
1. `received` → `first_pass_generation` (buildProfileInput + OpenAI call)
2. `first_pass_generation` → `first_injection` (template injection + placeholder scan)
3. `first_injection` → `repair_pass` (generate missing content) OR `complete` (if no placeholders)
4. `repair_pass` → `final_injection` (merge repairs + re-inject)
5. `final_injection` → `complete` (if 0 placeholders) OR `failed` (if placeholders remain)

**Proven working:**
- Stage 1 (first_pass_generation): ✅ Completes successfully
- Stages 2-4: ⚠️ Blocked by state machine bug

---

## CURRENT BLOCKER: STATE MACHINE BUG ⚠️

### Error

**Message:** `executeRepairPass: missingFields is null, expected array`

**Location:** When status poll tries to execute `repair_pass` stage

**Symptom:**
- Poll 1: Job advances from `received` → `first_pass_generation` → `first_injection`
- Poll 2: Job tries to execute `repair_pass`, reads `missingFields: null`, fails

---

### Root Cause Analysis

**Evidence collected:**

1. **OpenAI generation succeeds:**
   - reportContent has 12 keys, 10 pages
   - No schema validation errors
   - Content structure is valid

2. **first_injection stage behavior unclear:**
   - Job transitions to `repair_pass` stage
   - But `missingFields` remains null (from initial job creation)
   - Diagnostic code (`write_trace`) never runs (returns null)
   - This proves first_injection **does not complete successfully**

3. **State machine inconsistency:**
   - If first_injection throws error, stage should be `failed`
   - Instead, stage becomes `repair_pass`
   - This suggests error in `executeNextStage` transition logic

**Hypothesis:**
first_injection throws an exception early (before storing missingFields), but the catch handler in executeNextStage incorrectly allows stage to advance to repair_pass, or there's a race condition in the lock/unlock/reload cycle.

---

### Attempted Fixes (15+)

1. Schema parsing fix (buildProfileInput format) - Fixed different error
2. Answer formatting in start endpoint - Fixed different error
3. Null checks in flattenReportContent - Not reached
4. Null checks in snapshot generation - Not reached
5. Extract placeholders from HTML fallback - Not reached
6. Force missingFields to array - Not reached
7. Defensive checks in repair_pass - Catches error but doesn't prevent it
8. State machine trace logging - Latest attempt, needs testing

**None resolved the core issue:** first_injection fails and stage still advances.

---

## COMPARISON TEST: SYNC VS ASYNC

**Test payload:** `/tmp/test_answers_fixed.json` (24 realistic answers)

| Endpoint | Result | Time | Details |
|----------|--------|------|---------|
| **Sync** (`/api/moremindmap/mini-profile-v2`) | ⏱️ Timeout | 180s | Vercel kills function, HTTP 504 |
| **Async** (`/start` + `/status`) | ❌ Error | ~15s | Fails fast with specific error message |

**Conclusion:** Async prevents timeout and provides better error visibility. Both paths have pipeline issues, but async fails faster and cleaner.

---

## KEY COMMITS

### Async Architecture Implementation
- `1067ba8` - fix mini v2 async polling staged execution (CORE ARCHITECTURE)
- `8cefc77` - switch mini v2 redis client to ioredis (REDIS INTEGRATION)
- `31591da` - fix mini v2 async endpoint runtime errors - use lazy imports (MODULE RESOLUTION)

### Schema/Format Fixes
- `4579fb6` - fix mini v2 staged generation schema parsing
- `b4f764c` - fix mini v2 start endpoint answer formatting

### Vercel Infrastructure
- Pro plan upgrade (unlocked function discovery after 12-function Hobby limit)
- `39f2d6b` - expand vercel functions config to include all api routes

### Diagnostics
- `650496e` - add updateJob array handling test (proven: updateJob preserves arrays correctly)
- `f0ee4af` - add comprehensive state machine trace (latest)

---

## PRODUCTION ENDPOINTS

**Live:**
- `POST /api/moremindmap/start` - Job creation ✅
- `GET /api/moremindmap/status?job_id=...` - Job polling ✅
- `GET /api/moremindmap/inspect-job?job_id=...` - Diagnostics ✅
- `GET /api/test-redis` - Redis connectivity test ✅
- `GET /api/test-update-job` - Update mechanism test ✅

**Legacy:**
- `POST /api/moremindmap/mini-profile-v2` - Synchronous (times out at 180s)

---

## ENVIRONMENT

**Vercel:**
- Plan: Pro (upgraded from Hobby)
- Serverless functions: Unlimited
- Max duration: 180 seconds per function
- Region: iad1 (Washington DC)

**Redis:**
- Provider: Upstash (via Vercel integration)
- Environment variable: `REDIS_URL`
- Client: ioredis
- Connection: Verified operational

**OpenAI:**
- Model: gpt-4.1
- API key: Configured
- Max tokens: 16,000

---

## NEXT REQUIRED TASK

### Debug State Machine Transition Bug

**Exact issue to solve:**
Why does `first_injection` stage advance to `repair_pass` despite throwing an error?

**Required approach:**
1. Review state trace from latest test job (commit `f0ee4af`)
2. Identify exact sequence of stage transitions
3. Compare intended flow vs actual job state changes
4. Find where stage advances without valid missingFields
5. Fix transition logic to prevent advancement on error

**DO NOT:**
- Add more defensive null checks
- Guess at data shapes
- Patch symptoms

**DO:**
- Use trace data to identify exact bad transition
- Fix state machine logic
- Verify stage only advances after successful completion
- Test with trace proving: ENTER → execute → BEFORE_UPDATE → AFTER_UPDATE → EXIT

---

## SUCCESS CONDITION

**Frontend test produces:**
- Rendered 10-page Mini V2 HTML report
- Placeholder count: 0
- HTML stored in `result_html` field
- Job status: `complete`
- No browser timeout
- Total time: 3-6 minutes

---

## FILES CHANGED (Session Summary)

**Backend (Core):**
- `api/engine/redisClient.js` - NEW (2.9KB)
- `api/engine/miniV2JobManager.js` - NEW (5.1KB)
- `api/engine/miniV2StagedExecutor.js` - NEW (10.1KB)
- `api/moremindmap/start.js` - NEW (2.4KB)
- `api/moremindmap/status.js` - NEW (2.9KB)

**Backend (Diagnostics):**
- `api/test-redis.js` - NEW
- `api/test-update-job.js` - NEW
- `api/moremindmap/inspect-job.js` - NEW
- `api/moremindmap/ping.js` - NEW
- Multiple test endpoints (can be cleaned up)

**Frontend:**
- `src/Profile.jsx` - Async polling for FATHOMFREE users

**Config:**
- `vercel.json` - Function configuration
- `package.json` - Dependencies (ioredis, uuid)

**Docs:**
- `MINI_V2_ASYNC_RUNTIME_STATUS.md` - This file

---

## COMMIT STATS

**Total commits:** 30+  
**Lines added:** ~800  
**Lines removed:** ~200  
**Files created:** 10+

**Key milestone:** `1067ba8` - Poll-driven staged execution

---

## CONFIRMATION

- ✅ No questions touched
- ✅ No visuals touched (except polling UI message)
- ✅ No prompts touched
- ✅ No report templates touched
- ✅ No placeholder mapping touched
- ✅ No Stripe touched
- ✅ No MOLTmarket touched

---

**ASYNC TIMEOUT ARCHITECTURE: COMPLETE AND OPERATIONAL ✅**

**Next:** Debug state machine transition to unblock end-to-end testing.
