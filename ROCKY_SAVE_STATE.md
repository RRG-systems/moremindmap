# ROCKY SAVE STATE PROCEDURE

**Purpose:** Standard memory/Git save procedure for MORE MindMap Mini V2 development  
**Source of Truth:** Git repository commits + status documentation  
**Goal:** Preserve state so next session can restore context in <2 minutes

---

## WHEN TO SAVE

**Trigger conditions:**
1. Major milestone reached (e.g., "all 4 stages execute")
2. Critical bug fixed (e.g., "state machine routing corrected")
3. Architecture decision locked (e.g., "dimension mapping layer added")
4. Session ending with progress
5. Before risky changes
6. D.J. explicitly requests save

**Frequency:** Every 30-60 minutes of active work, or at natural breakpoints

---

## STEP 1 — UPDATE STATUS DOCUMENTATION

**Primary status doc:** `MINI_V2_STEP2_CONTENT_COMPLETION_STATUS.md`

**Required sections:**
1. **Last Updated:** Current timestamp + timezone (MST)
2. **Current HEAD:** Git commit hash (short)
3. **Status:** High-level state (e.g., "ASYNC COMPLETE, PLACEHOLDER IN PROGRESS")
4. **COMPLETE:** What's working (bullet list)
5. **IN PROGRESS:** What's partially done
6. **CURRENT BLOCKER:** Exact issue blocking progress
7. **LATEST KNOWN METRICS:** Numbers (placeholder counts, field counts, etc.)
8. **BUGS FIXED TODAY:** Commits + descriptions
9. **CURRENT FILES / COMPONENTS:** Key files changed
10. **EXACT CURRENT BLOCKER:** Detailed description
11. **NEXT SAFE TASK FOR NEXT SESSION:** Explicit next step
12. **SUCCESS CONDITION:** What "done" looks like
13. **DO NOT DO LIST:** Protected areas

**Update format:**
```bash
# Edit status doc with current state
vim MINI_V2_STEP2_CONTENT_COMPLETION_STATUS.md

# Or overwrite with new content
cat > MINI_V2_STEP2_CONTENT_COMPLETION_STATUS.md << 'EOF'
[full updated content]
EOF
```

---

## STEP 2 — VERIFY GIT STATE

```bash
git status --short
git diff --stat
```

**Confirm:**
- What files changed
- Whether changes are intentional
- No accidental modifications (MOLTmarket, Stripe, etc.)

---

## STEP 3 — COMMIT STATUS DOC FIRST

**Always commit status doc separately:**

```bash
git add MINI_V2_STEP2_CONTENT_COMPLETION_STATUS.md
git commit -m "document mini v2 [brief description of current state]"
```

**Example commit messages:**
- `document mini v2 step 2 content completion status`
- `update mini v2 status - dimension mapping complete`
- `document mini v2 async architecture operational`

---

## STEP 4 — COMMIT CODE CHANGES (IF ANY)

**Group related changes into logical commits:**

```bash
# Bug fix
git add api/engine/miniV2StagedExecutor.js
git commit -m "fix mini v2 state machine routing for repair pass"

# New feature
git add api/engine/mapDimensionFields.js
git commit -m "add dimension name translation layer for mini v2"

# Multiple related files
git add api/engine/*.js
git commit -m "fix mini v2 repair field completion - normalize arrays"
```

**Commit message format:**
- Start with verb: `fix`, `add`, `update`, `remove`, `document`
- Include `mini v2` for project context
- Brief but specific (not "various fixes")

---

## STEP 5 — PUSH TO GITHUB

```bash
git push origin main
```

**Verify:**
- Push succeeds
- No conflicts
- Remote matches local

---

## STEP 6 — VERIFY SAVE COMPLETED

```bash
git status --short
git log --oneline -5
git rev-parse --short HEAD
```

**Confirm:**
- Working directory clean
- Latest commits visible
- HEAD matches expected state

---

## STEP 7 — SAVE STATE REPORT

**Required output:**
1. Status doc updated? (yes/no + which file)
2. Status doc commit hash
3. Code changes committed? (yes/no + files)
4. Code commit hash(es)
5. Push successful? (yes/no)
6. Current HEAD
7. Git clean? (yes/no)
8. Current blocker (brief)
9. Next safe task (brief)

---

## SAVE STATE CHECKLIST

**Before pushing:**
- [ ] Status doc updated with current state
- [ ] Current HEAD recorded in status doc
- [ ] Current blocker explicitly stated
- [ ] Next safe task explicitly stated
- [ ] Metrics updated (placeholder counts, etc.)
- [ ] No accidental changes (MOLTmarket, Stripe)
- [ ] Commit messages descriptive
- [ ] Git status clean after push

---

## PRINCIPLES

1. **Git is permanent memory** — Not MEMORY.md, not chat history
2. **Status doc is recovery point** — Next session starts here
3. **Separate commits for docs vs code** — Easier to review
4. **Explicit over implicit** — State current blocker, don't assume obvious
5. **Push frequently** — Local-only commits aren't saved

---

## DO NOT DO DURING SAVE

- ❌ Commit broken code
- ❌ Push without status doc update
- ❌ Generic commit messages ("fix stuff", "updates")
- ❌ Commit MOLTmarket changes
- ❌ Commit Stripe changes
- ❌ Force push (unless explicitly authorized)

---

## RECOVERY TEST

**Good save state passes this test:**

1. Fresh Rocky session
2. Run ROCKY_WAKEUP.md procedure
3. Restore full context in <2 minutes
4. Know exact current blocker
5. Know exact next safe task
6. No giant prompts needed

**If recovery test fails, save state was incomplete.**

---

**SAVE STATE COMPLETE — NEXT SESSION CAN RESTORE CONTEXT FROM GIT**
