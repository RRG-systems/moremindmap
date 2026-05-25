# STEP 3.25 — NARRATIVE PRUNING SPECIFICATION

**Status:** ⚠️ PLANNED (Not Yet Implemented)  
**Date:** Mon 25 May 2026 15:45 MST

---

## ARCHITECTURE PROBLEMS IDENTIFIED

From the current Step 3 structure, these duplications and weaknesses exist:

### 1. **Duplicate Sections**
- **Facilitator Notes** appears on BOTH PageTwo (ZONE 3) AND PageEight (new plan)
- **The One Move** appears on BOTH PageTwo (ZONE 3) AND PageEight (new plan)
- Both should appear ONLY on PageEight (final intervention section)

### 2. **Weak Presentation**
- Five Futures is not visually featured (should be dedicated section with breathing room)
- Decision Architecture is scattered/weak (not emphasized properly)
- World Experience is missing from visible rendering

### 3. **Emotional Redundancy**
- Same ideas about "speed creates friction" repeated across sections
- Organizational consequence stated multiple times instead of once, clearly
- Pressure response explained redundantly

### 4. **Dashboard Inheritance Issues**
- Current structure still feels like "multiple smart cards"
- Not yet "one unfolding realization"
- Progression feels stacked, not sequential

---

## MANDATORY STRUCTURE (7 SECTIONS)

### SECTION 1 — ORIENTATION (Page 1)
**Current Components:**
- Hero identity zone
- DNA signature hexagons
- Profile DNA (operating model)
- Executive Summary

**Keep:** All of above  
**Rule:** No downstream consequence language here

### SECTION 2 — HOW THIS SYSTEM MOVES (Page 3 NEW)
**Required Components:**
- World Experience

**Keep:** Pure mechanism  
**Remove:** Any organizational damage language

### SECTION 3 — WHAT PRESSURE CHANGES (Page 4 NEW)
**Required Components:**
- Pressure Mechanics
- Hidden Contradictions

**Keep:** Escalation chain: behavior → amplification → blindness  
**Remove:** Repetitions of "speed causes friction"

### SECTION 4 — HOW OTHER PEOPLE ADAPT (Page 5 NEW)
**Required Components:**
- How Others Experience You
- Organizational Consequences

**Keep:** Lived-in, relational, observed feeling  
**Where "people stop bringing concerns" belongs**

### SECTION 5 — WHY SCALE BREAKS (Page 6 NEW)
**Required Components:**
- Scaling Constraint

**Keep:** Structural and inevitable feeling  
**Remove:** Business coaching tone

### SECTION 6 — FUTURE TRAJECTORIES (Page 7 NEW)
**Required Components:**
- Five Futures (FEATURED SECTION)

**Requirements:**
- Full-width treatment
- Visual breathing room
- Clear section introduction
- Distinct spacing

**Presentation:** NOT predictions, but "behavioral trajectories emerging from current patterns"  
**Feel:** Quietly unsettling

### SECTION 7 — INTERVENTION (Page 8 NEW)
**Required Components:**
- Facilitator Notes (ONLY HERE)
- The One Move (ONLY HERE)

**Keep:** Both appear ONCE and ONLY ONCE  
**Feel:** Earned by accumulated evidence, not generic advice

---

## IMPLEMENTATION REQUIREMENTS

### File: `src/components/reports/WebProfileReport.jsx`

**Page 1 (KEEP):**
- `PageOneDashboard` - existing, no changes needed
- Contains: Hero, Scoreboard, Profile DNA, Executive Summary

**Page 2 (MODIFY):**
- `PageTwoDashboard` - REMOVE ActionSystem (Facilitator Notes + One Move)
- Keep: Contradictions, Operating Under Pressure, Strategic Ceiling

**Pages 3-8 (CREATE/REORGANIZE):**
- `PageThreeDashboard` - Section 2: How This System Moves
- `PageFourDashboard` - Section 3: What Pressure Changes
- `PageFiveDashboard` - Section 4: How Other People Adapt
- `PageSixDashboard` - Section 5: Why Scale Breaks
- `PageSevenDashboard` - Section 6: Future Trajectories (FEATURED)
- `PageEightDashboard` - Section 7: Intervention (SINGLE appearance each)

---

## DUPLICATION REMOVAL CHECKLIST

- [ ] Remove ActionSystem from PageTwo
- [ ] Remove Facilitator Notes from PageFive (old plan)
- [ ] Remove The One Move from PageFive (old plan)
- [ ] Consolidate Facilitator Notes to PageEight only
- [ ] Consolidate The One Move to PageEight only
- [ ] Verify no section appears more than once

---

## CONTENT MAPPING

Current narrative fields → Proper sections:

| Narrative Field | Old Location | New Section | New Location |
|---|---|---|---|
| `profileDNA` | Page 1 | Orientation | Page 1 ✅ |
| `executiveSummary` | Page 1 | Orientation | Page 1 ✅ |
| `communicationStyle` | Page 2 | How Others Experience / World Experience | Page 3 or 5 |
| `systemUnderStrain` | Page 2 Zone 1 | What Pressure Changes | Page 4 |
| `hiddenContradictions` | Page 2 Zone 1 | What Pressure Changes | Page 4 |
| `strategicCeiling` | Page 2 Zone 2 | Why Scale Breaks | Page 6 |
| `coachingLeverage` | Page 2 Zone 3 (remove!) & Page 5 (remove!) | Intervention | Page 8 ONLY |
| `recommendedNextStep` | Page 2 Zone 3 (remove!) & Page 5 (remove!) | Intervention | Page 8 ONLY |

---

## REDUNDANCY REDUCTION

**Phrases to audit and consolidate:**
- "speed creates friction" / "coordination gaps" / "directness overrides signal"
  → Use ONE clear formulation per section
- "teams adapt" / "organizational adaptation"  
  → Dedicate Section 4 to this fully
- "personal execution insufficient"  
  → Feature this ONLY in Section 5 (Why Scale Breaks)

---

## SUCCESS CRITERIA (After Implementation)

✅ No duplicate sections  
✅ No repeated emotional beats  
✅ Five Futures visually featured  
✅ Intervention section appears once  
✅ Progression feels unfolding, not stacked  
✅ Build passes  
✅ Mobile verified  
✅ Screenshots show clean progression  

---

## FILES TO MODIFY

**Primary:**
- `src/components/reports/WebProfileReport.jsx` (Complete page restructuring)

**No changes needed to:**
- `src/lib/profile/renderContract.js` (Contract is fine, domains are defined)
- Backend extraction logic
- Canonical dossier structure

---

## NEXT PHASE (After Step 3.25)

**Step 4: Cinematic Render Expansion**
- Visual hierarchy refinement
- Breathing room between sections
- Premium treatment for Five Futures section
- Improved mobile flow
- Full-width narrative cards

---

## CURRENT STATUS

- [x] Step 3: Progression architecture (7 sections defined in renderContract)
- [x] Pages 1-2 working
- [x] Pages 3-5 partially working  
- [ ] **Step 3.25: Pruning & deduplication (IN PROGRESS)**
- [ ] Removed ActionSystem from Page 2
- [ ] Pages 3-8 need complete restructuring for 7-section mandatory flow
- [ ] Step 4: Visual refinement (planned after 3.25)

---

## EXECUTION NOTES

This is editorial restructuring ONLY:
- No new backend extraction
- No new data domains
- No visual redesign
- Only reordering existing narrative content into proper progression sequence

The goal: Transform from "multiple smart sections" to "one unfolding realization."
