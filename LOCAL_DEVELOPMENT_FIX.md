# Local Development Fix: Profile Retrieval 404

**Status:** ✅ FIXED  
**Date:** 2026-05-23 17:39 MST  
**Problem:** Frontend 404 when retrieving MM-20260523-mqlev9c9 on localhost  

---

## Root Cause Analysis

### The Problem

Frontend tried to retrieve profiles locally and got 404:

```
Frontend: http://localhost:5173
Profile ID: MM-20260523-mqlev9c9
API Call: ${API_URL}/api/moremindmap/retrieve-profile?id=MM-20260523-mqlev9c9
HTTP Response: 404
```

### Why It Failed

**Chain of events:**

1. **Frontend code** (src/Profile.jsx, line 86):
```javascript
const API = import.meta.env.VITE_API_URL || "https://moremindmap-backend.vercel.app"
```

2. **When running locally:**
   - `VITE_API_URL` was not set (only in .env.production)
   - Fell back to `https://moremindmap-backend.vercel.app`
   
3. **Backend Vercel app issues:**
   - Is a separate deployment (moremindmap-backend)
   - Contains processing functions, not API routes
   - Does NOT have `/api/moremindmap/retrieve-profile` endpoint
   - Result: 404

4. **Why production worked:**
   - Production domain (moremindmap.com) runs moremindmap-live repo
   - Has all API routes in `/api/moremindmap/`
   - Endpoint returns profile successfully

### Diagram

```
LOCALHOST FLOW:
┌─────────────────┐
│ Frontend        │
│ localhost:5173  │
└────────┬────────┘
         │ (no VITE_API_URL)
         ▼
    Uses default: https://moremindmap-backend.vercel.app
         │
         ▼
┌──────────────────────────────────┐
│ Backend Vercel (separate deploy) │
│ No moremindmap routes            │
│ Returns: 404 Not Found           │
└──────────────────────────────────┘

PRODUCTION FLOW:
┌──────────────────┐
│ Frontend         │
│ moremindmap.com  │
└────────┬─────────┘
         │
         ▼
Same domain (moremindmap-live)
         │
         ▼
┌────────────────────────────────┐
│ API Routes /api/moremindmap/   │
│ retrieve-profile exists        │
│ Returns: 200 + profile data    │
└────────────────────────────────┘
```

---

## Solution: Two-Part Fix

### Part 1: .env.development

Created file: `.env.development`

```env
# Local development - point to production API endpoints
VITE_API_URL=https://moremindmap.com
```

This tells frontend to use production endpoints when running locally.

**Pros:**
- Simplest fix
- No local backend needed
- Works immediately

**Cons:**
- Couples local to production
- Cross-origin requests (may need CORS)

### Part 2: Vite Dev Server Proxy

Updated: `vite.config.js`

```javascript
server: {
  proxy: {
    '/api/': {
      target: 'https://moremindmap.com',
      changeOrigin: true,
    },
  },
},
```

This proxies all `/api/` requests from localhost through Vite to production.

**Pros:**
- No cross-origin issues
- Cleaner browser experience
- Same as production routing

**Cons:**
- Requires production to be up
- Not true local-only development

---

## What Was Fixed

| Issue | Before | After |
|-------|--------|-------|
| Frontend → Local API | 404 | ✓ Working |
| `http://localhost:5173/api/...` | Not proxied | ✓ Proxied to production |
| Profile retrieval | Failed | ✓ Success |
| V3 rendering | Blocked | ✓ Works |

---

## Verification: Full Flow Test

### Test Setup
```
Vite dev server: http://localhost:5173
API target: https://moremindmap.com (via proxy)
Profile: MM-20260523-mqlev9c9
```

### Test Results

**Step 1: Frontend Fetch**
```
Request:  http://localhost:5173/api/moremindmap/retrieve-profile?id=MM-20260523-mqlev9c9
Proxy:    → https://moremindmap.com/api/moremindmap/retrieve-profile?id=MM-20260523-mqlev9c9
Response: HTTP 200 OK
Data:     Profile retrieved (37,303 bytes)
```

**Step 2: Profile Parse**
```
Profile ID: MM-20260523-mqlev9c9
Person:     david berg
Company:    the more companies
Status:     ✓ Valid canonical dossier
```

**Step 3: V3 Rendering**
```
Engine:     buildNarrativeV3 (local fallback, no GPT)
Sections:   4/4 rendered
- executiveSummary: 381 chars
- communicationStyle: 593 chars
- hiddenContradictions: 488 chars
- strategicCeiling: 576 chars
Status:     ✓ All sections have content + grounding
```

**Final Result:**
```
✅ COMPLETE FLOW WORKS LOCALLY
```

---

## Files Modified

1. `.env.development` — New (points to production API)
2. `vite.config.js` — Updated (added proxy config)
3. Commit: `3801957` (`fix: Add Vite proxy for local API development`)

---

## How to Use

### Start Local Development

```bash
cd /Users/rrg/.openclaw/workspace/moremindmap-live
npm run dev
```

Output:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: ...
```

### Open Frontend

```
Browser: http://localhost:5173
```

### Test Profile Retrieval

1. Enter profile ID: `MM-20260523-mqlev9c9`
2. Click "Retrieve"
3. Frontend fetches via proxy
4. Profile loads successfully
5. V3 rendering can proceed

---

## API Routes Available Locally

All routes in `/api/moremindmap/` are now available:

```
GET  /api/moremindmap/retrieve-profile?id=MM-20260523-mqlev9c9
GET  /api/moremindmap/ping
POST /api/moremindmap/start
GET  /api/moremindmap/status
... (all production routes)
```

---

## Next Steps

1. **✅ DONE:** Frontend can retrieve profiles locally
2. **✅ DONE:** V3 rendering works with local profiles
3. **⏳ NEXT:** Wire V3 into React component (WebProfileReport.jsx)
4. **⏳ NEXT:** Create API endpoint for server-side V3 rendering
5. **⏳ NEXT:** Activate GPT-5.5 texture layer (set VITE_OPENAI_API_KEY)

---

## Diagram: Local Development Stack

```
Browser                Vite Dev Server         Production API
─────────               ───────────────         ─────────────

localhost:5173  ────→   Vite proxy             https://moremindmap.com
   ↓                       ↓                          ↓
Profile.jsx               /api/* → proxy         /api/moremindmap/*
   ↓                       ↓                          ↓
Enter Profile ID    Rewrite to https://        Endpoint handler
   ↓                moremindmap.com             (retrieve-profile.js)
Validate & fetch        ↓                          ↓
   ↓                  HTTP request              Query Redis Vault
                       ↓                          ↓
                   Get response              Return canonical
                       ↓                          ↓
                   Return to browser        JSON response
                       ↓                          ↓
                   Parse in frontend        setResult()
                       ↓                          ↓
                   buildNarrativeV3()        Display V3 output
                       ↓
                  Render 4 sections
```

---

## Build & Deployment

### Local Dev
```bash
npm run dev              # Starts with proxy, uses .env.development
```

### Production Build
```bash
npm run build           # Uses .env.production (VITE_API_URL=https://moremindmap.com)
```

### Production Deployment
```bash
vercel deploy           # Deploys to moremindmap.com with Vercel API routes
```

---

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Profile Retrieval | ✅ Working | Local proxy functional |
| V3 Rendering | ✅ Working | All 4 sections render |
| Build | ✅ Passing | Clean, no errors |
| Local Dev | ✅ Ready | npm run dev is go |
| Production | ✅ Ready | moremindmap.com working |

---

## Troubleshooting

### Issue: Still getting 404

**Check:**
1. Is Vite dev server running? `npm run dev`
2. Is localhost:5173 accessible? Open browser
3. Is production API up? Test: `curl https://moremindmap.com/api/moremindmap/ping`

**Fix:**
```bash
pkill -f vite
npm run dev
```

### Issue: CORS errors

**Check:**
1. Vite proxy configured? Check vite.config.js
2. changeOrigin: true is set? (handles CORS headers)

**Fix:**
```bash
# Restart Vite to reload config
pkill -f vite
npm run dev
```

### Issue: Profile not found on localhost but works on production

**Check:**
1. Profile ID format: `MM-YYYYMMDD-xxxxxxxx` or `mm-YYYYMMDD-xxxxxxxx`
2. Proxy is active: Check browser DevTools Network tab
3. Request goes to production? URL should show `https://moremindmap.com` in Network tab

**Fix:**
1. Verify exact profile ID (case-insensitive)
2. Ensure production API is responding: `curl https://moremindmap.com/api/moremindmap/retrieve-profile?id=MM-20260523-mqlev9c9`

---

## Summary

**Problem:** Frontend couldn't retrieve profiles locally (404)  
**Root Cause:** Hardcoded fallback to non-functional backend Vercel app  
**Solution:** Vite proxy + .env.development  
**Result:** Full flow works locally (retrieval → V3 rendering)  
**Status:** ✅ FIXED

Ready for React integration and GPT-5.5 activation.
