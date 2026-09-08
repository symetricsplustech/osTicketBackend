/**
 * Offline, cross-table "neural-style" semantic search (the free-AI approach).
 *
 * No embeddings API, no data egress, no external deps. Pure bag-of-words
 * TF-IDF vectors + cosine similarity computed in-process over the tenant's
 * OWN documents (tickets, incidents, faqs, CIs, assets, changes, ...).
 * Every model fetch is wrapped in try/catch so a missing/unusable model
 * never breaks the whole search.
 */

const { tokenize, cosineScore, termFreq } = require('./suggestion.service');

function pickText(fields) {
  return fields.filter((f) => f !== undefined && f !== null && String(f).trim() !== '').join('\n');
}

function snippet(text) {
  return String(text || '').trim().slice(0, 140);
}

function normalizeScore(s) {
  if (!Number.isFinite(s)) return 0;
  return Math.round(s * 10000) / 10000;
}

/**
 * Fetch docs for a model and shape them into the unified corpus shape.
 * resilient: any thrown error results in [] for that model.
 */
async function fetchModel(model, query, select, shape, limit) {
  try {
    const docs = await model.find(query).select(select).limit(limit).lean();
    return docs.map(shape).filter((d) => d && String(d.text || '').trim());
  } catch (e) {
    return [];
  }
}

/**
 * semanticSearch({ company, query, limit = 30, userId })
 * Returns top-ranked cross-table matches: [{ entity, label, module, id,
 * title, recordNumber, score, snippet }].
 */
async function semanticSearch({ company, query, limit = 30, userId }) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const qTf = termFreq(queryTokens);
  const corpus = [];
  const push = (arr) => {
    for (const d of arr) if (d && String(d.text || '').trim()) corpus.push(d);
  };

  const LIMIT = 300;

  // Ticket
  try {
    const Ticket = require('../models/Ticket');
    push(await fetchModel(
      Ticket,
      { company },
      'number subject details status',
      (d) => ({
        text: pickText([d.subject, d.details, d.number]),
        entity: 'ticket',
        label: d.subject || d.number,
        module: 'helpdesk',
        id: String(d._id),
        recordNumber: d.number,
      }),
      LIMIT
    ));
  } catch (e) { /* skip */ }

  // Incident
  try {
    const Incident = require('../models/Incident');
    push(await fetchModel(
      Incident,
      { company },
      'title summary description',
      (d) => ({
        text: pickText([d.title, d.summary, d.description]),
        entity: 'incident',
        label: d.title,
        module: 'incidents',
        id: String(d._id),
        recordNumber: d.number,
      }),
      LIMIT
    ));
  } catch (e) { /* skip */ }

  // Faq (knowledgebase)
  try {
    const Faq = require('../models/Faq');
    push(await fetchModel(
      Faq,
      { company, isPublished: true },
      'question answer subject content',
      (d) => ({
        text: pickText([d.question, d.subject, d.answer, d.content]),
        entity: 'faq',
        label: d.question || d.subject,
        module: 'knowledgebase',
        id: String(d._id),
        recordNumber: '',
      }),
      LIMIT
    ));
  } catch (e) { /* skip */ }

  // CI (Enterprise) — tenant-scoped by tenantId
  try {
    const CI = require('../models/enterprise/CI');
    push(await fetchModel(
      CI,
      { tenantId: company },
      'name ciClass ipAddress serialNumber',
      (d) => ({
        text: pickText([d.name, d.ciClass, d.ipAddress, d.serialNumber]),
        entity: 'ci',
        label: d.name,
        module: 'cmdb',
        id: String(d._id),
        recordNumber: '',
      }),
      LIMIT
    ));
  } catch (e) { /* skip */ }

  // Asset
  try {
    const Asset = require('../models/Asset');
    push(await fetchModel(
      Asset,
      { company },
      'name assetTag category serial type hostname',
      (d) => ({
        text: pickText([d.name, d.assetTag, d.category, d.serial, d.type, d.hostname]),
        entity: 'asset',
        label: d.name,
        module: 'assets',
        id: String(d._id),
        recordNumber: d.assetTag || '',
      }),
      LIMIT
    ));
  } catch (e) { /* skip */ }

  // Change
  try {
    const Change = require('../models/Change');
    push(await fetchModel(
      Change,
      { company },
      'title description number type risk',
      (d) => ({
        text: pickText([d.title, d.description, d.number]),
        entity: 'change',
        label: d.title,
        module: 'changes',
        id: String(d._id),
        recordNumber: d.number,
      }),
      LIMIT
    ));
  } catch (e) { /* skip */ }

  // ActionItem (may not exist — guarded)
  try {
    const ActionItem = require('../models/ActionItem');
    push(await fetchModel(
      ActionItem,
      { company: company || {} },
      'title description',
      (d) => ({
        text: pickText([d.title, d.description]),
        entity: 'actionitem',
        label: d.title,
        module: 'action-items',
        id: String(d._id),
        recordNumber: '',
      }),
      LIMIT
    ));
  } catch (e) { /* skip */ }

  if (!corpus.length) return [];

  // Corpus-level document frequencies for IDF-ish weighting.
  const docFreq = new Map();
  for (const d of corpus) {
    const seen = new Set(termFreq(tokenize(d.text)).keys());
    for (const term of seen) docFreq.set(term, (docFreq.get(term) || 0) + 1);
  }

  const scored = corpus
    .map((d) => {
      const dTf = termFreq(tokenize(d.text));
      const score = cosineScore(qTf, dTf, docFreq, corpus.length);
      return { ...d, score };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((d) => ({
    entity: d.entity,
    label: d.label,
    module: d.module,
    id: d.id,
    title: d.label,
    recordNumber: d.recordNumber,
    score: normalizeScore(d.score),
    snippet: snippet(d.text),
  }));
}

module.exports = { semanticSearch };
