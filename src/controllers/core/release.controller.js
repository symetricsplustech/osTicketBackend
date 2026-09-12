const svc = require('../../services/releaseService');

// ─── Releases ──────────────────────────────────────────────────────────
exports.listReleases = async (req, res, next) => { try { res.json({ success: true, data: await svc.listReleases({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getRelease = async (req, res, next) => { try { res.json({ success: true, data: await svc.getRelease({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createRelease = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createRelease({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateRelease = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateRelease({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deleteRelease = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteRelease({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.transitionRelease = async (req, res, next) => { try { res.json({ success: true, data: await svc.transitionRelease({ tenantId: req.tenantId }, req.params.id, req.body.status, req.user) }); } catch (e) { next(e); } };

// ─── Phases ────────────────────────────────────────────────────────────
exports.listPhases = async (req, res, next) => { try { res.json({ success: true, data: await svc.listPhases({ tenantId: req.tenantId }, req.params.releaseId) }); } catch (e) { next(e); } };
exports.getPhase = async (req, res, next) => { try { res.json({ success: true, data: await svc.getPhase({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createPhase = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createPhase({ tenantId: req.tenantId }, req.params.releaseId, req.body, req.user) }); } catch (e) { next(e); } };
exports.updatePhase = async (req, res, next) => { try { res.json({ success: true, data: await svc.updatePhase({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deletePhase = async (req, res, next) => { try { res.json({ success: true, data: await svc.deletePhase({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Tasks ─────────────────────────────────────────────────────────────
exports.listTasks = async (req, res, next) => { try { res.json({ success: true, data: await svc.listTasks({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.getTask({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createTask = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createTask({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateTask({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deleteTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteTask({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.executeTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.executeTask({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Components ────────────────────────────────────────────────────────
exports.listComponents = async (req, res, next) => { try { res.json({ success: true, data: await svc.listComponents({ tenantId: req.tenantId }, req.params.releaseId) }); } catch (e) { next(e); } };
exports.getComponent = async (req, res, next) => { try { res.json({ success: true, data: await svc.getComponent({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createComponent = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createComponent({ tenantId: req.tenantId }, req.params.releaseId, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateComponent = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateComponent({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteComponent = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteComponent({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Dependencies ──────────────────────────────────────────────────────
exports.listDependencies = async (req, res, next) => { try { res.json({ success: true, data: await svc.listDependencies({ tenantId: req.tenantId }, req.params.releaseId) }); } catch (e) { next(e); } };
exports.getDependency = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDependency({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createDependency = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createDependency({ tenantId: req.tenantId }, req.params.releaseId, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateDependency = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateDependency({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteDependency = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteDependency({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Approvals ─────────────────────────────────────────────────────────
exports.listApprovals = async (req, res, next) => { try { res.json({ success: true, data: await svc.listApprovals({ tenantId: req.tenantId }, req.params.releaseId) }); } catch (e) { next(e); } };
exports.getApproval = async (req, res, next) => { try { res.json({ success: true, data: await svc.getApproval({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createApproval = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createApproval({ tenantId: req.tenantId }, req.params.releaseId, req.body, req.user) }); } catch (e) { next(e); } };
exports.decideApproval = async (req, res, next) => { try { res.json({ success: true, data: await svc.decideApproval({ tenantId: req.tenantId }, req.params.id, req.body.userId, req.body.decision, req.body.comment) }); } catch (e) { next(e); } };
exports.deleteApproval = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteApproval({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Deployments ───────────────────────────────────────────────────────
exports.listDeployments = async (req, res, next) => { try { res.json({ success: true, data: await svc.listDeployments({ tenantId: req.tenantId }, req.params.releaseId) }); } catch (e) { next(e); } };
exports.getDeployment = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDeployment({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createDeployment = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createDeployment({ tenantId: req.tenantId }, req.params.releaseId, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateDeployment = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateDeployment({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteDeployment = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteDeployment({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.startDeployment = async (req, res, next) => { try { res.json({ success: true, data: await svc.startDeployment({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.completeDeployment = async (req, res, next) => { try { res.json({ success: true, data: await svc.completeDeployment({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };
exports.rollbackDeployment = async (req, res, next) => { try { res.json({ success: true, data: await svc.rollbackDeployment({ tenantId: req.tenantId }, req.params.id, req.body.reason, req.user) }); } catch (e) { next(e); } };

// ─── Change Association ────────────────────────────────────────────────
exports.associateChange = async (req, res, next) => { try { res.json({ success: true, data: await svc.associateChange({ tenantId: req.tenantId }, req.params.releaseId, req.body.changeId, req.user) }); } catch (e) { next(e); } };
exports.removeChange = async (req, res, next) => { try { res.json({ success: true, data: await svc.removeChange({ tenantId: req.tenantId }, req.params.releaseId, req.body.changeId, req.user) }); } catch (e) { next(e); } };

// ─── Dashboard ──────────────────────────────────────────────────────────
exports.getDashboard = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDashboard({ tenantId: req.tenantId }) }); } catch (e) { next(e); } };
