/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const Incident = require('../src/models/helpdesk/incidents/Incident');
const AuditEvent = require('../src/models/AuditEvent');
const Communication = require('../src/models/MajorIncidentCommunication');
const P6 = require('../src/models/platformData');
const { processDueCommunicationPlans } = require('../src/services/majorIncidentCommunication.service');

const port = 5115; const base = `http://127.0.0.1:${port}/api/v1`;
const assert = (value, message) => { if (!value) throw new Error(message); console.log(`PASS ${message}`); };
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

(async () => {
  let server; const companies = []; const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    const [a, b] = await Promise.all([Company.create({ name: `Major A ${suffix}`, status: 'active' }), Company.create({ name: `Major B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id);
    const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey: 'helpdesk' },
      { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true },
    )));
    const [adminA, deniedA, adminB] = await Promise.all([
      Agent.create({ name: 'Major admin A', email: `major-admin-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
      Agent.create({ name: 'Major denied A', email: `major-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'Major admin B', email: `major-admin-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.update'] }),
    ]);
    const incident = await Incident.create({ number: `MAJ-${suffix}`, company: a._id, title: 'Sev1 outage', severity: 'Sev1', status: 'investigating', createdBy: adminA._id, commander: adminA._id });
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, deniedToken, bToken] = await Promise.all([login(adminA.email), login(deniedA.email), login(adminB.email)]);
    assert((await request('POST', '/enterprise/incidents', { token: aToken, body: { title: 'Bypass attempt', severity: 'critical', isMajor: true } })).status === 422, 'ordinary incident creation cannot bypass major declaration controls');
    assert((await request('PUT', `/enterprise/incidents/${incident._id}`, { token: aToken, body: { isMajor: true } })).status === 422, 'ordinary incident updates cannot bypass major declaration controls');
    assert((await request('POST', `/enterprise/incidents/${incident._id}/major`, { body: { reason: 'Major outage' } })).status === 401, 'anonymous major declaration is denied');
    assert((await request('POST', `/enterprise/incidents/${incident._id}/major`, { token: deniedToken, body: { reason: 'Major outage' } })).status === 403, 'agent without records.update cannot declare a major incident');
    assert([403, 404].includes((await request('POST', `/enterprise/incidents/${incident._id}/major`, { token: bToken, body: { reason: 'Cross-tenant request' } })).status), 'cross-tenant agent cannot declare a major incident');
    assert((await request('POST', `/enterprise/incidents/${incident._id}/major`, { token: aToken, body: { reason: 'Customer service outage' } })).status === 200, 'authorized agent can declare a major incident');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'incident.major_declared', entityId: incident._id }), 'major declaration has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/incidents/${incident._id}/communication-plan`, { token: aToken, body: { cadenceMinutes: 10, audience: ['internal'] } })).status === 422, 'invalid communication cadence is rejected');
    assert((await request('PUT', `/enterprise/incidents/${incident._id}/communication-plan`, { token: aToken, body: { cadenceMinutes: 30, audience: ['internal', 'customer'] } })).status === 200, 'authorized agent can configure communications');
    const plan = await P6.CommunicationPlan.findOne({ tenantId: a._id, incident: incident._id });
    plan.nextUpdateAt = new Date(Date.now() - 1000);
    await plan.save();
    const due = await processDueCommunicationPlans({ now: new Date(), limit: 10 });
    assert(due.count === 1 && due.processed[0].incidentId === String(incident._id), 'due major-incident communication plan is claimed once by scheduler');
    assert((await processDueCommunicationPlans({ now: new Date(), limit: 10 })).count === 0, 'a claimed communication plan cannot be processed twice in the same cadence window');
    const advancedPlan = await P6.CommunicationPlan.findById(plan._id);
    assert(advancedPlan.updatesSent === 1 && advancedPlan.nextUpdateAt > new Date(), 'scheduler advances communication cadence exactly once');
    assert(await AuditEvent.exists({ company: a._id, action: 'incident.communication_due', entityId: incident._id, source: 'scheduler' }), 'scheduled communication due event has mandatory audit evidence');
    assert((await request('POST', `/enterprise/incidents/${incident._id}/communications`, { token: aToken, body: { audience: 'customer', message: 'We are investigating the outage.' } })).status === 201, 'authorized agent can send major-incident communication');
    assert(await Communication.exists({ company: a._id, incident: incident._id, actor: adminA._id }), 'major-incident communication is persisted');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'incident.communication_sent', entityId: incident._id }), 'communication has mandatory audit evidence');
    console.log('ITSM-03 MAJOR INCIDENT SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-03 MAJOR INCIDENT SECURITY TEST FAILED:', error.message); process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await Communication.deleteMany({ company: { $in: companies } });
      await P6.CommunicationPlan.deleteMany({ tenantId: { $in: companies } });
      await Incident.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
