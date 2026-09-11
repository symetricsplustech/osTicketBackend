/* eslint-disable no-console */
const mongoose = require('mongoose');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Ticket = require('../src/models/helpdesk/tickets/Ticket');
const AuditEvent = require('../src/models/AuditEvent');
const { markOverdueTickets, markResponseBreaches } = require('../src/services/sla.service');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
};

(async () => {
  const companies = [];
  const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    const [companyA, companyB] = await Promise.all([
      Company.create({ name: `SLA scheduler A ${suffix}`, status: 'active' }),
      Company.create({ name: `SLA scheduler B ${suffix}`, status: 'active' }),
    ]);
    companies.push(companyA._id, companyB._id);
    const [userA, userB] = await Promise.all([
      User.create({ name: 'SLA user A', email: `sla-user-a-${suffix}@osticket.local`, password: 'Pass@1234', company: companyA._id }),
      User.create({ name: 'SLA user B', email: `sla-user-b-${suffix}@osticket.local`, password: 'Pass@1234', company: companyB._id }),
    ]);
    const past = new Date(Date.now() - 60_000);
    const [resolutionA, responseB] = await Promise.all([
      Ticket.create({ number: `SLA-R-${suffix}`, company: companyA._id, user: userA._id, subject: 'Resolution breach', status: 'open', dueDate: past, slaStartedAt: past, isOverdue: false }),
      Ticket.create({ number: `SLA-F-${suffix}`, company: companyB._id, user: userB._id, subject: 'Response breach', status: 'open', responseDueAt: past, slaStartedAt: past, responseBreached: false }),
    ]);

    assert((await markOverdueTickets()).modified === 1, 'scheduler claims one resolution breach');
    assert((await markOverdueTickets()).modified === 0, 'resolution breach is emitted only once across repeated runs');
    const overdue = await Ticket.findById(resolutionA._id).lean();
    assert(overdue.isOverdue && overdue.status === Ticket.STATUSES.OVERDUE, 'resolution breach state is persisted');
    assert(await AuditEvent.exists({ company: companyA._id, action: 'ticket.sla_breached', entityId: resolutionA._id }), 'resolution breach has mandatory tenant-scoped audit evidence');
    assert(!(await AuditEvent.exists({ company: companyB._id, action: 'ticket.sla_breached', entityId: resolutionA._id })), 'resolution audit does not cross tenant boundaries');

    assert((await markResponseBreaches()).modified === 1, 'scheduler claims one response breach');
    assert((await markResponseBreaches()).modified === 0, 'response breach is emitted only once across repeated runs');
    const response = await Ticket.findById(responseB._id).lean();
    assert(response.responseBreached === true, 'response breach state is persisted');
    assert(await AuditEvent.exists({ company: companyB._id, action: 'ticket.response_sla_breached', entityId: responseB._id }), 'response breach has mandatory tenant-scoped audit evidence');
    assert(!(await AuditEvent.exists({ company: companyA._id, action: 'ticket.response_sla_breached', entityId: responseB._id })), 'response audit does not cross tenant boundaries');
    console.log('ITSM-09 SLA SCHEDULER SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-09 SLA SCHEDULER SECURITY TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (companies.length) {
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await Ticket.deleteMany({ company: { $in: companies } });
      await User.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
