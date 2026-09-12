const Ticket = require("../models/helpdesk/tickets/Ticket");

const RESOLVED_STATUSES = ["resolved", "closed", "archived"];
let trainingCache = new Map();

async function fetchTrainingSet(company) {
  const key = company ? String(company) : "*";
  const cached = trainingCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.docs;

  const query = { status: { $in: RESOLVED_STATUSES } };
  if (company) query.company = company;
  const docs = await Ticket.find(query)
    .select(
      "number subject title body department dept topic priority tags intent resolution",
    )
    .sort({ resolvedAt: -1, updatedAt: -1 })
    .limit(500)
    .lean();
  trainingCache.set(key, { docs, expiresAt: Date.now() + 60 * 1000 });
  return docs;
}

function tokenize(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) || [],
  );
}

function score(text, doc) {
  const query = tokenize(text);
  const source = tokenize(
    [
      doc.subject,
      doc.title,
      doc.body,
      doc.intent,
      ...(doc.tags || []),
      doc.resolution && doc.resolution.solution,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!query.size || !source.size) return 0;
  let matches = 0;
  query.forEach((token) => {
    if (source.has(token)) matches += 1;
  });
  return matches / query.size;
}

function topVote(docs, field, confidence) {
  const votes = new Map();
  docs.forEach((doc) => {
    const value = doc[field] || (field === "dept" ? doc.department : null);
    if (value) votes.set(String(value), (votes.get(String(value)) || 0) + 1);
  });
  const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  return winner
    ? {
        value: winner[0],
        confidence:
          Math.min(1, winner[1] / Math.max(1, docs.length)) * confidence,
      }
    : null;
}

function suggest({ text, docs }) {
  const ranked = docs
    .map((doc) => ({ doc, score: score(text, doc) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const matches = ranked.map(({ doc, score: confidence }) => ({
    ticketNumber: doc.number,
    subject: doc.subject || doc.title || "",
    confidence: Number(confidence.toFixed(3)),
  }));
  const candidates = ranked.map((item) => item.doc);
  return {
    department: topVote(candidates, "dept", ranked[0] ? ranked[0].score : 0),
    topic: topVote(candidates, "topic", ranked[0] ? ranked[0].score : 0),
    priority: topVote(candidates, "priority", ranked[0] ? ranked[0].score : 0),
    matches,
  };
}

function invalidateTraining(company) {
  if (company) trainingCache.delete(String(company));
  else trainingCache.clear();
}

module.exports = { fetchTrainingSet, suggest, invalidateTraining };
