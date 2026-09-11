/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Faq = require('../src/models/helpdesk/knowledge/Faq');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5117; const base = `http://127.0.0.1:${port}/api/v1`;
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
    const [a, b] = await Promise.all([Company.create({ name: `KB A ${suffix}`, status: 'active' }), Company.create({ name: `KB B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id);
    const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey: 'helpdesk' },
      { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true },
    )));
    const [editorA, deniedA, editorB, requesterA] = await Promise.all([
      Agent.create({ name: 'KB editor A', email: `kb-editor-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['kb.manage'] }),
      Agent.create({ name: 'KB denied A', email: `kb-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'KB editor B', email: `kb-editor-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['kb.manage'] }),
      User.create({ name: 'KB requester A', email: `kb-requester-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id }),
    ]);
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const userLogin = async (email) => (await request('POST', '/auth/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, deniedToken, bToken, requesterToken] = await Promise.all([login(editorA.email), login(deniedA.email), login(editorB.email), userLogin(requesterA.email)]);
    assert((await request('POST', '/agent/faqs', { body: { question: 'Anonymous', answer: 'No' } })).status === 401, 'anonymous knowledge write is denied');
    assert((await request('POST', '/agent/faqs', { token: requesterToken, body: { question: 'Requester escalation', answer: 'No' } })).status === 403, 'requester cannot access agent knowledge operations');
    assert((await request('GET', '/agent/users', { token: deniedToken })).status === 403, 'agent without users.view cannot list tenant users');
    assert((await request('POST', '/agent/faqs', { token: deniedToken, body: { question: 'Denied', answer: 'No' } })).status === 403, 'agent without kb.manage cannot create an article');
    const create = await request('POST', '/agent/faqs', { token: aToken, body: { question: 'How to reset password?', answer: 'Use the reset link.' } });
    assert(create.status === 201, 'kb manager can create a draft article');
    const faq = await Faq.findById(create.data.faq._id);
    assert(faq.lifecycle === 'draft' && faq.isPublished === false, 'new knowledge article is draft and not directly published');
    assert(await AuditEvent.exists({ company: a._id, actor: editorA._id, action: 'knowledge.article_created', entityId: faq._id }), 'knowledge creation has mandatory audit evidence');
    assert([403, 404].includes((await request('PUT', `/agent/faqs/${faq._id}`, { token: bToken, body: { answer: 'cross tenant' } })).status), 'cross-tenant agent cannot update an article');
    assert((await request('PUT', `/agent/faqs/${faq._id}`, { token: deniedToken, body: { answer: 'denied' } })).status === 403, 'agent without kb.manage cannot update an article');
    assert((await request('POST', `/agent/faqs/${faq._id}/transition`, { token: aToken, body: { to: 'review' } })).status === 200, 'kb manager can transition draft to review');
    assert((await Faq.findById(faq._id)).lifecycle === 'review', 'transition updates lifecycle schema field');
    assert(await AuditEvent.exists({ company: a._id, actor: editorA._id, action: 'knowledge.article_transitioned', entityId: faq._id }), 'knowledge transition has mandatory audit evidence');
    console.log('ITSM-08 KNOWLEDGE SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-08 KNOWLEDGE SECURITY TEST FAILED:', error.message); process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await Faq.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await User.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
