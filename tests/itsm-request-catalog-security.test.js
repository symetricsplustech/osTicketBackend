/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Agent = require('../src/models/Agent');
const ServiceCatalogItem = require('../src/models/ServiceCatalogItem');
const ServiceRequest = require('../src/models/helpdesk/incidents/ServiceRequest');
const RequestedItem = require('../src/models/domain').RequestedItem;
const AuditEvent = require('../src/models/AuditEvent');

const port = 5116; const base = `http://127.0.0.1:${port}/api/v1`;
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
    const [a, b] = await Promise.all([Company.create({ name: `Catalog A ${suffix}`, status: 'active' }), Company.create({ name: `Catalog B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id);
    const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey: 'helpdesk' },
      { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true },
    )));
    const [userA, userB, userAOther] = await Promise.all([
      User.create({ name: 'Catalog requester A', email: `catalog-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isRegistered: true, status: 'active' }),
      User.create({ name: 'Catalog requester B', email: `catalog-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isRegistered: true, status: 'active' }),
      User.create({ name: 'Catalog fulfilled A', email: `catalog-other-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isRegistered: true, status: 'active' }),
    ]);
    const [fulfiller, itemA, itemB] = await Promise.all([
      Agent.create({ name: 'Request fulfiller', email: `request-fulfiller-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.update'] }),
      ServiceCatalogItem.create({ name: 'Laptop A', company: a._id, isActive: true, visibleInPortal: true }),
      ServiceCatalogItem.create({ name: 'Laptop B', company: b._id, isActive: true, visibleInPortal: true }),
    ]);
    const login = async (email) => (await request('POST', '/auth/portal-login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, bToken, fulfillerToken] = await Promise.all([login(userA.email), login(userB.email), (await request('POST', '/auth/agent/login', { body: { email: fulfiller.email, password: 'Pass@1234' } })).data.token]);
    assert((await request('GET', '/public/service-catalog')).status === 422, 'unauthenticated catalog browsing cannot select an arbitrary tenant');
    const catalogA = await request('GET', '/public/service-catalog', { token: aToken });
    assert(catalogA.status === 200 && catalogA.data.items.some((item) => String(item._id) === String(itemA._id)) && !catalogA.data.items.some((item) => String(item._id) === String(itemB._id)), 'tenant catalog browsing returns only the authenticated tenant catalog');
    assert((await request('POST', '/gaps2/catalog/cart', { token: aToken, body: { items: [{ catalogItemId: itemA._id }] } })).status === 410, 'legacy checkout bypass is retired in favor of canonical audited checkout');
    assert((await request('POST', '/enterprise/requests/cart', { body: { items: [{ catalogItemId: itemA._id }] } })).status === 401, 'anonymous checkout is denied');
    assert((await request('POST', '/enterprise/requests/cart', { token: aToken, body: { items: [{ catalogItemId: itemB._id }] } })).status === 404, 'cross-tenant catalog item cannot be checked out');
    assert((await request('POST', '/enterprise/requests/cart', { token: aToken, body: { fulfilledFor: userB._id, items: [{ catalogItemId: itemA._id }] } })).status === 403, 'cross-tenant fulfilled-for user is denied');
    assert((await request('POST', '/enterprise/requests/cart', { token: aToken, body: { items: [{ catalogItemId: itemA._id, quantity: 0 }] } })).status === 422, 'invalid cart quantity is rejected');
    const checkout = await request('POST', '/enterprise/requests/cart', { token: aToken, body: { items: [{ catalogItemId: itemA._id, quantity: 1, answers: { memory: '16GB' } }] } });
    assert(checkout.status === 201, 'requester can check out an eligible tenant catalog item');
    const parent = await ServiceRequest.findOne({ company: a._id, requester: userA._id });
    assert(parent && String(parent.fulfilledFor) === String(userA._id) && parent.requestedItems.length === 1, 'checkout creates a tenant-scoped parent request and RITM');
    assert(await RequestedItem.exists({ _id: parent.requestedItems[0], tenantId: a._id, catalogItem: itemA._id }), 'RITM is tenant-scoped and linked to the verified catalog item');
    assert(await AuditEvent.exists({ company: a._id, actor: userA._id, action: 'service_request.created', entityId: parent._id }), 'checkout has mandatory audit evidence');
    assert((await request('GET', `/enterprise/requests/${parent._id}`, { token: aToken })).status === 200, 'requester can read their own service request and RITMs');
    assert([403, 404].includes((await request('GET', `/enterprise/requests/${parent._id}`, { token: bToken })).status), 'cross-tenant requester cannot read another request');
    assert((await request('POST', `/enterprise/requests/${parent._id}/requested-items/${parent.requestedItems[0]}/fulfill`, { token: fulfillerToken })).status === 200, 'tenant-scoped fulfiller can fulfill an in-progress RITM');
    assert((await ServiceRequest.findById(parent._id)).status === 'fulfilled', 'parent request completes after every RITM is fulfilled');
    assert(await AuditEvent.exists({ company: a._id, actor: fulfiller._id, action: 'requested_item.fulfilled', entityId: parent.requestedItems[0] }), 'RITM fulfillment has mandatory audit evidence');
    console.log('ITSM-06/07 REQUEST CATALOG SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-06/07 REQUEST CATALOG SECURITY TEST FAILED:', error.message); process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await RequestedItem.deleteMany({ tenantId: { $in: companies } });
      await ServiceRequest.deleteMany({ company: { $in: companies } });
      await ServiceCatalogItem.deleteMany({ company: { $in: companies } });
      await User.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
