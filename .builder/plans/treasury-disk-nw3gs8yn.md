# Wheel Spinner External Display & Scaling Fix

## Issues Identified

1. **External Display Blank Screen**: ExternalDisplayWindow receives wheel-spinner data but lacks a 'wheel-spinner' case in its renderContent switch statement, resulting in a blank display
2. **Host Display Scaling**: WheelSpinnerInterface uses fixed SVG dimensions (400x400) that don't scale responsively, causing the wheel to be cut off at the sides

## Desired Outcomes

- Host display: Responsive wheel that grows/shrinks to fit available container space
- External display: Optimized wheel rendering for large screens (simplified layout)
- Winner announcement on external display: Full-screen prominent display

## Implementation Approach

### Part 1: Fix Host Display Scaling (src/components/WheelSpinnerInterface.tsx)

**Goal**: Make the wheel responsive to container size using a viewBox approach with percentage-based sizing

**Changes**:
1. Replace fixed SVG width/height (400x400) with viewBox="0 0 400 400" for aspect ratio preservation
2. Wrap the SVG in a responsive container div that grows to fill available space
3. Apply max-width constraints to prevent excessive growth on very large screens
4. Update the SVG element to use width/height of 100% instead of fixed pixels

**Key insight**: SVG viewBox maintains proportions while CSS controls the actual rendered size, allowing responsive scaling

### Part 2: Add Wheel Spinner Rendering to External Display (src/components/ExternalDisplayWindow.tsx)

**Goal**: Implement a 'wheel-spinner' case that renders the wheel with an optimized layout for external displays

**Changes**:
1. Add a new 'wheel-spinner' case in the renderContent switch statement
2. Extract wheel rendering logic (can reuse or adapt the SVG path generation from WheelSpinnerInterface)
3. Render the wheel with responsive sizing optimized for large screens
4. Implement full-screen winner overlay when a winner is determined
5. Display spinning animation synchronized with spinDuration

**Key components**:
- Main wheel container: Responsive SVG using viewBox and viewport dimensions
- Winner overlay: Full-screen announcement with large text when displayData.wheelSpinnerData.winner is set
- Pointer indicator: Arrow showing winning segment
- Rotation animation: Use CSS transitions with spinDuration for smooth spinning

**Data contract**: ExternalDisplayWindow.renderContent will read from `displayData.wheelSpinnerData`:
- wheelItems: array of {id, label, color}
- isSpinning: boolean for animation state
- rotation: degrees (target rotation)
- spinDuration: milliseconds for transition duration
- winner: label string or null
- contentType: 'teams' | 'random-points' | 'custom'

### Part 3: Extract Wheel Rendering Helper (Optional but Recommended)

**Goal**: Avoid code duplication between host and external display implementations

**Approach**:
- Create a utility function `renderWheelSegments()` or wheel SVG renderer that both components can use
- Takes wheelItems array and returns SVG segment elements
- Location: Could be in utils folder or as a shared component

**Rationale**: If both implementations need the same visual appearance for segments, centralized logic prevents drift

## Files to Modify

1. **src/components/WheelSpinnerInterface.tsx**
   - Update SVG element to use viewBox with responsive sizing
   - Adjust container div for responsive layout
   - Test that wheel scales with container

2. **src/components/ExternalDisplayWindow.tsx**
   - Add 'wheel-spinner' case in renderContent switch statement
   - Implement responsive wheel SVG rendering
   - Add full-screen winner display logic
   - Handle animation state based on isSpinning and spinDuration

## Testing Checklist

- [ ] Host wheel scales responsively when resizing window/container
- [ ] Host wheel remains centered and doesn't get cut off at edges
- [ ] External display shows wheel spinner when entering wheel-spinner mode
- [ ] External display wheel responds to contentType changes
- [ ] External display wheel rotates with correct duration during spin
- [ ] Winner announcement displays full-screen on external display
- [ ] Winner displays on both host and external display simultaneously
- [ ] Pointer/arrow indicator works on external display wheel

## Implementation Priority

1. **High Priority**: Add wheel-spinner case to ExternalDisplayWindow (fixes blank screen issue)
2. **High Priority**: Make host wheel responsive (fixes GUI scaling issue)
3. **Nice to Have**: Extract shared wheel rendering utility to reduce duplication
