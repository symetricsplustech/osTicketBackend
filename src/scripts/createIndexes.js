// Database index creation — run once on startup for optimal query performance
const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function createIndexes() {
  const db = mongoose.connection.db;
  if (!db) { logger.warn('No DB connection for index creation'); return; }

  const indexes = [
    // Tickets: most queried by tenant+status, tenant+assignee, tenant+number
    { coll: 'tickets', keys: { tenantId: 1, status: 1, createdAt: -1 } },
    { coll: 'tickets', keys: { tenantId: 1, assignedTo: 1, status: 1 } },
    { coll: 'tickets', keys: { tenantId: 1, number: 1 }, unique: false },
    // Incidents
    { coll: 'incidents', keys: { tenantId: 1, status: 1, severity: -1 } },
    { coll: 'incidents', keys: { tenantId: 1, isMajor: 1, createdAt: -1 } },
    // Leads + Opportunities
    { coll: 'leads', keys: { tenantId: 1, status: 1, score: -1 } },
    { coll: 'opportunities', keys: { tenantId: 1, stage: 1, value: -1 } },
    // Assets + Licences
    { coll: 'assets', keys: { tenantId: 1, status: 1 } },
    { coll: 'licenses', keys: { tenantId: 1, status: 1, expiryDate: 1 } },
    // Users/Agents
    { coll: 'users', keys: { email: 1 }, unique: true, sparse: true },
    { coll: 'agents', keys: { tenantId: 1, isActive: 1 } },
    // Notifications
    { coll: 'notifications', keys: { user: 1, read: 1, createdAt: -1 } },
    // Audit logs
    { coll: 'auditlogs', keys: { tenantId: 1, createdAt: -1 } },
    { coll: 'auditevents', keys: { tenantId: 1, occurredAt: -1 } },
    // Workflows
    { coll: 'workflows', keys: { company: 1, event: 1, isActive: 1 } },
    // Projects
    { coll: 'projects', keys: { tenantId: 1, status: 1 } },
    // Work orders
    { coll: 'workorders', keys: { tenantId: 1, status: 1, scheduledDate: 1 } },
    // HR cases
    { coll: 'hrcases', keys: { tenantId: 1, status: 1 } },
    // Security incidents
    { coll: 'securityincidents', keys: { tenantId: 1, status: 1, severity: -1 } },
    // Module activation
    { coll: 'tenant_modules', keys: { tenantId: 1, moduleKey: 1 }, unique: true },
  ];

  let created = 0;
  for (const idx of indexes) {
    try {
      const coll = db.collection(idx.coll);
      await coll.createIndex(idx.keys, { unique: idx.unique || false, sparse: idx.sparse || false, background: true });
      created++;
    } catch (err) {
      // Index already exists or collection doesn't exist yet
      if (!err.message.includes('already exists')) {
        logger.debug(`Index skip ${idx.coll}: ${err.message.slice(0, 60)}`);
      }
    }
  }
  logger.info(`Database indexes verified (${created} ensured)`);
}

module.exports = { createIndexes };
