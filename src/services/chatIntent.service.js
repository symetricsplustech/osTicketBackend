const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const Agent = require('../models/Agent');

const INTENTS = [
  { intent: 'status', keywords: ['status', 'update', 'where is my', 'what happened'], response: 'Let me check your recent tickets...' },
  { intent: 'hours', keywords: ['hours', 'open', 'when', 'available'], response: 'Our support hours are Mon-Fri 9AM-6PM.' },
  { intent: 'escalate', keywords: ['escalate', 'manager', 'urgent', 'supervisor'], response: 'I am escalating this to a senior agent.', escalate: true },
  { intent: 'catalog', keywords: ['request', 'need', 'order', 'provision'], response: 'I can help you with a service request. Let me open the catalog.' },
  { intent: 'kb', keywords: ['how to', 'help me', 'guide', 'tutorial'], response: 'Let me search our knowledge base for you.' },
];

async function routeChatIntent({ company, body, userId }) {
  if (!body) return { intent: 'general', response: null };
  const lower = body.toLowerCase();

  for (const def of INTENTS) {
    if (def.keywords.some(kw => lower.includes(kw))) {
      const result = { intent: def.intent, response: def.response, escalate: !!def.escalate };
      if (def.escalate) {
        const agents = await Agent.find({ company, isActive: true }).select('_id name openTickets');
        const agent = agents.reduce((best, a) => {
          const count = a.openTickets || 0;
          return !best || count < best._count ? { _id: a._id, name: a.name, _count: count } : best;
        }, null);
        if (agent) {
          result.escalateTo = agent._id;
          result.escalateToName = agent.name;
        }
      }
      return result;
    }
  }

  return { intent: 'general', response: null };
}

async function handleIntentMessage({ company, conversationId, body, userId }) {
  const result = await routeChatIntent({ company, body, userId });
  if (result.intent !== 'general') {
    await ChatMessage.create({
      company,
      conversation: conversationId,
      sender: 'system',
      body: result.response,
    });
    if (result.escalate && result.escalateTo) {
      await Conversation.findByIdAndUpdate(conversationId, { assignedAgent: result.escalateTo });
    }
  }
  return result;
}

module.exports = { routeChatIntent, handleIntentMessage };
