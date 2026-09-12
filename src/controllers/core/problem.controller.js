const ProblemService = require("../../services/problemService");
const asyncHandler = require("../../utils/asyncHandler");

const problemController = {
  create: asyncHandler(async (req, res) => {
    const problem = await ProblemService.create(req.body, req.user._id);
    res.status(201).json({ success: true, data: problem });
  }),

  list: asyncHandler(async (req, res) => {
    const result = await ProblemService.list(req.user.company, req.query);
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req, res) => {
    const problem = await ProblemService.getById(
      req.params.id,
      req.user.company,
    );
    res.json({ success: true, data: problem });
  }),

  update: asyncHandler(async (req, res) => {
    const problem = await ProblemService.update(
      req.params.id,
      req.body,
      req.user.company,
      req.user._id,
    );
    res.json({ success: true, data: problem });
  }),

  transition: asyncHandler(async (req, res) => {
    const problem = await ProblemService.transition(
      req.params.id,
      req.body.status,
      req.user.company,
      req.user._id,
      req.body.notes,
    );
    res.json({ success: true, data: problem });
  }),

  assign: asyncHandler(async (req, res) => {
    const problem = await ProblemService.assign(
      req.params.id,
      req.body,
      req.user.company,
      req.user._id,
    );
    res.json({ success: true, data: problem });
  }),

  addComment: asyncHandler(async (req, res) => {
    const problem = await ProblemService.addComment(
      req.params.id,
      req.body,
      req.user.company,
      req.user._id,
    );
    res.json({ success: true, data: problem });
  }),

  linkIncident: asyncHandler(async (req, res) => {
    const link = await ProblemService.linkIncident(
      req.params.id,
      req.body.incidentId,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: link });
  }),

  unlinkIncident: asyncHandler(async (req, res) => {
    await ProblemService.unlinkIncident(
      req.params.id,
      req.params.incidentId,
      req.user.company,
    );
    res.json({ success: true });
  }),

  listIncidents: asyncHandler(async (req, res) => {
    const incidents = await ProblemService.listIncidents(
      req.params.id,
      req.user.company,
    );
    res.json({ success: true, data: incidents });
  }),

  linkCI: asyncHandler(async (req, res) => {
    const link = await ProblemService.linkCI(
      req.params.id,
      req.body.ciId,
      req.body.role,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: link });
  }),

  unlinkCI: asyncHandler(async (req, res) => {
    await ProblemService.unlinkCI(
      req.params.id,
      req.params.ciId,
      req.user.company,
    );
    res.json({ success: true });
  }),

  listCIs: asyncHandler(async (req, res) => {
    const cis = await ProblemService.listCIs(req.params.id, req.user.company);
    res.json({ success: true, data: cis });
  }),

  linkServiceOffering: asyncHandler(async (req, res) => {
    const link = await ProblemService.linkServiceOffering(
      req.params.id,
      req.body.serviceOfferingId,
      req.body.role,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: link });
  }),

  linkChange: asyncHandler(async (req, res) => {
    const link = await ProblemService.linkChange(
      req.params.id,
      req.body.changeId,
      req.body.relationshipType,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: link });
  }),

  listChanges: asyncHandler(async (req, res) => {
    const changes = await ProblemService.listChanges(
      req.params.id,
      req.user.company,
    );
    res.json({ success: true, data: changes });
  }),

  linkKnowledge: asyncHandler(async (req, res) => {
    const link = await ProblemService.linkKnowledge(
      req.params.id,
      req.body.knowledgeArticleId,
      req.body.role,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: link });
  }),

  createTask: asyncHandler(async (req, res) => {
    const task = await ProblemService.createTask(
      req.params.id,
      req.body,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: task });
  }),

  listTasks: asyncHandler(async (req, res) => {
    const tasks = await ProblemService.listTasks(
      req.params.id,
      req.user.company,
      req.query,
    );
    res.json({ success: true, data: tasks });
  }),

  publishWorkaround: asyncHandler(async (req, res) => {
    const problem = await ProblemService.publishWorkaround(
      req.params.id,
      req.user.company,
      req.user._id,
    );
    res.json({ success: true, data: problem });
  }),

  acceptRisk: asyncHandler(async (req, res) => {
    const problem = await ProblemService.acceptRisk(
      req.params.id,
      req.body.reason,
      req.user.company,
      req.user._id,
    );
    res.json({ success: true, data: problem });
  }),

  reanalyze: asyncHandler(async (req, res) => {
    const problem = await ProblemService.reanalyze(
      req.params.id,
      req.user.company,
      req.user._id,
    );
    res.json({ success: true, data: problem });
  }),

  getAssignmentHistory: asyncHandler(async (req, res) => {
    const history = await ProblemService.getAssignmentHistory(
      req.params.id,
      req.user.company,
    );
    res.json({ success: true, data: history });
  }),

  createKnownError: asyncHandler(async (req, res) => {
    const ke = await ProblemService.createKnownError(
      req.params.id,
      req.body,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: ke });
  }),

  listKnownErrors: asyncHandler(async (req, res) => {
    const result = await ProblemService.listKnownErrors(
      req.user.company,
      req.query,
    );
    res.json({ success: true, ...result });
  }),

  createRootCauseRecord: asyncHandler(async (req, res) => {
    const rcr = await ProblemService.createRootCauseRecord(
      req.params.id,
      req.body,
      req.user.company,
      req.user._id,
    );
    res.status(201).json({ success: true, data: rcr });
  }),

  listRootCauseRecords: asyncHandler(async (req, res) => {
    const records = await ProblemService.listRootCauseRecords(
      req.params.id,
      req.user.company,
    );
    res.json({ success: true, data: records });
  }),
};

module.exports = problemController;
