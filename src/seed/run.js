/* eslint-disable no-console */
const mongoose = require('mongoose');
const dns = require('dns');
const config = require('../config/config');

dns.setServers(['8.8.8.8', '1.1.1.1']);
const Role = require('../models/Role');
const Agent = require('../models/Agent');
const Team = require('../models/Team');
const Department = require('../models/Department');
const SlaPlan = require('../models/SlaPlan');
const HelpTopic = require('../models/HelpTopic');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Ticket = require('../models/Ticket');
const TicketThread = require('../models/TicketThread');
const Task = require('../models/Task');
const CannedResponse = require('../models/CannedResponse');
const FaqCategory = require('../models/FaqCategory');
const Faq = require('../models/Faq');
const Announcement = require('../models/Announcement');
const EmailTemplate = require('../models/EmailTemplate');
const TicketFilter = require('../models/TicketFilter');
const Notification = require('../models/Notification');
const SystemSetting = require('../models/SystemSetting');
const SuperAdmin = require('../models/SuperAdmin');
const Plan = require('../models/Plan');
const Company = require('../models/Company');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const TicketStatus = require('../models/TicketStatus');
const { emailTemplates } = require('./seedData');
const { generateTicketNumber } = require('../utils/generators');
const { computeDueDate } = require('../services/sla.service');

const MODELS = [
  AuditLog,
  Invoice,
  Company,
  Plan,
  SuperAdmin,
  EmailTemplate,
  SystemSetting,
  TicketStatus,
  TicketFilter,
  TicketThread,
  Task,
  Ticket,
  Announcement,
  Faq,
  FaqCategory,
  CannedResponse,
  HelpTopic,
  SlaPlan,
  Department,
  Team,
  Role,
  Agent,
  Organization,
  User,
];

const reset = process.argv.includes('--reset');

const run = async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected to MongoDB: ${config.mongoUri}`);

  if (reset) {
    console.log('Resetting database...');
    await Promise.all(MODELS.map((M) => M.deleteMany({})));
  }

  const existing = await User.countDocuments();
  if (existing > 0 && !reset) {
    console.log('Database already has data. Use `npm run seed:reset` to reseed.');
    await mongoose.disconnect();
    return;
  }

  // ----- Email templates -----
  for (const t of emailTemplates) {
    await EmailTemplate.findOneAndUpdate({ key: t.key, company: null }, t, { upsert: true });
  }
  console.log('Email templates seeded.');

  // ----- Ticket statuses -----
  const defaultStatuses = [
    { name: 'Open', key: 'open', color: '#4a86b0', isDefault: true, sortOrder: 1 },
    { name: 'Assigned', key: 'assigned', color: '#8e6bb0', sortOrder: 2 },
    { name: 'Overdue', key: 'overdue', color: '#c0392b', sortOrder: 3 },
    { name: 'Closed', key: 'closed', color: '#6c757d', sortOrder: 4 },
    { name: 'Archived', key: 'archived', color: '#95a5a6', sortOrder: 5 },
  ];
  for (const s of defaultStatuses) {
    await require('../models/TicketStatus').findOneAndUpdate({ key: s.key }, s, { upsert: true });
  }
  console.log('Ticket statuses seeded.');

  // ----- Super admin -----
  let superAdmin = await SuperAdmin.findOne({ email: 'superadmin@osticket.local' });
  if (!superAdmin) {
    superAdmin = await SuperAdmin.create({
      name: 'Platform Super Admin',
      email: 'superadmin@osticket.local',
      password: 'SuperAdmin@123',
      role: 'super_admin',
      isActive: true,
    });
  }
  console.log(`Super admin seeded: ${superAdmin.email} / SuperAdmin@123`);

  // ----- Plans -----
  const freePlan = await Plan.create({ name: 'Free', code: 'free', description: 'For small teams getting started', priceMonthly: 0, priceYearly: 0, maxAgents: 3, maxUsers: 50, features: ['tickets', 'kb', 'basic_reports'], isActive: true, isDefault: true, trialDays: 0 });
  const proPlan = await Plan.create({ name: 'Pro', code: 'pro', description: 'For growing support teams', priceMonthly: 1999, priceYearly: 19990, maxAgents: 10, maxUsers: 500, features: ['tickets', 'kb', 'reports', 'sla', 'multi_dept', 'canned_responses'], isActive: true, trialDays: 14 });
  await Plan.create({ name: 'Business', code: 'business', description: 'For larger organizations', priceMonthly: 4999, priceYearly: 49990, maxAgents: 50, maxUsers: 5000, features: ['tickets', 'kb', 'reports', 'sla', 'multi_dept', 'canned_responses', 'api_access', 'priority_support'], isActive: true, apiAccess: true, prioritySupport: true, trialDays: 14 });
  console.log('Plans seeded.');

  // ----- Demo company -----
  const demoCompany = await Company.create({
    name: 'My Support Center',
    email: 'support@osticket.local',
    domain: 'osticket.local',
    plan: proPlan._id,
    status: 'active',
    billingCycle: 'monthly',
    planStartedAt: new Date(),
    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdBy: superAdmin._id,
  });
  await Invoice.create({
    invoiceNumber: 'INV-DEMO-0001',
    company: demoCompany._id,
    plan: proPlan._id,
    description: 'Pro plan (monthly) for My Support Center',
    amount: 1999,
    status: 'paid',
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paidAt: new Date(),
    createdBy: superAdmin._id,
  });
  console.log('Demo company seeded.');

  // ----- Roles -----
  const [adminRole, supportRole, techRole] = await Promise.all([
    Role.create({ name: 'Administrator', permissions: ['tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.transfer', 'tickets.close', 'tickets.delete', 'tickets.reply', 'tickets.note', 'tickets.tasks', 'users.manage', 'kb.manage', 'canned.manage', 'admin.manage', 'orgs.manage', 'escalations.manage'], isAdmin: true }),
    Role.create({ name: 'Support Agent', permissions: ['tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.transfer', 'tickets.close', 'tickets.reply', 'tickets.note', 'tickets.tasks', 'users.manage', 'canned.manage', 'kb.manage'], isAdmin: false }),
    Role.create({ name: 'Technician', permissions: ['tickets.view', 'tickets.reply', 'tickets.note', 'tickets.assign', 'tickets.close', 'tickets.tasks'], isAdmin: false }),
  ]);

  // ----- Departments -----
  const support = await Department.create({ name: 'Support', isPublic: true, notes: 'General customer support' });
  const billing = await Department.create({ name: 'Billing', isPublic: true, notes: 'Billing and invoicing' });
  const sales = await Department.create({ name: 'Sales', isPublic: true, notes: 'Pre-sales inquiries' });
  const maintenance = await Department.create({ name: 'Maintenance', isPublic: true, notes: 'Scheduled maintenance' });
  const technical = await Department.create({ name: 'Technical', parent: support._id, isPublic: true, notes: 'Deep technical issues' });

  // ----- SLA plans -----
  const sla24 = await SlaPlan.create({ name: '24/7 Response', gracePeriod: 24, schedule: '24/7', notes: 'First response within 24 hours, around the clock' });
  const slaBusiness = await SlaPlan.create({ name: 'Business Hours', gracePeriod: 8, schedule: 'Business Hours', notes: 'First response within 8 business hours' });
  const slaCritical = await SlaPlan.create({ name: 'Critical Response', gracePeriod: 4, schedule: '24/7', notes: 'Emergency response within 4 hours' });
  const slaOneDay = await SlaPlan.create({ name: '1 Business Day', gracePeriod: 24, schedule: 'Business Hours', notes: 'Standard service level' });

  // ----- Teams -----
  const teamSupport = await Team.create({ name: 'Support Team', notes: 'Front-line support' });
  const teamL2 = await Team.create({ name: 'Level 2 Team', notes: 'Escalation team' });
  const teamBilling = await Team.create({ name: 'Billing Team', notes: 'Billing specialists' });

  // ----- Agents -----
  const adminAgent = await Agent.create({
    name: 'System Administrator',
    email: 'admin@osticket.local',
    password: 'Admin@123',
    role: adminRole._id,
    isAdmin: true,
    isActive: true,
    departments: [{ department: support._id, isPrimary: true }, { department: billing._id }, { department: sales._id }, { department: technical._id }],
    teams: [teamSupport._id, teamL2._id, teamBilling._id],
    signature: 'System Administrator\nSupport Center',
  });
  const agent1 = await Agent.create({
    name: 'John Agent',
    email: 'agent@osticket.local',
    password: 'Agent@123',
    role: supportRole._id,
    isActive: true,
    departments: [{ department: support._id, isPrimary: true }, { department: technical._id }],
    teams: [teamSupport._id],
    signature: 'John Agent\nCustomer Support',
  });
  const agent2 = await Agent.create({
    name: 'Jane Smith',
    email: 'jane@osticket.local',
    password: 'Agent@123',
    role: techRole._id,
    isActive: true,
    departments: [{ department: technical._id, isPrimary: true }],
    teams: [teamL2._id],
    signature: 'Jane Smith\nTechnical Support',
  });
  const agent3 = await Agent.create({
    name: 'Billing Officer',
    email: 'billing@osticket.local',
    password: 'Agent@123',
    role: supportRole._id,
    isActive: true,
    departments: [{ department: billing._id, isPrimary: true }],
    teams: [teamBilling._id],
    signature: 'Billing Officer\nBilling Department',
  });

  // Update dept managers & team leads
  support.manager = agent1._id;
  support.autoAssignAgent = agent1._id;
  technical.manager = agent2._id;
  billing.manager = agent3._id;
  technical.autoAssignTeam = teamL2._id;
  await Promise.all([support.save(), technical.save(), billing.save()]);
  teamSupport.lead = agent1._id;
  teamSupport.members = [agent1._id, adminAgent._id];
  teamL2.lead = agent2._id;
  teamL2.members = [agent2._id];
  teamBilling.lead = agent3._id;
  teamBilling.members = [agent3._id];
  await Promise.all([teamSupport.save(), teamL2.save(), teamBilling.save()]);

  // ----- Help topics -----
  const hwIssue = await HelpTopic.create({ topic: 'Hardware Issue', category: 'Technical', department: technical._id, priority: 'Normal', sla: sla24._id, autoAssignTeam: teamL2._id, isPublic: true });
  const swIssue = await HelpTopic.create({ topic: 'Software Issue', category: 'Technical', department: technical._id, priority: 'High', sla: slaCritical._id, autoAssignAgent: agent2._id, isPublic: true });
  const general = await HelpTopic.create({ topic: 'General Inquiry', category: 'Support', department: support._id, priority: 'Normal', sla: slaBusiness._id, autoAssignAgent: agent1._id, isPublic: true });
  const billingQuery = await HelpTopic.create({ topic: 'Billing Question', category: 'Billing', department: billing._id, priority: 'Normal', sla: slaBusiness._id, autoAssignTeam: teamBilling._id, isPublic: true });
  const salesQ = await HelpTopic.create({ topic: 'Sales Question', category: 'Sales', department: sales._id, priority: 'Normal', sla: slaBusiness._id, isPublic: true });
  const report = await HelpTopic.create({ topic: 'Report a Problem', category: 'Support', department: support._id, priority: 'Normal', sla: sla24._id, isPublic: true });

  // ----- Organization + users -----
  const acme = await Organization.create({ name: 'Acme Corp', address: '123 Main Street, Springfield', phone: '+1 555 0100', domain: 'acme.com', notes: 'Demo organization' });
  const globalCo = await Organization.create({ name: 'Globex Ltd', address: '42 Industry Road, Metropolis', phone: '+1 555 0199', domain: 'globex.com', notes: 'Demo organization' });

  const user1 = await User.create({
    name: 'Customer One',
    email: 'customer@osticket.local',
    phone: '+1 555 0101',
    password: 'Customer@123',
    isRegistered: true,
    emailConfirmed: true,
    organization: acme._id,
  });
  const user2 = await User.create({
    name: 'Rahul Sharma',
    email: 'rahul@acme.com',
    phone: '+1 555 0102',
    password: 'Customer@123',
    isRegistered: true,
    emailConfirmed: true,
    organization: acme._id,
  });
  const user3 = await User.create({
    name: 'Maria Gomez',
    email: 'maria@globex.com',
    phone: '+1 555 0198',
    isRegistered: false,
    emailConfirmed: false,
    organization: globalCo._id,
  });
  const user4 = await User.create({
    name: 'Wei Chen',
    email: 'wei@acme.com',
    phone: '+1 555 0105',
    isRegistered: true,
    emailConfirmed: true,
    organization: acme._id,
  });

  const testUsers = [
    { name: 'Mahima Seldiya 1', email: 'mahimaseldiya1@gmail.com' },
    { name: 'Mahima Seldiya 3', email: 'mahimaseldiya3@gmail.com' },
    { name: 'Mahima Seldiya 7', email: 'mahimaseldiya7@gmail.com' },
    { name: 'Mahima Seldiya 365', email: 'mahimaseldiya365@gmail.com' },
  ];
  for (const tu of testUsers) {
    await User.create({
      name: tu.name,
      email: tu.email,
      password: 'Customer@123',
      isRegistered: true,
      emailConfirmed: true,
      status: 'active',
      company: demoCompany._id,
    });
  }

  const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

  // ----- Tickets -----
  const mkTicket = async ({ user, topic, dept, priority, subject, source, status, agent, team, sla, created, lastActivity, body, responses = 0 }) => {
    const number = generateTicketNumber();
    const dueDate = await computeDueDate(sla, created);
    const t = await Ticket.create({
      number,
      user: user._id,
      dept: dept ? dept._id : null,
      topic: topic ? topic._id : null,
      priority: priority || 'Normal',
      sla: sla ? sla._id : null,
      agent: agent ? agent._id : null,
      team: team ? team._id : null,
      subject,
      source,
      status,
      dueDate,
      isOverdue: status === Ticket.STATUSES.OVERDUE,
      lastActivity,
      lastMessageAt: created,
      createdAt: created,
      updatedAt: lastActivity,
      stats: { responses, messages: 1, firstResponseAt: responses > 0 ? new Date(created.getTime() + 3600000) : null },
    });
    await TicketThread.create({ ticket: t._id, type: 'message', posterType: 'user', user: user._id, title: 'Message', body, createdAt: created });
    if (responses > 0) {
      await TicketThread.create({
        ticket: t._id, type: 'message', posterType: 'agent', agent: (agent || adminAgent)._id, title: 'Response', body: 'Thank you for contacting us. Our team is looking into this and will get back to you shortly.', createdAt: new Date(created.getTime() + 3600000),
      });
    }
    return t;
  };

  await mkTicket({
    user: user1, topic: general, dept: support, priority: 'Normal', subject: 'Cannot access my account', source: 'web', status: Ticket.STATUSES.OPEN, agent: agent1, sla: slaBusiness, created: daysAgo(1), lastActivity: daysAgo(0.5), body: 'I am trying to login but it says invalid credentials. I have tried resetting my password but still cannot access the portal.', responses: 1,
  });
  await mkTicket({
    user: user2, topic: billingQuery, dept: billing, priority: 'High', subject: 'Duplicate invoice charged', source: 'email', status: Ticket.STATUSES.ASSIGNED, team: teamBilling, agent: null, sla: slaBusiness, created: daysAgo(2), lastActivity: daysAgo(1), body: 'I was charged twice for the same invoice this month. Invoice #INV-2024-00123 and #INV-2024-00124 are identical.', responses: 0,
  });
  await mkTicket({
    user: user3, topic: hwIssue, dept: technical, priority: 'Emergency', subject: 'Production server down - outage', source: 'web', status: Ticket.STATUSES.OVERDUE, team: teamL2, sla: slaCritical, created: daysAgo(5), lastActivity: daysAgo(1.5), body: 'Our production server has been down for 4 hours. This is impacting all customers. Please escalate urgently.', responses: 1,
  });
  await mkTicket({
    user: user4, topic: swIssue, dept: technical, priority: 'High', subject: 'Mobile app crashes on login', source: 'web', status: Ticket.STATUSES.CLOSED, agent: agent2, sla: slaCritical, created: daysAgo(8), lastActivity: daysAgo(6), body: 'The mobile app crashes every time I try to login on Android 14. Clearing cache does not help.', responses: 2,
  });
  await mkTicket({
    user: user1, topic: salesQ, dept: sales, priority: 'Normal', subject: 'Enterprise plan pricing', source: 'phone', status: Ticket.STATUSES.CLOSED, agent: null, sla: slaBusiness, created: daysAgo(12), lastActivity: daysAgo(10), body: 'Looking for pricing on the enterprise plan for a 500 seat deployment.', responses: 1,
  });
  await mkTicket({
    user: user2, topic: report, dept: support, priority: 'Low', subject: 'Feedback: add dark mode', source: 'web', status: Ticket.STATUSES.ARCHIVED, agent: agent1, sla: sla24, created: daysAgo(20), lastActivity: daysAgo(18), body: 'Would be great to have dark mode in the client portal. Please consider adding it.', responses: 1,
  });

  // A task on the open ticket
  const firstTicket = await Ticket.findOne({ subject: 'Cannot access my account' });
  await Task.create({
    ticket: firstTicket._id,
    title: 'Verify account status',
    description: 'Check if the account was disabled and reset the password.',
    assignedTo: agent1._id,
    createdBy: adminAgent._id,
    status: 'open',
  });

  console.log('Tickets seeded.');

  // ----- Canned responses -----
  await CannedResponse.create({ title: 'Password Reset Instructions', response: 'Hello %{user.name.first}, you can reset your password by clicking "Forgot Password" on the login page. We will send a reset link to your email.', createdBy: agent1._id });
  await CannedResponse.create({ title: 'Ticket Received', response: 'Thank you for contacting support. Your ticket #%{ticket.number} has been received and a representative will respond shortly.', createdBy: agent1._id });
  await CannedResponse.create({ title: 'Issue Resolved', response: 'We believe the issue has been resolved. Please let us know if you continue to experience any problems and we will be happy to help.', createdBy: agent2._id });
  await CannedResponse.create({ title: 'Billing Confirmation', response: 'We have verified your billing records. If the duplicate charge persists after 5 business days, please contact your bank to dispute it.', createdBy: agent3._id });
  console.log('Canned responses seeded.');

  // ----- FAQ -----
  const faqTech = await FaqCategory.create({ name: 'Technical', description: 'Hardware and software related questions', isPublic: true, sortOrder: 1, createdBy: agent1._id });
  const faqAccount = await FaqCategory.create({ name: 'Account & Billing', description: 'Login, passwords and billing questions', isPublic: true, sortOrder: 2, createdBy: agent3._id });
  const faqGeneral = await FaqCategory.create({ name: 'General', description: 'General questions about our services', isPublic: true, sortOrder: 3, createdBy: agent1._id });

  await Faq.create({ category: faqTech._id, question: 'How do I reset my password?', answer: 'Go to the login page and click "Forgot Password". Enter your email address and we will send you a secure reset link that expires in 30 minutes.', keywords: ['password', 'reset', 'login'], createdBy: agent1._id });
  await Faq.create({ category: faqTech._id, question: 'Why is the mobile app crashing on startup?', answer: 'Make sure you have the latest version installed. Go to your app store and check for updates. If the issue persists, try clearing the app cache or reinstalling the app.', keywords: ['app', 'crash', 'mobile'], createdBy: agent2._id });
  await Faq.create({ category: faqAccount._id, question: 'How do I view my invoices?', answer: 'Log in to the client portal, go to "My Tickets" and open the related ticket. Attached invoices are listed in the ticket thread.', keywords: ['invoice', 'billing', 'payment'], createdBy: agent3._id });
  await Faq.create({ category: faqGeneral._id, question: 'What are your support hours?', answer: 'Our support team is available 24/7. Responses are guaranteed within the SLA of your ticket priority.', keywords: ['hours', 'support', 'sla'], createdBy: agent1._id });
  await Faq.create({ category: faqAccount._id, question: 'How do I close a ticket?', answer: 'You can close a ticket from the ticket detail page by clicking the "Close" button, or it will be closed by our team once resolved.', keywords: ['close', 'ticket'], createdBy: agent1._id });
  console.log('FAQ seeded.');

  // ----- Announcements -----
  await Announcement.create({ title: 'Scheduled Maintenance - Sunday 2:00 AM', body: 'Our systems will undergo scheduled maintenance on Sunday from 2:00 AM to 4:00 AM. The portal may be briefly unavailable during this window.', showDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), createdBy: adminAgent._id, isActive: true });
  await Announcement.create({ title: 'Welcome to our new Support Center', body: 'We have upgraded our support portal with a new knowledgebase and improved ticket tracking. Please explore and let us know what you think!', createdBy: adminAgent._id, isActive: true });
  console.log('Announcements seeded.');

  // ----- Filters -----
  await TicketFilter.create({
    name: 'Route emergency tickets',
    rules: [{ field: 'priority', method: 'equals', value: 'Emergency' }],
    actions: [{ action: 'sla', target: String(slaCritical._id) }, { action: 'team', target: String(teamL2._id) }],
    match: 'all',
    status: 'active',
    order: 1,
    createdBy: adminAgent._id,
  });
  await TicketFilter.create({
    name: 'Billing keywords to billing dept',
    rules: [{ field: 'subject', method: 'contains', value: 'billing' }, { field: 'subject', method: 'contains', value: 'invoice' }],
    actions: [{ action: 'dept', target: String(billing._id) }],
    match: 'any',
    status: 'active',
    order: 2,
    createdBy: adminAgent._id,
  });
  console.log('Ticket filters seeded.');

  // ----- System settings -----
  await SystemSetting.setSetting('company.name', 'My Support Center');
  await SystemSetting.setSetting('company.email', 'support@osticket.local');
  await SystemSetting.setSetting('company.url', 'https://osticket.local');
  await SystemSetting.setSetting('system.defaultDept', String(support._id));
  await SystemSetting.setSetting('system.defaultSla', String(slaBusiness._id));
  await SystemSetting.setSetting('system.defaultPriority', 'Normal');
  await SystemSetting.setSetting('system.autoLockTickets', true);
  await SystemSetting.setSetting('system.ticketLockMinutes', 5);
  await SystemSetting.setSetting('system.allowTicketReopen', true);
  await SystemSetting.setSetting('system.emailToTicket', require('../config/config').email.user);
  await SystemSetting.setSetting('tickets.autoResponder', true);
  await SystemSetting.setSetting('tickets.autoAssign', true);
  await SystemSetting.setSetting('tickets.notifyNewTicketToDept', true);
  await SystemSetting.setSetting('autoresponder.enabled', true);
  await SystemSetting.setSetting('autoresponder.subject', 'Ticket received - [ticket.number]');
  await SystemSetting.setSetting('alerts.notifyNewTicket', true);
  await SystemSetting.setSetting('alerts.notifyAssignment', true);
  await SystemSetting.setSetting('auth.registrationEnabled', true);
  await SystemSetting.setSetting('auth.allowGuestTickets', true);
  await SystemSetting.setSetting('auth.passwordMinLength', 8);
  await SystemSetting.setSetting('schedules.timezone', 'Asia/Kolkata');
  console.log('Settings seeded.');

  // ----- Assign all seeded data to the demo company -----
  const companyScoped = [Agent, User, Ticket, TicketThread, Task, Organization, Department, HelpTopic, SlaPlan, Team, Role, CannedResponse, FaqCategory, Faq, Announcement, TicketFilter, Notification];
  for (const M of companyScoped) {
    await M.updateMany({ company: null }, { company: demoCompany._id });
  }
  console.log('Seeded data assigned to demo company.');

  console.log('');
  console.log('==============================================');
  console.log('Seed completed successfully!');
  console.log('----------------------------------------------');
  console.log('Demo logins:');
  console.log('  Super Admin Panel  superadmin@osticket.local / SuperAdmin@123');
  console.log('  Customer Portal     customer@osticket.local / Customer@123');
  console.log('  Agent Panel         agent@osticket.local / Agent@123');
  console.log('  Admin Panel         admin@osticket.local / Admin@123');
  console.log('==============================================');

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
