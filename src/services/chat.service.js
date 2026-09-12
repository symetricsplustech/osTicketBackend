const Conversation = require("../models/Conversation");
const ChatMessage = require("../models/ChatMessage");

async function startConversation(data) {
  return Conversation.create(data);
}
async function conversationDetail(id) {
  const conversation = await Conversation.findById(id).lean();
  if (!conversation) return null;
  const messages = await ChatMessage.find({ conversation: id })
    .sort({ createdAt: 1 })
    .lean();
  return { conversation, messages };
}
async function postMessage(data) {
  return ChatMessage.create({
    ...data,
    conversation: data.conversationId,
    user: data.userId || null,
  });
}

module.exports = { startConversation, conversationDetail, postMessage };
