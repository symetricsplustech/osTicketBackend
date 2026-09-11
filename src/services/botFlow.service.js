/**
 * Bot-flow dialog runner (MD §82).
 *
 * Manages tenant-defined conversational flows: caching, matching, and
 * node-graph traversal. When a user message matches a flow trigger, the
 * service walks the directed graph, returning bot replies and optional
 * actions (handoff, prompt, etc.).
 */

const BotFlow = require('../models/BotFlow');

const TTL_MS = 60 * 1000;
const cache = new Map(); // companyId -> { at, flows }

function invalidateFlows(companyId) {
  cache.delete(String(companyId));
}

async function findFlows(companyId) {
  const key = String(companyId || '');
  if (!key) return [];
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.flows;
  const flows = await BotFlow.find({ company: key, enabled: true }).lean();
  cache.set(key, { at: Date.now(), flows });
  return flows;
}

/**
 * Return the first enabled flow whose comma-separated trigger keywords
 * appear as substrings in userText (case-insensitive).
 */
async function matchFlow(companyId, userText) {
  if (!userText) return null;
  const flows = await findFlows(companyId);
  const lower = userText.toLowerCase();
  for (const flow of flows) {
    if (!flow.trigger) continue;
    const triggers = flow.trigger.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (triggers.some((t) => lower.includes(t))) return flow;
  }
  return null;
}

function getStartNode(flow) {
  if (!flow || !flow.nodes || !flow.nodes.length) return null;
  if (flow.startNode) {
    const sn = flow.nodes.find((n) => n.id === flow.startNode);
    if (sn) return sn;
  }
  return flow.nodes[0];
}

function resolveNode(flow, nodeId) {
  if (!flow || !flow.nodes) return null;
  return flow.nodes.find((n) => n.id === nodeId) || null;
}

function tokenize(text = '') {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function nodeReply(node) {
  if (!node) return '';
  if (node.type === 'question' && Array.isArray(node.options) && node.options.length) {
    const opts = node.options.map((o, i) => `${i + 1}. ${o.value || o.label || ''}`).join('\n');
    return `${node.text || 'Please choose an option:'}\n${opts}`;
  }
  return node.text || '';
}

async function resolveTicketStatus(companyId, userId) {
  try {
    const Ticket = require('../models/helpdesk/tickets/Ticket');
    const query = { company: companyId };
    if (userId) query.user = userId;
    const ticket = await Ticket.findOne(query).sort('-updatedAt').lean();
    if (!ticket) return 'No recent tickets found for your account.';
    return `Your latest ticket #${ticket.number}: "${ticket.subject}" — status: ${ticket.status}.`;
  } catch (_) {
    return 'Unable to retrieve ticket status right now.';
  }
}

async function resolveKbSearch(companyId, userText) {
  try {
    const Faq = require('../models/helpdesk/knowledge/Faq');
    const articles = await Faq.find({ company: companyId, isPublished: true })
      .select('subject answer content')
      .limit(100)
      .lean();
    if (!articles.length) return 'No knowledge base articles found.';
    const words = tokenize(userText);
    const scored = articles
      .map((a) => {
        const articleWords = tokenize(a.subject + ' ' + (a.answer || a.content || ''));
        return { a, score: articleWords.filter((w) => words.includes(w)).length };
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score);
    if (!scored.length) return 'No matching knowledge base articles found.';
    const top = scored[0].a;
    return `Here is a relevant article:\n${top.subject}\n${(top.answer || top.content || '').slice(0, 400)}`;
  } catch (_) {
    return 'Unable to search the knowledge base right now.';
  }
}

/**
 * Full dialog runner. state shape: { flowId, currentNodeId, history: [] }
 * Returns { reply, nextPrompt, handoff, state, terminal } or null.
 */
async function handleUserInput(companyId, userText, conversationId, state) {
  if (!state || !state.currentNodeId) {
    const flow = await matchFlow(companyId, userText);
    if (!flow) return null;
    const start = getStartNode(flow);
    if (!start) return null;
    const newState = { flowId: String(flow._id), currentNodeId: start.id, history: [] };
    const reply = nodeReply(start);
    if (start.type === 'handoff') {
      return { reply, handoff: true, state: newState };
    }
    if (start.type === 'ticket_status') {
      const msg = await resolveTicketStatus(companyId, conversationId);
      return { reply: msg, state: newState };
    }
    if (start.type === 'kb_search') {
      const msg = await resolveKbSearch(companyId, userText);
      return { reply: msg, state: newState };
    }
    if (start.type === 'end' || !start.next) {
      return { reply, terminal: true, state: newState };
    }
    return { reply, nextPrompt: true, state: newState };
  }

  const flow = await BotFlow.findById(state.flowId).lean();
  if (!flow) return null;

  const node = resolveNode(flow, state.currentNodeId);
  if (!node) return null;

  state.history.push({ nodeId: node.id, text: userText });

  if (node.type === 'question') {
    const options = Array.isArray(node.options) ? node.options : [];
    const match = options.find((o) => {
      const val = (o.value || o.label || '').toLowerCase();
      return val && userText.toLowerCase().includes(val);
    });
    if (match && match.next) {
      state.currentNodeId = match.next;
    } else {
      return { reply: nodeReply(node), nextPrompt: true, state };
    }
  } else if (node.type === 'condition') {
    const conditions = Array.isArray(node.conditions) ? node.conditions : [];
    let nextId = node.next || '';
    for (const cond of conditions) {
      if (cond.if === 'contains' && userText.toLowerCase().includes((cond.value || '').toLowerCase())) {
        nextId = cond.next || nextId;
        break;
      }
    }
    if (nextId) {
      state.currentNodeId = nextId;
    } else {
      return { reply: 'I did not understand that. Please try again.', nextPrompt: true, state };
    }
  } else {
    if (node.next) {
      state.currentNodeId = node.next;
    } else {
      return { reply: nodeReply(node), terminal: true, state };
    }
  }

  const nextNode = resolveNode(flow, state.currentNodeId);
  if (!nextNode) {
    return { reply: 'Thank you. This conversation has ended.', terminal: true, state };
  }

  if (nextNode.type === 'handoff') {
    return { reply: nodeReply(nextNode), handoff: true, state };
  }
  if (nextNode.type === 'ticket_status') {
    const msg = await resolveTicketStatus(companyId, conversationId);
    return { reply: msg, state };
  }
  if (nextNode.type === 'kb_search') {
    const msg = await resolveKbSearch(companyId, userText);
    return { reply: msg, state };
  }
  if (nextNode.type === 'end') {
    return { reply: nodeReply(nextNode), terminal: true, state };
  }
  return { reply: nodeReply(nextNode), nextPrompt: true, state };
}

module.exports = { findFlows, matchFlow, getStartNode, resolveNode, handleUserInput, invalidateFlows };
