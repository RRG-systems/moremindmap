# ROCKY WAKEUP PROCEDURE

**Purpose:** Standard startup/recovery procedure for MORE MindMap Mini V2 development  
**Source of Truth:** Git repository state + status documentation  
**Goal:** Restore context in <2 minutes without giant prompts

---

## STEP 1 — VERIFY EXECUTION ENVIRONMENT

```bash
pwd
node -v
npm -v
git --version
```

**Stop if any command fails.** Report exact error.

---

## STEP 2 — CHECK REPO STATE

```bash
cd /Users/rrg/.openclaw/workspace/moremindmap-live
pwd
git rev-parse --show-toplevel
git remote -v
git status --short
git rev-parse --short HEAD
git log --oneline -10
```

**Confirm:**
- Repo path correct
- Remote is `https://github.com/RRG-systems/moremindmap.git`
- Git clean (no uncommitted changes) or report dirty state
- Current HEAD commit

---

## STEP 3 — READ STATUS DOCUMENTATION (IN ORDER)

**Primary source of truth:**
```bash
cat MINI_V2_STEP2_CONTENT_COMPLETION_STATUS.md
```

**If that file doesn't exist, fall back to:**
```bash
cat MINI_V2_ASYNC_RUNTIME_STATUS.md
cat README_PROJECT_STATE.md
```

**Extract:**
- Current HEAD from status doc
- What's COMPLETE
- What's IN PROGRESS
- Current blocker
- Next safe task

---

## STEP 4 — VERIFY KEY FILES EXIST

```bash
ls -lh api/engine/miniV2StagedExecutor.js
ls -lh api/engine/mapDimensionFields.js
ls -lh api/engine/miniV2FieldMap.js
ls -lh api/engine/injectReportContent.js
ls -lh api/moremindmap/start.js
ls -lh api/moremindmap/status.js
```

**Confirm all exist.** Report missing files.

---

## STEP 5 — CHECK PRODUCTION HEALTH

```bash
curl -i https://moremindmap.com/api/test-redis
curl -i https://moremindmap.com/api/moremindmap/ping
```

**Confirm HTTP 200.** Report failures.

**DO NOT run full report generation during wakeup.**

---

## STEP 6 — REPORT CURRENT STATE

**Required output:**
1. Execution environment working? (yes/no)
2. Repo path
3. Current HEAD
4. Git clean/dirty
5. Latest 5 commits
6. Primary status doc found? (which one)
7. What's COMPLETE (brief)
8. Current blocker (brief)
9. Next safe task (brief)
10. Production health (Redis + ping)

---

## STEP 7 — READY STATE

**If all checks pass:**
- ✅ Execution restored
- ✅ Repo state known
- ✅ Current blocker identified
- ✅ Next task clear
- ✅ Production operational

**Proceed with next safe task.**

**If any check fails:**
- ❌ Stop
- ❌ Report exact failure
- ❌ Request intervention

---

## PRINCIPLES

1. **Git is source of truth** — Not memory files, not chat history
2. **Status docs over inference** — Read documentation, don't guess
3. **Production health first** — Verify endpoints before development
4. **Report state, don't assume** — Explicit > implicit
5. **Stop on ambiguity** — Ask rather than proceed on uncertainty

---

## DO NOT DO DURING WAKEUP

- ❌ Modify code
- ❌ Commit changes
- ❌ Run full report generation
- ❌ Touch MOLTmarket
- ❌ Touch Stripe
- ❌ Make assumptions about current state

---

**WAKEUP COMPLETE — READY FOR NEXT TASK**
