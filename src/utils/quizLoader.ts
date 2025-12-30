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
  else if (userView === "numbers") type = "nearest";
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
    if (/^[A-Za-z]$/.test(shortAns)) {
      const i = letterToIndex(shortAns);
      if (i !== undefined) {
        correctIndex = i;
        if (!answerText) answerText = shortAns.toUpperCase();
      }
    } else if (answerText && /^[A-Za-z]$/.test(answerText)) {
      const i = letterToIndex(answerText);
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

export function parseQuizXmlString(xml: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
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

export async function loadQuizFromFile(file: File | string) {
  if (typeof File !== "undefined" && file instanceof File) {
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
