/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Ticket = require('../src/models/helpdesk/tickets/Ticket');
const TicketThread = require('../src/models/helpdesk/tickets/TicketThread');
const AuditEvent = require('../src/models/AuditEvent');
const TicketWorklog = require('../src/models/platformServices/TicketWorklog');

const port = 5111;
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
  const companies = [];
  const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    const [companyA, companyB] = await Promise.all([
      Company.create({ name: `Action security A ${suffix}`, status: 'active' }),
      Company.create({ name: `Action security B ${suffix}`, status: 'active' }),
    ]);
    companies.push(companyA._id, companyB._id);
    const now = new Date();
    for (const company of [companyA, companyB]) {
      await mongoose.connection.db.collection('tenant_modules').updateOne(
        { tenantId: company._id, moduleKey: 'helpdesk' },
        { $set: { status: 'active', activatedAt: now, updatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } },
        { upsert: true }
      );
    }
    const [deptA, deptOther, deptB] = await Promise.all([
      Department.create({ name: `Action A ${suffix}`, company: companyA._id }),
      Department.create({ name: `Action Other ${suffix}`, company: companyA._id }),
      Department.create({ name: `Action B ${suffix}`, company: companyB._id }),
    ]);
    const [owner, otherOwner, ownerB] = await Promise.all([
      User.create({ name: 'Action owner', email: `action-owner-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isRegistered: true, status: 'active' }),
      User.create({ name: 'Action other', email: `action-other-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isRegistered: true, status: 'active' }),
      User.create({ name: 'Action owner B', email: `action-owner-b-${suffix}@osticket.local`, password: 'Pass@1234', company: companyB._id, isRegistered: true, status: 'active' }),
    ]);
    const [editor, closer] = await Promise.all([
      Agent.create({ name: 'Bulk editor', email: `bulk-editor-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isActive: true, permissions: ['tickets.view', 'tickets.edit', 'tickets.tasks', 'tickets.note'], departments: [{ department: deptA._id, isPrimary: true }] }),
      Agent.create({ name: 'Bulk closer', email: `bulk-closer-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id, isActive: true, permissions: ['tickets.view', 'tickets.close', 'tickets.delete'], departments: [{ department: deptA._id, isPrimary: true }] }),
    ]);
    const slaDueAt = new Date(Date.now() + 4 * 3600000);
    const [owned, outOfScope] = await Promise.all([
      Ticket.create({ number: `ACT-${suffix}`, company: companyA._id, user: owner._id, dept: deptA._id, subject: 'Owned action ticket', priority: 'Normal', status: 'open', dueDate: slaDueAt }),
      Ticket.create({ number: `ACT-OTHER-${suffix}`, company: companyA._id, user: otherOwner._id, dept: deptOther._id, subject: 'Out of scope ticket', priority: 'Normal', status: 'open', dueDate: slaDueAt }),
    ]);

    const login = async (path, email) => (await request('POST', path, { body: { email, password: 'Pass@1234' } })).data.token;
    const [ownerToken, otherToken, ownerBToken, editorToken, closerToken] = await Promise.all([
      login('/auth/portal-login', owner.email),
      login('/auth/portal-login', otherOwner.email),
      login('/auth/portal-login', ownerB.email),
      login('/auth/agent/login', editor.email),
      login('/auth/agent/login', closer.email),
    ]);

    assert((await request('GET', `/tickets/check-status?number=${owned.number}`)).status === 401, 'public ticket status enumeration is denied');
    assert((await request('GET', `/tickets/check-status?number=${owned.number}`, { token: ownerToken })).status === 200, 'owner can check an owned ticket status');
    assert([403, 404].includes((await request('GET', `/tickets/check-status?number=${owned.number}`, { token: otherToken })).status), 'same-tenant non-owner cannot check ticket status');
    assert([403, 404].includes((await request('GET', `/tickets/check-status?number=${owned.number}`, { token: ownerBToken })).status), 'cross-tenant requester cannot check ticket status');
    assert((await request('GET', `/public/csat/ticket/${owned.number}`, { token: ownerToken })).status === 200, 'owner can view CSAT configuration for their ticket');
    assert((await request('GET', `/public/csat/ticket/${owned.number}`, { token: otherToken })).status === 403, 'same-tenant non-owner cannot enumerate CSAT by ticket number');
    assert([401, 403].includes((await request('GET', `/public/csat/ticket/${owned.number}`)).status), 'anonymous CSAT ticket lookup is denied');
    assert((await request('POST', '/public/csat/submit', { body: { ticketNumber: owned.number, rating: 5 } })).status === 401, 'anonymous CSAT submission is denied');
    assert((await request('POST', '/public/csat/submit', { token: otherToken, body: { ticketNumber: owned.number, rating: 5 } })).status === 403, 'same-tenant non-owner cannot submit CSAT for another ticket');
    assert((await request('POST', '/gaps2/csat-negative-recovery-sweep', { token: ownerToken, body: {} })).status === 410, 'legacy CSAT recovery sweep is retired until shared task workflow exists');
    assert((await request('POST', `/tickets/${owned.number}/merge`, { token: ownerToken, body: { targetTicketId: outOfScope._id } })).status === 404, 'requester merge endpoint is not exposed');

    assert((await request('POST', `/tickets/${owned.number}/close`, { token: ownerToken })).status === 200, 'owner can close an owned ticket');
    assert(await AuditEvent.exists({ company: companyA._id, actor: owner._id, action: 'ticket.status_changed', entityId: owned._id }), 'requester close has mandatory audit evidence');
    assert((await request('POST', `/tickets/${owned.number}/reopen`, { token: ownerToken })).status === 200, 'owner can reopen inside the configured window');
    assert((await request('POST', `/agent/tickets/${owned.number}/fields`, { token: editorToken, body: { dueDate: 'not-a-date' } })).status === 422, 'ticket field updates reject an invalid due date');
    assert((await request('POST', `/agent/tickets/${owned.number}/tasks`, { token: editorToken, body: { title: 'Invalid due date task', dueDate: 'not-a-date' } })).status === 422, 'ticket task creation rejects an invalid due date');
    assert((await request('POST', `/gaps/worklogs/${owned.number}`, { token: ownerToken, body: { minutes: 15, note: 'Requester must not log agent time' } })).status === 403, 'requester cannot create an agent worklog');
    assert((await request('POST', `/gaps/worklogs/${outOfScope.number}`, { token: editorToken, body: { minutes: 15, note: 'Out-of-scope worklog' } })).status === 403, 'agent cannot log time on an out-of-scope ticket');
    assert((await request('POST', `/gaps/worklogs/${owned.number}`, { token: editorToken, body: { minutes: 15, note: 'Investigated access issue', billable: true } })).status === 201, 'authorized scoped agent can create a validated worklog');
    assert(await AuditEvent.exists({ company: companyA._id, actor: editor._id, action: 'ticket.worklog_created', entityId: owned._id }), 'worklog creation has mandatory audit evidence');
    const predictions = await request('GET', '/agent/tickets/sla/predictions', { token: editorToken });
    const predictedNumbers = ['atRisk', 'watching', 'green'].flatMap((bucket) => (predictions.data[bucket] || []).map((row) => row.number));
    assert(predictions.status === 200 && predictedNumbers.includes(owned.number) && !predictedNumbers.includes(outOfScope.number), 'SLA predictions are constrained to the agent ticket scope');
    const semantic = await request('GET', '/agent/search/semantic?q=Owned', { token: editorToken });
    assert(semantic.status === 200 && semantic.data.results.every((row) => row.entity === 'ticket') && semantic.data.results.every((row) => row.recordNumber !== outOfScope.number), 'semantic search returns only record-scoped ticket results');
    assert([403, 404].includes((await request('POST', `/agent/tickets/${outOfScope.number}/sla/predict`, { token: editorToken })).status), 'single-ticket SLA prediction rejects an out-of-scope ticket');
    const taskCreate = await request('POST', `/agent/tickets/${owned.number}/tasks`, { token: editorToken, body: { title: 'Verified task', dueDate: new Date(Date.now() + 86400000).toISOString() } });
    assert(taskCreate.status === 201, 'authorized scoped agent can create a ticket task');
    assert((await request('PUT', `/agent/tickets/${owned.number}/tasks/${taskCreate.data.task._id}`, { token: editorToken, body: { status: 'invalid' } })).status === 422, 'ticket task updates reject an invalid status');
    assert(await AuditEvent.exists({ company: companyA._id, actor: editor._id, action: 'ticket.task_created', entityId: owned._id }), 'ticket task creation has mandatory audit evidence');

    const deniedBulkClose = await request('POST', '/bulk/status', { token: editorToken, body: { ticketIds: [owned._id], status: 'closed' } });
    assert(deniedBulkClose.status === 403, 'bulk close requires tickets.close, not tickets.edit');
    const bulkPriority = await request('POST', '/bulk/priority', { token: editorToken, body: { ticketIds: [owned._id, outOfScope._id], priority: 'High' } });
    assert(bulkPriority.status === 200 && bulkPriority.data.modified === 1 && bulkPriority.data.skipped.length === 1, 'bulk priority updates only record-scoped tickets');
    assert((await Ticket.findById(outOfScope._id)).priority === 'Normal', 'out-of-scope bulk priority leaves the record unchanged');
    assert(await AuditEvent.exists({ company: companyA._id, actor: editor._id, action: 'ticket.priority_changed', entityId: owned._id }), 'bulk priority change is audited');

    const bulkDelete = await request('POST', '/bulk/delete', { token: closerToken, body: { ticketIds: [owned._id, outOfScope._id] } });
    assert(bulkDelete.status === 200 && bulkDelete.data.modified === 1 && bulkDelete.data.skipped.length === 1, 'bulk delete affects only record-scoped tickets');
    assert((await Ticket.findById(outOfScope._id)).status !== Ticket.STATUSES.DELETED, 'out-of-scope bulk delete leaves the record unchanged');
    assert(await AuditEvent.exists({ company: companyA._id, actor: closer._id, action: 'ticket.deleted', entityId: owned._id }), 'bulk delete has mandatory audit evidence');

    console.log('ITSM-01 TICKET ACTION SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-01 TICKET ACTION SECURITY TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await TicketThread.deleteMany({ company: { $in: companies } });
      await TicketWorklog.deleteMany({ tenantId: { $in: companies } });
      await Ticket.deleteMany({ company: { $in: companies } });
      await Department.deleteMany({ company: { $in: companies } });
      await User.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
