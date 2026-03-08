# Export Leaderboard Image Feature

## Summary
Implement the "Export Image" button in `LeaderboardReveal.tsx` to generate and download a PNG scoreboard image showing all teams, their scores/rankings, and the Popquiz logo.

## Approach: Canvas API (No New Dependencies)
Use the browser's built-in **Canvas API** to draw the scoreboard image programmatically. This avoids adding any new npm dependencies (like html2canvas or dom-to-image) and gives full control over the layout.

The image will be generated off-screen and downloaded as a `.png` file via a temporary download link (`<a>` tag with `download` attribute). Since this runs in a browser/Electron context, the file will be saved to the user's default downloads location (typically Desktop or Downloads folder).

## Image Design
- **Header**: "POP QUIZ" logo text at the top (styled in the app's orange brand color `#f39c12`, matching the existing branding throughout the app)
- **Subtitle**: "LEADERBOARD" beneath the logo
- **Scoreboard rows**: Each team listed in rank order (1st to last) showing:
  - Position number with medal emoji for top 3 (🥇🥈🥉)
  - Team name
  - Score (right-aligned)
- **Styling**: Dark background (`#2c3e50`) matching the app's theme, with clear contrast for readability
- **Footer**: Small "popquiz" watermark at the bottom

## Files to Modify

### `src/components/LeaderboardReveal.tsx`
- Replace the placeholder `console.log` in the Export Image button's `onClick` handler with a function that:
  1. Creates an off-screen `<canvas>` element
  2. Draws the "POP QUIZ" branding/logo at the top
  3. Draws column headers (Rank, Team, Score)
  4. Iterates through `sortedTeams` (already available in component state, sorted by score) and draws each row
  5. Converts the canvas to a PNG blob
  6. Triggers a browser download of the file (e.g. `PopQuiz_Leaderboard.png`)

No other files need to be modified. All data (`quizzes` prop, `sortedTeams` state) is already available in the component.
