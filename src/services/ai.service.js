const config = require('../config/config');

// ---------------------------------------------------------------------------
// Provider-agnostic LLM client (any OpenAI-compatible /chat/completions API)
// ---------------------------------------------------------------------------
const aiEnabled = () => !!(config.ai.provider !== 'none' && config.ai.apiKey);

async function llmComplete(messages, { maxTokens, temperature = 0.3 } = {}) {
  if (!aiEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs || 15000);
  try {
    const res = await fetch(`${config.ai.apiUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        max_tokens: maxTokens || config.ai.maxTokens || 500,
        temperature,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const parseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (err2) {
        return null;
      }
    }
    return null;
  }
};

// ---------------------------------------------------------------------------
// Heuristic fallbacks (fully offline, no API key required)
// ---------------------------------------------------------------------------
const INTENT_KEYWORDS = [
  ['password_reset', ['password', 'reset', 'forgot', 'login', 'credential', 'sign in']],
  ['refund', ['refund', 'money back', 'reimburse']],
  ['payment_failure', ['payment', 'charge', 'declined', 'card', 'transaction', 'billing', 'invoice']],
  ['connectivity', ['internet', 'network', 'wifi', 'connection', 'offline', 'down', 'disconnect']],
  ['account_access', ['account', 'locked', 'blocked', 'access', 'unauthorized']],
  ['hardware', ['laptop', 'printer', 'monitor', 'keyboard', 'device', 'server', 'machine', 'router']],
  ['software', ['install', 'update', 'upgrade', 'crash', 'error', 'application', 'app', 'software', 'license']],
  ['order', ['order', 'shipping', 'delivery', 'tracking', 'purchase']],
  ['cancel_subscription', ['cancel', 'subscription', 'unsubscribe', 'discontinue']],
  ['general', ['help', 'question', 'issue', 'problem', 'support']],
];

const NEGATIVE_KEYWORDS = ['angry', 'furious', 'terrible', 'worst', 'unacceptable', 'disappointed', 'frustrated', 'useless', 'scam', 'never', 'third time', 'sick of', 'furious', 'appalled'];
const POSITIVE_KEYWORDS = ['thanks', 'thank you', 'great', 'awesome', 'excellent', 'appreciate', 'perfect', 'love', 'works', 'solved'];
const URGENT_KEYWORDS = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'down', 'outage', 'production', 'deadline', 'hours', 'blocked'];
const TAGS_KEYWORDS = [
  ['billing', ['payment', 'invoice', 'refund', 'charge']],
  ['network', ['internet', 'wifi', 'router', 'connection', 'network']],
  ['hardware', ['laptop', 'printer', 'device', 'hardware']],
  ['software', ['install', 'update', 'crash', 'app', 'software']],
  ['security', ['password', 'login', 'access', 'account', 'hacked']],
  ['account', ['account', 'profile', 'settings']],
];

const includesAny = (text, words) => words.some((w) => text.toLowerCase().includes(w.toLowerCase()));

const detectIntent = (text) => {
  const t = (text || '').toLowerCase();
  for (const [intent, words] of INTENT_KEYWORDS) {
    if (includesAny(t, words)) return intent;
  }
  return 'general';
};

const detectSentiment = (text) => {
  const t = (text || '').toLowerCase();
  const neg = NEGATIVE_KEYWORDS.filter((w) => t.includes(w.toLowerCase())).length;
  const pos = POSITIVE_KEYWORDS.filter((w) => t.includes(w.toLowerCase())).length;
  if (neg >= 2) return 'frustrated';
  if (neg > pos) return 'negative';
  if (pos > neg) return 'positive';
  return 'neutral';
};

const detectUrgency = (text, priority = '') => {
  const t = (text || '').toLowerCase();
  if (priority === 'Emergency') return 'critical';
  if (priority === 'High') return 'high';
  if (includesAny(t, URGENT_KEYWORDS)) return 'high';
  return 'normal';
};

const detectLanguage = (text) => {
  const t = (text || '').trim();
  if (!t) return 'en';
  // crude: Latin-script -> en; else common Unicode ranges
  if (/[\u0900-\u097F]/.test(t)) return 'hi';
  if (/[\u4E00-\u9FFF]/.test(t)) return 'zh';
  if (/[\u3040-\u30FF\uAC00-\uD7AF]/.test(t)) return 'ja';
  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  if (/[\u0400-\u04FF]/.test(t)) return 'ru';
  return 'en';
};

const extractEntities = (text) => {
  const entities = {};
  const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (email) entities.email = email[0];
  const phone = text.match(/(\+?\d[\d\s\-()]{7,}\d)/);
  if (phone) entities.phone = phone[0].trim();
  const ip = text.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/);
  if (ip) entities.ip = ip[0];
  const invoice = text.match(/\b(INV|INV-[A-Z0-9]+|inv\.?\s?\d+)\b/i);
  if (invoice) entities.invoice = invoice[0];
  const order = text.match(/\b(ORD|SO|PO)[- ]?\d{3,}\b/i) || text.match(/\border[ -]?#?\d{3,}\b/i);
  if (order) entities.order = order[0];
  const account = text.match(/\b(acct|accnt|account)[ -]?#?\d{3,}\b/i);
  if (account) entities.account = account[0];
  return entities;
};

const tokenize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'this', 'that', 'you', 'your', 'have', 'has', 'are', 'was', 'not', 'but', 'from', 'please', 'help', 'issue'].includes(w));

const textSimilarity = (a, b) => {
  const ta = tokenize(a);
  if (!ta.length) return 0;
  const tb = new Set(tokenize(b));
  const hits = ta.filter((w) => tb.has(w)).length;
  return hits / ta.length;
};

const detectTags = (text) => {
  const t = (text || '').toLowerCase();
  return TAGS_KEYWORDS.filter(([tag, words]) => includesAny(t, words)).map(([tag]) => tag);
};

const priorityFromUrgency = (urgency) =>
  ({ low: 'Low', normal: 'Normal', high: 'High', critical: 'Emergency' }[urgency] || 'Normal');

const KB_STOPWORDS = new Set(['the', 'and', 'for', 'with', 'your', 'have', 'this', 'that', 'please', 'help', 'issue', 'problem', 'ticket', 'need', 'want', 'able']);

// ---------------------------------------------------------------------------
// Public AI APIs
// ---------------------------------------------------------------------------
async function analyze(text) {
  const safeText = (text || '').slice(0, 6000);
  if (aiEnabled()) {
    const json = parseJson(await llmComplete([
      {
        role: 'system',
        content:
          'You are a helpdesk AI analyst. Analyze the customer message and return ONLY JSON with keys: intent, sentiment (positive|neutral|negative|frustrated), urgency (low|normal|high|critical), language, category, complexity (low|medium|high), entities (object), tags (array).',
      },
      { role: 'user', content: safeText },
    ]));
    if (json && json.intent) {
      return {
        ...json,
        entities: json.entities || extractEntities(safeText),
        tags: Array.isArray(json.tags) ? json.tags : detectTags(safeText),
      };
    }
  }
  const sentiment = detectSentiment(safeText);
  const urgency = detectUrgency(safeText);
  return {
    intent: detectIntent(safeText),
    sentiment,
    urgency,
    language: detectLanguage(safeText),
    category: detectIntent(safeText),
    complexity: urgency === 'critical' || sentiment === 'frustrated' ? 'high' : 'medium',
    entities: extractEntities(safeText),
    tags: detectTags(safeText),
  };
}

async function summarize(text) {
  const safeText = (text || '').slice(0, 6000);
  if (aiEnabled()) {
    const out = await llmComplete([
      {
        role: 'system',
        content: 'You are a helpdesk copilot. Summarize the customer issue in 2 sentences, plain English, no preamble.',
      },
      { role: 'user', content: safeText },
    ]);
    if (out) return out.trim();
  }
  const first = safeText.replace(/\s+/g, ' ').trim();
  return first.length > 220 ? `${first.slice(0, 220)}...` : first;
}

async function replySuggestions(ticketText, customerHistory = '') {
  if (aiEnabled()) {
    const json = parseJson(await llmComplete([
      {
        role: 'system',
        content:
          'You are a customer-support AI drafting agent replies. Return ONLY JSON: {"suggestions": ["...", "..."]} with 3 short empathetic replies addressing the issue, asking any missing details.',
      },
      { role: 'user', content: `Customer: ${(ticketText || '').slice(0, 3000)}${customerHistory ? `\nHistory: ${customerHistory.slice(0, 2000)}` : ''}` },
    ]));
    if (json && Array.isArray(json.suggestions)) return json.suggestions;
  }
  const t = (ticketText || '').toLowerCase();
  if (includesAny(t, ['password', 'forgot', 'reset'])) {
    return [
      'Thanks for reaching out. To reset your password, use the "Forgot Password" link on the login page — we will email you a secure reset link.',
      'We are happy to help. Can you confirm your registered email address so we can verify your account?',
      'Once verified, we will send a password reset link to your email on file.',
    ];
  }
  if (includesAny(t, ['payment', 'refund', 'charge'])) {
    return [
      'Thank you for contacting us about this payment matter. We have started reviewing the transaction details you provided.',
      'Could you share the last 4 digits of the card or the transaction reference so we can locate the payment quickly?',
      'We will keep you updated as soon as we have more information from the billing team.',
    ];
  }
  if (includesAny(t, ['internet', 'wifi', 'connection', 'down'])) {
    return [
      'Sorry for the connection trouble. Could you try restarting your router and confirm whether other devices are affected?',
      'Please share your service address so our network team can check for outages in your area.',
      'Once we confirm, we will escalate to the network team if the issue persists.',
    ];
  }
  return [
    'Thank you for reaching out. We have received your request and are looking into it.',
    'Could you provide any additional details or error messages you are seeing?',
    'We will get back to you shortly with an update.',
  ];
}

async function kbRecommendations(text, company, limit = 4) {
  const Faq = require('../models/Faq');
  const safeText = (text || '').slice(0, 3000);
  const comp = company ? { company } : {};
  const faqs = await Faq.find({ ...comp, isPublished: true, lifecycle: 'published' }).lean();
  const scored = faqs
    .map((f) => ({ id: f._id, question: f.question, score: textSimilarity(safeText, `${f.question} ${f.answer}`) }))
    .filter((f) => f.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (scored.length >= limit) return scored;
  // AI-assisted expansion
  if (aiEnabled()) {
    const json = parseJson(await llmComplete([
      {
        role: 'system',
        content: `Given a customer issue, pick the most relevant FAQ titles from this list. Return ONLY JSON: {"ids": ["<exact title>", ...]} up to ${limit}.`,
      },
      { role: 'user', content: `Issue: ${safeText}\nFAQs: ${faqs.map((f) => f.question).join(' | ')}` },
    ]));
    if (json && Array.isArray(json.ids)) {
      for (const title of json.ids) {
        if (scored.length >= limit) break;
        const f = faqs.find((x) => x.question === title);
        if (f && !scored.some((s) => String(s.id) === String(f._id))) scored.push({ id: f._id, question: f.question, score: 0.5 });
      }
    }
  }
  return scored;
}

async function similarTickets(ticketText, company, excludeId, limit = 4) {
  const Ticket = require('../models/Ticket');
  const tickets = await Ticket.find({
    company,
    _id: { $ne: excludeId },
    status: { $in: ['closed', 'archived'] },
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  return tickets
    .map((t) => ({
      number: t.number,
      subject: t.subject,
      status: t.status,
      resolution: (t.aiSummary || '').slice(0, 200),
      score: Math.round(textSimilarity(ticketText, t.subject) * 100),
    }))
    .filter((t) => t.score > 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function rewrite(text, tone = 'professional') {
  if (aiEnabled()) {
    const out = await llmComplete([
      { role: 'system', content: `Rewrite the agent message in a ${tone} tone. Output only the rewritten message.` },
      { role: 'user', content: text },
    ]);
    if (out) return out.trim();
  }
  return text;
}

async function translate(text, targetLang = 'en') {
  if (aiEnabled() && targetLang && targetLang !== 'en') {
    const out = await llmComplete([
      { role: 'system', content: `Translate the following to ${targetLang}. Output only the translation.` },
      { role: 'user', content: text },
    ]);
    if (out) return out.trim();
  }
  return text;
}

async function handoffSummary(ticket, thread) {
  const body = `${ticket.subject}\n${thread.map((x) => `[${x.posterType || x.type}] ${x.title || ''} ${x.body || ''}`).join('\n')}`.slice(0, 6000);
  if (aiEnabled()) {
    const out = await llmComplete([
      {
        role: 'system',
        content:
          'You are writing an internal handoff summary for a support ticket. Return ONLY JSON: {"summary": "...", "nextSteps": ["..."], "risks": ["..."]} in 3 bullet next steps.',
      },
      { role: 'user', content: body },
    ]);
    const json = parseJson(out);
    if (json && json.summary) return json;
  }
  const intent = detectIntent(body);
  const sentiment = detectSentiment(body);
  return {
    summary: `${ticket.subject} — ${intent} issue, customer sentiment ${sentiment}.`,
    nextSteps: ['Read full thread', 'Contact customer with update', 'Resolve once confirmed'],
    risks: [],
  };
}

async function resolutionSummary(ticket, thread) {
  const body = thread.map((x) => x.body || '').join(' ').slice(0, 6000);
  if (aiEnabled()) {
    const out = await llmComplete([
      {
        role: 'system',
        content: 'Write a concise resolution summary for a closed support ticket (1-2 sentences). Output only the summary.',
      },
      { role: 'user', content: body },
    ]);
    if (out) return out.trim();
  }
  const intent = detectIntent(body);
  const kb = await kbRecommendations(body, ticket.company, 1);
  const base = kb.length ? `Resolved by applying: ${kb[0].question}.` : 'Issue was resolved after agent assistance.';
  return `Customer ${ticket.user ? 'reported' : 'contacted'} about ${intent}. ${base}`;
}

/**
 * AI auto-resolution: when confident, answer from the KB directly.
 * Returns null when the ticket should go to a human.
 */
async function autoResolve(ticketText, company) {
  const kb = await kbRecommendations(ticketText, company, 3);
  if (kb.length) {
    const Faq = require('../models/Faq');
    const top = kb[0];
    const faq = await Faq.findById(top.id).lean();
    if (faq) {
      let confidence = top.score;
      if (aiEnabled()) {
        const json = parseJson(await llmComplete([
          { role: 'system', content: 'Return ONLY JSON: {"confidence": 0.0-1.0, "answer": "<paraphrased answer or empty>"} deciding if the FAQ answers the customer issue.' },
          { role: 'user', content: `Issue: ${(ticketText || '').slice(0, 2000)}\nFAQ: ${faq.question} -> ${faq.answer.slice(0, 1500)}` },
        ]));
        if (json && typeof json.confidence === 'number') {
          confidence = json.confidence;
          if (json.answer) {
            return { shouldResolve: true, reply: json.answer, confidence, kbId: faq._id };
          }
        }
      }
      if (confidence >= (config.ai.autoResolveThreshold || 0.8)) {
        return { shouldResolve: true, reply: faq.answer, confidence, kbId: faq._id };
      }
    }
  }
  return null;
}

/**
 * Agent assist: while an agent is typing, surface everything relevant.
 */
async function agentAssist(ticket, latestMessage, context = {}) {
  const text = latestMessage || ticket.subject || '';
  const [suggestions, kb, similar, analysis] = await Promise.all([
    replySuggestions(text, context.history),
    kbRecommendations(text, ticket.company, 3),
    similarTickets(text, ticket.company, ticket._id, 3),
    analyze(text),
  ]);
  return {
    suggestions,
    kbArticles: kb,
    similarTickets: similar,
    analysis,
    recommendedAction:
      analysis.urgency === 'critical'
        ? 'Escalate and inform supervisor immediately'
        : analysis.sentiment === 'frustrated'
          ? 'Respond quickly with empathy and a concrete next step'
          : 'Respond with a clear resolution or follow-up question',
    recommendedEscalation: analysis.urgency === 'critical' ? 'Escalate to senior agent' : null,
  };
}

/**
 * AI QA: evaluate a conversation for correctness/tone/policy cues.
 */
async function qaEvaluate(thread) {
  const convo = thread
    .filter((x) => x.body)
    .map((x) => `[${x.posterType || x.type}] ${x.body}`)
    .join('\n')
    .slice(0, 8000);
  if (aiEnabled()) {
    const json = parseJson(await llmComplete([
      {
        role: 'system',
        content:
          'You are a support QA reviewer. Score the conversation 0-100 and return ONLY JSON: {"score": 0-100, "checks": {"tone": "pass|warn|fail", "information": "pass|warn|fail", "resolution": "pass|warn|fail", "policy": "pass|warn|fail"}, "notes": "..."}',
      },
      { role: 'user', content: convo },
    ]));
    if (json && typeof json.score === 'number') {
      return { score: Math.max(0, Math.min(100, Math.round(json.score))), checks: json.checks || {}, notes: json.notes || '', provider: 'ai' };
    }
  }
  const text = convo.toLowerCase();
  let score = 70;
  const checks = { tone: 'pass', information: 'pass', resolution: 'pass', policy: 'pass' };
  if (NEGATIVE_KEYWORDS.some((w) => text.includes(w.toLowerCase())) || /\b[a-z]+\b!{2,}/.test(text)) {
    checks.tone = 'fail';
    score -= 15;
  }
  if (text.split('?').length > 4) {
    checks.information = 'warn';
    score -= 10;
  }
  if (/thanks|resolved|fixed|done|anything else|let me know/.test(text)) {
    checks.resolution = 'pass';
    score += 10;
  } else {
    checks.resolution = 'warn';
  }
  return { score: Math.max(0, Math.min(100, score)), checks, notes: '', provider: 'heuristic' };
}

/**
 * AI knowledge loop: draft a KB article from recurring resolved tickets.
 */
async function draftArticleFromTickets(tickets) {
  const combined = tickets.map((t) => `${t.subject} ${t.aiSummary || ''}`).join('\n').slice(0, 4000);
  if (aiEnabled()) {
    const json = parseJson(await llmComplete([
      {
        role: 'system',
        content: 'Draft a knowledge-base article from resolved tickets. Return ONLY JSON: {"question": "...", "answer": "..."}',
      },
      { role: 'user', content: combined },
    ]));
    if (json && json.question && json.answer) return json;
  }
  return {
    question: `How do I resolve: ${tickets[0]?.subject || 'recurring issue'}?`,
    answer: 'Internal draft: based on repeated resolved tickets, the recommended steps are recorded in the linked ticket resolutions.',
  };
}

/**
 * Voice call analysis (transcription -> summary/intent/sentiment).
 */
async function analyzeCall(transcription) {
  const safe = (transcription || '').slice(0, 6000);
  if (aiEnabled()) {
    const json = parseJson(await llmComplete([
      {
        role: 'system',
        content: 'Analyze a support call transcript. Return ONLY JSON: {"summary": "...", "intent": "...", "sentiment": "...", "actionItems": ["..."]}',
      },
      { role: 'user', content: safe },
    ]));
    if (json && json.summary) {
      return { summary: json.summary, intent: json.intent || '', sentiment: json.sentiment || '', actionItems: json.actionItems || [] };
    }
  }
  return {
    summary: (safe.replace(/\s+/g, ' ').trim() || 'No transcription').slice(0, 300),
    intent: detectIntent(safe),
    sentiment: detectSentiment(safe),
    actionItems: [],
  };
}

module.exports = {
  aiEnabled,
  llmComplete,
  analyze,
  summarize,
  replySuggestions,
  kbRecommendations,
  similarTickets,
  rewrite,
  translate,
  handoffSummary,
  resolutionSummary,
  autoResolve,
  agentAssist,
  qaEvaluate,
  draftArticleFromTickets,
  analyzeCall,
  detectIntent,
  detectSentiment,
  detectUrgency,
  extractEntities,
  textSimilarity,
};