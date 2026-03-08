# Add Pop Quiz Logo to Leaderboard Export Image

## Summary
Add the Pop Quiz logo image to the canvas-rendered leaderboard export image that gets downloaded as a PNG.

## File to Modify
- `src/components/LeaderboardReveal.tsx` — the `exportLeaderboardImage()` function (line 19)

## Current Behavior
The function draws a canvas with:
- Dark background (#1a1a2e)
- Orange gradient top bar
- "POP QUIZ" as text (bold 48px Arial) at the top
- "LEADERBOARD" subtitle
- Team rows with rank, name, score
- Small "popquiz" watermark at the bottom

## Approach
1. Load the logo image from the provided URL into an `Image` object before drawing the canvas
2. Draw the logo at the top of the canvas (centered), replacing or supplementing the text "POP QUIZ"
3. Keep the logo reasonably sized (e.g., ~120px tall) so it doesn't overwhelm the leaderboard data
4. The rest of the leaderboard layout stays the same — just shift content down slightly if needed to accommodate the logo

### Implementation Details
- Use `new Image()` with `crossOrigin = 'anonymous'` to load the logo from the CDN URL
- Wrap the canvas drawing in the image's `onload` callback to ensure the logo is ready
- Draw the logo centered horizontally at the top, scaled proportionally to fit ~120px height
- Remove or keep the "POP QUIZ" text — since the logo already says "POP QUIZ", the text can be removed to avoid duplication
- Keep the "LEADERBOARD" subtitle below the logo
- Adjust `headerHeight` to account for the logo dimensions

### Logo URL
```
https://cdn.builder.io/api/v1/image/assets%2Ffc9fa4b494f14138b58309dabb6bd450%2Fb0568b833d844f8db7ee325b5de9e5fb?format=webp&width=800&height=1200
```

Note: Canvas requires the image in a compatible format. The URL returns webp which should work in modern browsers. We'll set `crossOrigin = 'anonymous'` for CORS compliance.
