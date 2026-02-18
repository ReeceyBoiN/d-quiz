# WiFi Button Network Connectivity Implementation Plan

## Overview
Add real network connectivity detection to the "No Wi-Fi" button in TopNavigation. The button will:
- **Stop flashing** when successfully connected to local WiFi/ethernet network (backend WebSocket connected)
- **Continue flashing** when disconnected from local network
- **Show troubleshooting guide** when clicked (with connection status and debug info)

## Key Insights
1. **Connection Status**: The backend WebSocket connection (`wsConnected` state in QuizHost) is the best indicator of local network connectivity - it shows whether the host can reach the backend on the local network
2. **Existing Infrastructure**: Network detection infrastructure already exists:
   - `wsConnected` state in QuizHost tracks backend WebSocket connection
   - AuthContext tracks browser online/offline status
   - Backend has local IP detection via `getLocalIPAddress()` 
   - Backend exposes `/api/host-info` endpoint with local IP and WebSocket URL
3. **Communication Pattern**: The app uses both:
   - IPC calls via `window.api.*` for backend operations
   - Direct WebSocket messages for real-time player communication

## Implementation Approach

### Phase 1: Wire TopNavigation Button to Connection Status
**Goal**: Make button reactive to network state instead of static

**Files to Modify**:
- `src/components/TopNavigation.tsx` - Main button component
  - Import `wsConnected` state (will need to get from context or prop)
  - Conditionally apply CSS classes: remove "flash-warning" when `wsConnected === true`
  - Add click handler to show troubleshooting modal
  - Change button styling: show green/success state when connected, red/warning when disconnected

**Approach**: 
- Get network connection state via AuthContext (which already tracks navigator.onLine) OR create a NetworkStatusContext that includes wsConnected
- Simpler option: Use AuthContext.isOnline for initial pass (checks browser connectivity)
- Better option: Pass wsConnected from QuizHost down through context or props

### Phase 2: Create Troubleshooting Modal/Dropdown
**Goal**: Display connection status and help steps when button is clicked

**Files to Create/Modify**:
- Create `src/components/NetworkTroubleshootingModal.tsx` (new component)
  - Display current connection status
  - Show local IP address (fetch from backend via `/api/host-info` or IPC call)
  - Show WebSocket URL/connection status
  - Display troubleshooting steps:
    1. Ensure players are on same WiFi network
    2. Check host IP and share with players
    3. Verify firewall isn't blocking port 4310
    4. Try refreshing the player app
  - Show debug info (backend URL, WebSocket status, etc.)

- Modify `src/components/TopNavigation.tsx`
  - Add state for showing/hiding troubleshooting modal
  - Add click handler to show modal

### Phase 3: Update Connection State Management
**Goal**: Ensure TopNavigation has access to accurate network connection state

**Files to Consider**:
- `src/utils/AuthContext.tsx` - Could extend to include wsConnected
- `src/components/QuizHost.tsx` - Source of wsConnected state
- Consider creating a `NetworkContext` that combines:
  - `isOnline` (browser online/offline from navigator)
  - `wsConnected` (backend WebSocket status from QuizHost)
  - `hostInfo` (local IP, WebSocket URL from backend)

**Approach**:
- Either: Create new NetworkContext to consolidate network state
- Or: Add wsConnected to existing AuthContext
- Or: Pass wsConnected as prop down from QuizHost to TopNavigation

## Technical Considerations

1. **Connection Detection Method (Confirmed)**: Will use `wsConnected` state from QuizHost as the primary indicator
   - Most reliable: indicates backend is reachable on local network
   - Real-time: updates automatically when WebSocket connects/disconnects
   - Aligned with player experience: players need this connection too

2. **State Availability**: TopNavigation is in the component tree and may not have direct access to QuizHost's wsConnected state - need to verify component hierarchy and find best way to share state
   - Option A: Create NetworkContext to manage and expose wsConnected
   - Option B: Lift wsConnected to a parent component and pass as prop
   - Option C: Extend existing AuthContext to include wsConnected

3. **Backend Communication**: Will need to fetch host info from `/api/host-info` endpoint for troubleshooting modal:
   - Can use `window.api.backend.url()` IPC call or direct HTTP fetch
   - Cache result to avoid excessive API calls

4. **CSS Styling**: Currently uses "flash-warning" class with red/orange animation - need to:
   - Add "connected" state styling (green, no flash)
   - Keep "disconnected" state with flash animation
   - Smooth transitions between states

5. **Real-time Updates**: wsConnected state already updates in real-time when WebSocket connects/disconnects, so button will automatically reflect current status

## Critical Files to Inspect Before Implementation
1. `src/components/TopNavigation.tsx` - Button location and current implementation
2. `src/components/QuizHost.tsx` - wsConnected state and how it's managed
3. `src/components/RootLayout.tsx` or main layout - Component hierarchy to understand state flow
4. `src/utils/AuthContext.tsx` - Existing context pattern to follow
5. `electron/backend/server.js` - `/api/host-info` endpoint details

## Success Criteria
- Button stops flashing (changes to solid state) when WebSocket is connected
- Button continues flashing when WebSocket is disconnected
- Clicking button opens troubleshooting modal with:
  - Current connection status (connected/disconnected)
  - Local host IP address
  - WebSocket URL
  - Troubleshooting steps
  - Debug information
- Button automatically updates in real-time as connection status changes
- No errors in browser console related to missing state/context
