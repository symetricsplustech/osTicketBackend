/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const Change = require('../src/models/helpdesk/incidents/Change');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5114; const base = `http://127.0.0.1:${port}/api/v1`;
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
    const [a, b] = await Promise.all([Company.create({ name: `Change security A ${suffix}`, status: 'active' }), Company.create({ name: `Change security B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id);
    const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey: 'helpdesk' },
      { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true },
    )));
    const [adminA, deniedA, adminB] = await Promise.all([
      Agent.create({ name: 'Change admin A', email: `change-admin-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
      Agent.create({ name: 'Change denied A', email: `change-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'Change admin B', email: `change-admin-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
    ]);
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, deniedToken, bToken] = await Promise.all([login(adminA.email), login(deniedA.email), login(adminB.email)]);
    assert((await request('POST', '/enterprise/changes', { body: { title: 'Anonymous change' } })).status === 401, 'anonymous change creation is denied');
    assert((await request('POST', '/enterprise/changes', { token: deniedToken, body: { title: 'Denied change' } })).status === 403, 'agent without records.create cannot create a change');
    assert((await request('POST', '/enterprise/changes', { token: aToken, body: { title: 'Invalid window', windowStart: '2026-10-10T12:00:00Z', windowEnd: '2026-10-10T11:00:00Z' } })).status === 422, 'invalid change window is rejected');
    assert((await request('POST', '/enterprise/changes', { token: aToken, body: { title: 'Invalid type', type: 'uncontrolled' } })).status === 422, 'invalid change type is rejected');
    assert((await request('POST', '/enterprise/changes', { token: aToken, body: { title: 'Verified change', windowStart: '2026-10-10T10:00:00Z', windowEnd: '2026-10-10T11:00:00Z' } })).status === 200, 'authorized agent can create a change');
    const change = await Change.findOne({ company: a._id, title: 'Verified change' });
    assert(String(change.submittedBy) === String(adminA._id), 'change records submitting agent');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'change.created', entityId: change._id }), 'change creation has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: deniedToken, body: { rollbackPlan: 'bad' } })).status === 403, 'agent without records.update cannot update a change');
    assert([403, 404].includes((await request('PUT', `/enterprise/changes/${change._id}`, { token: bToken, body: { rollbackPlan: 'cross tenant' } })).status), 'cross-tenant agent cannot update a change');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { rollbackPlan: 'verified backout' } })).status === 200, 'authorized agent can update a change');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'change.updated', entityId: change._id }), 'change update has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { status: 'approved' } })).status === 200, 'change can advance to approved through the state machine');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { status: 'scheduled' } })).status === 422, 'scheduling requires implementation and rollback plans');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { status: 'scheduled', implementationPlan: 'Deploy the approved package', rollbackPlan: 'Restore prior package' } })).status === 200, 'scheduling accepts required operational plans');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { status: 'implementing' } })).status === 200, 'implementation stamps the executing agent and time');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { status: 'validating' } })).status === 200, 'change can advance to validation with implementation evidence');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { status: 'closed' } })).status === 422, 'closing requires validation evidence');
    assert((await request('PUT', `/enterprise/changes/${change._id}`, { token: aToken, body: { status: 'closed', validationPlan: 'Verify service health for 30 minutes' } })).status === 200, 'closing accepts required validation evidence');
    const closed = await Change.findById(change._id).lean();
    assert(closed.implementedAt && closed.validatedAt && closed.closedAt && String(closed.implementedBy) === String(adminA._id), 'change lifecycle persists operational timestamps and actor');
    console.log('ITSM-05 CHANGE SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-05 CHANGE SECURITY TEST FAILED:', error.message); process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await Change.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
