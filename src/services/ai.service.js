/**
 * Assistant summarization hooks (MD ITSM-01/15).
 *
 * Two-tier design — honest about what runs where:
 *  1. Extractive summarizer (default, offline): sentence scoring by term
 *     frequency over the record's own thread. No data leaves the tenant.
 *  2. LLM path (opt-in): if AI_API_URL + AI_API_KEY are set, an
 *     OpenAI-compatible chat endpoint is tried first with a short timeout;
 *     ANY failure falls back to (1). The response always reports `provider`.
 *
 * Nothing here trains on or transmits tenant data unless the operator
 * explicitly configures an LLM endpoint.
 */

const { tokenize } = require('./suggestion.service');

const PROVIDER = process.env.AI_PROVIDER || 'extractive';
const API_URL = process.env.AI_API_URL || '';
const API_KEY = process.env.AI_API_KEY || '';
const API_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const LLM_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20000;

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(#])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 600);
}

function extractiveSummary(texts, maxSentences = 5) {
  const sentences = [];
  for (const t of texts) sentences.push(...splitSentences(t));
  if (!sentences.length) return { summary: '', sentences: [] };
  const freq = new Map();
  for (const s of sentences) {
    for (const tok of new Set(tokenize(s))) freq.set(tok, (freq.get(tok) || 0) + 1);
  }
  const scored = sentences.map((s, i) => {
    const toks = tokenize(s);
    if (!toks.length) return { s, i, score: 0 };
    const score = toks.reduce((a, t) => a + (freq.get(t) || 0), 0) / Math.sqrt(toks.length);
    return { s, i, score };
  });
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, maxSentences))
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  return { summary: top.join(' '), sentences: top };
}

async function llmSummary(prompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: API_MODEL,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: 'Summarize the support record thread for an agent. Reply with 3-6 concise sentences: current state, key facts, latest ask. No preamble.' },
          { role: 'user', content: prompt.slice(0, 12000) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('LLM empty response');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * summarizeThread({ title, entries, maxSentences }) — entries:
 * [{ author, type, body, createdAt }]. Returns
 * { provider, summary, participants, counts }.
 */
async function summarizeThread({ title = '', entries = [], maxSentences = 5 }) {
  const texts = entries.map((e) => e.body || e.content || '').filter(Boolean);
  const participants = [...new Set(entries.map((e) => (e.author && (e.author.name || e.author)) || 'system'))];
  const counts = {
    messages: entries.length,
    replies: entries.filter((e) => e.type !== 'note').length,
    notes: entries.filter((e) => e.type === 'note').length,
  };
  const headed = [`Ticket: ${title}`, ...texts].filter((t) => t && t !== 'Ticket: ');
  if (PROVIDER !== 'extractive' && API_URL && API_KEY) {
    try {
      const summary = await llmSummary(headed.join('\n\n'));
      return { provider: 'llm', summary, participants, counts };
    } catch (_) {
      // fall through to extractive
    }
  }
  const { summary } = extractiveSummary(headed, maxSentences);
  return { provider: 'extractive', summary, participants, counts };
}

module.exports = { summarizeThread, extractiveSummary, splitSentences };
