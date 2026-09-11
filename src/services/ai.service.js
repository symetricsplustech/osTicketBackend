function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function summarizeThread({ title = '', entries = [] }) {
  const messages = entries.map((entry) => clean(entry.body)).filter(Boolean);
  const text = messages.join(' ');
  const summary = text.length > 600 ? `${text.slice(0, 597)}...` : text;
  const actionItems = entries
    .map((entry) => clean(entry.body))
    .filter((body) => /\b(need|should|must|please|action|follow up|todo)\b/i.test(body))
    .slice(0, 5);
  return {
    title: clean(title),
    summary: summary || 'No message content available.',
    actionItems,
    messageCount: messages.length,
  };
}

module.exports = { summarizeThread };
