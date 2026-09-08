/* eslint-disable no-console */
// Custom roles & permissions engine — DB-free unit tests (MD §15/§16).
// Run: npm run test:customauth
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

const {
  matchCustomPermission,
  customRolesFor,
  evaluateCustom,
  isSaasKey,
} = require('../src/services/customAuth.service');

const T = '507f1f77bcf86cd799439011';
const ME = '507f1f77bcf86cd799439012';
const TEAM = '507f1f77bcf86cd799439013';

const agent = (over = {}) => ({ _id: ME, name: 'Asha', isActive: true, company: T, permissions: [], teams: [], departments: [], role: null, ...over });

// --- isSaasKey (SaaS boundary) ---
assert(!isSaasKey('tickets.view'), 'plain key is not SaaS');
assert(isSaasKey('saas.tenant.read'), 'saas.* is SaaS');
assert(isSaasKey('platform.tickets.delete'), 'platform.* is SaaS');
assert(isSaasKey('superadmin.manage'), 'superadmin.* is SaaS');

// --- matchCustomPermission ---
const perm = { _id: 'p1', key: 'custom.itsm.incident.approve_p1', module: 'itsm', resource: 'incident', action: 'approve_p1', effect: 'allow', status: 'active' };
assert(matchCustomPermission(perm, 'custom.itsm.incident.approve_p1'), 'exact key match');
assert(matchCustomPermission(perm, 'itsm.incident.approve_p1'), 'triple match');
assert(!matchCustomPermission(perm, 'tickets.view'), 'no match');
assert(!matchCustomPermission({ ...perm, status: 'disabled' }, 'itsm.incident.approve_p1'), 'disabled perm never matches');

// --- customRolesFor (direct + team membership + window) ---
const roleDirect = { _id: 'r1', key: 'p1-approver', agentMembers: [ME], teamMembers: [], status: 'active' };
const roleTeam = { _id: 'r2', key: 'team-role', agentMembers: [], teamMembers: [TEAM], status: 'active' };
const roleWindow = { _id: 'r3', key: 'windowed', agentMembers: [ME], effectiveFrom: new Date(Date.now() + 100000), status: 'active', teamMembers: [] };
const roleDisabled = { _id: 'r4', key: 'disabled', agentMembers: [ME], status: 'disabled', teamMembers: [] };
const roles = [roleDirect, roleTeam, roleWindow, roleDisabled];

const memberOfTeam = agent({ teams: [{ team: TEAM }] });
assert(customRolesFor(agent(), roles).map((r) => r.key).includes('p1-approver'), 'direct member matches');
assert(customRolesFor(memberOfTeam, roles).map((r) => r.key).includes('team-role'), 'team member matches');
assert(!customRolesFor(agent(), roles).some((r) => r.key === 'windowed'), 'future effectiveFrom excluded');
assert(!customRolesFor(agent(), roles).some((r) => r.key === 'disabled'), 'disabled role excluded');

// --- evaluateCustom precedence (role deny > custom deny > role allow > custom allow) ---
const auth = {
  roles: [{ ...roleDirect, permissions: ['tickets.assign'], deniedPermissions: ['tickets.approve'], key: 'p1-approver' }],
  permissions: [perm, { ...perm, _id: 'p9', key: 'custom.itsm.incident.reject', resource: 'incident', action: 'reject', effect: 'deny' }],
};

let v = evaluateCustom('tickets.approve', auth, agent());
assert(v && v.decision === 'DENY' && v.via === 'custom_role_deny', 'role deny beats custom allow');
v = evaluateCustom('itsm.incident.reject', auth, agent());
assert(v && v.decision === 'DENY' && v.via === 'custom_deny', 'direct custom deny');
v = evaluateCustom('tickets.assign', auth, agent());
assert(v && v.decision === 'ALLOW' && v.via === 'custom_role', 'custom role allow grants gap');
v = evaluateCustom('itsm.incident.approve_p1', auth, agent());
assert(v && v.decision === 'ALLOW' && v.via === 'custom', 'direct custom allow');
assert(evaluateCustom('tickets.view', auth, agent()) === null, 'unrelated permission returns null');

console.log('\nAll custom-auth tests passed.');
