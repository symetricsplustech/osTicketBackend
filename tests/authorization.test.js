/* eslint-disable no-console */
// Central authorization service — DB-free unit tests (MD §95/§26/§59).
// Run: npm run test:authorization
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

const {
  authorize,
  assertPermission,
  checkPermission,
  hasPermission,
  grantedScopes,
  matchConditions,
  filterFields,
} = require('../src/services/authorization.service');

const T = '507f1f77bcf86cd799439011'; // tenant A
const ME = '507f1f77bcf86cd799439012'; // principal id
const OTHER = '507f1f77bcf86cd799439013';

const agent = (over = {}) => ({
  _id: ME,
  name: 'Asha Agent',
  isActive: true,
  company: T,
  permissions: [],
  teams: [],
  departments: [],
  role: null,
  ...over,
});

(async () => {
  // 1. authentication / account / tenant gates
  assert((await authorize({ principal: null, permission: 'tickets.view', audit: false })).reason === 'UNAUTHENTICATED', 'unauthenticated principal is denied');
  assert((await authorize({ principal: agent({ isActive: false }), permission: 'tickets.view', audit: false })).reason === 'ACCOUNT_INACTIVE', 'inactive account is denied');
  assert((await authorize({ principal: agent({ company: null }), permission: 'tickets.view', audit: false })).reason === 'TENANT_UNRESOLVED', 'tenant-less principal is denied');
  assert((await authorize({ principal: agent(), permission: 'tickets.view', tenant: '507f1f77bcf86cd799439099', audit: false })).reason === 'MEMBERSHIP_MISMATCH', 'cross-tenant membership is denied');

  // 2. permission resolution + deny precedence (MD §22)
  assert((await authorize({ principal: agent(), permission: 'tickets.view', audit: false })).reason === 'PERMISSION_MISSING', 'missing permission defaults to DENY');
  const direct = await authorize({ principal: agent({ permissions: ['tickets.view'] }), permission: 'tickets.view', audit: false });
  assert(direct.decision === 'ALLOW' && direct.via === 'direct', 'direct grant allows');
  const viaRole = await authorize({
    principal: agent({ role: { permissions: ['tickets.assign'], recordScopes: ['assigned'] } }),
    permission: 'tickets.assign', audit: false,
  });
  assert(viaRole.decision === 'ALLOW' && viaRole.via === 'role', 'role grant allows');
  const denied = await authorize({
    principal: agent({ permissions: ['tickets.delete', '!tickets.delete'] }),
    permission: 'tickets.delete', audit: false,
  });
  assert(denied.decision === 'DENY' && denied.reason === 'EXPLICIT_DENY', 'explicit deny beats direct allow');
  const adminRes = await authorize({ principal: agent({ isAdmin: true }), permission: 'tickets.delete', audit: false });
  assert(adminRes.decision === 'ALLOW' && adminRes.via === 'admin_aggregate', 'aggregate admin bypass is explicit and auditable');
  const wild = await authorize({ principal: agent({ permissions: ['*'] }), permission: 'anything.at_all', audit: false });
  assert(wild.decision === 'ALLOW' && wild.via === 'wildcard', 'wildcard grant allows');

  // 3. pure helpers stay backward compatible
  assert(hasPermission(agent({ permissions: ['tickets.view'] }), 'tickets.view') === true, 'hasPermission true on direct grant');
  assert(hasPermission(agent(), 'tickets.view') === false, 'hasPermission false when missing');
  assert(checkPermission(agent({ isAdmin: true }), 'x.y').via === 'admin_aggregate', 'checkPermission reports admin aggregate');

  // 4. module entitlement (MD §85)
  assert((await authorize({ principal: agent({ permissions: ['tickets.view'] }), permission: 'tickets.view', module: 'helpdesk', audit: false })).reason === 'MODULE_NOT_ENTITLED', 'unentitled module is denied');
  assert((await authorize({
    principal: agent({ permissions: ['tickets.view'], moduleKeys: ['helpdesk'] }),
    permission: 'tickets.view', module: 'helpdesk', audit: false,
  })).decision === 'ALLOW', 'entitled module allows');

  // 5. scope gate (MD §19)
  const assignedTicket = { _id: 't1', company: T, agent: ME, status: 'open' };
  const foreignTicket = { _id: 't2', company: T, agent: OTHER, status: 'open' };
  const scoped = await authorize({
    principal: agent({ permissions: ['tickets.view'], role: { permissions: [], recordScopes: ['assigned'] } }),
    permission: 'tickets.view', record: assignedTicket, audit: false,
  });
  assert(scoped.decision === 'ALLOW' && scoped.scope === 'ASSIGNED_TO_ME', 'assigned scope matches own ticket');
  assert((await authorize({
    principal: agent({ permissions: ['tickets.view'], role: { permissions: [], recordScopes: ['assigned'] } }),
    permission: 'tickets.view', record: foreignTicket, audit: false,
  })).reason === 'SCOPE_REJECTED', 'assigned scope rejects foreign ticket');
  assert((await authorize({
    principal: agent({ permissions: ['tickets.view'] }),
    permission: 'tickets.view', record: foreignTicket, requiredScope: 'ASSIGNED_TO_ME', audit: false,
  })).reason === 'SCOPE_REJECTED', 'requiredScope narrows even without role scopes');
  assert(grantedScopes(agent({ role: { recordScopes: ['team', 'department'] } })).join(',') === 'TEAM,DEPARTMENT', 'legacy lowercase scopes map to canonical scopes');

  // 6. record conditions (MD §20)
  const condOk = matchConditions(agent(), { assignedTo: ME }, [{ field: 'assignedTo', op: '=', value: 'current_user' }], T);
  assert(condOk.ok === true, 'current_user condition matches');
  const condNo = matchConditions(agent(), { assignedTo: OTHER }, [{ field: 'assignedTo', op: '=', value: 'current_user' }], T);
  assert(condNo.ok === false, 'current_user condition rejects others');
  const rej = await authorize({
    principal: agent({ permissions: ['tickets.view'], role: { permissions: [], recordScopes: ['organization'] } }),
    permission: 'tickets.view',
    record: foreignTicket,
    conditions: [{ field: 'agent', op: '=', value: 'current_user' }],
    audit: false,
  });
  assert(rej.reason === 'RECORD_CONDITION_REJECTED', 'failing record condition denies');

  // 7. field access (MD §21)
  const fields = filterFields(agent({ role: { fieldAccess: ['cost'] } }), ['cost', 'work_notes']);
  assert(fields.allowedFields.join(',') === 'cost' && fields.deniedFields.join(',') === 'work_notes', 'sensitive fields split by grant');
  const adminFields = filterFields(agent({ isAdmin: true }), ['cost', 'work_notes']);
  assert(adminFields.deniedFields.length === 0, 'aggregate admin sees all fields');

  // 8. throwing variant hides internals (MD §26/§80)
  let thrown = null;
  try {
    await assertPermission({ principal: agent(), permission: 'tickets.delete', audit: false });
  } catch (e) { thrown = e; }
  assert(thrown && thrown.statusCode === 403 && thrown.message === 'You do not have permission for this action', 'assertPermission throws generic 403 without internal reason');
  const okRes = await assertPermission({ principal: agent({ permissions: ['tickets.delete'] }), permission: 'tickets.delete', audit: false });
  assert(okRes.decision === 'ALLOW', 'assertPermission resolves on allow');

  console.log('\nAll authorization tests passed.');
  process.exit(0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
