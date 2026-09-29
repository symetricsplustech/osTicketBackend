function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function summarizeThread({ title = "", entries = [] }) {
  const messages = entries.map((entry) => clean(entry.body)).filter(Boolean);
  const text = messages.join(" ");
  const summary = text.length > 600 ? `${text.slice(0, 597)}...` : text;
  const actionItems = entries
    .map((entry) => clean(entry.body))
    .filter((body) =>
      /\b(need|should|must|please|action|follow up|todo)\b/i.test(body),
    )
    .slice(0, 5);
  return {
    title: clean(title),
    summary: summary || "No message content available.",
    actionItems,
    messageCount: messages.length,
  };
}

function extractiveSummary(sentences, count = 3) {
  const scored = sentences
    .filter((s) => s.trim().length > 20)
    .map((s, i) => {
      const words = s.toLowerCase().split(/\s+/);
      const uniqueWords = new Set(words);
      const score = (uniqueWords.size / words.length) * (1 - i * 0.05);
      return { text: s.trim(), score };
    })
    .sort((a, b) => b.score - a.score);
  return {
    summary: scored
      .slice(0, count)
      .map((s) => s.text)
      .join(" "),
    sentences: scored.slice(0, count).map((s) => s.text),
  };
}

module.exports = { summarizeThread, extractiveSummary };
