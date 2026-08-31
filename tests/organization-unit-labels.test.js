/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const OrganizationUnitLabel = require('../src/models/OrganizationUnitLabel');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5104;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };

(async () => {
  let server; const suffix = Date.now(); let companyA; let companyB; let admin; let member;
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    [companyA, companyB] = await Promise.all([Company.create({ name: `Labels A ${suffix}`, status: 'active' }), Company.create({ name: `Labels B ${suffix}`, status: 'active' })]);
    admin = await Agent.create({ name: 'Labels admin', email: `labels-admin-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isAdmin: true, isActive: true });
    member = await Agent.create({ name: 'Labels member', email: `labels-member-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isActive: true });
    await OrganizationUnitLabel.create({ company: companyB._id, type: 'business_unit', label: 'Store' });
    const [adminLogin, memberLogin] = await Promise.all([request('POST', '/auth/agent/login', { body: { email: admin.email, password: 'Pass@1234' } }), request('POST', '/auth/agent/login', { body: { email: member.email, password: 'Pass@1234' } })]);
    const saved = await request('PUT', '/rbac/unit-labels/business_unit', { token: adminLogin.data.token, body: { label: 'Hospital' } });
    assert(saved.status === 200 && saved.data.item.label === 'Hospital', 'tenant administrator can rename a unit type');
    const list = await request('GET', '/rbac/unit-labels', { token: adminLogin.data.token });
    assert(list.status === 200 && list.data.items.some((item) => item.type === 'business_unit' && item.label === 'Hospital'), 'tenant reads its own renamed label');
    assert(!list.data.items.some((item) => item.label === 'Store'), 'tenant cannot read another tenant label');
    assert((await request('PUT', '/rbac/unit-labels/not-a-type', { token: adminLogin.data.token, body: { label: 'Invalid' } })).status === 422, 'invalid unit type label is denied');
    assert((await request('PUT', '/rbac/unit-labels/business_unit', { token: memberLogin.data.token, body: { label: 'Blocked' } })).status === 403, 'non-admin cannot rename tenant unit labels');
    assert(await AuditEvent.exists({ company: companyA._id, actor: admin._id, action: 'organization_unit_label.updated' }), 'unit label change is audit logged');
    console.log('ORGANIZATION UNIT LABEL TESTS PASSED');
  } catch (error) { console.error('ORGANIZATION UNIT LABEL TEST FAILED:', error.message); process.exitCode = 1; }
  finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companyA) await OrganizationUnitLabel.deleteMany({ company: companyA._id });
    if (companyB) await OrganizationUnitLabel.deleteMany({ company: companyB._id });
    if (admin) { await Agent.deleteOne({ _id: admin._id }); await AuditEvent.deleteMany({ actor: admin._id }); }
    if (member) await Agent.deleteOne({ _id: member._id });
    await Company.deleteMany({ name: { $regex: String(suffix) } });
    await mongoose.disconnect();
  }
})();
