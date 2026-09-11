/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const Problem = require('../src/models/helpdesk/incidents/Problem');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5113;
const base = `http://127.0.0.1:${port}/api/v1`;
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
    const [a, b] = await Promise.all([Company.create({ name: `Problem security A ${suffix}`, status: 'active' }), Company.create({ name: `Problem security B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id);
    const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey: 'helpdesk' },
      { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true },
    )));
    const [adminA, deniedA, adminB] = await Promise.all([
      Agent.create({ name: 'Problem admin A', email: `problem-admin-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
      Agent.create({ name: 'Problem denied A', email: `problem-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'Problem admin B', email: `problem-admin-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
    ]);
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, deniedToken, bToken] = await Promise.all([login(adminA.email), login(deniedA.email), login(adminB.email)]);
    assert((await request('POST', '/enterprise/problems', { body: { title: 'Anonymous problem' } })).status === 401, 'anonymous problem creation is denied');
    assert((await request('POST', '/enterprise/problems', { token: deniedToken, body: { title: 'Denied problem' } })).status === 403, 'agent without records.create cannot create a problem');
    assert((await request('POST', '/enterprise/problems', { token: aToken, body: { title: 'Verified problem', knownError: true } })).status === 200, 'authorized agent can create a problem');
    const problem = await Problem.findOne({ company: a._id, title: 'Verified problem' });
    assert(String(problem.createdBy) === String(adminA._id), 'problem records its creating agent');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'problem.created', entityId: problem._id }), 'problem creation has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: deniedToken, body: { workaround: 'bad' } })).status === 403, 'agent without records.update cannot update a problem');
    assert([403, 404].includes((await request('PUT', `/enterprise/problems/${problem._id}`, { token: bToken, body: { workaround: 'cross tenant' } })).status), 'cross-tenant agent cannot update a problem');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { workaround: 'verified workaround' } })).status === 200, 'authorized agent can update a problem');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'problem.updated', entityId: problem._id }), 'problem update has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'investigation' } })).status === 200, 'problem can enter investigation through the state machine');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'known_error' } })).status === 422, 'known-error transition requires root cause and workaround');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'known_error', rootCause: 'Authentication cache corruption', workaround: 'Clear the cache and retry' } })).status === 200, 'problem can publish a known error with required evidence');
    const knownError = await Problem.findById(problem._id).lean();
    assert(knownError.knownError && knownError.status === 'known_error', 'known-error transition records the lifecycle state');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'problem.updated', entityId: problem._id, 'after.status': 'known_error' }), 'known-error transition has mandatory audit evidence');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'fix_in_progress' } })).status === 200, 'known error can move into remediation');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'fixed' } })).status === 422, 'fixed transition requires a permanent solution');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'fixed', permanentSolution: 'Deploy cache integrity fix' } })).status === 200, 'fixed transition accepts permanent-solution evidence');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'closed' } })).status === 422, 'problem closure requires postmortem evidence');
    assert((await request('PUT', `/enterprise/problems/${problem._id}`, { token: aToken, body: { status: 'closed', postmortem: 'Effectiveness review completed with no recurrence.' } })).status === 200, 'problem closure accepts required evidence');
    console.log('ITSM-04 PROBLEM SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-04 PROBLEM SECURITY TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await Problem.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
