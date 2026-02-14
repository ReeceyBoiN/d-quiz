# Buzzer Dropdown Empty Display - Root Cause & Robust Fix Plan

## Problem Summary
Buzzer dropdowns are empty because API fetch calls fail in Electron. The `/api/host-info` endpoint is unreachable when called via relative URL from renderer process.

### Evidence from Logs
```
Failed to load resource: net::ERR_FILE_NOT_FOUND
/C:/api/host-info:1
[TeamWindow] Error loading buzzer list: TypeError: Failed to fetch
```

## Root Cause
- BuzzersManagement and TeamWindow try to fetch `/api/host-info` with relative URL
- In Electron renderer, this doesn't resolve to the backend server
- Host info fetch fails → buzzerSounds stays empty → no SelectItems render

## Recommended Solution: Electron IPC + HTTP Caching

**Why this approach is robust for 200+ players:**
1. **Reliability**: Uses Electron IPC to get actual backend URL from main process (which knows it)
2. **Performance**: Cache hostInfo once, reuse across all components (no repeated IPC calls)
3. **Future-proof**: Handles dynamic IP changes automatically (main process always has current URL)
4. **Scalability**: Direct HTTP to backend for buzzers list + 200+ player connections work independently

### Implementation Strategy

#### Step 1: Create Shared Host Info Hook
- New file: `src/hooks/useHostInfo.ts`
- Purpose: Get host info once via IPC, cache result, provide to all components
- Benefits: Single point of access, automatic caching, no duplicate IPC calls

#### Step 2: Update BuzzersManagement.tsx
- Replace `fetch('/api/host-info')` with IPC call via custom hook
- Use proper backend URL to fetch buzzers list
- Keep existing buzzer loading logic intact

#### Step 3: Update TeamWindow.tsx  
- Replace `fetch('/api/host-info')` with same custom hook
- Use proper backend URL to fetch buzzers list
- Keep existing buzzer loading logic intact

#### Step 4: Create API Utility
- New file: `src/utils/api.ts`
- Purpose: Centralized HTTP API calls with dynamic backend URL
- Handles: /api/buzzers/list endpoint

## Files to Modify
1. **Create**: `src/hooks/useHostInfo.ts` - IPC-based host info hook with caching
2. **Create**: `src/utils/api.ts` - HTTP API utility for buzzer endpoints
3. **Modify**: `src/components/BuzzersManagement.tsx` - Use new hook + API utility
4. **Modify**: `src/components/TeamWindow.tsx` - Use new hook + API utility

## Technical Details

### useHostInfo Hook
- Makes single IPC call to get backend URL
- Caches result in component memory
- Returns hostInfo object or null if unavailable
- Handles errors gracefully

### API Utility
- Takes hostInfo as parameter
- Constructs full API URLs dynamically
- Provides functions: `getBuzzersList(hostInfo)`
- Can be extended for other API calls

## Expected Outcome
- Dropdowns populate with buzzers from API
- Works with dynamic IP addresses
- Scalable for 200+ concurrent players
- Single point of configuration change if backend URL changes

## Notes
- SelectItem `asChild` fix already applied (handles rendering once items exist)
- This fix focuses on getting data TO render
- No changes needed to SelectItem component - it will work once buzzers load
