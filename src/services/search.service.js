const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Agent = require('../models/Agent');
const Faq = require('../models/Faq');
const Asset = require('../models/Asset');
const Invoice = require('../models/Invoice');
const CannedResponse = require('../models/CannedResponse');

const ESCAPE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parse a query into { text, filters } supporting field filters:
 *   priority:critical  status:open  department:technical  sla:<2h  customer_tier:enterprise
 *   source:email  tags:refund  from:user@example.com  number:TCK-1025  is:overdue
 */
function parseQuery(q = '') {
  const textParts = [];
  const filters = {};
  const tokens = q.trim().split(/\s+/);
  for (const token of tokens) {
    const m = token.match(/^([a-z_]+):(<|>|>=|<=|!=|)(.+)$/i);
    if (m && ['priority', 'status', 'department', 'sla', 'customer_tier', 'source', 'tags', 'from', 'number', 'is', 'type', 'agent', 'severity'].includes(m[1].toLowerCase())) {
      const key = m[1].toLowerCase();
      let op = m[2] || '=';
      let val = m[3];
      if (key === 'sla' && val.match(/^\d+h$/)) {
        filters.slaHours = { op, value: parseInt(val, 10) };
      } else {
        filters[key] = { op, value: val.replace(/["']/g, '') };
      }
    } else {
      textParts.push(token);
    }
  }
  return { text: textParts.join(' '), filters };
}

/**
 * Global search across tickets/users/orgs/messages/KB/assets/agents/invoices.
 */
async function globalSearch({ company, q = '', type, page = 1, limit = 20 }) {
  const parsed = parseQuery(q);
  const text = parsed.text;
  const filters = parsed.filters;
  const regex = text ? new RegExp(ESCAPE(text), 'i') : null;
  const comp = company ? { company } : {};
  const skip = (page - 1) * limit;
  const out = { query: parsed, results: [], total: 0 };

  const ticketMatch = { ...comp, status: { $ne: 'deleted' } };
  if (filters.priority) ticketMatch.priority = filters.priority.value;
  if (filters.status) ticketMatch.status = filters.status.value;
  if (filters.is) {
    const is = filters.is.value.toLowerCase();
    if (is === 'overdue') ticketMatch.isOverdue = true;
    if (is === 'unassigned') ticketMatch.agent = null;
    if (is === 'waiting') ticketMatch.waitingOn = 'customer';
  }
  if (filters.number) ticketMatch.number = filters.number.value.toUpperCase();
  if (filters.tags) ticketMatch.tags = filters.tags.value;
  if (filters.slaHours) {
    const hoursAgo = new Date(Date.now() - filters.slaHours.value * 3600000);
    ticketMatch.dueDate = filters.slaHours.op === '<' ? { $lte: hoursAgo } : { $gte: hoursAgo };
  }
  if (filters.customer_tier) {
    const users = await User.find({ ...comp, tier: filters.customer_tier.value }).distinct('_id');
    ticketMatch.user = { $in: users };
  }
  if (filters.from) {
    const user = await User.findOne({ ...comp, email: filters.from.value.toLowerCase() }).lean();
    if (user) ticketMatch.user = user._id;
  }
  if (regex) ticketMatch.$or = [{ number: regex }, { subject: regex }, { aiSummary: regex }, { tags: regex }];

  const sections = type ? [type] : ['tickets', 'users', 'organizations', 'kb', 'assets', 'agents', 'invoices'];
  const sectionLimit = Math.max(1, Math.min(limit, 10));

  for (const section of sections) {
    switch (section) {
      case 'tickets': {
        const [items, total] = await Promise.all([
          Ticket.find(ticketMatch).sort({ updatedAt: -1 }).skip(skip).limit(sectionLimit).populate('user', 'name email').populate('agent', 'name').lean(),
          Ticket.countDocuments(ticketMatch),
        ]);
        out.results.push({
          type: 'tickets',
          items: items.map((t) => ({
            id: t._id,
            number: t.number,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            customer: t.user?.name || '',
            email: t.user?.email || '',
            agent: t.agent?.name || '',
            dueDate: t.dueDate,
            link: `/agent/tickets/${t.number}`,
          })),
          total,
        });
        out.total += total;
        break;
      }
      case 'users': {
        const match = { ...comp };
        if (regex) match.$or = [{ name: regex }, { email: regex }];
        const [items, total] = await Promise.all([
          User.find(match).sort({ createdAt: -1 }).skip(skip).limit(sectionLimit).lean(),
          User.countDocuments(match),
        ]);
        out.results.push({ type: 'users', items: items.map((u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone, tier: u.tier, link: `/agent/users/${u._id}` })), total });
        out.total += total;
        break;
      }
      case 'organizations': {
        const match = { ...comp };
        if (regex) match.$or = [{ name: regex }, { domain: regex }, { website: regex }];
        const [items, total] = await Promise.all([
          Organization.find(match).sort({ name: 1 }).skip(skip).limit(sectionLimit).lean(),
          Organization.countDocuments(match),
        ]);
        out.results.push({ type: 'organizations', items, total });
        out.total += total;
        break;
      }
      case 'kb': {
        const match = { ...comp, isPublished: true, lifecycle: 'published' };
        if (regex) match.$or = [{ question: regex }, { answer: regex }, { keywords: regex }];
        const [items, total] = await Promise.all([
          Faq.find(match).sort({ views: -1 }).skip(skip).limit(sectionLimit).lean(),
          Faq.countDocuments(match),
        ]);
        out.results.push({ type: 'kb', items, total });
        out.total += total;
        break;
      }
      case 'assets': {
        const match = { ...comp };
        if (regex) match.$or = [{ name: regex }, { serial: regex }, { ip: regex }, { hostname: regex }];
        const [items, total] = await Promise.all([
          Asset.find(match).sort({ name: 1 }).skip(skip).limit(sectionLimit).lean(),
          Asset.countDocuments(match),
        ]);
        out.results.push({ type: 'assets', items, total });
        out.total += total;
        break;
      }
      case 'agents': {
        const match = { isActive: true, ...comp };
        if (regex) match.$or = [{ name: regex }, { email: regex }];
        const [items, total] = await Promise.all([
          Agent.find(match).sort({ name: 1 }).skip(skip).limit(sectionLimit).select('name email presence').lean(),
          Agent.countDocuments(match),
        ]);
        out.results.push({ type: 'agents', items, total });
        out.total += total;
        break;
      }
      case 'invoices': {
        const match = { ...comp };
        if (regex) match.$or = [{ invoiceNumber: regex }, { description: regex }];
        const [items, total] = await Promise.all([
          Invoice.find(match).sort({ createdAt: -1 }).skip(skip).limit(sectionLimit).lean(),
          Invoice.countDocuments(match),
        ]);
        out.results.push({ type: 'invoices', items, total });
        out.total += total;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

module.exports = { globalSearch, parseQuery };