// Browser-only ESM quiz loader

function getText(el: Element | null): string {
  return (el?.textContent || "").trim();
}

function $(parent: Element | Document | null, tag: string): Element | null {
  if (!parent) return null;
  const els = (parent as Element).getElementsByTagName?.(tag) ||
              (parent as Document).getElementsByTagName?.(tag);
  return els && els.length ? (els[0] as Element) : null;
}

function $all(parent: Element | Document | null, tag: string): Element[] {
  if (!parent) return [];
  const els = (parent as Element).getElementsByTagName?.(tag) ||
              (parent as Document).getElementsByTagName?.(tag);
  return Array.from(els) as Element[];
}

function letterToIndex(letter: string): number | undefined {
  const i = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(letter.trim().toUpperCase());
  return i >= 0 ? i : undefined;
}

function sniffMime(bytes: Uint8Array): string {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  if (bytes.length > 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return "image/gif";
  return "application/octet-stream";
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function toDataUrlFromBase64(b64: string): string {
  const bytes = base64ToBytes(b64);
  const mime = sniffMime(bytes);
  return `data:${mime};base64,${b64}`;
}

function parseQuestion(qEl: Element, roundGame: string) {
  const q = getText($(qEl, "q"));
  const userView = getText($(qEl, "user_view"));
  const shortAns = getText($(qEl, "short_answer"));
  const longAns = getText($(qEl, "long_answer"));
  const options = $all($(qEl, "options"), "option").map((el) => getText(el));
  const pictureB64 = getText($(qEl, "picture"));

  let type: string;
  if (userView === "multi") type = "multi";
  else if (userView === "letters") type = "letters";
  else if (userView === "numbers") type = roundGame === "Nearest Wins" ? "nearest" : "numbers";
  else if (userView === "sequence") type = "sequence";
  else type = roundGame === "Nearest Wins" ? "nearest" : "buzzin";

  let answerText: string | undefined = longAns || undefined;
  let correctIndex: number | undefined;

  if (type === "multi" && options.length) {
    if (/^[A-Za-z]$/.test(shortAns)) {
      const i = letterToIndex(shortAns);
      if (i !== undefined && i < options.length) {
        correctIndex = i;
        if (!answerText) answerText = options[i];
      }
    } else if (shortAns) {
      const i = options.findIndex(
        (o) => o.trim().toLowerCase() === shortAns.trim().toLowerCase()
      );
      if (i >= 0) {
        correctIndex = i;
        if (!answerText) answerText = options[i];
      }
    } else if (answerText) {
      const i = options.findIndex(
        (o) => o.trim().toLowerCase() === answerText!.trim().toLowerCase()
      );
      if (i >= 0) correctIndex = i;
    }
  }

  if (type === "letters") {
    // Helper to extract the first letter, stripping "The " prefix
    const extractLetter = (text: string): string | undefined => {
      if (!text) return undefined;
      const stripped = text.replace(/^The\s+/i, "").trim();
      if (stripped) {
        const firstChar = stripped[0].toUpperCase();
        if (/^[A-Za-z]$/.test(firstChar)) {
          return firstChar;
        }
      }
      return undefined;
    };

    let letter: string | undefined;
    if (/^[A-Za-z]$/.test(shortAns)) {
      letter = shortAns.toUpperCase();
      if (!answerText) answerText = letter;
    } else if (shortAns) {
      letter = extractLetter(shortAns);
    } else if (answerText) {
      letter = extractLetter(answerText);
    }

    if (letter) {
      const i = letterToIndex(letter);
      if (i !== undefined) {
        correctIndex = i;
      }
    }
  }

  const imageDataUrl = pictureB64 ? toDataUrlFromBase64(pictureB64) : undefined;

  return {
    type,
    q,
    answerText,
    options: options.length ? options : undefined,
    correctIndex,
    imageDataUrl,
    meta: { short_answer: shortAns || undefined, user_view: userView || undefined },
  } as const;
}

// ─── Regex-based fallback parser for .sqb files ──────────────────────
// Used when XML parsing fails (bare &, encoding issues, etc.)

function extractTagContent(content: string, tagName: string): string {
  const match = content.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSqbWithRegex(raw: string) {
  console.log('[quizLoader] Using regex fallback parser for .sqb file');

  // Extract round-level metadata
  const gameMatch = raw.match(/<game>([\s\S]*?)<\/game>/i);
  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/i);
  const gameVarMatch = raw.match(/<game_variation>([\s\S]*?)<\/game_variation>/i);

  const game = gameMatch ? decodeXmlEntities(gameMatch[1].trim()) : 'Unknown';
  const title = titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : undefined;
  const gameVariation = gameVarMatch ? decodeXmlEntities(gameVarMatch[1].trim()) : undefined;

  // Extract all questions using regex
  const questionRegex = /<question>([\s\S]*?)<\/question>/gi;
  const questions: any[] = [];
  let match;
  while ((match = questionRegex.exec(raw)) !== null) {
    const qContent = match[1];
    const q = extractTagContent(qContent, 'q');
    const longAns = extractTagContent(qContent, 'long_answer');
    const shortAns = extractTagContent(qContent, 'short_answer');
    const userView = extractTagContent(qContent, 'user_view');
    const pictureB64Raw = qContent.match(/<picture>([\s\S]*?)<\/picture>/i);
    const pictureB64 = pictureB64Raw ? pictureB64Raw[1].trim() : '';

    // Extract options
    const optionsBlock = qContent.match(/<options>([\s\S]*?)<\/options>/i);
    const options: string[] = [];
    if (optionsBlock) {
      const optRegex = /<option>([\s\S]*?)<\/option>/gi;
      let optMatch;
      while ((optMatch = optRegex.exec(optionsBlock[1])) !== null) {
        options.push(decodeXmlEntities(optMatch[1].trim()));
      }
    }

    // Determine question type
    let type: string;
    if (userView === 'multi') type = 'multi';
    else if (userView === 'letters') type = 'letters';
    else if (userView === 'numbers') type = game === 'Nearest Wins' ? 'nearest' : 'numbers';
    else if (userView === 'sequence') type = 'sequence';
    else type = game === 'Nearest Wins' ? 'nearest' : 'buzzin';

    let answerText: string | undefined = longAns || undefined;
    let correctIndex: number | undefined;

    // Handle multiple choice
    if (type === 'multi' && options.length) {
      if (shortAns && /^[A-Za-z]$/.test(shortAns)) {
        const i = letterToIndex(shortAns);
        if (i !== undefined && i < options.length) {
          correctIndex = i;
          if (!answerText) answerText = options[i];
        }
      } else if (shortAns) {
        const i = options.findIndex(
          (o) => o.trim().toLowerCase() === shortAns.trim().toLowerCase()
        );
        if (i >= 0) {
          correctIndex = i;
          if (!answerText) answerText = options[i];
        }
      } else if (answerText) {
        const i = options.findIndex(
          (o) => o.trim().toLowerCase() === answerText!.trim().toLowerCase()
        );
        if (i >= 0) correctIndex = i;
      }
    }

    // Handle letters type
    if (type === 'letters') {
      const extractLetter = (text: string): string | undefined => {
        if (!text) return undefined;
        const stripped = text.replace(/^The\s+/i, '').trim();
        if (stripped) {
          const firstChar = stripped[0].toUpperCase();
          if (/^[A-Za-z]$/.test(firstChar)) return firstChar;
        }
        return undefined;
      };

      let letter: string | undefined;
      if (shortAns && /^[A-Za-z]$/.test(shortAns)) {
        letter = shortAns.toUpperCase();
        if (!answerText) answerText = letter;
      } else if (shortAns) {
        letter = extractLetter(shortAns);
      } else if (answerText) {
        letter = extractLetter(answerText);
      }

      if (letter) {
        const i = letterToIndex(letter);
        if (i !== undefined) correctIndex = i;
      }
    }

    const imageDataUrl = pictureB64 ? toDataUrlFromBase64(pictureB64) : undefined;

    questions.push({
      type,
      q,
      answerText,
      options: options.length ? options : undefined,
      correctIndex,
      imageDataUrl,
      meta: { short_answer: shortAns || undefined, user_view: userView || undefined },
    });
  }

  console.log('[quizLoader] Regex parser found', questions.length, 'questions');
  return { game, title, gameVariation, questions };
}

export function parseQuizXmlString(xml: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  // Check for XML parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    console.warn('[quizLoader] XML parse error detected:', parseError.textContent?.substring(0, 200));
  }

  const rounds = doc.getElementsByTagName("round");
  if (!rounds.length) throw new Error("Invalid file: missing <round>");

  // Load the first round's metadata
  const firstRound = rounds[0];
  const game = getText($(firstRound, "game")) || "Unknown";
  const title = getText($(firstRound, "title")) || undefined;
  const gameVariation = getText($(firstRound, "game_variation")) || undefined;

  // Load ALL questions from ALL rounds
  const allQuestions: any[] = [];
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    let qEls = $all($(round, "questions"), "question");
    if (!qEls.length) qEls = $all(round, "question");

    const roundGame = getText($(round, "game")) || game;
    const roundQuestions = qEls.map((q) => parseQuestion(q, roundGame));
    allQuestions.push(...roundQuestions);
  }

  return { game, title, gameVariation, questions: allQuestions };
}

// ─── .popq (ZIP of .pop files) support ───────────────────────────────

/** Read a little-endian uint16 from a DataView */
function readU16(dv: DataView, off: number): number {
  return dv.getUint16(off, true);
}
/** Read a little-endian uint32 from a DataView */
function readU32(dv: DataView, off: number): number {
  return dv.getUint32(off, true);
}

/**
 * Parse a ZIP archive (ArrayBuffer) and extract all .pop file contents as XML strings.
 * Uses browser-native DecompressionStream for deflate-raw decompression.
 */
async function parsePopqZip(buf: ArrayBuffer): Promise<string[]> {
  const bytes = new Uint8Array(buf);
  const dv = new DataView(buf);
  const results: string[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const sig = readU32(dv, offset);
    if (sig !== 0x04034b50) break; // not a local file header

    const method = readU16(dv, offset + 8);
    const compSize = readU32(dv, offset + 18);
    const uncompSize = readU32(dv, offset + 22);
    const nameLen = readU16(dv, offset + 26);
    const extraLen = readU16(dv, offset + 28);

    const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen);
    const fileName = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;
    const rawData = bytes.slice(dataStart, dataStart + compSize);

    if (/\.pop$/i.test(fileName)) {
      let xmlString: string;
      if (method === 0) {
        // stored (no compression)
        xmlString = new TextDecoder("utf-8").decode(rawData);
      } else if (method === 8) {
        // deflate
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();

        writer.write(rawData);
        writer.close();

        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLen = chunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let pos = 0;
        for (const c of chunks) {
          merged.set(c, pos);
          pos += c.length;
        }
        xmlString = new TextDecoder("utf-8").decode(merged);
      } else {
        console.warn(`Skipping ${fileName}: unsupported compression method ${method}`);
        offset = dataStart + compSize;
        continue;
      }
      results.push(xmlString);
    }

    offset = dataStart + compSize;
  }

  if (results.length === 0) {
    throw new Error("No .pop files found inside the .popq archive");
  }
  return results;
}

/** Map .pop type values to internal type strings */
function mapPopType(popType: string, roundGame?: string): string {
  switch (popType) {
    case "multiple_choice": return "multi";
    case "letters": return "letters";
    case "numbers": return "numbers";
    case "sequence": return "sequence";
    case "nearest_wins": return "nearest";
    default: return "buzzin";
  }
}

/** Parse a single .pop round XML string into a title and array of questions */
function parsePopRoundXml(xml: string): { title: string; questions: ReturnType<typeof parseQuestion>[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  const root = doc.getElementsByTagName("pop_round")[0];
  if (!root) throw new Error("Invalid .pop file: missing <pop_round>");

  const title = getText($(root, "title")) || "Untitled Round";
  const items = $all($(root, "items") || root, "item");

  const questions = items.map((item) => {
    const q = getText($(item, "text"));
    const popType = getText($(item, "type"));
    const type = mapPopType(popType);
    const answerTextEl = getText($(item, "answer_text"));
    const longAns = getText($(item, "long_answer"));
    const optEls = $all(item, "opt");
    const options = optEls.length ? optEls.map((el) => getText(el)) : undefined;
    const pictureB64 = getText($(item, "picture"));

    let answerText: string | undefined = longAns || answerTextEl || undefined;
    let correctIndex: number | undefined;

    if (type === "multi" && options?.length) {
      // answer_text is typically the letter "A", "B", "C", "D"
      if (answerTextEl && /^[A-Za-z]$/.test(answerTextEl)) {
        const i = letterToIndex(answerTextEl);
        if (i !== undefined && i < options.length) {
          correctIndex = i;
          answerText = longAns || options[i];
        }
      } else if (answerTextEl) {
        const i = options.findIndex(
          (o) => o.trim().toLowerCase() === answerTextEl.trim().toLowerCase()
        );
        if (i >= 0) {
          correctIndex = i;
          if (!answerText) answerText = options[i];
        }
      }
    }

    if (type === "letters") {
      const extractLetter = (text: string): string | undefined => {
        if (!text) return undefined;
        const stripped = text.replace(/^The\s+/i, "").trim();
        if (stripped) {
          const firstChar = stripped[0].toUpperCase();
          if (/^[A-Za-z]$/.test(firstChar)) return firstChar;
        }
        return undefined;
      };

      let letter: string | undefined;
      if (answerTextEl && /^[A-Za-z]$/.test(answerTextEl)) {
        letter = answerTextEl.toUpperCase();
        if (!answerText) answerText = letter;
      } else if (answerTextEl) {
        letter = extractLetter(answerTextEl);
      } else if (longAns) {
        letter = extractLetter(longAns);
      }

      if (letter) {
        const i = letterToIndex(letter);
        if (i !== undefined) correctIndex = i;
      }
    }

    const imageDataUrl = pictureB64 ? toDataUrlFromBase64(pictureB64) : undefined;

    return {
      type,
      q,
      answerText,
      options,
      correctIndex,
      imageDataUrl,
      meta: { short_answer: answerTextEl || undefined, user_view: popType || undefined },
    } as const;
  });

  return { title, questions };
}

/** Determine overall game type from a flat list of question types */
function detectGameType(questions: { type: string }[]): string {
  const types = new Set(questions.map((q) => q.type));
  if (types.size === 1) {
    const only = [...types][0];
    switch (only) {
      case "nearest": return "Nearest Wins";
      case "letters": return "Letters";
      case "multi": return "Multiple Choice";
      case "numbers": return "Numbers";
      case "sequence": return "Sequence";
      default: return "Mixed";
    }
  }
  return "Mixed";
}

export async function loadQuizFromFile(file: File | string) {
  if (typeof File !== "undefined" && file instanceof File) {
    // Detect .sqb files - they wrap XML in <html> tags that need stripping
    if (/\.sqb$/i.test(file.name)) {
      let raw = await file.text();
      console.log('[quizLoader] Loading .sqb file, raw length:', raw.length);

      // Strip BOM if present
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.substring(1);
      }

      // Preprocess for XML parsing
      let preprocessed = raw;
      // Strip <html> wrapper
      preprocessed = preprocessed.replace(/^<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '');
      // Ensure XML declaration is at the very start if present
      const xmlDeclMatch = preprocessed.match(/<\?xml[^?]*\?>/);
      if (xmlDeclMatch) {
        preprocessed = preprocessed.replace(/<\?xml[^?]*\?>/, '');
        preprocessed = xmlDeclMatch[0] + preprocessed;
      }
      // Escape unescaped & characters that break XML parsing
      preprocessed = preprocessed.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, '&amp;');

      // Try XML parsing first
      try {
        const result = parseQuizXmlString(preprocessed);
        if (result.questions.length > 0) {
          console.log('[quizLoader] XML parsing succeeded with', result.questions.length, 'questions');
          return result;
        }
        console.warn('[quizLoader] XML parsing returned 0 questions, falling back to regex parser');
      } catch (e) {
        console.warn('[quizLoader] XML parsing failed, falling back to regex parser:', e);
      }

      // Fallback: regex-based parsing (handles malformed XML, encoding issues, etc.)
      return parseSqbWithRegex(raw);
    }

    // Detect .popq files by extension
    if (/\.popq$/i.test(file.name)) {
      const buf = await file.arrayBuffer();
      const popXmls = await parsePopqZip(buf);
      const allQuestions: ReturnType<typeof parseQuestion>[] = [];
      let firstTitle = "";

      for (const xml of popXmls) {
        const round = parsePopRoundXml(xml);
        if (!firstTitle) firstTitle = round.title;
        allQuestions.push(...round.questions);
      }

      const game = detectGameType(allQuestions);
      return {
        game,
        title: firstTitle || undefined,
        gameVariation: undefined,
        questions: allQuestions,
      };
    }

    const xml = await file.text();
    return parseQuizXmlString(xml);
  }

  if (typeof file === "string") {
    if (file.trim().startsWith("<")) {
      return parseQuizXmlString(file);
    }
    throw new Error("Path loading is only supported in the Electron build");
  }

  throw new Error("Pass a File or XML string in the browser.");
}
