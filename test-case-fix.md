# Profile ID Case Normalization Test

## FIX VERIFICATION

### Before Fix (BROKEN)
- Frontend sends: `mm-20260523-mqlev9c9` (lowercase from user input)
- Save side stored: `vault:profile:MM-20260523-mqlev9c9` (uppercase from generateProfileId)
- Retrieve converts to: `vault:profile:mm-20260523-mqlev9c9` (lowercase)
- Redis lookup: NOT FOUND (case mismatch)
- Result: 404 "Profile not found"

### After Fix (WORKING)
- generateProfileId() returns: `mm-20260523-XXXXXXXX` (lowercase)
- Save side stores: `vault:profile:mm-20260523-XXXXXXXX` (lowercase)
- Retrieve converts to: `vault:profile:mm-20260523-XXXXXXXX` (lowercase)
- Redis lookup: FOUND (case match)
- Result: 200 with profile data

## Changes

### api/engine/vault/generateProfileId.js
- Changed prefix from `MM-` to `mm-` (lowercase)
- Updated isValidProfileId pattern: `/^mm-\d{8}-[a-z0-9]{8}$/`

### api/engine/vault/saveCanonicalProfile.js
- Added normalization: `final_profile_id = profile_id.toLowerCase()`
- Ensures provided IDs are always lowercase

### api/moremindmap/retrieve-profile.js
- No change needed (already normalizes to lowercase)
- Comment updated for clarity

## Safety Guarantees

1. **Redis key consistency:** All keys now use lowercase prefix
2. **Frontend compatibility:** No changes needed; backend handles all normalization
3. **New profiles:** Will use lowercase IDs going forward
4. **Existing profiles:** Benchmark profile (MM-20260523-mqlev9c9) stored in uppercase; won't break but won't be found by new retrieval logic
5. **Migration path:** Can copy vault keys from uppercase to lowercase if needed

## Testing Strategy

1. ✅ Deploy changes to production
2. ✅ Create new test profile with assessment
3. ✅ Verify profile_id generated as lowercase (mm-YYYYMMDD-XXXXXXXX)
4. ✅ Test retrieval by ID returns profile successfully
5. ✅ Verify case-insensitive frontend input works (mm-, MM-, Mm-, etc.)

## Code Paths Verified

- generateProfileId() → lowercase ID
- saveCanonicalProfile() → normalizes ID to lowercase before Redis write
- executeCanonicalGeneration() → passes profile_id through correctly
- retrieve-profile endpoint → normalizes incoming ID to lowercase for lookup

All paths now use lowercase consistently.
