/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Agent = require('../src/models/Agent');
const { Product } = require('../src/models/Product');
const AuditEvent = require('../src/models/AuditEvent');
const { runWithTenant } = require('../src/middleware/tenantScope');

const port = 5101;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };

(async () => {
  let server; const suffix = Date.now(); const emails = []; const agentEmails = []; let tenantBProduct; let scopedProduct; let tenantlessUser;
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    const [tenantA, tenantB] = await Promise.all([
      Company.create({ name: `Tenant A ${suffix}`, status: 'active' }),
      Company.create({ name: `Tenant B ${suffix}`, status: 'active' }),
    ]);
    const makeUser = async (name, company) => { const email = `tenant_${name}_${suffix}@osticket.local`; emails.push(email); return User.create({ name, email, password: 'Pass@1234', company, isRegistered: true, emailConfirmed: true, status: 'active' }); };
    const [userA, userB, tenantless] = await Promise.all([makeUser('a', tenantA._id), makeUser('b', tenantB._id), makeUser('none', null)]);
    tenantlessUser = tenantless;
    const makeAgent = async (name, company) => { const email = `tenant_agent_${name}_${suffix}@osticket.local`; agentEmails.push(email); return Agent.create({ name, email, password: 'Pass@1234', company, isActive: true }); };
    const [agentA, agentB, agentNone] = await Promise.all([makeAgent('a', tenantA._id), makeAgent('b', tenantB._id), makeAgent('none', null)]);
    tenantBProduct = await Product.create({ name: `Tenant B Product ${suffix}`, tenantId: tenantB._id });
    const automaticScopeResult = await new Promise((resolve, reject) => runWithTenant(tenantA._id, () => {
      Product.find({ _id: tenantBProduct._id }).then(resolve, reject);
    }));
    assert(automaticScopeResult.length === 0, 'request tenant context automatically scopes an omitted tenant query');
    scopedProduct = await new Promise((resolve, reject) => runWithTenant(tenantA._id, () => {
      Product.create({ name: `Context Scoped Product ${suffix}` }).then(resolve, reject);
    }));
    assert(String(scopedProduct.tenantId) === String(tenantA._id), 'request tenant context stamps new tenant records');
    const login = async (email) => request('POST', '/auth/login', { body: { email, password: 'Pass@1234' } });
    const [loginA, loginB, loginNone] = await Promise.all([login(userA.email), login(userB.email), login(tenantless.email)]);
    assert(loginA.status === 200 && loginA.data.token, 'tenant A user can authenticate');
    assert(loginB.status === 200 && loginB.data.token, 'tenant B user can authenticate');
    assert(loginNone.status === 200 && loginNone.data.token, 'tenant-less login does not issue elevated access');
    assert((await request('GET', '/users/notifications')).status === 401, 'unauthenticated request is denied');
    assert((await request('GET', '/users/notifications', { token: loginNone.data.token })).status === 403, 'tenant-less authenticated request is denied');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert(await AuditEvent.exists({ actor: tenantless._id, action: 'tenant.access_denied', 'after.reason': 'missing_tenant_membership' }), 'tenant denial is audit logged');
    assert((await request('GET', '/users/notifications', { token: loginA.data.token })).status === 200, 'tenant A request is allowed');
    assert((await request('GET', '/users/notifications', { token: loginB.data.token })).status === 200, 'tenant B request is allowed');
    const [agentLogin, agentBLogin, tenantlessAgentLogin] = await Promise.all([request('POST', '/auth/agent/login', { body: { email: agentA.email, password: 'Pass@1234' } }), request('POST', '/auth/agent/login', { body: { email: agentB.email, password: 'Pass@1234' } }), request('POST', '/auth/agent/login', { body: { email: agentNone.email, password: 'Pass@1234' } })]);
    assert((await request('GET', '/products/products')).status === 401, 'previously unprotected product route now denies anonymous access');
    assert((await request('GET', '/products/products', { token: tenantlessAgentLogin.data.token })).status === 403, 'tenant-less agent is denied on protected operational route');
    const productsA = await request('GET', '/products/products', { token: agentLogin.data.token });
    const productsB = await request('GET', '/products/products', { token: agentBLogin.data.token });
    assert(productsA.status === 200, 'tenant-bound agent is allowed on protected operational route');
    assert(!productsA.data.some((product) => String(product._id) === String(tenantBProduct._id)), 'tenant A cannot read tenant B operational data');
    assert(productsB.data.some((product) => String(product._id) === String(tenantBProduct._id)), 'tenant B can read its own operational data');
    const registration = await request('POST', '/auth/register', { body: { name: 'No Tenant', email: `registration_${suffix}@osticket.local`, password: 'Pass@1234' } });
    assert(registration.status === 422, 'tenant-less registration is denied');
    console.log('TENANT ISOLATION TESTS PASSED');
  } catch (error) { console.error('TENANT ISOLATION TEST FAILED:', error.message); process.exitCode = 1; }
  finally { if (server) await new Promise((resolve) => server.close(resolve)); await User.deleteMany({ email: { $in: emails } }); await Agent.deleteMany({ email: { $in: agentEmails } }); if (tenantlessUser) await AuditEvent.deleteMany({ actor: tenantlessUser._id, action: 'tenant.access_denied' }); if (tenantBProduct) await Product.deleteOne({ _id: tenantBProduct._id }); if (scopedProduct) await Product.deleteOne({ _id: scopedProduct._id }); await Company.deleteMany({ name: new RegExp(String(suffix)) }); await mongoose.disconnect(); }
})();
