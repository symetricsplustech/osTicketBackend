const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const Ticket = require('../models/Ticket');
const { getIO } = require('../config/socket');
const { emit } = require('./events');

/**
 * Start a chat conversation (guest or registered user). When the user sends a
 * real support request, a ticket is auto-created (unified conversation -> ticket).
 */
async function startConversation({ company, channel = 'chat', userId = null, guestName = '', guestEmail = '', guestPhone = '', subject = '' }) {
  const conversation = await Conversation.create({
    company,
    channel,
    user: userId || null,
    guestName,
    guestEmail,
    guestPhone,
    subject: subject || (guestName ? `Chat with ${guestName}` : 'Chat conversation'),
  });
  emit('chat.conversation_created', { company, conversationId: conversation._id, channel });
  const io = getIO();
  if (io) io.to('admin:room').emit('chat:new', { conversationId: conversation._id, guestName, guestEmail, channel });
  return conversation;
}

/**
 * Post a message. 'user' sender auto-creates the backing ticket once the
 * message qualifies (any body > 0 chars on first message).
 */
async function postMessage({ company, conversationId, sender, userId = null, agentId = null, body, attachments = [], createTicketIfOpen = true }) {
  if (!body) throw new Error('Message body required');
  let conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error('Conversation not found');

  if (sender === 'user' && !conversation.ticket && createTicketIfOpen) {
    const ticketService = require('./ticket.service');
    try {
      const ticket = await ticketService.createTicket({
        company,
        user: userId,
        guestEmail: conversation.guestEmail,
        guestName: conversation.guestName,
        subject: conversation.subject,
        details: body,
        source: conversation.channel || 'chat',
        skipFilters: false,
      });
      conversation.ticket = ticket._id;
      conversation.subject = ticket.subject;
    } catch (err) {
      // ticket creation failed (e.g. filtered/rejected) — keep chat open
    }
  }

  const message = await ChatMessage.create({
    company,
    conversation: conversation._id,
    sender,
    user: sender === 'user' ? userId : null,
    agent: sender === 'agent' ? agentId : null,
    body,
    attachments: attachments || [],
    readByAgent: sender !== 'user',
    readByUser: sender === 'user',
  });

  const io = getIO();
  if (io) {
    io.to(`conv:${conversationId}`).emit('chat:message', message);
    io.to('admin:room').emit('chat:message', message);
    if (sender === 'user') io.to('admin:room').emit('chat:unread', { conversationId });
  }

  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: { lastMessageAt: new Date() },
      $inc: sender === 'user' ? { unreadAgent: 1 } : { unreadUser: 1 },
    }
  );
  emit('chat.message', { company, conversationId, sender, messageId: message._id, ticketId: conversation.ticket });
  return message;
}

/**
 * Agent opens/reads a conversation: mark messages as read by agent.
 */
async function markConversationRead({ conversationId, by }) {
  await ChatMessage.updateMany({ conversation: conversationId, ...(by === 'agent' ? { readByAgent: false } : { readByUser: false }) }, { $set: by === 'agent' ? { readByAgent: true } : { readByUser: true } });
  await Conversation.updateOne({ _id: conversationId }, { $set: by === 'agent' ? { unreadAgent: 0 } : { unreadUser: 0 } });
}

async function conversationDetail(conversationId) {
  const conversation = await Conversation.findById(conversationId).populate('user', 'name email').populate('assignedAgent', 'name').populate('ticket', 'number status priority').lean();
  if (!conversation) return null;
  const messages = await ChatMessage.find({ conversation: conversationId }).sort({ createdAt: 1 }).lean();
  return { conversation, messages };
}

async function listConversations({ company, status, channel, agentId, page = 1, limit = 20 }) {
  const query = { company };
  if (status) query.status = status;
  if (channel) query.channel = channel;
  if (agentId) query.assignedAgent = agentId;
  const [items, total] = await Promise.all([
    Conversation.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .populate('assignedAgent', 'name'),
    Conversation.countDocuments(query),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

async function assignConversation({ conversationId, agentId }) {
  const conversation = await Conversation.findByIdAndUpdate(conversationId, { $set: { assignedAgent: agentId } }, { new: true });
  return conversation;
}

module.exports = { startConversation, postMessage, markConversationRead, conversationDetail, listConversations, assignConversation };