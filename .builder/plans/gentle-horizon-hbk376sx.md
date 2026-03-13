# Fix: .sqb Quiz File Loading (0 Questions)

## Problem

When loading `.sqb` quiz files, the app recognizes the game type ("Buzzin") and variation ("Advanced") but extracts **0 questions**. The console confirms:

```
✅ Quiz loaded: {game: 'Buzzin', title: undefined, gameVariation: 'Advanced', questions: Array(0)}
```

The `QuizHost` effect then skips initialization because `questions.length > 0` is false.

## Root Cause

The `.sqb` file format wraps the XML quiz data inside an `<html>` tag:

```
<html>
<?xml version="1.0" encoding="utf-8"?><round><game>Buzzin</game>...
</round>
</html>
```

When `parseQuizXmlString()` in `src/utils/quizLoader.ts` passes this to `DOMParser` with `"application/xml"` mode:

1. The `<html>` wrapper makes `<round>` a child element rather than root-level
2. The misplaced `<?xml?>` declaration (after `<html>`) is invalid XML
3. Any unescaped `&` characters in question text (common in quiz content) cause XML parse errors
4. The parser may produce a partial or error document, extracting some metadata but failing on nested `<questions>` content

## Fix

**File:** `src/utils/quizLoader.ts` — in the `loadQuizFromFile` function

Before passing the file content to `parseQuizXmlString()`, preprocess `.sqb` files to strip the HTML wrapper:

1. Remove `<html>` and `</html>` tags
2. Ensure the `<?xml?>` declaration (if present) is at the very start of the content
3. Pass the cleaned XML to `parseQuizXmlString()`

**Also update:** `quizLoader.js` (the Node.js/Electron version) with the same preprocessing, since the Electron build uses this file for file-path-based loading.

### Implementation

In `loadQuizFromFile()` in `src/utils/quizLoader.ts`, add `.sqb`-specific preprocessing:

```ts
// Inside loadQuizFromFile, after reading the file as text:
if (/\.sqb$/i.test(file.name)) {
  // .sqb files wrap XML in <html> tags - strip the wrapper
  let cleaned = xml.replace(/^<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '');
  // Ensure XML declaration is at the start if present
  const xmlDeclMatch = cleaned.match(/<\?xml[^?]*\?>/);
  if (xmlDeclMatch) {
    cleaned = cleaned.replace(/<\?xml[^?]*\?>/, '');
    cleaned = xmlDeclMatch[0] + cleaned;
  }
  return parseQuizXmlString(cleaned);
}
```

Apply the same logic in `quizLoader.js` for the Node.js path.

### Files to Modify

1. **`src/utils/quizLoader.ts`** — Add `.sqb` preprocessing in `loadQuizFromFile()` (browser path)
2. **`quizLoader.js`** — Add `.sqb` preprocessing in `loadQuizFromFile()` (Node.js/Electron path)
