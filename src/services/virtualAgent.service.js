/* eslint-disable no-console */
// Virtual agent intent engine — DB-free keyword/phrase intent ranking
// (MD §82 dialog designer / §ITSM-05). Pure logic, no model dependencies.
const STOP = new Set(["the", "a", "an", "to", "i", "me", "my", "and", "or"]);

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];
}

function scoreIntent(text, keywords) {
  const source = ` ${tokenize(text)
    .filter((w) => !STOP.has(w))
    .join(" ")} `;
  const phraseSpace = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const raw of keywords) {
    const kw = String(raw || "").trim().toLowerCase();
    if (!kw) continue;
    const words = tokenize(kw);
    if (words.length > 1) {
      if (phraseSpace.includes(` ${kw} `) || source.includes(` ${kw} `)) score += 2;
      else if (words.every((w) => source.includes(` ${w} `))) score += 1;
    } else if (source.includes(` ${kw} `)) {
      score += 2;
    }
  }
  return score;
}

const INTENT_PATTERNS = {
  greeting: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "greetings"],
  status: ["status", "where is", "tracking", "progress", "where's", "update on", "what is the status", "check my", "ticket status"],
  troubleshoot: ["reset", "how do i", "fix", "repair", "broken", "not working", "printer", "password", "help with", "troubleshoot", "error", "freeze", "crash"],
  catalog: ["want", "need", "new", "buy", "order", "provision", "request a", "laptop", "monitor", "phone", "software", "license", "access"],
  escalate: ["escalate", "urgent", "manager", "supervisor", "senior", "immediately"],
  bye: ["bye", "goodbye", "thanks", "thank you", "that's all", "that is all", "see you"],
};

const INTENT_ORDER = ["escalate", "status", "troubleshoot", "catalog", "greeting", "bye"];

function rankIntent(ctx, text) {
  const scored = Object.entries(INTENT_PATTERNS)
    .map(([intent, keywords]) => ({
      intent,
      score: scoreIntent(text, keywords),
    }))
    .sort((a, b) => b.score - a.score || INTENT_ORDER.indexOf(a.intent) - INTENT_ORDER.indexOf(b.intent));
  const top = scored[0];
  const bestScore = top.score;
  const total = scored.reduce((acc, s) => acc + s.score, 0);
  const intent = bestScore > 0 ? top.intent : "fallback";
  const confidence = bestScore > 0 ? Math.min(1, bestScore / Math.max(1, total)) : 0;
  return Promise.resolve({
    intent,
    confidence: Number(confidence.toFixed(3)),
    matched: bestScore > 0 ? scored.filter((s) => s.score > 0) : [],
  });
}

module.exports = { tokenize, scoreIntent, rankIntent, INTENT_PATTERNS };