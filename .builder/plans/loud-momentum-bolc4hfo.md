# Plan: Expand External Display Question Bubble for Better Readability

## Problem Statement
The question bubble on the external display (livescreen) appears cramped with:
- Too much dead space on the left/right (narrow bubble width)
- Text packed too tightly (insufficient internal padding)
- Text difficult to read due to tight spacing

The bubble should use more of the available screen width and have more breathing room inside.

## Root Causes Identified
1. **Width Constraints**: 
   - In `question-with-timer` mode: maxWidth is hardcoded to `600px` (line 498) when no image present
   - This is too restrictive and doesn't utilize available screen space
   
2. **Internal Padding**:
   - Current padding is `16px` on all sides (lines 504, 750)
   - This is too small relative to content, making text feel squished
   
3. **Line Height**:
   - Line-height is `1.2` (lines 515, 757) which is quite tight
   - Should be increased to `1.4-1.5` for better readability with larger bubbles

4. **Option Spacing**:
   - Option padding is `12px` (lines 784) to `16px` (line 544)
   - Option gaps are `12px` to `16px` 
   - These are adequate but should scale with bubble expansion

## Recommended Changes

### For 'question-with-timer' case (lines 493-606):
1. **Increase internal bubble padding**: `16px` → `32px` (line 504)
   - Gives text more breathing room on all sides
   
2. **Increase/remove width constraint**: 
   - Remove or increase the `600px` maxWidth (line 498)
   - Change `maxWidth: '600px'` → `maxWidth: '85%'` or `'90%'`
   - This allows bubble to use more of available screen width while maintaining some margin
   
3. **Increase line-height**:
   - Change `lineHeight: '1.2'` → `lineHeight: '1.4'` (line 515)
   - Improves vertical spacing between lines

4. **Increase option padding** (optional refinement):
   - Change padding from `isMobileSize ? '10px' : '16px'` → `isMobileSize ? '14px' : '20px'` (line 544)
   - Matches the larger bubble aesthetic

### For 'question' case (lines 744-801):
1. **Increase internal bubble padding**: `16px` → `40px` (line 750)
   - Gives more breathing room around title and question text
   
2. **Increase line-height**:
   - Change `lineHeight: '1.2'` → `lineHeight: '1.4'` (line 757)
   - Better readability with more space between text lines

3. **Expand options container**:
   - Change option padding from `'12px'` → `'18px'` (line 784)
   - Change gap from `'12px'` → `'16px'` (line 768)
   - Creates more breathing room between option buttons

### Additional Considerations
- Keep the `maxWidth: '1400px'` on the content wrapper (line 748) for the 'question' case - this is already appropriate
- The `maxWidth: '90vw'` on question text (line 757) may need adjustment if padding increases significantly, but it should work fine with `lineHeight: 1.4`
- Text scaling via `scaleFontSize()` will still work correctly with increased padding/line-height

## Visual Impact
- Bubble will expand horizontally to use ~85-90% of screen width
- Internal padding increases from 16px to 32-40px creates visible breathing room
- Line-height increase from 1.2 to 1.4 makes text less cramped vertically
- Overall effect: much more readable, less claustrophobic display

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx` (lines 498, 504, 515, 544, 750, 757, 768, 784)

## Testing Strategy
After changes:
1. Verify question displays with good width utilization (not narrow)
2. Check text readability with increased spacing
3. Ensure option buttons are still clickable and properly spaced
4. Test with different text size settings (small/medium/large)
5. Verify no text overflow or layout breaks
6. Check on both quiz-pack and normal keypad modes
