// quizLoader.js

function getText(el) {
  return (el && el.textContent ? el.textContent : "").trim();
}
function $(el, sel) {
  return el.querySelector(sel);
}
function $all(el, sel) {
  return Array.from(el.querySelectorAll(sel));
}
function letterToIndex(letter) {
  const i = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(letter.trim().toUpperCase());
  return i >= 0 ? i : undefined;
}

// Detect file type for images
function sniffMime(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  if (bytes.length > 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return "image/gif";
  return "application/octet-stream";
}

// Convert Base64 to bytes
function base64ToBytes(b64) {
  if (typeof atob !== "undefined") {
    const bin = atob(b64.replace(/\s+/g, ""));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  } else {
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
}

// Convert Base64 image to data URL
function toDataUrlFromBase64(b64) {
  const bytes = base64ToBytes(b64);
  const mime = sniffMime(bytes);
  return `data:${mime};base64,${b64}`;
}

// ---------- Parse one <question> ----------
function parseQuestion(qEl, roundGame) {
  const q = getText($(qEl, "q"));
  const userView = getText($(qEl, "user_view"));
  const shortAns = getText($(qEl, "short_answer"));
  const longAns = getText($(qEl, "long_answer"));
  const options = $all(qEl, "options > option").map(getText);
  const pictureB64 = getText($(qEl, "picture"));

  // Decide question type
  let type;
  if (userView === "multi") type = "multi";
  else if (userView === "letters") type = "letters";
  else if (userView === "numbers") type = "nearest";
  else if (userView === "sequence") type = "sequence";
  else type = roundGame === "Nearest Wins" ? "nearest" : "buzzin";

  let answerText = longAns || undefined;
  let correctIndex;

  // Handle multiple choice options
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
        (o) => o.trim().toLowerCase() === answerText.trim().toLowerCase()
      );
      if (i >= 0) correctIndex = i;
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
    meta: {
      short_answer: shortAns || undefined,
      user_view: userView || undefined,
    },
  };
}

// ---------- Parse entire XML file ----------
function parseQuizXmlString(xml) {
  let parser;

  if (typeof DOMParser !== "undefined") {
    // Browser
    parser = new DOMParser();
  } else {
    // Node.js environment - use xmldom
    const { DOMParser } = require("xmldom");
    parser = new DOMParser();
  }

  const doc = parser.parseFromString(xml, "application/xml");
  const round = doc.querySelector("round");
  if (!round) throw new Error("Invalid file: missing <round>");

  const game = getText($(round, "game")) || "Unknown";
  const title = getText($(round, "title")) || undefined;
  const gameVariation = getText($(round, "game_variation")) || undefined;

  const qEls = $all(round, "questions > question").length
    ? $all(round, "questions > question")
    : $all(round, "question");

  const questions = qEls.map((q) => parseQuestion(q, game));
  return { game, title, gameVariation, questions };
}

// ---------- Load a quiz file ----------
async function loadQuizFromFile(fileOrPath) {
  if (typeof File !== "undefined" && fileOrPath instanceof File) {
    // Browser
    const xml = await fileOrPath.text();
    return parseQuizXmlString(xml);
  }

  if (typeof fileOrPath === "string") {
    // Node/Electron
    const fs = require("fs/promises");
    const xml = await fs.readFile(fileOrPath, "utf-8");
    return parseQuizXmlString(xml);
  }

  throw new Error("Pass a File (browser) or string path (Node).");
}

// ---------- Export for Node ----------
module.exports = { loadQuizFromFile, parseQuizXmlString };
