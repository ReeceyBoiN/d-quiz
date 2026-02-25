# Host Remote Layout Redesign Plan

## Objective
Move the Answer Input section from the right sidebar to the center of the screen, positioned just above the timer buttons (replacing where "No Round Loaded" text is), creating a more unified and uniform layout.

## Current Layout
- Two-column flex layout in `HostTerminal/index.tsx`
- Left: GameControlsPanel with "No Round Loaded" placeholder and Timer Controls
- Right: HostRemoteKeypad with Answer Input (A, B, C, D buttons) in a fixed-width sidebar

## Target Layout
- Single-column centered full-width layout
- Top section: Answer Input (A, B, C, D buttons) centered
- Directly below: Timer Controls (Normal Timer and Silent Timer buttons)
- Remove "No Round Loaded" placeholder completely
- GameControlsPanel restructured to fit new layout

## Key Changes Required

### 1. **HostTerminal/index.tsx** (Main Layout Container)
- Change from two-column flex layout to single-column layout
- Remove the right-side fixed-width column (`w-80`)
- Restructure to stack components vertically with centered Answer Input at top
- Ensure full-width Answer Input section with proper centering

### 2. **GameControlsPanel.tsx** (Left Panel Content)
- Remove or repurpose QuestionPreviewPanel that displays "No Round Loaded"
- Keep Timer Controls functionality and buttons intact
- Move Timer Controls below the Answer Input section
- Adjust layout to work within new centered structure

### 3. **QuestionPreviewPanel.tsx**
- Either remove the "No Round Loaded" placeholder or repurpose it
- Its content will be replaced by the Answer Input section

### 4. **HostRemoteKeypad.tsx** (Answer Input)
- Will be moved from right sidebar to center/top of page
- Styling adjustments for centered layout (may need adjusted widths)
- Maintain A, B, C, D button functionality and styling

### 5. **Layout Structure**
```
┌─────────────────────────────────────┐
│   Host Controller Header             │
├─────────────────────────────────────┤
│                                     │
│      Answer Input (centered)        │
│   ┌─────────────────────────────┐   │
│   │    A    │    B              │   │
│   │    C    │    D              │   │
│   │  Confirm Answer             │   │
│   └─────────────────────────────┘   │
│                                     │
│      Timer Controls (centered)      │
│   ┌─────────────────────────────┐   │
│   │  Normal Timer │ Silent Timer │   │
│   │  ⏱️ Timer Controls (expand) │   │
│   └─────────────────────────────┘   │
│                                     │
│      Additional Game Controls       │
│                                     │
└─────────────────────────────────────┘
```

## Implementation Approach

1. Start with `HostTerminal/index.tsx` - change container from two-column to single-column centered layout
2. Update `GameControlsPanel.tsx` - remove or hide QuestionPreviewPanel, adjust Timer Controls positioning
3. Adjust `HostRemoteKeypad.tsx` styling for centered display (may need width constraints removed or modified)
4. Test the layout to ensure all buttons and controls are properly displayed and functional
5. Ensure responsive behavior is maintained

## Files to Modify
1. `src-player/src/components/HostTerminal/index.tsx` - Primary layout structure change
2. `src-player/src/components/HostTerminal/GameControlsPanel.tsx` - Restructure content and controls
3. `src-player/src/components/HostTerminal/HostRemoteKeypad.tsx` - Styling adjustments for centered layout
4. `src-player/src/components/HostTerminal/QuestionPreviewPanel.tsx` - Optional: repurpose or remove

## Dependencies to Consider
- WebSocket functionality in `useHostTerminalAPI.ts` remains unchanged
- Timer state management and button handlers remain in `GameControlsPanel.tsx`
- Answer input state and handlers remain in `HostRemoteKeypad.tsx`
- The split layout logic (`shouldRenderAnswerKeypad`) may need adjustment based on new structure
