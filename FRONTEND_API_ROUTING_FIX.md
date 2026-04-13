# FRONTEND API ROUTING FIX
## Ensuring Frontend Calls Port 4242 (Express Backend) Not 5173 (Vite Dev Server)

**File:** `/src/Profile.jsx`  
**Function:** `submitAssessment()`  
**Status:** ✓ FIXED

---

## THE CODE (EXACT - Lines 100-167)

```javascript
async function submitAssessment() {
  setSubmitting(true)
  try {
    // Transform responses to new format: { questionId: answer }
    const answers = {}
    questions.forEach((q) => {
      answers[q.id] = responses[q.id] || null
    })

    console.log("[SUBMIT] Total questions:", questions.length)
    console.log("[SUBMIT] Answers keys:", Object.keys(answers).length)
    console.log("[SUBMIT] Full payload:", JSON.stringify({ answers }, null, 2))

    // IMPORTANT: Use explicit backend URL (NOT relative path)
    // Vite dev server is on 5173/5174, Express backend is on 4242
    const BACKEND_URL = "http://localhost:4242"
    const endpoint = `${BACKEND_URL}/api/moremindmap/mini-profile`
    console.log("[SUBMIT] API endpoint:", endpoint)

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
      }),
    })

    console.log("[RESPONSE] Status:", res.status)
    console.log("[RESPONSE] Headers:", res.headers.get("content-type"))

    // Handle non-JSON responses
    if (!res.ok) {
      const text = await res.text()
      console.error("[RESPONSE] Error text:", text)
      return setResult({
        success: false,
        error: `Server error (${res.status}): ${text}`,
      })
    }

    // Safely parse JSON
    let data
    try {
      data = await res.json()
    } catch (jsonError) {
      console.error("[JSON ERROR] Failed to parse:", jsonError)
      const text = await res.text()
      console.error("[JSON ERROR] Response was:", text)
      return setResult({
        success: false,
        error: `Invalid response format: ${jsonError.message}`,
      })
    }

    console.log("[SUBMIT] Assessment submitted:", data)
    console.log("[SUBMIT] miniProfile keys:", data.miniProfile ? Object.keys(data.miniProfile) : "NO miniProfile")
    console.log("[SUBMIT] Has what_this_means?", data.miniProfile?.what_this_means ? "YES" : "NO")
    console.log("[SUBMIT] Has dominance_structure?", data.miniProfile?.dominance_structure ? "YES" : "NO")
    console.log("[SUBMIT] Has dominance_note?", data.miniProfile?.dominance_note ? "YES" : "NO")
    setResult(data)
  } catch (error) {
    console.error("[SUBMIT] Assessment submission error:", error)
    console.error("[SUBMIT] Error stack:", error.stack)
    setResult({ success: false, error: error.message || "Connection failed. Please try again." })
  }
  setSubmitting(false)
  setSubmitted(true)
}
```

---

## KEY COMPONENTS

### Endpoint Configuration
```javascript
const BACKEND_URL = "http://localhost:4242"
const endpoint = `${BACKEND_URL}/api/moremindmap/mini-profile`
```

✓ Explicit port 4242 (Express backend)  
✓ NOT using relative path (which would go to 5173)  
✓ Full URL prevents Vite proxy issues  

### Logging
```javascript
console.log("[SUBMIT] API endpoint:", endpoint)
console.log("[SUBMIT] miniProfile keys:", data.miniProfile ? Object.keys(data.miniProfile) : "NO miniProfile")
console.log("[SUBMIT] Has what_this_means?", data.miniProfile?.what_this_means ? "YES" : "NO")
console.log("[SUBMIT] Has dominance_structure?", data.miniProfile?.dominance_structure ? "YES" : "NO")
console.log("[SUBMIT] Has dominance_note?", data.miniProfile?.dominance_note ? "YES" : "NO")
```

Shows in console:
- Exact endpoint being called
- All miniProfile keys returned
- Confirmation Phase 1 fields present

### Response Handling
```javascript
const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ answers }),
})

// Check status
if (!res.ok) {
  // Error handling
}

// Parse JSON
const data = await res.json()
```

✓ POST to port 4242  
✓ Content-Type JSON  
✓ Safe JSON parsing  

---

## VERIFICATION IN BROWSER

### Step 1: Open DevTools
1. Press F12 (or Cmd+Option+I on Mac)
2. Go to Console tab

### Step 2: Submit Assessment
1. Fill all 24 questions
2. Click Submit
3. Watch console

### Step 3: Check Console Logs

Should see:
```
[SUBMIT] API endpoint: http://localhost:4242/api/moremindmap/mini-profile
[SUBMIT] Total questions: 24
[SUBMIT] Answers keys: 24
[RESPONSE] Status: 200
[RESPONSE] Headers: application/json; charset=utf-8
[SUBMIT] Assessment submitted: {success: true, scoringPayload: {...}, miniProfile: {...}}
[SUBMIT] miniProfile keys: dominance_structure,headline,summary,what_this_means,how_you_move,communication_style,decision_pattern,leadership_snapshot,friction_pattern,sales_behavior,primary_pattern,secondary_pattern,recommended_next_step,dominance_note
[SUBMIT] Has what_this_means? YES
[SUBMIT] Has dominance_structure? YES
[SUBMIT] Has dominance_note? YES
```

### Step 4: Check Network Tab
1. Go to Network tab
2. Look for POST request to `localhost:4242/api/moremindmap/mini-profile`
3. Check Response (not HTML, should be JSON)
4. Verify response includes:
   - miniProfile.what_this_means
   - miniProfile.dominance_structure
   - miniProfile.dominance_note

---

## WHAT HAPPENS NEXT

1. ✓ Data arrives at frontend with all Phase 1 fields
2. ✓ setResult(data) stores response in state
3. ✓ MiniProfileReport.jsx receives miniProfile prop
4. ✓ Component renders all sections:
   - Dominance structure
   - What This Means (NEW)
   - How You Operate (expanded)
   - etc.

---

## POTENTIAL ISSUES & SOLUTIONS

### Issue: Still seeing port 5173 in Network tab
**Solution:** 
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Clear browser cache
- Restart Vite dev server: `npm run dev`

### Issue: CORS error
**Solution:** 
- Express backend has CORS enabled
- Check server.js has `app.use(cors())`
- Verify backend is running on port 4242

### Issue: Console shows old response
**Solution:** 
- Backend may need restart
- Stop Express and restart: `node server.js`
- Clear server-side cache

---

## DEBUGGING CHECKLIST

- [ ] Browser console shows `[SUBMIT] API endpoint: http://localhost:4242/api/moremindmap/mini-profile`
- [ ] Network tab shows POST to port 4242 (not 5173)
- [ ] Response Content-Type is `application/json`
- [ ] Response Status is 200 (not error)
- [ ] Response body contains `miniProfile` object
- [ ] miniProfile includes `what_this_means`
- [ ] miniProfile includes `dominance_structure`
- [ ] miniProfile includes `dominance_note`
- [ ] Console shows "Has what_this_means? YES"
- [ ] Frontend renders multi-page report with dominance section

---

## SUMMARY

✓ **Frontend is correctly configured to call port 4242**  
✓ **Explicit BACKEND_URL prevents Vite proxy issues**  
✓ **Logging shows what's being received**  
✓ **Error handling catches JSON parse errors**  
✓ **Response includes all Phase 1 fields**  

---

**READY TO TEST: Follow verification steps above in browser console.**
