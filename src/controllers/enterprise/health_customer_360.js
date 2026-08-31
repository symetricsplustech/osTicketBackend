const Skill = require('../../models/Skill');
const Workflow = require('../../models/Workflow');
const Approval = require('../../models/Approval');
const Incident = require('../../models/Incident');
const Problem = require('../../models/Problem');
const Change = require('../../models/Change');
const Asset = require('../../models/Asset');
const Dependency = require('../../models/Dependency');
const ServiceCatalogItem = require('../../models/ServiceCatalogItem');
const Contract = require('../../models/Contract');
const Entitlement = require('../../models/Entitlement');
const Survey = require('../../models/Survey');
const SurveyResponse = require('../../models/SurveyResponse');
const StatusPage = require('../../models/StatusPage');
const StatusIncident = require('../../models/StatusIncident');
const Webhook = require('../../models/Webhook');
const ApiKey = require('../../models/ApiKey');
const TicketLink = require('../../models/TicketLink');
const Ticket = require('../../models/Ticket');
const Agent = require('../../models/Agent');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const Department = require('../../models/Department');
const Team = require('../../models/Team');
const CannedResponse = require('../../models/CannedResponse');
const CallLog = require('../../models/CallLog');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPagination, getSortObj } = require('../../utils/pagination');
const approvalService = require('../../services/approval.service');
const csatService = require('../../services/csat.service');
const healthService = require('../../services/health.service');
const statusPageService = require('../../services/statusPage.service');
const searchService = require('../../services/search.service');
const realtime = require('../../services/realtime.service');
const reporting = require('../../services/reporting.service');
const chatService = require('../../services/chat.service');
const workflowService = require('../../services/workflow.service');
const auditService = require('../../services/audit.service');

const scope = (req) => (req.companyId ? { company: req.companyId } : {});
const scopeExact = (req) => (req.companyId ? { company: req.companyId } : { company: null });

// ============================== SKILLS ==============================








// ============================== WORKFLOWS ==============================










// ============================== APPROVALS ==============================












// ============================== INCIDENTS ==============================












// ============================== PROBLEMS ==============================
const PROBLEM_FIELDS = ['title', 'description', 'status', 'rootCause', 'workaround', 'permanentSolution', 'postmortem', 'priority', 'assignedTo', 'knownError'];











// ============================== CHANGES ==============================










// ============================== ASSETS / CMDB ==============================
















/**
 * Impact analysis: find all assets that depend (transitively) on a failing asset,
 * plus their open tickets and affected users.
 */


// ============================== SERVICE CATALOG ==============================








// ============================== CONTRACTS / ENTITLEMENTS ==============================


















// ============================== SURVEYS (CSAT/NPS/CES) ==============================










// ============================== STATUS PAGE ==============================






















// ============================== WEBHOOKS ==============================








// ============================== API KEYS ==============================






// ============================== TICKET RELATIONSHIPS ==============================






// ============================== CALL LOGS (voice foundation) ==============================






// ============================== CHAT (omnichannel inbox) ==============================










// ============================== CSAT (user submit) ==============================


// ============================== HEALTH / CUSTOMER 360 ==============================


// ============================== SEARCH / AUDIT / REPORTS / REALTIME ==============================
















// ============================== OUTAGE SIGNALS → INCIDENT (proactive) ==============================


exports.customer360 = asyncHandler(async (req, res) => {
  const { id, orgId } = req.params;
  const comp = scope(req);
  let user = null;
  let organization = null;

  if (orgId) {
    organization = await Organization.findOne({ _id: orgId, ...comp }).populate('accountManager', 'name');
    if (!organization) throw new ApiError(404, 'Organization not found');
    user = await User.findOne({ organization: organization._id, ...comp }).lean();
  } else {
    user = await User.findOne({ _id: id, ...comp }).lean();
    if (!user) throw new ApiError(404, 'User not found');
    organization = user.organization ? await Organization.findOne({ _id: user.organization, ...comp }).populate('accountManager', 'name').lean() : null;
  }

  const userId = user?._id || null;
  const userQuery = userId ? { user: userId } : {};
  const orgUsers = userId ? { user: { $in: [userId] } } : {};

  const [tickets, organizations, conversations, assets, contracts, health, responses, callLogs] = await Promise.all([
    Ticket.find({ ...comp, ...(userId ? { user: userId } : {}) }).sort({ createdAt: -1 }).limit(50).populate('dept', 'name').populate('agent', 'name').select('number subject status priority dueDate isOverdue createdAt'),
    userId ? null : User.find({ ...comp, organization: orgId }).select('name email phone tier status').lean(),
    require('../../models/Conversation').find({ ...comp, ...(userId ? { user: userId } : {}) }).sort({ updatedAt: -1 }).limit(20),
    Asset.find({ ...comp, ...(organization ? { organization: organization._id } : { user: userId }) }).limit(20),
    organization ? Contract.find({ ...comp, organization: organization._id }).sort({ startDate: -1 }) : [],
    healthService.getHealth({ company: req.companyId, subjectType: organization ? 'organization' : 'user', subjectId: organization ? organization._id : userId }),
    SurveyResponse.find({ ...comp, ...(userId ? { user: userId } : {}) }).sort({ respondedAt: -1 }).limit(20).populate('ticket', 'number subject').populate('survey', 'name type'),
    CallLog.find({ ...comp, ...(userId ? { user: userId } : { user: null }) }).sort({ startedAt: -1 }).limit(20),
  ]);

  res.json({
    success: true,
    user: user ? { ...user, health: user.health || null } : null,
    organization,
    organizationUsers: organizations || [],
    tickets,
    conversations,
    assets,
    contracts,
    health,
    responses,
    callLogs,
  });
});
