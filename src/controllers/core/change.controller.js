const ChangeService = require('../../services/changeService');
const asyncHandler = require('../../utils/asyncHandler');

const changeController = {
  create: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await ChangeService.create(req.body, req.user._id) }); }),
  list: asyncHandler(async (req, res) => { res.json({ success: true, ...(await ChangeService.list(req.user.company, req.query)) }); }),
  getById: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.getById(req.params.id, req.user.company) }); }),
  update: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.update(req.params.id, req.body, req.user.company, req.user._id) }); }),
  transition: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.transition(req.params.id, req.body.status, req.user.company, req.user._id, req.body.notes) }); }),
  close: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.close(req.params.id, req.body.closeCode, req.body.closeNotes, req.user.company, req.user._id) }); }),
  rollback: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.rollback(req.params.id, req.body.reason, req.user.company, req.user._id) }); }),

  linkCI: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await ChangeService.linkCI(req.params.id, req.body.ciId, req.body.role, req.user.company, req.user._id) }); }),
  unlinkCI: asyncHandler(async (req, res) => { await ChangeService.unlinkCI(req.params.id, req.params.ciId, req.user.company); res.json({ success: true }); }),
  listCIs: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listCIs(req.params.id, req.user.company) }); }),

  linkService: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await ChangeService.linkService(req.params.id, req.body.serviceId, req.body.impactLevel, req.user.company, req.user._id) }); }),

  assessRisk: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.assessRisk(req.params.id, req.body, req.user.company, req.user._id) }); }),
  detectConflicts: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.detectConflicts(req.params.id, req.user.company) }); }),
  listConflicts: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listConflicts(req.params.id, req.user.company) }); }),

  createTask: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await ChangeService.createTask(req.params.id, req.body, req.user.company, req.user._id) }); }),
  listTasks: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listTasks(req.params.id, req.user.company) }); }),

  createImplementationResult: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.createImplementationResult(req.params.id, req.body, req.user.company, req.user._id) }); }),

  listModels: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listModels(req.user.company) }); }),
  listTemplates: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listTemplates(req.user.company) }); }),
  listMaintenanceWindows: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listMaintenanceWindows(req.user.company) }); }),
  listBlackoutWindows: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listBlackoutWindows(req.user.company) }); }),
  listApprovalPolicies: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listApprovalPolicies(req.user.company) }); }),

  listCABs: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listCABs(req.user.company) }); }),
  createCABMeeting: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await ChangeService.createCABMeeting(req.params.cabId, req.body, req.user.company, req.user._id) }); }),
  listCABMeetings: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listCABMeetings(req.user.company, req.query) }); }),
  addAgendaItem: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await ChangeService.addAgendaItem(req.params.meetingId, req.body, req.user.company) }); }),
  listAgendaItems: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listAgendaItems(req.params.meetingId, req.user.company) }); }),
  decideAgendaItem: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.decideAgendaItem(req.params.itemId, req.body.decision, req.body.decisionNotes, req.user.company, req.user._id) }); }),
  addAttendee: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await ChangeService.addAttendee(req.params.meetingId, req.body.userId, req.user.company) }); }),
  listAttendees: asyncHandler(async (req, res) => { res.json({ success: true, data: await ChangeService.listAttendees(req.params.meetingId, req.user.company) }); }),
};

module.exports = changeController;
