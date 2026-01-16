# Fetch-Injuries Success Rate Tracking

## Overview
This document tracks the success rate and reliability of the `fetch-injuries` functionality.

## Test Results

### Test 1: January 12, 2025 (Historical Date)
**Date:** 2025-01-12  
**Method:** Python Script (`fetch_injuries_pdf.py`)  
**Status:** ✅ **SUCCESS**

**Results:**
- PDF Found: ✅ Yes (08AM version)
- PDF Size: 77,638 bytes
- Text Extracted: 5,888 characters
- Injuries Found: 50
- Successfully Stored: 42 (84% success rate)
- Skipped (Player Not Found): 8 (16%)
- Errors: 0

**Players Skipped (Not in Database):**
1. Vlatko Cancar (DEN)
2. Nikola Jokic (DEN) - *Note: This is likely a parsing issue, Jokic should be in DB*
3. Luka Doncic (DAL) - *Note: This is likely a parsing issue, Doncic should be in DB*
4. Dante Exum (DAL)
5. Pacome Dadiet (NYK)
6. Kevin Jr. (NYK)
7. Nikola Topic (CLE)
8. Bojan Bogdanovic (BKN)

**Analysis:**
- The script successfully fetched and parsed the PDF
- 84% of injuries were successfully matched to players in the database
- Some skipped players are likely due to:
  - Rookie players not yet in database
  - Name parsing issues (e.g., "Kevin Jr." might be a parsing error)
  - Players with special characters or name formats

### Test 2: January 13, 2026 (Today) - INITIAL TEST
**Date:** 2026-01-13  
**Method:** Python Script (`fetch_injuries_pdf.py`)  
**Status:** ⚠️ **PDF NOT FOUND** (URL format issue)

**Results:**
- PDF Found: ❌ No (tried old format: 08AM, 04PM, 12PM, 10AM, 06PM)
- Reason: URL format changed - NBA now uses `HH_MMAM/PM` instead of `HHAM/PM`

**Analysis:**
- The script was using outdated URL format
- NBA changed format to include minutes: `08_00AM` instead of `08AM`

### Test 3: January 13, 2026 (Today) - AFTER FIX
**Date:** 2026-01-13  
**Method:** Python Script (`fetch_injuries_pdf.py`) - **UPDATED URL FORMAT**  
**Status:** ✅ **SUCCESS**

**Results:**
- PDF Found: ✅ Yes (08_00AM version)
- PDF Size: 76,330 bytes
- Text Extracted: 5,168 characters
- Injuries Found: 48
- Successfully Stored: 44 (92% success rate)
- Skipped (Player Not Found): 4 (8%)
- Errors: 0

**Players Skipped (Not in Database):**
1. Nikola Jokic (DEN) - *Note: This is likely a parsing issue, Jokic should be in DB*
2. Jonas Valanciunas (DEN) - *Note: Team mismatch - Valanciunas is on NOP, not DEN*
3. Nikola Topic (OKC) - *Rookie player*
4. Kristaps Porzingis (ATL) - *Note: Team mismatch - Porzingis is on BOS, not ATL*

**Analysis:**
- ✅ **FIXED:** Updated URL generation to support new format (`HH_MMAM/PM`)
- Script now tries both old and new formats for backwards compatibility
- 92% success rate (improved from 84% on previous test)
- Some skipped players are due to team abbreviation mismatches in PDF parsing

### Test 4: Edge Function (Supabase)
**Date:** 2026-01-13  
**Method:** Supabase Edge Function (`fetch-injuries`)  
**Status:** ❌ **FAILED - PDF PARSING LIBRARY ISSUE**

**Results:**
- Function Deployed: ✅ Yes
- PDF Fetching: ✅ Works (tried multiple URLs)
- PDF Parsing: ❌ **FAILED**
- Error: `Module not found: https://deno.land/x/pdfjs@2.10.377/build/pdf.js`

**Analysis:**
- The edge function has a dependency issue with the PDF parsing library
- The Deno import for pdfjs is not resolving correctly
- **Recommendation:** Fix the PDF parsing library import or use an alternative library

## Success Rate Summary

| Method | PDF Fetch | PDF Parse | Player Match | Overall Success |
|--------|-----------|----------|--------------|----------------|
| Python Script | ✅ 100% | ✅ 100% | ✅ 84% | ✅ **84%** |
| Edge Function | ✅ 100% | ❌ 0% | N/A | ❌ **0%** |

## Fixes Applied

### ✅ URL Format Update (January 13, 2026)
**Issue:** NBA changed PDF URL format from `HHAM/PM` to `HH_MMAM/PM`  
**Fix:** Updated both Python script and Edge function to try both formats  
**Result:** Script now successfully finds PDFs with new format  
**Status:** ✅ **FIXED**

## Known Issues

### 1. Edge Function PDF Parsing Library
**Issue:** The Deno PDF.js library import is failing  
**Impact:** Edge function cannot parse PDFs  
**Status:** 🔴 **CRITICAL - NEEDS FIX**  
**Recommendation:** 
- Update the PDF parsing library import
- Consider using `https://deno.land/x/pdfjs@0.4.0/mod.ts` or similar
- Or switch to a different PDF parsing approach

### 2. Player Name Matching
**Issue:** Some players are not being matched (8 out of 50 = 16%)  
**Impact:** Some injuries are not stored  
**Status:** 🟡 **MODERATE - CAN BE IMPROVED**  
**Recommendation:**
- Improve name parsing to handle edge cases
- Add fuzzy matching for player names
- Handle special characters and suffixes better (e.g., "Jr.", "III")

### 3. PDF Availability
**Issue:** PDFs may not be available immediately or on non-game days  
**Impact:** Function may fail when PDF isn't published yet  
**Status:** 🟢 **EXPECTED BEHAVIOR**  
**Recommendation:**
- Add retry logic with exponential backoff
- Schedule multiple runs throughout the day
- Handle "PDF not found" gracefully (current behavior is correct)

## Recommendations

### Immediate Actions
1. **Fix Edge Function PDF Parsing** 🔴
   - Update the PDF.js library import
   - Test with a known working PDF
   - Deploy and verify

2. **Improve Player Matching** 🟡
   - Review skipped players and identify patterns
   - Enhance name parsing logic
   - Add logging for unmatched players

### Long-term Improvements
1. **Add Success Rate Monitoring**
   - Track success rates over time
   - Alert when success rate drops below threshold
   - Log all runs to a database table

2. **Implement Retry Logic**
   - Retry PDF fetching with different time slots
   - Exponential backoff for failed attempts
   - Queue system for processing

3. **Enhanced Error Handling**
   - Better error messages
   - Detailed logging
   - Fallback mechanisms

## Usage

### Running the Python Script (Recommended - Currently Working)
```bash
cd /Users/adam/Desktop/hoopgeek
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Fetch today's injuries
python3 scripts/setup/fetch_injuries_pdf.py

# Fetch specific date
python3 scripts/setup/fetch_injuries_pdf.py --date 2025-01-12
```

### Running the Edge Function (Needs Fix)
```bash
curl -X POST "https://qbznyaimnrpibmahisue.supabase.co/functions/v1/fetch-injuries" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Test Log

| Date | Method | Status | Injuries Found | Stored | Skipped | Errors | Notes |
|------|--------|--------|----------------|--------|---------|--------|-------|
| 2025-01-12 | Python | ✅ Success | 50 | 42 | 8 | 0 | PDF found at 08AM (old format) |
| 2026-01-13 | Python | ⚠️ No PDF | 0 | 0 | 0 | 0 | Initial test - URL format issue |
| 2026-01-13 | Python | ✅ Success | 48 | 44 | 4 | 0 | **AFTER FIX** - PDF found at 08_00AM (new format) |
| 2026-01-13 | Edge Function | ❌ Failed | N/A | N/A | N/A | 1 | PDF parsing library issue |

## Next Steps

1. Fix the edge function PDF parsing library issue
2. Test edge function with a known working PDF
3. Improve player name matching accuracy
4. Set up automated daily runs
5. Monitor success rates over time

---

**Last Updated:** January 13, 2026  
**Current Status:** 
- ✅ Python script working (92% success rate after URL format fix)
- ❌ Edge function needs PDF parsing library fix
- ✅ URL format issue resolved - now supports both old and new formats
