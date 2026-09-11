const IncidentService = require('../../services/incidentService');
const MajorIncidentService = require('../../services/majorIncidentService');
const PostIncidentReviewService = require('../../services/postIncidentReviewService');
const asyncHandler = require('../../utils/asyncHandler');

const incidentController = {
  create: asyncHandler(async (req, res) => {
    const incident = await IncidentService.create(req.body, req.user._id);
    res.status(201).json({ success: true, data: incident });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await IncidentService.list(req.user.company, req.query);
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req, res) => {
    const incident = await IncidentService.getById(req.params.id, req.user.company);
    res.json({ success: true, data: incident });
  }),

  update: asyncHandler(async (req, res) => {
    const incident = await IncidentService.update(req.params.id, req.body, req.user.company, req.user._id);
    res.json({ success: true, data: incident });
  }),

  transition: asyncHandler(async (req, res) => {
    const incident = await IncidentService.transition(
      req.params.id,
      req.body.status,
      req.user.company,
      req.user._id,
      req.body.notes
    );
    res.json({ success: true, data: incident });
  }),

  assign: asyncHandler(async (req, res) => {
    const incident = await IncidentService.assign(req.params.id, req.body, req.user.company, req.user._id);
    res.json({ success: true, data: incident });
  }),

  addComment: asyncHandler(async (req, res) => {
    const incident = await IncidentService.addComment(req.params.id, req.body, req.user.company, req.user._id);
    res.json({ success: true, data: incident });
  }),

  linkCI: asyncHandler(async (req, res) => {
    const link = await IncidentService.linkCI(req.params.id, req.body.ciId, req.body.role, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: link });
  }),

  unlinkCI: asyncHandler(async (req, res) => {
    await IncidentService.unlinkCI(req.params.id, req.params.ciId, req.user.company);
    res.json({ success: true });
  }),

  listCIs: asyncHandler(async (req, res) => {
    const cis = await IncidentService.listCIs(req.params.id, req.user.company);
    res.json({ success: true, data: cis });
  }),

  linkServiceOffering: asyncHandler(async (req, res) => {
    const link = await IncidentService.linkServiceOffering(req.params.id, req.body.serviceOfferingId, req.body.role, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: link });
  }),

  linkIncident: asyncHandler(async (req, res) => {
    const link = await IncidentService.linkIncident(req.params.id, req.body.targetIncidentId, req.body.relationshipType, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: link });
  }),

  listRelationships: asyncHandler(async (req, res) => {
    const relationships = await IncidentService.listRelationships(req.params.id, req.user.company);
    res.json({ success: true, data: relationships });
  }),

  resolve: asyncHandler(async (req, res) => {
    const incident = await IncidentService.resolve(req.params.id, req.body, req.user.company, req.user._id);
    res.json({ success: true, data: incident });
  }),

  close: asyncHandler(async (req, res) => {
    const incident = await IncidentService.close(req.params.id, req.user.company, req.user._id);
    res.json({ success: true, data: incident });
  }),

  reopen: asyncHandler(async (req, res) => {
    const incident = await IncidentService.reopen(req.params.id, req.user.company, req.user._id, req.body.reason);
    res.json({ success: true, data: incident });
  }),

  cancel: asyncHandler(async (req, res) => {
    const incident = await IncidentService.cancel(req.params.id, req.user.company, req.user._id, req.body.reason);
    res.json({ success: true, data: incident });
  }),

  createTask: asyncHandler(async (req, res) => {
    const task = await IncidentService.createTask(req.params.id, req.body, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: task });
  }),

  listTasks: asyncHandler(async (req, res) => {
    const tasks = await IncidentService.listTasks(req.params.id, req.user.company, req.query);
    res.json({ success: true, data: tasks });
  }),

  getAssignmentHistory: asyncHandler(async (req, res) => {
    const history = await IncidentService.getAssignmentHistory(req.params.id, req.user.company);
    res.json({ success: true, data: history });
  }),

  getDuplicateCandidates: asyncHandler(async (req, res) => {
    const candidates = await IncidentService.getDuplicateCandidates(req.user.company, req.query.title, req.query.category);
    res.json({ success: true, data: candidates });
  }),

  nominateMajor: asyncHandler(async (req, res) => {
    const candidate = await MajorIncidentService.nominate(req.params.id, req.body, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: candidate });
  }),

  approveMajor: asyncHandler(async (req, res) => {
    const majorIncident = await MajorIncidentService.approve(req.params.id, req.user.company, req.user._id);
    res.json({ success: true, data: majorIncident });
  }),

  rejectMajor: asyncHandler(async (req, res) => {
    const candidate = await MajorIncidentService.reject(req.params.id, req.body.reason, req.user.company, req.user._id);
    res.json({ success: true, data: candidate });
  }),

  demoteMajor: asyncHandler(async (req, res) => {
    const majorIncident = await MajorIncidentService.demote(req.params.id, req.body.reason, req.user.company, req.user._id);
    res.json({ success: true, data: majorIncident });
  }),

  listMajorIncidents: asyncHandler(async (req, res) => {
    const result = await MajorIncidentService.list(req.user.company, req.query);
    res.json({ success: true, ...result });
  }),

  getMajorIncident: asyncHandler(async (req, res) => {
    const mi = await MajorIncidentService.getById(req.params.id, req.user.company);
    res.json({ success: true, data: mi });
  }),

  listMajorCandidates: asyncHandler(async (req, res) => {
    const result = await MajorIncidentService.listCandidates(req.user.company, req.query);
    res.json({ success: true, ...result });
  }),

  addMajorParticipant: asyncHandler(async (req, res) => {
    const participant = await MajorIncidentService.addParticipant(req.params.id, req.body, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: participant });
  }),

  removeMajorParticipant: asyncHandler(async (req, res) => {
    await MajorIncidentService.removeParticipant(req.params.id, req.params.userId, req.user.company);
    res.json({ success: true });
  }),

  listMajorParticipants: asyncHandler(async (req, res) => {
    const participants = await MajorIncidentService.listParticipants(req.params.id, req.user.company);
    res.json({ success: true, data: participants });
  }),

  addMajorTimelineEvent: asyncHandler(async (req, res) => {
    const event = await MajorIncidentService.addTimelineEvent(req.params.id, req.body, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: event });
  }),

  listMajorTimelineEvents: asyncHandler(async (req, res) => {
    const events = await MajorIncidentService.listTimelineEvents(req.params.id, req.user.company, req.query);
    res.json({ success: true, data: events });
  }),

  updateMajorCommPlan: asyncHandler(async (req, res) => {
    const mi = await MajorIncidentService.updateCommunicationPlan(req.params.id, req.body, req.user.company, req.user._id);
    res.json({ success: true, data: mi });
  }),

  updateMajorExecSummary: asyncHandler(async (req, res) => {
    const mi = await MajorIncidentService.updateExecSummary(req.params.id, req.body.execSummary, req.user.company, req.user._id);
    res.json({ success: true, data: mi });
  }),

  createPIR: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.create(req.body, req.user.company, req.user._id);
    res.status(201).json({ success: true, data: pir });
  }),

  listPIRs: asyncHandler(async (req, res) => {
    const result = await PostIncidentReviewService.list(req.user.company, req.query);
    res.json({ success: true, ...result });
  }),

  getPIR: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.getById(req.params.id, req.user.company);
    res.json({ success: true, data: pir });
  }),

  updatePIR: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.update(req.params.id, req.body, req.user.company, req.user._id);
    res.json({ success: true, data: pir });
  }),

  submitPIRForReview: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.submitForReview(req.params.id, req.user.company, req.user._id);
    res.json({ success: true, data: pir });
  }),

  approvePIR: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.approve(req.params.id, req.user.company, req.user._id);
    res.json({ success: true, data: pir });
  }),

  publishPIR: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.publish(req.params.id, req.user.company, req.user._id);
    res.json({ success: true, data: pir });
  }),

  addPIRActionItem: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.addActionItem(req.params.id, req.body, req.user.company, req.user._id);
    res.json({ success: true, data: pir });
  }),

  updatePIRActionItem: asyncHandler(async (req, res) => {
    const pir = await PostIncidentReviewService.updateActionItem(req.params.id, req.params.actionItemId, req.body, req.user.company);
    res.json({ success: true, data: pir });
  }),

  deletePIRActionItem: asyncHandler(async (req, res) => {
    await PostIncidentReviewService.deleteActionItem(req.params.id, req.params.actionItemId, req.user.company);
    res.json({ success: true });
  }),
};

module.exports = incidentController;
