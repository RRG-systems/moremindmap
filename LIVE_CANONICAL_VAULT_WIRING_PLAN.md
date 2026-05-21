# LIVE CANONICAL VAULT WIRING PLAN

**Created:** Thu May 21, 2026 15:53 MST  
**Purpose:** Wire canonical dossier generation + Vault storage into live MORE MindMap pipeline

---

## CURRENT LIVE FLOW

### Entry Points
1. **POST /api/moremindmap/start** (`api/moremindmap/start.js`)
   - Receives answers
   - Calls `createJob({ answers, metadata })`
   - Returns `{ job_id, status: 'queued' }`

2. **GET /api/moremindmap/status?job_id=X** (`api/moremindmap/status.js`)
   - Gets job from Redis
   - If not complete: locks job → calls `executeNextStage(job)` → unlocks
   - Returns job status + result

### Staged Execution Pipeline

**Location:** `api/engine/miniV2StagedExecutor.js`

**Stages (in order):**
1. `RECEIVED` → (queued, waiting for first poll)
2. `FIRST_PASS_GENERATION` → calls buildProfileInput + generateReportContent
3. `FIRST_INJECTION` → injects content into templates, scans for placeholders
4. `REPAIR_PASS` → (if placeholders exist) generates missing content
5. `FINAL_INJECTION` → final template injection
6. `COMPLETE` → done, returns HTML

**Key Functions:**
- `executeFirstPassGeneration(job)` — Stage 1
  - Calls `buildProfileInput({ answers })`
  - Calls `generateReportContent(profileInput)`
  - Stores `profileInput` + `reportContent` in job
  - Transitions to `FIRST_INJECTION`

- `executeFirstInjection(job)` — Stage 2
  - Injects content into templates
  - Scans for missing placeholders
  - Transitions to `REPAIR_PASS` or `COMPLETE`

- `executeRepairPass(job)` — Stage 3 (conditional)
  - Generates missing content
  - Transitions to `FINAL_INJECTION`

- `executeFinalInjection(job)` — Stage 4
  - Final injection
  - Transitions to `COMPLETE`

### Job Structure

**Stored in Redis:** `job:{job_id}`

```javascript
{
  job_id: "uuid",
  status: "queued|processing|complete|failed",
  stage: "received|first_pass_generation|...|complete",
  progress_message: "...",
  created_at: "ISO timestamp",
  updated_at: "ISO timestamp",
  locked: false,
  locked_at: null,
  payload: { answers, metadata },
  profileInput: {...},      // Set in Stage 1
  reportContent: {...},     // Set in Stage 1
  firstSnapshot: {...},     // Set in Stage 2
  missingFields: [...],
  repairContent: {...},
  result_html: "...",       // Set when complete
  result_metadata: {},
  error: null,
  diagnostics: {}
}
```

---

## PROPOSED NEW FLOW

### Insertion Point: **After Stage 1 (FIRST_PASS_GENERATION)**

**Why this point:**
- ✅ `profileInput` available (buildProfileInput complete)
- ✅ `reportContent` available (GPT generation complete)
- ✅ No disruption to existing template/PDF flow
- ✅ Early enough to attach profile_id to job before completion
- ✅ Late enough that answers are validated and formatted

**New Stage Sequence:**
1. FIRST_PASS_GENERATION (existing)
2. **CANONICAL_GENERATION** (new) ← **INSERT HERE**
3. FIRST_INJECTION (existing)
4. REPAIR_PASS (existing, conditional)
5. FINAL_INJECTION (existing)
6. COMPLETE (existing)

### New Stage: CANONICAL_GENERATION

**Function:** `executeCanonicalGeneration(job)`

**Actions:**
1. Call `generateCanonicalProfile(job.profileInput)`
2. Generate `profile_id` using `generateProfileId()`
3. Attach `profile_id` to canonical profile metadata
4. Call `saveCanonicalProfile()` with all required fields
5. Call `saveCanonicalMarkdown()` if markdown exists
6. Update job with canonical diagnostics + profile_id
7. Transition to `FIRST_INJECTION`

**Error Handling:**
- Canonical generation failure → log error, continue to FIRST_INJECTION
- Vault save failure → log error, continue to FIRST_INJECTION
- **CRITICAL:** Report flow MUST NOT crash if canonical fails

### Job Structure Changes

**Add to job object:**
```javascript
{
  // Existing fields...
  
  // New canonical fields
  canonical_profile_id: "MM-20260521-abc12345",
  canonical_profile: {...},        // Full canonical profile JSON
  canonical_profile_markdown: "...", // Markdown dossier
  canonical_diagnostics: {
    generation_attempted: true,
    generation_success: true,
    generation_error: null,
    generation_time_ms: 1234,
    quality_score: 93,
    vault_save_attempted: true,
    vault_save_success: true,
    vault_save_error: null,
    vault_keys_created: [
      "vault:profile:MM-20260521-abc12345",
      "vault:markdown:MM-20260521-abc12345",
      "vault:index:date:2026-05-21",
      "vault:index:email:user@example.com"
    ],
    profile_signature: "f2ef73f2fa3508f1"
  }
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Add JOB_STAGE.CANONICAL_GENERATION

**File:** `api/engine/miniV2JobManager.js`

**Changes:**
```javascript
export const JOB_STAGE = {
  RECEIVED: 'received',
  FIRST_PASS_GENERATION: 'first_pass_generation',
  CANONICAL_GENERATION: 'canonical_generation',  // NEW
  FIRST_INJECTION: 'first_injection',
  REPAIR_PASS: 'repair_pass',
  FINAL_INJECTION: 'final_injection',
  COMPLETE: 'complete',
  FAILED: 'failed'
}

// Update progress messages
const STAGE_MESSAGES = {
  [JOB_STAGE.RECEIVED]: 'Starting generation...',
  [JOB_STAGE.FIRST_PASS_GENERATION]: 'Analyzing response patterns',
  [JOB_STAGE.CANONICAL_GENERATION]: 'Building canonical dossier',  // NEW
  [JOB_STAGE.FIRST_INJECTION]: 'Building behavioral profile',
  // ...existing
}
```

### Phase 2: Implement executeCanonicalGeneration()

**File:** `api/engine/miniV2StagedExecutor.js`

**Add new function:**
```javascript
/**
 * Stage 1.5: Canonical generation and Vault storage
 * Generates frontier canonical dossier and saves to Vault
 */
export async function executeCanonicalGeneration(job) {
  const trace = job.diagnostics?.stage_trace || []
  trace.push('ENTER_canonical_generation')
  
  const canonical_diagnostics = {
    generation_attempted: true,
    generation_success: false,
    generation_error: null,
    generation_time_ms: 0,
    vault_save_attempted: false,
    vault_save_success: false,
    vault_save_error: null,
    vault_keys_created: [],
    profile_signature: null,
    quality_score: null
  }
  
  try {
    const start_time = Date.now()
    
    // Import canonical engine
    const { generateCanonicalProfile } = await import('./canonical/canonicalProfileGenerator.js')
    const { generateProfileId } = await import('./vault/generateProfileId.js')
    const { saveCanonicalProfile, saveCanonicalMarkdown } = await import('./vault/saveCanonicalProfile.js')
    const { buildNarrativeProfile } = await import('./canonical/buildNarrativeProfile.js')
    
    trace.push('imported_canonical_modules')
    
    // Generate canonical profile
    const { profileInput } = job
    
    if (!profileInput) {
      throw new Error('profileInput not available')
    }
    
    trace.push('before_generateCanonicalProfile')
    const canonical_profile = generateCanonicalProfile(profileInput)
    trace.push('after_generateCanonicalProfile')
    
    canonical_diagnostics.generation_success = true
    canonical_diagnostics.generation_time_ms = Date.now() - start_time
    
    // Generate profile_id
    const profile_id = generateProfileId()
    trace.push(`profile_id_generated: ${profile_id}`)
    
    // Attach profile_id to canonical profile metadata
    canonical_profile.profile_id = profile_id
    canonical_profile.metadata.profile_id = profile_id
    canonical_profile.metadata.job_id = job.job_id
    
    // Extract metadata from job payload
    const { metadata = {} } = job.payload
    const person_name = metadata.person_name || metadata.name || null
    const email = metadata.email || null
    
    // Calculate quality score (if available from canonical profile)
    const quality_score = canonical_profile.evidence_map?.aggregate_confidence 
      ? Math.round(canonical_profile.evidence_map.aggregate_confidence * 100)
      : null
    
    canonical_diagnostics.quality_score = quality_score
    canonical_diagnostics.profile_signature = canonical_profile.profile_signature || null
    
    // Generate markdown
    trace.push('before_buildNarrativeProfile')
    const narrative = buildNarrativeProfile(canonical_profile)
    const canonical_markdown = narrative.full_narrative || null
    trace.push('after_buildNarrativeProfile')
    
    // Save to Vault
    canonical_diagnostics.vault_save_attempted = true
    trace.push('before_saveCanonicalProfile')
    
    const vault_result = await saveCanonicalProfile({
      canonical_profile,
      job_id: job.job_id,
      person_name,
      email,
      assessment_version: 'mini-v2',
      model: 'canonical-v1-frontier',
      intake_answers: job.payload.answers,
      quality_score,
      metadata: {
        ...metadata,
        generation_time_ms: canonical_diagnostics.generation_time_ms,
        job_created_at: job.created_at
      }
    })
    
    trace.push('after_saveCanonicalProfile')
    
    canonical_diagnostics.vault_save_success = vault_result.success
    canonical_diagnostics.vault_keys_created.push(vault_result.vault_key)
    
    // Save markdown
    if (canonical_markdown) {
      trace.push('before_saveCanonicalMarkdown')
      const md_result = await saveCanonicalMarkdown(profile_id, canonical_markdown)
      trace.push('after_saveCanonicalMarkdown')
      
      if (md_result.success) {
        canonical_diagnostics.vault_keys_created.push(md_result.markdown_key)
      }
    }
    
    // Update job with canonical data
    await updateJob(job.job_id, {
      stage: JOB_STAGE.FIRST_INJECTION,
      progress_message: 'Building behavioral profile',
      canonical_profile_id: profile_id,
      canonical_profile,
      canonical_profile_markdown: canonical_markdown,
      canonical_diagnostics,
      diagnostics: {
        ...job.diagnostics,
        stage_trace: [...trace, 'canonical_generation_complete']
      }
    })
    
    trace.push('EXIT_canonical_generation')
    return { success: true, nextStage: JOB_STAGE.FIRST_INJECTION }
    
  } catch (error) {
    // Log error but DO NOT fail job
    console.error('[CANONICAL-GENERATION] Error:', error)
    
    canonical_diagnostics.generation_error = error.message
    if (canonical_diagnostics.vault_save_attempted && !canonical_diagnostics.vault_save_success) {
      canonical_diagnostics.vault_save_error = error.message
    }
    
    // Update job with error diagnostics, continue to next stage
    await updateJob(job.job_id, {
      stage: JOB_STAGE.FIRST_INJECTION,
      progress_message: 'Building behavioral profile',
      canonical_diagnostics,
      diagnostics: {
        ...job.diagnostics,
        stage_trace: [...trace, `canonical_generation_error: ${error.message}`],
        canonical_generation_failed: true
      }
    })
    
    // Return success to continue pipeline
    return { success: true, nextStage: JOB_STAGE.FIRST_INJECTION }
  }
}
```

### Phase 3: Wire into executeNextStage()

**File:** `api/engine/miniV2StagedExecutor.js`

**Modify executeNextStage():**
```javascript
export async function executeNextStage(job) {
  const { stage } = job
  
  switch (stage) {
    case JOB_STAGE.RECEIVED:
    case JOB_STAGE.FIRST_PASS_GENERATION:
      return await executeFirstPassGeneration(job)
    
    case JOB_STAGE.CANONICAL_GENERATION:  // NEW
      return await executeCanonicalGeneration(job)
    
    case JOB_STAGE.FIRST_INJECTION:
      return await executeFirstInjection(job)
    
    // ...existing stages
  }
}
```

**Modify executeFirstPassGeneration() transition:**
```javascript
// OLD:
await updateJob(job.job_id, {
  status: JOB_STATUS.PROCESSING,
  stage: JOB_STAGE.FIRST_INJECTION,  // OLD
  // ...
})

// NEW:
await updateJob(job.job_id, {
  status: JOB_STATUS.PROCESSING,
  stage: JOB_STAGE.CANONICAL_GENERATION,  // NEW - insert canonical stage
  // ...
})
```

### Phase 4: Expose profile_id in Status Response

**File:** `api/engine/miniV2JobManager.js`

**Modify formatJobResponse():**
```javascript
export function formatJobResponse(job) {
  // ...existing logic
  
  if (job.status === JOB_STATUS.COMPLETE) {
    return {
      success: true,
      job_id: job.job_id,
      status: job.status,
      stage: job.stage,
      progress_message: job.progress_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
      result_html: job.result_html,
      result_metadata: job.result_metadata,
      diagnostics: job.diagnostics,
      
      // NEW: Include canonical data
      canonical_profile_id: job.canonical_profile_id || null,
      canonical_diagnostics: job.canonical_diagnostics || null
    }
  }
  
  // For in-progress jobs, include partial canonical data
  return {
    success: false,
    job_id: job.job_id,
    status: job.status,
    stage: job.stage,
    progress_message: getProgressMessage(job.stage),
    created_at: job.created_at,
    updated_at: job.updated_at,
    
    // NEW: Include profile_id if available
    canonical_profile_id: job.canonical_profile_id || null
  }
}
```

---

## FALLBACK BEHAVIOR

### If Canonical Generation Fails

**Symptom:** `executeCanonicalGeneration()` throws error

**Behavior:**
1. Error logged to console
2. `canonical_diagnostics.generation_error` set
3. Job continues to `FIRST_INJECTION`
4. Report flow proceeds normally
5. Status response includes `canonical_diagnostics` with error

**User Impact:** None - report generates as before

### If Vault Save Fails

**Symptom:** `saveCanonicalProfile()` throws error

**Behavior:**
1. Error logged to console
2. `canonical_diagnostics.vault_save_error` set
3. Job continues to `FIRST_INJECTION`
4. Report flow proceeds normally
5. Canonical profile stored in job Redis (temp) even if Vault fails

**User Impact:** None - report generates, canonical in job storage

### If Redis Unavailable

**Symptom:** Redis connection fails during Vault save

**Behavior:**
1. Error caught in try/catch
2. Job continues (Vault is optional addon)
3. Report flow unaffected

**User Impact:** None - assessment completes without Vault

---

## RISKS & MITIGATION

### Risk 1: Canonical Generation Timeout

**Risk:** executeCanonicalGeneration() takes >10s, serverless timeout

**Mitigation:**
- Canonical generation is pure JS (no LLM calls)
- Expected time: <1s
- If timeout occurs, job remains at CANONICAL_GENERATION stage
- Next status poll will retry or skip to FIRST_INJECTION

**Likelihood:** Very Low

### Risk 2: Vault Storage Failure

**Risk:** Redis unavailable, Vault save fails

**Mitigation:**
- Try/catch around all Vault operations
- Job continues on error
- Error visible in diagnostics
- Canonical profile still in job Redis (temp storage)

**Likelihood:** Low (Vercel Redis highly available)

### Risk 3: Profile_id Collision

**Risk:** Two jobs generate same profile_id

**Mitigation:**
- 36^8 = 2.8 trillion combinations per day
- Collision probability: <0.0001% per million profiles
- Redis atomic operations prevent overwrite

**Likelihood:** Negligible

### Risk 4: Breaking Existing Flow

**Risk:** New stage disrupts template injection

**Mitigation:**
- Canonical stage inserted BEFORE template injection
- No changes to FIRST_INJECTION or later stages
- Job structure extended, not replaced
- Existing fields untouched

**Likelihood:** Very Low

---

## TESTING STRATEGY

### Test 1: Structure Test (No Live Redis)

**Already passing:** `scripts/testVaultStructure.js`

### Test 2: Live Assessment Test

**Steps:**
1. Submit test assessment via `/api/moremindmap/start`
2. Poll `/api/moremindmap/status` until complete
3. Verify `canonical_profile_id` in response
4. Verify `canonical_diagnostics.generation_success = true`
5. Verify `canonical_diagnostics.vault_save_success = true`
6. Retrieve profile from Vault using `profile_id`
7. Verify report HTML generated (existing flow works)

### Test 3: Retrieval Test

**Script:** `scripts/testVaultRetrieveLatest.js`

**Actions:**
1. Call `listRecentProfiles(1)`
2. Get latest `profile_id`
3. Call `getCanonicalProfile(profile_id)`
4. Verify JSON structure
5. Call `getCanonicalMarkdown(profile_id)`
6. Verify markdown exists

---

## ROLLBACK PLAN

### If Canonical Wiring Breaks Production

**Immediate Rollback:**
1. Revert `miniV2StagedExecutor.js` changes
2. Revert `miniV2JobManager.js` changes
3. Git: `git revert <commit_hash>`
4. Deploy immediately

**Changes reverted:**
- `JOB_STAGE.CANONICAL_GENERATION` removed
- `executeCanonicalGeneration()` removed
- `executeFirstPassGeneration()` transitions to `FIRST_INJECTION` (original)
- `formatJobResponse()` canonical fields removed

**User impact:** None - reverts to pre-canonical flow

**Vault data:** Preserved in Redis, retrievable later when fixed

---

## SUCCESS CRITERIA

**Minimum viable success:**
1. ✅ Live assessment completes
2. ✅ `profile_id` generated
3. ✅ Canonical profile generated
4. ✅ Vault save succeeds
5. ✅ Redis keys exist
6. ✅ Retrieval by `profile_id` works
7. ✅ Status response includes `canonical_profile_id`
8. ✅ Existing report/PDF flow unaffected

**Additional success indicators:**
- Generation time <2s
- Zero production errors
- Vault storage <30KB per profile
- Profile retrievable via test script

---

## STATUS

**Plan Status:** Complete, ready for implementation  
**Insertion Point:** After `FIRST_PASS_GENERATION`, before `FIRST_INJECTION`  
**Risk Level:** Low (isolated addon, graceful fallback)  
**Production Impact:** None (pure addition, no removal)

**Next Step:** Implement Phase 1-4, test with live assessment

---

**END OF WIRING PLAN**
