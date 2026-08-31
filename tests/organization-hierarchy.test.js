/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const OrganizationUnit = require('../src/models/OrganizationUnit');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5103;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };

(async () => {
  let server; const suffix = Date.now(); let companyA; let companyB; let admin; let member; const created = [];
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    [companyA, companyB] = await Promise.all([Company.create({ name: `Hierarchy A ${suffix}`, status: 'active' }), Company.create({ name: `Hierarchy B ${suffix}`, status: 'active' })]);
    admin = await Agent.create({ name: 'Hierarchy admin', email: `hierarchy-admin-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isAdmin: true, isActive: true });
    member = await Agent.create({ name: 'Hierarchy member', email: `hierarchy-member-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isActive: true });
    const [adminLogin, memberLogin] = await Promise.all([request('POST', '/auth/agent/login', { body: { email: admin.email, password: 'Pass@1234' } }), request('POST', '/auth/agent/login', { body: { email: member.email, password: 'Pass@1234' } })]);
    assert(adminLogin.status === 200 && adminLogin.data.token, 'organisation administrator can authenticate');
    assert((await request('GET', '/rbac/units', { token: memberLogin.data.token })).status === 403, 'non-admin cannot manage organisation hierarchy');
    const create = async (body) => { const result = await request('POST', '/rbac/units', { token: adminLogin.data.token, body }); assert(result.status === 201, `created ${body.type} unit`); created.push(result.data.item); return result.data.item; };
    const root = await create({ name: `Acme ${suffix}`, type: 'organization', label: 'Organisation' });
    const division = await create({ name: `North ${suffix}`, type: 'division', parent: root._id });
    const team = await create({ name: `Support ${suffix}`, type: 'team', parent: division._id });
    const tree = await request('GET', '/rbac/units/tree', { token: adminLogin.data.token });
    assert(tree.status === 200 && tree.data.items.some((unit) => unit._id === root._id && unit.children?.some((child) => child._id === division._id && child.children?.some((grandchild) => grandchild._id === team._id))), 'tree endpoint returns parent-child hierarchy');
    const selfParent = await request('PUT', `/rbac/units/${division._id}`, { token: adminLogin.data.token, body: { parent: division._id } });
    assert(selfParent.status === 422, 'self-parenting is denied');
    const cycle = await request('PUT', `/rbac/units/${root._id}`, { token: adminLogin.data.token, body: { parent: team._id } });
    assert(cycle.status === 422, 'descendant-parent cycle is denied');
    const foreign = await OrganizationUnit.create({ company: companyB._id, name: `Foreign ${suffix}`, type: 'organization' }); created.push(foreign);
    const crossTenant = await request('POST', '/rbac/units', { token: adminLogin.data.token, body: { name: `Invalid ${suffix}`, type: 'team', parent: foreign._id } });
    assert(crossTenant.status === 422, 'cross-tenant parent is denied');
    const list = await request('GET', '/rbac/units', { token: adminLogin.data.token });
    assert(list.status === 200 && !list.data.items.some((unit) => String(unit._id) === String(foreign._id)), 'tenant hierarchy listing excludes other tenants');
    assert(await AuditEvent.exists({ company: companyA._id, actor: admin._id, action: 'organization_unit.created' }), 'hierarchy creation is audit logged');
    console.log('ORGANIZATION HIERARCHY TESTS PASSED');
  } catch (error) { console.error('ORGANIZATION HIERARCHY TEST FAILED:', error.message); process.exitCode = 1; }
  finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companyA) await OrganizationUnit.deleteMany({ company: companyA._id });
    if (companyB) await OrganizationUnit.deleteMany({ company: companyB._id });
    if (admin) { await Agent.deleteOne({ _id: admin._id }); await AuditEvent.deleteMany({ actor: admin._id }); }
    if (member) await Agent.deleteOne({ _id: member._id });
    await Company.deleteMany({ name: { $regex: String(suffix) } });
    await mongoose.disconnect();
  }
})();
