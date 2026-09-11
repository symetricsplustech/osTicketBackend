/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const AuditEvent = require('../src/models/AuditEvent');
const P6 = require('../src/models/platformData');

const port = 5123; const base = `http://127.0.0.1:${port}/api/v1`;
const assert = (value, message) => { if (!value) throw new Error(message); console.log(`PASS ${message}`); };
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

(async () => {
  let server; const companies = []; const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 }); server = app.listen(port);
    const [a, b] = await Promise.all([Company.create({ name: `Approval A ${suffix}`, status: 'active' }), Company.create({ name: `Approval B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id); const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne({ tenantId: company._id, moduleKey: 'helpdesk' }, { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true })));
    const [managerA, approverA, deniedA, wrongRoleA, approverB] = await Promise.all([
      Agent.create({ name: 'Approval manager A', email: `approval-manager-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['approvals.manage'] }),
      Agent.create({ name: 'Approval admin A', email: `approval-admin-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['approvals.decide'] }),
      Agent.create({ name: 'Approval denied A', email: `approval-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'Approval wrong role A', email: `approval-wrong-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true, permissions: ['approvals.decide'] }),
      Agent.create({ name: 'Approval admin B', email: `approval-admin-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['approvals.decide'] }),
    ]);
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [managerToken, aToken, deniedToken, wrongRoleToken, bToken] = await Promise.all([login(managerA.email), login(approverA.email), login(deniedA.email), login(wrongRoleA.email), login(approverB.email)]);
    const chainBody = { entityType: 'change', entityId: new mongoose.Types.ObjectId(), mode: 'sequential', steps: [{ approverRole: 'admin' }] };
    assert((await request('POST', '/gaps2/approval-chains', { body: chainBody })).status === 401, 'anonymous approval-chain creation is denied');
    assert((await request('POST', '/gaps2/approval-chains', { token: deniedToken, body: chainBody })).status === 403, 'agent without approvals.manage cannot create an approval chain');
    assert((await request('POST', '/gaps2/approval-chains', { token: managerToken, body: { ...chainBody, steps: [] } })).status === 422, 'approval-chain creation requires approver steps');
    const created = await request('POST', '/gaps2/approval-chains', { token: managerToken, body: chainBody });
    assert(created.status === 201 && String(created.data.tenantId) === String(a._id), 'authorized approver manager can create a tenant-scoped approval chain');
    const chain = await P6.ApprovalChain.findById(created.data._id);
    assert(String(chain.createdBy) === String(managerA._id) && await AuditEvent.exists({ company: a._id, actor: managerA._id, action: 'approval_chain.created', entityId: chain._id }), 'approval-chain creation stamps its creator and has mandatory audit evidence');
    assert((await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { body: { decision: 'approved' } })).status === 401, 'anonymous approval decision is denied');
    assert((await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { token: deniedToken, body: { decision: 'approved' } })).status === 403, 'agent without approvals.decide is denied');
    assert((await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { token: wrongRoleToken, body: { decision: 'approved' } })).status === 403, 'non-active approver role cannot decide the step');
    assert((await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { token: bToken, body: { decision: 'approved' } })).status === 404, 'cross-tenant approver cannot decide a foreign chain');
    assert((await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { token: managerToken, body: { decision: 'approved' } })).status === 403, 'approval-chain creator cannot decide their own chain');
    assert((await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { token: aToken, body: { decision: 'invalid' } })).status === 422, 'invalid approval decision is rejected');
    const decision = await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { token: aToken, body: { decision: 'approved' } });
    assert(decision.status === 200 && decision.data.status === 'approved', 'active authorized approver can decide the pending step');
    assert(await AuditEvent.exists({ company: a._id, actor: approverA._id, action: 'approval_chain.decided', entityId: chain._id }), 'approval decision has mandatory audit evidence');
    assert((await request('POST', `/gaps2/approval-chains/${chain._id}/decide`, { token: aToken, body: { decision: 'approved' } })).status === 409, 'approval decision cannot be submitted twice after completion');
    console.log('ITSM-12 APPROVAL SECURITY TESTS PASSED');
  } catch (error) { console.error('ITSM-12 APPROVAL SECURITY TEST FAILED:', error.message); process.exitCode = 1; }
  finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) { await AuditEvent.deleteMany({ company: { $in: companies } }); await P6.ApprovalChain.deleteMany({ tenantId: { $in: companies } }); await Agent.deleteMany({ company: { $in: companies } }); await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } }); await Company.deleteMany({ _id: { $in: companies } }); }
    await mongoose.disconnect();
  }
})();
