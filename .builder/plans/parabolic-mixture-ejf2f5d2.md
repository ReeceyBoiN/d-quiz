# Plan: Add .popq File Format Support

## Background

The `.popq` file is a **ZIP archive** containing multiple `.pop` files, each representing a quiz round. The `.pop` files contain XML with a different schema than the existing `.sqb`/`.sqq`/`.sqn` formats.

### Existing Format (`.sqb`/`.sqq`/`.sqn`)
- Single XML file with `<round>` root element
- Questions in `<question>` elements under `<questions>`
- Question text in `<q>` tag
- Options in `<option>` tags
- Answer in `<short_answer>` / `<long_answer>` tags
- Type in `<user_view>` tag (values: "multi", "letters", "numbers", "sequence")

### New Format (`.popq` → `.pop` files)
- ZIP containing multiple `.pop` XML files (one per round)
- `<pop_round>` root element
- Questions in `<item num="N">` elements under `<items>`
- Question text in `<text>` tag
- Options in `<opt label="A">` tags
- Answer in `<answer_text>` / `<long_answer>` tags
- Type in `<type>` tag (values: "letters", "multiple_choice", "numbers", "sequence", "nearest_wins")
- Metadata: `<format_version>`, `<title>`, `<generated_at>`, `<question_count>`

### File Inspected: `12-03-2026.popq`
Contains 4 rounds:
1. **Round 1** (20 questions) - mixed letters, multiple_choice, numbers, sequence
2. **Round 2** (20 questions) - mixed letters, multiple_choice
3. **Round 3** (20 questions) - mixed letters, multiple_choice, numbers
4. **Nearest Wins** (1 question) - nearest_wins type

Total: 61 questions across 4 rounds.

## Implementation Plan

### Step 1: Add ZIP extraction capability to `src/utils/quizLoader.ts`

Since no ZIP library exists in the project, use the browser's native `DecompressionStream` API (or a lightweight manual ZIP parser using the approach already proven in our test script — reading local file headers and `zlib.inflateRaw` equivalent via `DecompressionStream`).

Add a new function `parsePopqZip(arrayBuffer: ArrayBuffer)` that:
- Reads ZIP local file headers to find `.pop` entries
- Decompresses each entry using `DecompressionStream('deflate-raw')`
- Returns array of XML strings (one per round)

### Step 2: Add `.pop` XML parser to `src/utils/quizLoader.ts`

Add `parsePopRoundXml(xml: string)` function that:
- Parses `<pop_round>` XML using DOMParser
- Extracts round title from `<title>`
- Maps each `<item>` to a `LoadedQuizQuestion`:
  - `<type>` mapping:
    - `"multiple_choice"` → `"multi"`
    - `"letters"` → `"letters"`
    - `"numbers"` → `"numbers"`
    - `"sequence"` → `"sequence"`
    - `"nearest_wins"` → `"nearest"`
  - `<text>` → `q`
  - `<opt>` elements → `options[]`
  - `<answer_text>` → `answerText` + compute `correctIndex` for multi (letter-based like "A", "B", etc.)
  - `<long_answer>` → `answerText` (fallback)
  - `meta.short_answer` / `meta.user_view` populated from type/answer

### Step 3: Add `.popq` loading entry point in `src/utils/quizLoader.ts`

Update `loadQuizFromFile()` to detect `.popq` files:
- If file name ends with `.popq`, read as ArrayBuffer
- Call `parsePopqZip()` to extract `.pop` XML strings
- Call `parsePopRoundXml()` on each
- Combine all rounds' questions into a single questions array
- Determine `game` type from the round types (mixed = "mixed", all letters = "letters", etc.)
- Return same `{ game, title, questions }` structure as existing loader

### Step 4: Update file input to accept `.popq` extension

In `src/components/QuestionDisplay.tsx`:
- Add `.popq` to the `accept` attribute on the file input (line 119): `.sqq,.sqn,.sqb,.popq`
- Add `.popq` to the regex pattern for file clicking (line 155): `/\.(sqq|sqn|sqb|popq)$/i`

### Step 5: Update `useQuizLoader.ts` to handle `.popq` detection

The `isBuzzinPack` detection currently checks `quiz.game?.toLowerCase() === 'buzzin'`. For `.popq` files with mixed round types, this needs to check the actual question types present. Since `.popq` packs are general quiz packs (not exclusively buzz-in), they should set `isBuzzinPack = false` and `isQuizPack = true` by default.

The game type detection should look at the round types:
- If all questions are "nearest" type → game = "Nearest Wins"
- If all questions are "letters" → game = "Letters"  
- If mixed types → game = "Mixed" (treated as general quiz pack)

## Files to Modify

1. **`src/utils/quizLoader.ts`** — Add ZIP extraction, `.pop` XML parser, and `.popq` entry point
2. **`src/components/QuestionDisplay.tsx`** — Add `.popq` to accepted file types (2 locations)
3. **`src/utils/useQuizLoader.ts`** — Minor update if needed for game type detection

## Notes

- No new dependencies needed — browser-native `DecompressionStream` handles ZIP deflate
- The `.popq` format preserves round boundaries via separate `.pop` files, but the current app flattens all questions into a single array (same as existing `.sqb` behavior)
- Question type mapping is straightforward since both formats support the same game modes
- For multiple choice questions, the `.pop` format uses letter answers ("A", "B", "C", "D") which maps directly to index (A=0, B=1, etc.)
