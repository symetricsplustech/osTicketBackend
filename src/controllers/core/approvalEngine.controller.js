const svc = require("../../services/approvalEngine");

// ─── Definitions ────────────────────────────────────────────────────────
exports.listDefinitions = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listDefinitions({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getDefinition = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getDefinition({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createDefinition = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createDefinition(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateDefinition = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateDefinition(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteDefinition = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteDefinition(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.evaluatePolicy = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.evaluatePolicy(
        { tenantId: req.tenantId },
        req.body.entityType,
        req.body.entity || {},
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Instances ──────────────────────────────────────────────────────────
exports.listInstances = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listInstances({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getInstance = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getInstance({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.getInstanceWithSteps = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getInstanceWithSteps(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createInstance = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createInstance(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.decide = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.decide(
        { tenantId: req.tenantId },
        req.params.id,
        req.params.stepId,
        req.body.decision,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.batchDecide = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.batchDecide(
        { tenantId: req.tenantId },
        req.params.id,
        req.body.decisions,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Delegations ────────────────────────────────────────────────────────
exports.listDelegations = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listDelegations({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.createDelegation = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createDelegation(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateDelegation = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateDelegation(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteDelegation = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteDelegation(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Decisions / History ────────────────────────────────────────────────
exports.getDecisionHistory = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getDecisionHistory(
        { tenantId: req.tenantId },
        req.params.instanceId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getRecentDecisions = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getRecentDecisions({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Pending / Dashboard / Stats ────────────────────────────────────────
exports.getPendingForUser = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getPendingForUser(
        { tenantId: req.tenantId },
        req.user.userId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getDashboard = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getDashboard({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};
exports.getStats = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getStats({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Timeout / Escalation (admin triggers) ──────────────────────────────
exports.processTimeouts = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.processTimeouts({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};
exports.processEscalations = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.processEscalations({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};
