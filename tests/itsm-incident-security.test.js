/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const Incident = require('../src/models/helpdesk/incidents/Incident');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5112;
const base = `http://127.0.0.1:${port}/api/v1`;
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

(async () => {
  let server;
  const companies = [];
  const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    const [companyA, companyB] = await Promise.all([
      Company.create({ name: `Incident security A ${suffix}`, status: 'active' }),
      Company.create({ name: `Incident security B ${suffix}`, status: 'active' }),
    ]);
    companies.push(companyA._id, companyB._id);
    const now = new Date();
    await Promise.all([companyA, companyB].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey: 'helpdesk' },
      { $set: { status: 'active', activatedAt: now, updatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } },
      { upsert: true },
    )));
    const [adminA, deniedA, adminB] = await Promise.all([
      Agent.create({ name: 'Incident admin A', email: `incident-admin-a-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
      Agent.create({ name: 'Incident denied A', email: `incident-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isActive: true }),
      Agent.create({ name: 'Incident admin B', email: `incident-admin-b-${suffix}@osticket.local`, password: 'Pass@1234', company: companyB._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
    ]);
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [adminAToken, deniedToken, adminBToken] = await Promise.all([login(adminA.email), login(deniedA.email), login(adminB.email)]);

    assert((await request('POST', '/enterprise/incidents', { body: { title: 'Anonymous incident' } })).status === 401, 'anonymous incident creation is denied');
    assert((await request('POST', '/enterprise/incidents', { token: deniedToken, body: { title: 'Denied incident' } })).status === 403, 'agent without records.create cannot create an incident');
    assert((await request('POST', '/enterprise/incidents', { token: adminAToken, body: { title: 'Invalid severity', severity: 'Sev0' } })).status === 422, 'incident creation rejects an invalid severity');
    assert((await request('POST', '/enterprise/incidents', { token: adminAToken, body: { title: 'Verified incident', severity: 'high' } })).status === 200, 'authorized agent can create an incident');
    const incident = await Incident.findOne({ company: companyA._id, title: 'Verified incident' });
    assert(incident && String(incident.createdBy) === String(adminA._id), 'incident records its creating agent');
    assert(await AuditEvent.exists({ company: companyA._id, actor: adminA._id, action: 'incident.created', entityId: incident._id }), 'incident creation has mandatory audit evidence');
    assert((await request('GET', '/enterprise/incidents', { token: adminAToken })).status === 200, 'authorized agent can list incidents');
    assert((await request('POST', `/ops/incidents/${incident._id}/stakeholder-update`, { body: { message: 'Anonymous update' } })).status === 401, 'anonymous stakeholder update is denied');
    assert((await request('POST', `/ops/incidents/${incident._id}/stakeholder-update`, { token: deniedToken, body: { message: 'Denied update' } })).status === 403, 'agent without records.update cannot send stakeholder updates');
    assert([403, 404].includes((await request('POST', `/ops/incidents/${incident._id}/stakeholder-update`, { token: adminBToken, body: { message: 'Cross-tenant update' } })).status), 'cross-tenant stakeholder update is denied');
    assert((await request('POST', `/ops/incidents/${incident._id}/stakeholder-update`, { token: adminAToken, body: { message: '' } })).status === 422, 'stakeholder update requires a message');
    assert((await request('POST', `/ops/incidents/${incident._id}/stakeholder-update`, { token: adminAToken, body: { message: 'Investigating service impact.' } })).status === 200, 'authorized agent can send a validated stakeholder update');
    assert(await AuditEvent.exists({ company: companyA._id, actor: adminA._id, action: 'incident.stakeholder_updated', entityId: incident._id }), 'stakeholder update has mandatory audit evidence');
    assert((await request('POST', `/ops/incidents/${incident._id}/resolution-team`, { token: adminAToken, body: { agentIds: [adminB._id] } })).status === 422, 'resolution team rejects a cross-tenant agent');
    assert((await request('POST', `/ops/incidents/${incident._id}/resolution-team`, { token: adminAToken, body: { agentIds: [adminA._id] } })).status === 200, 'authorized agent can assign a same-tenant resolution team');
    assert(await AuditEvent.exists({ company: companyA._id, actor: adminA._id, action: 'incident.resolution_team_updated', entityId: incident._id }), 'resolution-team update has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/incidents/${incident._id}`, { token: deniedToken, body: { summary: 'unauthorized' } })).status === 403, 'agent without records.update cannot update an incident');
    assert([403, 404].includes((await request('PUT', `/enterprise/incidents/${incident._id}`, { token: adminBToken, body: { summary: 'cross tenant' } })).status), 'cross-tenant agent cannot update an incident');
    assert((await request('PUT', `/enterprise/incidents/${incident._id}`, { token: adminAToken, body: { summary: 'updated securely' } })).status === 200, 'authorized agent can update an incident');
    assert(await AuditEvent.exists({ company: companyA._id, actor: adminA._id, action: 'incident.updated', entityId: incident._id }), 'incident update has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/incidents/${incident._id}`, { token: adminAToken, body: { status: 'resolved' } })).status === 422, 'incident resolution requires a resolution summary');
    assert((await request('PUT', `/enterprise/incidents/${incident._id}`, { token: adminAToken, body: { status: 'resolved', resolution: 'Service restored and monitored.' } })).status === 200, 'incident can resolve with required resolution evidence');
    const resolved = await Incident.findById(incident._id).lean();
    assert(resolved.resolvedAt && resolved.timeline.some((entry) => String(entry.message).includes('Status changed')) && resolved.updates.some((entry) => entry.status === 'resolved'), 'incident state transition records durable timeline and update entries');
    assert(await AuditEvent.exists({ company: companyA._id, actor: adminA._id, action: 'incident.updated', entityId: incident._id, 'after.status': 'resolved' }), 'incident resolution has mandatory transition audit evidence');
    console.log('ITSM-02 INCIDENT SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-02 INCIDENT SECURITY TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await Incident.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
