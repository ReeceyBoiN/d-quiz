# Responsive Scaling Strategy for Quiz Application

## Goal
Implement intelligent scaling and layout adaptation for all visual elements to work seamlessly from 800x600 to 4K resolutions and across all aspect ratios (16:9, 4:3, portrait, square, etc.).

## Current State
- **Mixed approaches**: Tailwind utilities + inline styles + JS viewport checks
- **Inconsistent breakpoints**: useIsMobile uses 768px, ExternalDisplayWindow uses 1024px
- **Fixed sizes throughout**: Images (160-300px), sidebars (345px), buttons (h-16 w-16)
- **Brittle scaling**: transform: scale() hacks that break at unusual aspect ratios
- **No unified strategy**: Scaling rules scattered across components

## Recommended Approach: Hybrid Responsive System

### Phase 1: Foundation (Unified Scaling System)

**1.1 Create Responsive Breakpoints Utility**
- Location: `src/utils/responsiveConfig.ts`
- Define centralized, shared breakpoints used by both Tailwind and JS
- Breakpoints:
  - `xs`: 640px (mobile phones)
  - `sm`: 768px (tablets)
  - `md`: 1024px (laptops/monitors)
  - `lg`: 1440px (large monitors)
  - `xl`: 1920px (full HD)
  - `2xl`: 3840px (4K)
- Export constants for JS usage, remove hardcoded values (768, 1024)

**1.2 Create Responsive Typography System**
- Use CSS `clamp()` for fluid typography that scales with viewport
- Pattern: `clamp(minSize, preferredSize, maxSize)`
- Example: `font-size: clamp(0.875rem, 2vw, 2.5rem)` scales from 14px to 40px
- Create utility classes in `tailwind.config.js`:
  - `text-fluid-sm`, `text-fluid-base`, `text-fluid-lg`, `text-fluid-xl`, `text-fluid-2xl`
  - For display titles: `text-fluid-display` with very large clamp ranges

**1.3 Create Responsive Sizing Utilities**
- Location: `src/utils/responsiveSizing.ts`
- Helper functions for common responsive patterns:
  - `responsiveSize(mobileValue, tabletValue, desktopValue, largeValue)` → returns object with Tailwind classes
  - `fluidSize(minPx, prefVw, maxPx)` → returns clamp() string for width/height
  - `aspectRatioSize(width, aspectRatio)` → calculates responsive dimensions
- Export hooks:
  - `useResponsiveValue(mobileValue, desktopValue)` → returns appropriate value based on screen size
  - `useContainerScale()` → returns scale factor (0.5 to 2.0) based on viewport vs expected size

### Phase 2: External Display Scaling (Projector/Large Screen)

**2.1 Replace Brittle transform: scale() with Fluid Layout**
- **File**: `src/components/ExternalDisplayWindow.tsx`
- **Problem**: Current timer overlay uses `transform: 'scale(0.425)'` which breaks at unusual aspect ratios
- **Solution**: 
  - Use CSS Grid or Flexbox with max-width/max-height constraints instead of transform: scale()
  - Replace fixed sizes (30rem, 12rem) with responsive units
  - Use clamp() for responsive sizing: `max(150px, min(50vw, 500px))`
  - Adapt layout (center content better for tall/wide screens)

**2.2 Responsive Typography for Displays**
- Replace hard-coded inline font sizes with clamp()
- Examples:
  - Question titles: `clamp(2rem, 6vw, 5rem)` (scales from 32px to 80px)
  - Team names: `clamp(1.5rem, 8vw, 4rem)` (scales from 24px to 64px)
  - Answer text: `clamp(1rem, 3vw, 2.5rem)` (scales from 16px to 40px)
  - Timer numbers: `clamp(3rem, 15vw, 10rem)` (scales from 48px to 160px)

**2.3 Aspect Ratio Adaptation**
- Detect if display is portrait, landscape, or square using aspect-ratio media queries
- For portrait (height > width): rearrange layouts vertically, reduce padding
- For square: center content, balanced padding
- For ultra-wide (>2.5:1): spread content horizontally with larger gaps

**2.4 Responsive Grid/Container Layout**
- Replace fixed pixel dimensions with percentage-based widths and max-width constraints
- For option grids: use `repeat(auto-fit, minmax(100px, 1fr))` instead of hard-coded counts
- For images: max-width and max-height with aspect-ratio preservation

### Phase 3: Host Control Screen Scaling

**3.1 Flexible Sidebar Sizing**
- **File**: `src/components/QuizHost.tsx`
- Current: Fixed 345px default, resizable to 200-600px
- **New behavior**:
  - Desktop (lg+): Keep current resizable behavior (200-600px)
  - Tablet (sm-md): Set default to 25% of window width, max 300px
  - Mobile (xs): Collapse to icon-only or hidden, add toggle button
  - Never let sidebar exceed 50% of screen width at any resolution

**3.2 Responsive Panels and Sidebars**
- **Files**: `src/components/LeftSidebar.tsx`, `src/components/RightPanel.tsx`
- Right panel current: `w-80` (fixed 320px)
- **New**: Use responsive width: `w-80 lg:w-96 xl:max-w-[25vw]`
- Ensure panels don't compress main content below readable sizes
- At small sizes: stack vertically or hide non-critical panels

**3.3 Responsive Button and Control Sizing**
- **File**: `src/components/KeypadInterface.tsx`
- Current: Fixed `h-16 w-16` buttons
- **New**: Add responsive Tailwind classes
  - `h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-20 lg:w-20`
  - Ensures buttons are always tappable and readable at any size

**3.4 Image Preview Sizing**
- **Files**: `src/components/KeypadInterface.tsx`, `src/components/QuestionPanel.tsx`
- Current: Fixed 160x240px or 300x450px
- **New**: Use max-width/max-height with aspect-ratio
  - Pattern: `max-w-[20vw] max-h-[50vh] aspect-[2/3] object-contain`
  - For external display: `max-w-[30vw] max-h-[70vh] aspect-[2/3]`

### Phase 4: Smart Responsive Utilities

**4.1 Create useResponsiveBreakpoint Hook**
- Location: `src/hooks/useResponsiveBreakpoint.ts`
- Returns current breakpoint name based on window width
- Used to conditionally render different layouts
- Replaces individual `window.innerWidth` checks scattered throughout code

**4.2 Create useViewportRatio Hook**
- Location: `src/hooks/useViewportRatio.ts`
- Returns aspect ratio of current viewport (width / height)
- Detects: portrait (ratio < 1), landscape (ratio > 1.2), square (1-1.2)
- Can be used to conditionally adjust layouts

**4.3 Centralize Media Query Usage**
- Create `src/styles/responsive.css` with custom media queries
- Use CSS variables for breakpoints
- Apply consistent spacing, padding scaling at each breakpoint

### Phase 5: Implementation Priority

**High Priority** (addresses main visual scaling issues):
1. ExternalDisplayWindow fluid sizing and clamp() typography
2. Unified breakpoints and remove hardcoded values
3. Image sizing responsiveness (max-width/max-height)

**Medium Priority** (improves usability):
4. Responsive button sizing
5. Sidebar responsive behavior
6. Responsive panels

**Low Priority** (polish):
7. Aspect ratio detection and layout optimization
8. Advanced scaling utilities

## Key Design Decisions

1. **Clamp() over Media Queries**: For typography and non-critical sizing, prefer CSS `clamp()` for continuous scaling rather than discrete breakpoints
2. **Percentage-based over Fixed Pixels**: Use width/height percentages, vw/vh, and max-constraints instead of fixed px where possible
3. **Aspect Ratio Preservation**: Always use `aspect-ratio` CSS property to maintain proportions when scaling images/containers
4. **Tailwind as Primary**: Use Tailwind utilities first (responsive classes, max-width), inline styles only when necessary
5. **Container-based Scaling**: Size based on container width/height, not just viewport (better for responsive components)

## Critical Files to Modify

1. **Foundation**: 
   - Create: `src/utils/responsiveConfig.ts`
   - Create: `src/utils/responsiveSizing.ts`
   - Create: `src/hooks/useResponsiveBreakpoint.ts`
   - Modify: `tailwind.config.js`

2. **High Impact**:
   - `src/components/ExternalDisplayWindow.tsx` (timer sizing, typography, layout)
   - `src/components/KeypadInterface.tsx` (button sizes, image preview)
   - `src/components/QuizHost.tsx` (sidebar, panel sizing)

3. **Supporting**:
   - `src/components/QuestionPanel.tsx` (image sizing)
   - `src/components/QuizPackDisplay.tsx` (display scaling)
   - `src/components/CircularTimer.tsx` (proportional sizing)
   - `src/components/ui/use-mobile.ts` (update to use unified breakpoints)

## Expected Outcomes

✅ 800x600 resolution: All content visible, readable (though slightly cramped)
✅ 1920x1080: Perfect scaling, normal appearance  
✅ 4K (3840x2160): Proportional scaling up, all text/controls legible
✅ Portrait (mobile): Layout reflows, stacks vertically, hidden panels collapse
✅ Unusual aspect ratios: Content centers, adapts gracefully instead of breaking
✅ Consistency: Same responsive behavior across external display and host screen

## Testing Strategy

1. Test at resolutions: 800x600, 1024x768, 1366x768, 1920x1080, 3840x2160
2. Test aspect ratios: 4:3, 16:9, 16:10, 1:1, 9:16
3. Test window resize: Smooth scaling during resize, no jump/flicker
4. Test all game modes: Keypad, Quizpack, Buzz-in, Nearest Wins, Wheel Spinner
5. Test both screens: Host and External Display at each resolution

## Implementation Order

1. Create utilities (Phase 1) → foundation for all changes
2. Fix ExternalDisplayWindow (Phase 2) → biggest visual impact
3. Fix Host screen sizing (Phase 3) → improves usability
4. Add helper hooks (Phase 4) → enables future enhancements
5. Test and iterate → fix edge cases
