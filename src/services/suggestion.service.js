/**
 * Tenant-learned triage suggestions (Task-Intelligence-lite, MD ITSM-02/10).
 *
 * No ML infrastructure: TF-IDF cosine similarity over the tenant's OWN
 * resolved/closed tickets. Suggestions improve as the tenant resolves more
 * tickets — department, topic, priority + similar past tickets with scores.
 * Pure functions (tokenize/score) are unit-tested; fetchTrainingSet hits Mongo.
 */

const Ticket = require('../models/helpdesk/tickets/Ticket');

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'had',
  'are', 'was', 'were', 'been', 'will', 'would', 'could', 'should', 'there',
  'their', 'what', 'when', 'where', 'which', 'while', 'about', 'into',
  'please', 'thanks', 'thank', 'hello', 'dear', 'regards', 'help', 'need',
  'issue', 'problem', 'error', 'unable', 'cannot', 'cant', 'wont', 'just',
  'like', 'get', 'got', 'also', 'need', 'needs', 'needed', 'using', 'used',
  'not', 'no', 'yes',
  'nos', 'para', 'con', 'una', 'por', 'como', 'pero', 'todo',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function termFreq(tokens) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

/**
 * Score one candidate doc against query tokens with TF-IDF cosine.
 * idf computed from the training corpus document frequencies.
 */
function cosineScore(queryTf, docTf, docFreq, corpusSize) {
  let dot = 0;
  let qNorm = 0;
  let dNorm = 0;
  const idf = (term, df) => Math.log(1 + corpusSize / (1 + (df || 0)));
  for (const [term, qtf] of queryTf) {
    const w = idf(term, docFreq.get(term));
    qNorm += (qtf * w) ** 2;
    const dtf = docTf.get(term) || 0;
    if (dtf) {
      dot += qtf * w * dtf * w;
      dNorm += (dtf * w) ** 2;
    }
  }
  // Terms only in the doc still contribute to doc norm (proper cosine).
  for (const [term, dtf] of docTf) {
    if (!queryTf.has(term)) {
      const w = idf(term, docFreq.get(term));
      dNorm += (dtf * w) ** 2;
    }
  }
  if (!qNorm || !dNorm) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm));
}

function docText(doc) {
  return [doc.title, doc.subject, doc.body, doc.description].filter(Boolean).join('\n');
}

/**
 * suggest({ text, docs, topN }) — docs: [{ _id, number, title, subject,
 * body, description, dept, deptName, topic, topicName, priority }].
 * Returns ranked label votes + similar tickets, all with 0..1 scores.
 */
function suggest({ text, docs = [], topN = 5 }) {
  const queryTokens = tokenize(text);
  if (!queryTokens.length || !docs.length) {
    return { department: [], topic: [], priority: [], similar: [] };
  }
  const queryTf = termFreq(queryTokens);
  const prepared = docs.map((d) => ({ doc: d, tf: termFreq(tokenize(docText(d))) }));
  const docFreq = new Map();
  for (const { tf } of prepared) {
    for (const term of tf.keys()) docFreq.set(term, (docFreq.get(term) || 0) + 1);
  }
  const scored = prepared
    .map(({ doc, tf }) => ({ doc, score: cosineScore(queryTf, tf, docFreq, prepared.length) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const vote = (keyFn, nameFn) => {
    const acc = new Map();
    for (const { doc, score } of scored.slice(0, 20)) {
      const key = keyFn(doc);
      if (!key) continue;
      const cur = acc.get(key) || { id: key, name: nameFn(doc) || key, score: 0 };
      cur.score += score;
      acc.set(key, cur);
    }
    const total = [...acc.values()].reduce((s, v) => s + v.score, 0) || 1;
    return [...acc.values()]
      .map((v) => ({ ...v, score: Math.round((v.score / total) * 100) / 100 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  };

  const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || v) : v ? String(v) : '');
  return {
    department: vote((d) => idOf(d.dept), (d) => d.deptName),
    topic: vote((d) => idOf(d.topic) || d.category, (d) => d.topicName || d.category),
    priority: vote((d) => d.priority, (d) => d.priority),
    similar: scored.slice(0, topN).map(({ doc, score }) => ({
      id: String(doc._id),
      number: doc.number,
      title: doc.title || doc.subject,
      score: Math.round(score * 100) / 100,
    })),
  };
}

// Simple per-tenant cache so repeated triage doesn't rescan history.
const trainingCache = new Map(); // tenantId -> { at, docs }
const TRAIN_TTL_MS = 5 * 60 * 1000;

async function fetchTrainingSet(tenantId, limit = 500) {
  const key = String(tenantId);
  const hit = trainingCache.get(key);
  if (hit && Date.now() - hit.at < TRAIN_TTL_MS) return hit.docs;
  const docs = await Ticket.find({ company: tenantId, status: { $in: ['resolved', 'closed'] } })
    .select('number title subject body dept topic priority category')
    .populate('dept', 'name')
    .populate('topic', 'topic name')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  const shaped = docs.map((d) => ({
    ...d,
    deptName: (d.dept && d.dept.name) || undefined,
    topicName: (d.topic && (d.topic.topic || d.topic.name)) || undefined,
  }));
  trainingCache.set(key, { at: Date.now(), docs: shaped });
  return shaped;
}

function invalidateTraining(tenantId) {
  trainingCache.delete(String(tenantId));
}

module.exports = { tokenize, cosineScore, termFreq, suggest, fetchTrainingSet, invalidateTraining, STOPWORDS };
