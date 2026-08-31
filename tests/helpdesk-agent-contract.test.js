/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Ticket = require('../src/models/Ticket');
const TicketThread = require('../src/models/TicketThread');

const port = 5105;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS ${message}`); };

(async () => {
  let server; let company; let admin; let assignee; let requester; let sourceDept; let targetDept; let ticket;
  const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    company = await Company.create({ name: `Helpdesk Contract ${suffix}`, status: 'active' });
    [sourceDept, targetDept] = await Promise.all([
      Department.create({ name: `Helpdesk Source ${suffix}`, company: company._id }),
      Department.create({ name: `Helpdesk Target ${suffix}`, company: company._id }),
    ]);
    [admin, assignee, requester] = await Promise.all([
      Agent.create({ name: 'Helpdesk admin', email: `helpdesk-admin-${suffix}@osticket.local`, password: 'Pass@1234', company: company._id, isAdmin: true, isActive: true, departments: [{ department: sourceDept._id, isPrimary: true }] }),
      Agent.create({ name: 'Helpdesk assignee', email: `helpdesk-assignee-${suffix}@osticket.local`, password: 'Pass@1234', company: company._id, isActive: true, departments: [{ department: targetDept._id, isPrimary: true }] }),
      User.create({ name: 'Helpdesk requester', email: `helpdesk-requester-${suffix}@osticket.local`, company: company._id }),
    ]);
    ticket = await Ticket.create({ number: `HD-${suffix}`, company: company._id, user: requester._id, dept: sourceDept._id, subject: 'Contract test ticket', priority: 'Normal' });
    const login = await request('POST', '/auth/agent/login', { body: { email: admin.email, password: 'Pass@1234' } });
    assert(login.status === 200 && login.data.token, 'agent authentication succeeds');
    const token = login.data.token;

    const note = await request('POST', `/agent/tickets/${ticket.number}/note`, { token, body: { message: 'Internal contract note' } });
    assert(note.status === 200, 'agent note uses POST /note with message payload');
    const assigned = await request('POST', `/agent/tickets/${ticket.number}/assign`, { token, body: { agentId: assignee._id.toString() } });
    assert(assigned.status === 200 && String(assigned.data.ticket.agent) === String(assignee._id), 'agent assignment uses POST and persists the selected agent');
    const transferred = await request('POST', `/agent/tickets/${ticket.number}/transfer`, { token, body: { deptId: targetDept._id.toString() } });
    assert(transferred.status === 200 && String(transferred.data.ticket.dept) === String(targetDept._id), 'department transfer uses POST and deptId payload');
    const status = await request('POST', `/agent/tickets/${ticket.number}/status`, { token, body: { status: 'closed' } });
    assert(status.status === 200 && status.data.ticket.status === 'closed', 'ticket status uses POST and validates a lifecycle status');
    const detail = await request('GET', `/agent/tickets/${ticket.number}`, { token });
    assert(detail.status === 200 && detail.data.ticket.subject === 'Contract test ticket', 'ticket detail returns the ticket domain record');
    assert(Array.isArray(detail.data.threads) && detail.data.threads.some((thread) => thread.body === 'Internal contract note'), 'ticket detail returns thread records separately from the ticket');
    console.log('HELPDESK AGENT CONTRACT TESTS PASSED');
  } catch (error) {
    console.error('HELPDESK AGENT CONTRACT TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (ticket) await TicketThread.deleteMany({ ticket: ticket._id });
    if (ticket) await Ticket.deleteOne({ _id: ticket._id });
    if (admin) await Agent.deleteOne({ _id: admin._id });
    if (assignee) await Agent.deleteOne({ _id: assignee._id });
    if (requester) await User.deleteOne({ _id: requester._id });
    if (sourceDept) await Department.deleteOne({ _id: sourceDept._id });
    if (targetDept) await Department.deleteOne({ _id: targetDept._id });
    if (company) await Company.deleteOne({ _id: company._id });
    await mongoose.disconnect();
  }
})();
