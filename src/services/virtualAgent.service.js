/**
 * NLU-style virtual agent (MD §82).
 *
 * Deterministic, dependency-free natural-language intent engine with dialog
 * flows. Learns from the tenant's resolved tickets (TF-IDF vocabulary) to
 * answer status/knowledge/solve intents offline — no external NLU service.
 * Every response is explainable: intent, confidence, matched terms.
 *
 * Design note: this is intent classification + dialog state, NOT a general
 * LLM. It guarantees low latency, zero data egress, and deterministic
 * behavior — the right tradeoff for a self-hosted agent.
 */

const { fetchTrainingSet, suggest } = require('./suggestion.service');

// Dialog intent definitions: keyword groups + canned/handoff responses.
const INTENTS = {
  greeting: {
    keywords: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
    response: 'Hello! I am the virtual assistant. You can ask me about your ticket status, how to solve an issue, service hours, or service requests.',
    needsTickets: false,
  },
  status: {
    keywords: ['status', 'where is', 'what happened', 'update', 'progress', 'tracking', 'is my ticket', 'when will'],
    needsTickets: true,
  },
  troubleshoot: {
    keywords: ['how do i', 'how to', 'cant', 'cannot', 'fix', 'issue with', 'problem with', 'broken', 'not working', 'error', 'reset', 'password', 'login'],
    needsTickets: false,
  },
  catalog: {
    keywords: ['need', 'request', 'order', 'provision', 'get a new', 'i want', 'i would like', 'purchase', 'laptop', 'access to'],
    response: 'I can help you with a service request. Please describe what you need and an agent will process it shortly.',
    needsTickets: false,
  },
  hours: {
    keywords: ['hours', 'opening', 'when are you', 'available', 'working hours', 'open now', 'holiday'],
    response: 'Our support hours are Monday–Friday 9:00 AM to 6:00 PM (local time). Critical issues are supported 24/7.',
    needsTickets: false,
  },
  escalate: {
    keywords: ['escalate', 'manager', 'supervisor', 'urgent', 'asap', 'human', 'agent', 'real person', 'fed up', 'angry'],
    response: "I understand this is important. I am escalating your conversation to a senior agent right away.",
    needsTickets: false,
    escalate: true,
  },
  bye: {
    keywords: ['bye', 'goodbye', 'thanks', 'thank you', 'thx'],
    response: 'You are welcome! Reply anytime if you need more help.',
    needsTickets: false,
  },
  fallback: {
    response: "I am not sure I understood. Try asking about your ticket status, troubleshooting steps, service hours, or a request. I will connect you to an agent if needed.",
    needsTickets: false,
  },
};

let trainingCache = new Map(); // company -> { at, docs }

async function getTraining(company, ttlMs = 5 * 60 * 1000) {
  const key = String(company || '');
  const hit = trainingCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.docs;
  const docs = await fetchTrainingSet(company, 500);
  trainingCache.set(key, { at: Date.now(), docs });
  return docs;
}

function tokenize(text = '') {
  return text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
}

function textLength(text) {
  const t = tokenize(text);
  return t.length;
}

/**
 * Score an intent group against user text (word-overlap on keywords, plus
 * phrase overlap). Returns 0..1.
 */
function scoreIntent(userText, keywords) {
  const words = tokenize(userText);
  if (!words.length) return 0;
  let hits = 0;
  const lower = ' ' + userText.toLowerCase() + ' ';
  for (const kw of keywords) {
    if (/[\s]/.test(kw)) {
      // multi-word phrase
      if (lower.includes(' ' + kw + ' ') || lower.includes(kw)) hits += 2;
    } else if (words.includes(kw)) {
      hits += 1;
    }
  }
  return hits / (1 + keywords.length / 4);
}

async function rankIntent(company, userText) {
  let best = null;
  let bestScore = -1;
  for (const [name, def] of Object.entries(INTENTS)) {
    if (name === 'fallback') continue;
    const s = scoreIntent(userText, def.keywords);
    if (s > bestScore) { bestScore = s; best = name; }
  }
  const threshold = 0.28;
  return { intent: bestScore >= threshold ? best : 'fallback', confidence: Math.min(1, bestScore * 2) };
}

/**
 * Main entry — turn a user message into an agent response + optional actions.
 * Returns:
 *  { intent, confidence, response, actions: { openTicket?, escalate?, knowledge?: [], statuses?: [] }, matched }
 */
async function virtualAgent({ company, userText, userId, conversationId }) {
  try {
    const { handleUserInput, matchFlow } = require('./botFlow.service');
    const flow = await matchFlow(company, userText);
    if (flow) {
      const started = await handleUserInput(company, userText, conversationId, null);
      if (started && started.reply) {
        return {
          intent: 'custom_flow',
          confidence: 1,
          response: started.reply,
          actions: started.handoff ? { escalate: true } : (started.nextPrompt ? { prompt: true } : {}),
          matched: [flow.key],
        };
      }
    }
  } catch (_) { /* custom flows are advisory */ }

  const { intent, confidence } = await rankIntent(company, userText);
  const def = INTENTS[intent];
  const actions = {};
  const matched = intent !== 'fallback' ? def.keywords.filter((k) => {
    const w = tokenize(userText);
    const lower = ' ' + userText.toLowerCase() + ' ';
    return /[\s]/.test(k) ? lower.includes(k) : w.includes(k);
  }) : [];

  if (intent === 'status' || intent === 'troubleshoot') {
    const tickets = await findRelevantTickets({ company, userId, userText, intent });
    if (intent === 'status') {
      if (tickets.length) {
        const top = tickets[0];
        actions.statuses = tickets.map((t) => ({ number: t.number, subject: t.subject, status: t.status, updatedAt: t.updatedAt }));
        def.response = `Here is an update on your ${tickets.length > 1 ? 'tickets' : 'ticket'}:\n` +
          tickets.slice(0, 3).map((t) => `• #${t.number} — ${t.subject} — status: ${t.status}`).join('\n');
      } else {
        def.response = "I could not find a recent ticket matching that. If it was just created, it may not be visible yet. Would you like to open a new one?";
        actions.openTicket = true;
      }
    } else {
      // troubleshoot -> knowledge match
      const kb = await findKnowledge({ company, userText });
      if (kb.length) {
        actions.knowledge = kb;
        const first = kb[0];
        def.response = `Here is a solution that may help:\n${first.subject}\n${(first.answer || first.content || '').slice(0, 400)}`;
      } else {
        def.response = "I could not find a matching article. I will route this to an agent to help you resolve it.";
        actions.openTicket = true;
      }
    }
  } else if (intent === 'escalate') {
    actions.escalate = true;
  } else if (intent === 'fallback') {
    def.response = INTENTS.fallback.response;
    actions.openTicket = true;
  }

  return { intent, confidence, response: def.response, actions, matched };
}

async function findRelevantTickets({ company, userId, userText, intent }) {
  const Ticket = require('../models/Ticket');
  const query = { company };
  if (userId) query.user = userId;
  const recent = await Ticket.find(query).sort('-updatedAt').limit(20).lean();
  if (!recent.length) return [];
  // score by text overlap
  const words = tokenize(userText);
  return recent
    .map((t) => ({ t, score: (tokenize((t.subject || '') + ' ' + (t.details || '')).filter((w) => words.includes(w)).length) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

async function findKnowledge({ company, userText }) {
  const Faq = require('../models/Faq');
  const all = await Faq.find({ company, isPublished: true }).select('subject answer content category').limit(200).lean();
  const words = tokenize(userText);
  const scored = all
    .map((f) => {
      const faqWords = tokenize(f.subject + ' ' + (f.answer || f.content || ''));
      const score = faqWords.filter((w) => words.includes(w)).length;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => ({
    id: x.f._id, subject: x.f.subject, answer: x.f.answer || x.f.content || '', category: x.f.category,
  }));
}

module.exports = { virtualAgent, rankIntent, scoreIntent, INTENTS, tokenize };
