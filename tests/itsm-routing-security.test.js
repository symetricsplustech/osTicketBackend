/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Ticket = require('../src/models/helpdesk/tickets/Ticket');
const AuditEvent = require('../src/models/AuditEvent');
const P6 = require('../src/models/platformData');

const port = 5122; const base = `http://127.0.0.1:${port}/api/v1`;
const assert = (value, message) => { if (!value) throw new Error(message); console.log(`PASS ${message}`); };
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

(async () => {
  let server; const companies = []; const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 }); server = app.listen(port);
    const [a, b] = await Promise.all([Company.create({ name: `Routing A ${suffix}`, status: 'active' }), Company.create({ name: `Routing B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id); const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne({ tenantId: company._id, moduleKey: 'helpdesk' }, { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true })));
    const [routerA, deniedA, routerB, candidateA, userA] = await Promise.all([
      Agent.create({ name: 'Router A', email: `router-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['tickets.assign', 'tickets.view'] }),
      Agent.create({ name: 'Denied router A', email: `denied-router-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'Router B', email: `router-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['tickets.assign', 'tickets.view'] }),
      Agent.create({ name: 'Candidate A', email: `candidate-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      User.create({ name: 'Routing requester', email: `routing-user-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id }),
    ]);
    const ticket = await Ticket.create({ number: `ROUTE-${suffix}`, company: a._id, user: userA._id, subject: 'Route me', status: 'open' });
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, deniedToken, bToken] = await Promise.all([login(routerA.email), login(deniedA.email), login(routerB.email)]);
    assert((await request('POST', '/gaps2/routing/next-agent', { body: { ticketNumber: ticket.number } })).status === 401, 'anonymous routing selection is denied');
    assert((await request('POST', '/gaps2/routing/next-agent', { token: deniedToken, body: { ticketNumber: ticket.number } })).status === 403, 'agent without tickets.assign cannot select a route');
    assert((await request('POST', '/gaps2/routing/next-agent', { token: bToken, body: { ticketNumber: ticket.number } })).status === 404, 'cross-tenant router cannot select for a foreign ticket');
    const routed = await request('POST', '/gaps2/routing/next-agent', { token: aToken, body: { ticketNumber: ticket.number, strategy: 'round_robin', departmentKey: `security-${suffix}` } });
    assert(routed.status === 200 && await Agent.exists({ _id: routed.data.agent.id, company: a._id, isActive: true }), 'authorized router selects an active same-tenant candidate');
    assert(await P6.AssignmentHistory.exists({ tenantId: a._id, ticketNumber: ticket.number, toAgent: routed.data.agent.id }), 'routing decision persists tenant-scoped history');
    assert(await AuditEvent.exists({ company: a._id, actor: routerA._id, action: 'routing.next_agent_selected', entityId: ticket._id }), 'routing decision has mandatory audit evidence');
    assert((await request('GET', `/gaps2/assignments/history/${ticket.number}`, { token: deniedToken })).status === 403, 'agent without tickets.assign cannot read assignment history');
    assert((await request('POST', '/gaps2/routing/caps', { token: deniedToken, body: { agent: candidateA._id, dailyMaxOpen: 5 } })).status === 403, 'agent without tickets.assign cannot set a routing capacity');
    assert((await request('POST', '/gaps2/routing/caps', { token: aToken, body: { agent: routerB._id, dailyMaxOpen: 5 } })).status === 404, 'cross-tenant routing capacity agent is rejected');
    const cap = await request('POST', '/gaps2/routing/caps', { token: aToken, body: { agent: candidateA._id, dailyMaxOpen: 5, weeklyHours: 40 } });
    assert(cap.status === 201 && String(cap.data.tenantId) === String(a._id), 'authorized router can set a tenant-scoped routing capacity');
    assert(await AuditEvent.exists({ company: a._id, actor: routerA._id, action: 'routing.capacity_set', entityId: cap.data._id }), 'routing capacity change has mandatory audit evidence');
    console.log('ITSM-10 ROUTING SECURITY TESTS PASSED');
  } catch (error) { console.error('ITSM-10 ROUTING SECURITY TEST FAILED:', error.message); process.exitCode = 1; }
  finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await AuditEvent.deleteMany({ company: { $in: companies } }); await P6.AssignmentHistory.deleteMany({ tenantId: { $in: companies } }); await P6.WorkScheduleCap.deleteMany({ tenantId: { $in: companies } }); await P6.RoutingState.deleteMany({ tenantId: { $in: companies } }); await Ticket.deleteMany({ company: { $in: companies } }); await User.deleteMany({ company: { $in: companies } }); await Agent.deleteMany({ company: { $in: companies } }); await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } }); await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
