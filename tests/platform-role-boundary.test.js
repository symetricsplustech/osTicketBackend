/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Role = require('../src/models/Role');
const Agent = require('../src/models/Agent');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5102;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };

(async () => {
  let server; const suffix = Date.now(); let tenantA; let tenantB; let admin; let tenantRole; let platformRole;
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    [tenantA, tenantB] = await Promise.all([
      Company.create({ name: `Role A ${suffix}`, status: 'active' }),
      Company.create({ name: `Role B ${suffix}`, status: 'active' }),
    ]);
    tenantRole = await Role.create({ name: `Tenant Role ${suffix}`, scope: 'tenant', company: tenantA._id, category: 'operational' });
    platformRole = await Role.create({ name: `Platform Role ${suffix}`, scope: 'platform', category: 'platform' });
    assert(tenantRole.scope === 'tenant' && String(tenantRole.company) === String(tenantA._id), 'tenant role is tenant-owned');
    assert(platformRole.scope === 'platform' && !platformRole.company, 'platform role has no tenant owner');
    await Role.create({ name: `Bad Tenant ${suffix}`, scope: 'tenant', category: 'operational' }).then(() => { throw new Error('tenant role without company was accepted'); }, () => {});
    await Role.create({ name: `Bad Platform ${suffix}`, scope: 'platform', company: tenantA._id, category: 'platform' }).then(() => { throw new Error('platform role with company was accepted'); }, () => {});
    console.log('PASS role model rejects mixed platform and tenant ownership');
    await Agent.create({ name: 'Wrong role', email: `wrong-role-${suffix}@osticket.local`, password: 'Pass@1234', company: tenantA._id, role: platformRole._id }).then(() => { throw new Error('agent received platform role'); }, () => {});
    await Agent.create({ name: 'Cross tenant role', email: `cross-role-${suffix}@osticket.local`, password: 'Pass@1234', company: tenantB._id, role: tenantRole._id }).then(() => { throw new Error('agent received another tenant role'); }, () => {});
    console.log('PASS agents cannot receive platform or other-tenant roles');
    admin = await Agent.create({ name: 'Role admin', email: `role-admin-${suffix}@osticket.local`, password: 'Pass@1234', company: tenantA._id, isAdmin: true, isActive: true });
    const login = await request('POST', '/auth/agent/login', { body: { email: admin.email, password: 'Pass@1234' } });
    assert(login.status === 200 && login.data.token, 'tenant administrator can authenticate');
    const modules = await request('GET', '/auth/modules', { token: login.data.token });
    assert(modules.status === 200, 'tenant administrator can load tenant module entitlements');
    const list = await request('GET', '/admin/roles', { token: login.data.token });
    assert(list.status === 200 && list.data.items.every((role) => role.scope === 'tenant' && String(role.company) === String(tenantA._id)), 'tenant role API never returns platform roles');
    const forbidden = await request('POST', '/admin/roles', { token: login.data.token, body: { name: 'Attempt platform role', category: 'platform' } });
    assert(forbidden.status === 422, 'tenant role API denies platform role creation');
    assert(await AuditEvent.exists({ company: tenantA._id, actor: admin._id, action: 'role.platform_creation_denied' }), 'platform role denial is audit logged');
    const assignment = await request('POST', '/rbac/assignments', { token: login.data.token, body: { principal: admin._id, principalType: 'agent', roles: [platformRole._id] } });
    assert(assignment.status === 422, 'tenant role assignment denies platform role');
    console.log('PLATFORM ROLE BOUNDARY TESTS PASSED');
  } catch (error) { console.error('PLATFORM ROLE BOUNDARY TEST FAILED:', error.message); process.exitCode = 1; }
  finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (admin) await Agent.deleteOne({ _id: admin._id });
    await Agent.deleteMany({ email: { $regex: String(suffix) } });
    if (tenantRole) await Role.deleteOne({ _id: tenantRole._id });
    if (platformRole) await Role.deleteOne({ _id: platformRole._id });
    await Role.deleteMany({ name: { $regex: String(suffix) } });
    if (admin) await AuditEvent.deleteMany({ actor: admin._id });
    await Company.deleteMany({ name: { $regex: String(suffix) } });
    await mongoose.disconnect();
  }
})();
