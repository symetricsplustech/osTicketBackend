const Priority = require('../models/Priority');

const DEFAULTS = [
  { name: 'Low', level: 1, color: '#16a34a' },
  { name: 'Normal', level: 2, color: '#64748b', isDefault: true },
  { name: 'High', level: 3, color: '#d97706' },
  { name: 'Emergency', level: 4, color: '#dc2626' },
];

let seedPromise = null;

async function ensureDefaults(company = null) {
  const existing = await Priority.find({ company }).countDocuments();
  if (existing > 0) return;
  seedPromise = seedPromise || (async () => {
    for (const d of DEFAULTS) {
      await Priority.create({ ...d, company, isActive: true });
    }
  })();
  await seedPromise;
  seedPromise = null;
}

async function listPriorities(company = null) {
  await ensureDefaults(company);
  return Priority.find({ company }).sort({ level: 1, name: 1 }).populate('sla', 'name');
}

async function getDefaultPriorityName(company = null) {
  await ensureDefaults(company);
  const def = await Priority.findOne({ company, isDefault: true });
  return def?.name || DEFAULTS[1].name;
}

async function isValidPriority(name, company = null) {
  const items = await listPriorities(company);
  return items.some((p) => p.name === String(name).trim());
}

module.exports = { listPriorities, ensureDefaults, getDefaultPriorityName, isValidPriority, DEFAULTS };