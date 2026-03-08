# Export Image Scaling Review

## Summary
The current `exportLeaderboardImage` implementation in `src/components/LeaderboardReveal.tsx` already handles dynamic team counts correctly. No changes are strictly required.

## Scaling Analysis
- **Canvas height formula**: `headerHeight (160) + teams.length * rowHeight (52) + footerHeight (50) + padding (80)`
- **4 teams** → 498px tall — compact, clean
- **100 teams** → 5,490px tall — well within browser canvas max (~32,767px)
- Font sizes, row heights, and layout remain consistent regardless of team count

## Optional Improvement: Team Name Truncation
Long team names could overlap the score column. If desired, add text measurement via `ctx.measureText()` and truncate with ellipsis when the name exceeds the available width (~430px between the name column start and score column).

## File to Modify
- `src/components/LeaderboardReveal.tsx` — only if adding the optional name truncation
