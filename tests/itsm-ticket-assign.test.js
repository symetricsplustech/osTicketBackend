/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Team = require('../src/models/Team');
const Ticket = require('../src/models/Ticket');
const TicketThread = require('../src/models/TicketThread');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5110;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };

(async () => {
  let server;
  let coA; let coB; let owner; let deptA1; let deptB1; let teamA; let adminA; let agentA1; let agentA2; let agentB1; let agentNoPerm; let ticket;
  const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    coA = await Company.create({ name: `Assign A ${suffix}`, status: 'active' });
    coB = await Company.create({ name: `Assign B ${suffix}`, status: 'active' });
    const now = new Date();
    const db = mongoose.connection.db;
    for (const c of [coA, coB]) {
      await db.collection('tenant_modules').updateOne(
        { tenantId: c._id, moduleKey: 'helpdesk' },
        { $set: { status: 'active', activatedAt: now, updatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } },
        { upsert: true }
      );
    }
    deptA1 = await Department.create({ name: `Assign A1 ${suffix}`, company: coA._id });
    deptB1 = await Department.create({ name: `Assign B1 ${suffix}`, company: coB._id });
    teamA = await Team.create({ name: `Assign TeamA ${suffix}`, company: coA._id, status: 'active' });
    owner = await User.create({ name: 'Assign owner', email: `asg-owner-${suffix}@osticket.local`, password: 'Pass@1234', company: coA._id, isRegistered: true, status: 'active' });
    const mkAgent = (name, company, departments, permissions) => Agent.create({ name, email: `${name.toLowerCase().replace(/\s+/g, '-')}-${suffix}@osticket.local`, password: 'Pass@1234', company, isActive: true, departments, permissions, isAdmin: false });
    adminA = await Agent.create({ name: 'Assign admin', email: `asg-admin-${suffix}@osticket.local`, password: 'Pass@1234', company: coA._id, isAdmin: true, isActive: true });
    agentA1 = await mkAgent('Assign A1', coA._id, [{ department: deptA1._id, isPrimary: true }], ['tickets.assign', 'tickets.transfer', 'tickets.reply', 'tickets.note']);
    agentA2 = await mkAgent('Assign A2', coA._id, [{ department: deptA1._id, isPrimary: true }], []);
    agentB1 = await mkAgent('Assign B1', coB._id, [{ department: deptB1._id, isPrimary: true }], []);
    agentNoPerm = await mkAgent('Assign NoPerm', coA._id, [{ department: deptA1._id, isPrimary: true }], []);
    ticket = await Ticket.create({ number: `ASG-${suffix}`, company: coA._id, user: owner._id, dept: deptA1._id, subject: 'Assignment ticket', priority: 'Normal', status: 'open' });

    const login = async (path, body) => { const r = await request('POST', path, { body }); return r.data.token; };
    const tokenA1 = await login('/auth/agent/login', { email: agentA1.email, password: 'Pass@1234' });
    const tokenNoPerm = await login('/auth/agent/login', { email: agentNoPerm.email, password: 'Pass@1234' });
    const tokenB1 = await login('/auth/agent/login', { email: agentB1.email, password: 'Pass@1234' });

    // --- Denial: no permission ---
    const noPermAssign = await request('POST', `/agent/tickets/${ticket.number}/assign`, { token: tokenNoPerm, body: { agentId: String(agentA2._id) } });
    assert(noPermAssign.status === 403, 'an agent without tickets.assign is denied');
    // cross-tenant agent cannot assign or read the A-ticket at all (403/404)
    const crossTenantAssign = await request('POST', `/agent/tickets/${ticket.number}/assign`, { token: tokenB1, body: { agentId: String(agentB1._id) } });
    assert([403, 404].includes(crossTenantAssign.status), 'a B-tenant agent cannot assign the A-ticket');

    // --- Assign in-tenant agent (A1 -> A2) ---
    const assign = await request('POST', `/agent/tickets/${ticket.number}/assign`, { token: tokenA1, body: { agentId: String(agentA2._id) } });
    assert(assign.status === 200, 'scoped agent can assign an in-tenant agent');
    const reloaded = await Ticket.findById(ticket._id);
    assert(String(reloaded.agent) === String(agentA2._id), 'ticket is assigned to the target agent');
    assert(reloaded.status === 'assigned', 'ticket status becomes assigned');
    assert(await AuditEvent.exists({ company: coA._id, action: 'ticket.assigned', entityId: ticket._id }), 'assignment is audit logged');
    assert(await TicketThread.exists({ ticket: ticket._id, type: 'system' }), 'assignment system-event history is recorded');

    // --- Cross-tenant assign scope denial (assign A-ticket to a B-tenant agent) ---
    const crossTenantTarget = await request('POST', `/agent/tickets/${ticket.number}/assign`, { token: tokenA1, body: { agentId: String(agentB1._id) } });
    assert([403, 404].includes(crossTenantTarget.status), 'cannot assign an in-tenant ticket to an out-of-tenant agent');
    const stillA2 = await Ticket.findById(ticket._id);
    assert(String(stillA2.agent) === String(agentA2._id), 'ticket assignment unchanged after cross-tenant assign attempt');

    // --- Assignment to team ---
    const toTeam = await request('POST', `/agent/tickets/${ticket.number}/assign`, { token: tokenA1, body: { teamId: String(teamA._id) } });
    assert(toTeam.status === 200, 'scoped agent can assign an in-tenant team');
    const withTeam = await Ticket.findById(ticket._id);
    assert(String(withTeam.team) === String(teamA._id), 'ticket is assigned to the target team');

    // --- Claim / takeover ---
    const unassigned = await Ticket.create({ number: `ASG-CLM-${suffix}`, company: coA._id, user: owner._id, dept: deptA1._id, subject: 'Claim ticket', priority: 'Normal', status: 'open' });
    const claim = await request('POST', `/agent/tickets/${unassigned.number}/claim`, { token: tokenA1 });
    assert(claim.status === 200, 'agent can claim an unassigned in-tenant ticket');
    const claimedTicket = await Ticket.findById(unassigned._id);
    assert(String(claimedTicket.agent) === String(agentA1._id), 'claimed ticket is assigned to the claiming agent');
    assert(await AuditEvent.exists({ company: coA._id, action: 'ticket.claimed', entityId: unassigned._id }), 'claim is audit logged');
    const claimTaken = await request('POST', `/agent/tickets/${unassigned.number}/claim`, { token: await login('/auth/agent/login', { email: adminA.email, password: 'Pass@1234' }) });
    assert(claimTaken.status === 409, 'a second agent cannot take over an already-claimed ticket');

    // --- Assign in-tenant agent A2 -> A1 (reassignment) ---
    const reassign = await request('POST', `/agent/tickets/${ticket.number}/assign`, { token: tokenA1, body: { agentId: String(agentA1._id) } });
    assert(reassign.status === 200, 'scoped agent can reassign an in-tenant agent');
    assert((await AuditEvent.countDocuments({ company: coA._id, action: 'ticket.assigned', entityId: ticket._id })) >= 2, 'reassignment appends assignment history');

    // --- Cross-tenant transfer scope denial (A-ticket to B dept) ---
    const crossTransfer = await request('POST', `/agent/tickets/${ticket.number}/transfer`, { token: tokenA1, body: { deptId: String(deptB1._id) } });
    assert([403, 404].includes(crossTransfer.status), 'cannot transfer an in-tenant ticket to an out-of-tenant department');
    const stillDeptA = await Ticket.findById(ticket._id);
    assert(String(stillDeptA.dept) === String(deptA1._id), 'ticket department unchanged after cross-tenant transfer attempt');

    // --- In-tenant transfer + audit ---
    const transfer = await request('POST', `/agent/tickets/${ticket.number}/transfer`, { token: tokenA1, body: { deptId: String(deptA1._id) } });
    assert(transfer.status === 200, 'scoped agent can transfer to an in-tenant department');
    assert(await AuditEvent.exists({ company: coA._id, action: 'ticket.transferred', entityId: ticket._id }), 'transfer is audit logged');

    console.log('ITSM-01.04 TICKET ASSIGNMENT / CLAIM / REASSIGNMENT TESTS PASSED');
  } catch (error) {
    console.error('ITSM-01.04 TICKET ASSIGNMENT / CLAIM / REASSIGNMENT TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    const corps = [coA?._id, coB?._id].filter(Boolean);
    if (corps.length) {
      const db = mongoose.connection.db;
      await db.collection('tenant_modules').deleteMany({ tenantId: { $in: corps.map((c) => new mongoose.Types.ObjectId(c)) } });
      await AuditEvent.deleteMany({ company: { $in: corps } });
      await TicketThread.deleteMany({ company: { $in: corps } });
      await Ticket.deleteMany({ company: { $in: corps } });
      await Team.deleteMany({ company: { $in: corps } });
      await Department.deleteMany({ company: { $in: corps } });
      await User.deleteMany({ company: { $in: corps } });
      await Agent.deleteMany({ company: { $in: corps } });
      await Company.deleteMany({ _id: { $in: corps } });
    }
    await mongoose.disconnect();
  }
})();
