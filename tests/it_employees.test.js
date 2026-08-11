/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const User = require('../src/models/User');
const Ticket = require('../src/models/Ticket');

const PORT = 5099;
const base = `http://localhost:${PORT}`;
const email = (n) => `itest_${n}@osticket.local`;
let server;

const req = async (method, path, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { data = {}; }
  return { status: res.status, data };
};

const ok = (cond, label) => {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  PASS: ${label}`);
};

(async () => {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(PORT, () => console.log(`Test server on ${PORT}`));
    await new Promise((r) => setTimeout(r, 800));

    const suffix = Date.now();
    const ownerEmail = email(`owner_${suffix}`);
    const empEmail = email(`emp_${suffix}`);

    // Seed a main customer directly
    const owner = await User.create({ name: 'IT Owner', email: ownerEmail, password: 'Pass@1234', isRegistered: true, emailConfirmed: true });
    let login = await req('POST', '/api/v1/auth/login', { body: { email: ownerEmail, password: 'Pass@1234' } });
    ok(login.status === 200 && login.data.token, 'main customer login');
    const ownerToken = login.data.token;

    // 1. Create employee with partial permissions
    let r = await req('POST', '/api/v1/users/employees', { token: ownerToken, body: { name: 'IT Emp', email: empEmail, password: 'Emp@1234', permissions: ['ticket_view', 'ticket_reply'] } });
    ok(r.status === 201 && r.data.user, 'create employee');
    const empId = r.data.user._id;
    ok(r.data.user.permissions.length === 2, 'permissions saved');
    const empUser = await User.findById(empId);
    ok(String(empUser.createdBy) === String(owner._id), 'employee.createdBy set');
    ok(empUser.isRegistered === true, 'employee registered');

    // 2. List employees as owner
    r = await req('GET', '/api/v1/users/employees', { token: ownerToken });
    ok(r.status === 200 && r.data.items.length === 1, 'list employees (owner)');

    // 3. Employee cannot list employees (403)
    let empLogin = await req('POST', '/api/v1/auth/login', { body: { email: empEmail, password: 'Emp@1234' } });
    ok(empLogin.status === 200, 'employee login');
    const empToken = empLogin.data.token;
    r = await req('GET', '/api/v1/users/employees', { token: empToken });
    ok(r.status === 403, 'employee cannot manage employees');

    // 4. Employee without ticket_create -> 403 on create
    r = await req('POST', '/api/v1/tickets', { token: empToken, body: { subject: 'Test', details: 'no create perm', topic: '', priority: 'Normal' } });
    ok(r.status === 403, 'employee without create permission blocked');

    // 5. Owner creates a ticket
    r = await req('POST', '/api/v1/tickets', { token: ownerToken, body: { subject: 'Owner ticket', details: 'hello', priority: 'Normal' } });
    ok(r.status === 201 && r.data.ticket, 'owner creates ticket');
    const ticketNumber = r.data.ticket.number;
    ok(String(r.data.ticket.createdBy) === String(owner._id), 'owner ticket createdBy = owner');

    // 6. Employee with ticket_view can list + view tickets
    r = await req('GET', '/api/v1/tickets', { token: empToken });
    ok(r.status === 200 && r.data.items.length >= 1, 'employee lists org tickets');
    r = await req('GET', `/api/v1/tickets/${ticketNumber}`, { token: empToken });
    ok(r.status === 200 && r.data.ticket.number === ticketNumber, 'employee views ticket');

    // 7. Employee with ticket_reply can reply
    r = await req('POST', `/api/v1/tickets/${ticketNumber}/reply`, { token: empToken, body: { message: 'reply from employee' } });
    ok(r.status === 200, 'employee replies to ticket');

    // 7b. Owner notified when employee replies
    let ownerNotifs = await req('GET', '/api/v1/users/notifications', { token: ownerToken });
    ok(ownerNotifs.data.items.some((n) => n.message.includes('replied on ticket')), 'owner notified of employee reply');

    // 8. Employee without ticket_delete cannot delete
    r = await req('DELETE', `/api/v1/tickets/${ticketNumber}`, { token: empToken });
    ok(r.status === 403, 'employee without delete permission blocked');

    // 9. Update employee permissions (add delete) then delete works
    r = await req('PUT', `/api/v1/users/employees/${empId}`, { token: ownerToken, body: { permissions: ['ticket_view', 'ticket_reply', 'ticket_delete'] } });
    ok(r.status === 200, 'update employee permissions');
    r = await req('DELETE', `/api/v1/tickets/${ticketNumber}`, { token: empToken });
    ok(r.status === 200, 'employee deletes ticket after permission granted');
    const deletedTicket = await Ticket.findOne({ number: ticketNumber });
    ok(deletedTicket.status === 'deleted', 'ticket soft-deleted');

    // 9b. Owner notified when employee deletes ticket
    ownerNotifs = await req('GET', '/api/v1/users/notifications', { token: ownerToken });
    ok(ownerNotifs.data.items.some((n) => n.message.includes('deleted on ticket')), 'owner notified of employee delete');

    // 10. Employee profile/password update
    r = await req('PUT', '/api/v1/users/me', { token: empToken, body: { name: 'IT Emp Updated', currentPassword: 'Emp@1234', password: 'Emp@5678' } });
    ok(r.status === 200 && r.data.user.name === 'IT Emp Updated', 'employee profile update');
    empLogin = await req('POST', '/api/v1/auth/login', { body: { email: empEmail, password: 'Emp@5678' } });
    ok(empLogin.status === 200, 'employee login with new password');

    // 11. Notifications (employee got account_created notification)
    r = await req('GET', '/api/v1/users/notifications', { token: empToken });
    ok(r.status === 200 && r.data.items.length >= 1, 'employee has notifications');
    ok(r.data.unread >= 1, 'unread count > 0');

    // 12. Delete employee
    r = await req('DELETE', `/api/v1/users/employees/${empId}`, { token: ownerToken });
    ok(r.status === 200, 'delete employee');

    // Cleanup
    await Ticket.deleteMany({ user: owner._id });
    await User.deleteMany({ email: { $in: [ownerEmail, empEmail] } });
    console.log('ALL INTEGRATION TESTS PASSED');
  } catch (err) {
    console.error('TEST FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
})();
