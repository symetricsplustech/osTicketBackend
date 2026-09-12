const svc = require('../../services/improvementService');

// ─── Opportunities ────────────────────────────────────────────────────
exports.listOpportunities = async (req, res, next) => { try { res.json({ success: true, data: await svc.listOpportunities({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getOpportunity = async (req, res, next) => { try { res.json({ success: true, data: await svc.getOpportunity({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createOpportunity = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createOpportunity({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateOpportunity = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateOpportunity({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.transitionOpportunity = async (req, res, next) => { try { res.json({ success: true, data: await svc.transitionOpportunity({ tenantId: req.tenantId }, req.params.id, req.body.status, req.user) }); } catch (e) { next(e); } };
exports.deleteOpportunity = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteOpportunity({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Initiatives ──────────────────────────────────────────────────────
exports.listInitiatives = async (req, res, next) => { try { res.json({ success: true, data: await svc.listInitiatives({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getInitiative = async (req, res, next) => { try { res.json({ success: true, data: await svc.getInitiative({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.getInitiativeWithDetails = async (req, res, next) => { try { res.json({ success: true, data: await svc.getInitiativeWithDetails({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createInitiative = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createInitiative({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateInitiative = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateInitiative({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.transitionInitiative = async (req, res, next) => { try { res.json({ success: true, data: await svc.transitionInitiative({ tenantId: req.tenantId }, req.params.id, req.body.status, req.user) }); } catch (e) { next(e); } };
exports.deleteInitiative = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteInitiative({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Tasks ────────────────────────────────────────────────────────────
exports.listTasks = async (req, res, next) => { try { res.json({ success: true, data: await svc.listTasks({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.getTask({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createTask = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createTask({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateTask({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.transitionTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.transitionTask({ tenantId: req.tenantId }, req.params.id, req.body.status, req.user) }); } catch (e) { next(e); } };
exports.deleteTask = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteTask({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Goals ────────────────────────────────────────────────────────────
exports.listGoals = async (req, res, next) => { try { res.json({ success: true, data: await svc.listGoals({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getGoal = async (req, res, next) => { try { res.json({ success: true, data: await svc.getGoal({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createGoal = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createGoal({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateGoal = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateGoal({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateGoalProgress = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateGoalProgress({ tenantId: req.tenantId }, req.params.id, req.body.currentValue, req.user) }); } catch (e) { next(e); } };
exports.deleteGoal = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteGoal({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Benefits ─────────────────────────────────────────────────────────
exports.listBenefits = async (req, res, next) => { try { res.json({ success: true, data: await svc.listBenefits({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.createBenefit = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createBenefit({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateBenefit = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateBenefit({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deleteBenefit = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteBenefit({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Costs ────────────────────────────────────────────────────────────
exports.listCosts = async (req, res, next) => { try { res.json({ success: true, data: await svc.listCosts({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.createCost = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createCost({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateCost = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateCost({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteCost = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteCost({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Metric Baselines ────────────────────────────────────────────────
exports.listBaselines = async (req, res, next) => { try { res.json({ success: true, data: await svc.listBaselines({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.createBaseline = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createBaseline({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateBaseline = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateBaseline({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteBaseline = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteBaseline({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Metric Targets ──────────────────────────────────────────────────
exports.listTargets = async (req, res, next) => { try { res.json({ success: true, data: await svc.listTargets({ tenantId: req.tenantId }, req.query) }); } catch (e) { next(e); } };
exports.getTarget = async (req, res, next) => { try { res.json({ success: true, data: await svc.getTarget({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
exports.createTarget = async (req, res, next) => { try { res.status(201).json({ success: true, data: await svc.createTarget({ tenantId: req.tenantId }, req.body, req.user) }); } catch (e) { next(e); } };
exports.updateTarget = async (req, res, next) => { try { res.json({ success: true, data: await svc.updateTarget({ tenantId: req.tenantId }, req.params.id, req.body, req.user) }); } catch (e) { next(e); } };
exports.deleteTarget = async (req, res, next) => { try { res.json({ success: true, data: await svc.deleteTarget({ tenantId: req.tenantId }, req.params.id, req.user) }); } catch (e) { next(e); } };

// ─── Dashboard / Analytics ──────────────────────────────────────────
exports.getDashboard = async (req, res, next) => { try { res.json({ success: true, data: await svc.getDashboard({ tenantId: req.tenantId }) }); } catch (e) { next(e); } };
exports.getInitiativeROI = async (req, res, next) => { try { res.json({ success: true, data: await svc.getInitiativeROI({ tenantId: req.tenantId }, req.params.id) }); } catch (e) { next(e); } };
