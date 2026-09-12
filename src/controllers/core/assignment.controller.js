const svc = require("../../services/assignmentService");

// ─── Assignment Rules ───────────────────────────────────────────────────
exports.listRules = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listRules({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getRule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getRule({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createRule = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createRule(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateRule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateRule(
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
exports.deleteRule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteRule(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Queues ─────────────────────────────────────────────────────────────
exports.listQueues = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listQueues({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getQueue = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getQueue({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createQueue = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createQueue(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateQueue = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateQueue(
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
exports.deleteQueue = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteQueue(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getQueueStats = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getQueueStats({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Skills ─────────────────────────────────────────────────────────────
exports.listSkills = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listSkills({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getSkill = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getSkill({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createSkill = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createSkill(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateSkill = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateSkill(
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
exports.deleteSkill = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteSkill(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Agent Skills ───────────────────────────────────────────────────────
exports.listAgentSkills = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listAgentSkills(
        { tenantId: req.tenantId },
        req.params.agentId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.assignSkill = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.assignSkill(
        { tenantId: req.tenantId },
        req.params.agentId,
        req.params.skillId,
        req.body,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.removeSkill = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.removeSkill(
        { tenantId: req.tenantId },
        req.params.agentId,
        req.params.skillId,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Presence ───────────────────────────────────────────────────────────
exports.getPresence = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getPresence(
        { tenantId: req.tenantId },
        req.params.agentId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getPresenceHistory = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getPresenceHistory(
        { tenantId: req.tenantId },
        req.params.agentId,
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.setPresence = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.setPresence(
        { tenantId: req.tenantId },
        req.params.agentId,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getPresenceStats = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getPresenceStats({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Capacity ───────────────────────────────────────────────────────────
exports.getCapacity = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getCapacity(
        { tenantId: req.tenantId },
        req.params.agentId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getCapacityStats = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getCapacityStats({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};
exports.updateCapacity = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateCapacity(
        { tenantId: req.tenantId },
        req.params.agentId,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.recalculateCapacity = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.recalculateCapacity(
        { tenantId: req.tenantId },
        req.params.agentId,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Routing Rules ──────────────────────────────────────────────────────
exports.listRoutingRules = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listRoutingRules({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getRoutingRule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getRoutingRule({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createRoutingRule = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createRoutingRule(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateRoutingRule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateRoutingRule(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteRoutingRule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteRoutingRule(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Assignment Events ──────────────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getHistory(
        { tenantId: req.tenantId },
        req.params.ticketId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getHistoryByNumber = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getHistoryByNumber(
        { tenantId: req.tenantId },
        req.params.ticketNumber,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getRecentEvents = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getRecentEvents({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Core Logic ─────────────────────────────────────────────────────────
exports.evaluateRules = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.evaluateRules({ tenantId: req.tenantId }, req.body),
    });
  } catch (e) {
    next(e);
  }
};
exports.evaluateRoutingRules = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.evaluateRoutingRules(
        { tenantId: req.tenantId },
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.findBestAgent = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.findBestAgent({ tenantId: req.tenantId }, req.body),
    });
  } catch (e) {
    next(e);
  }
};
exports.diagnose = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.diagnose({ tenantId: req.tenantId }, req.body),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Work Offer ─────────────────────────────────────────────────────────
exports.offerWork = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.offerWork(
        { tenantId: req.tenantId },
        req.params.ticketId,
        req.body.agentId,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.acceptWork = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.acceptWork(
        { tenantId: req.tenantId },
        req.params.ticketId,
        req.params.agentId,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.declineWork = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.declineWork(
        { tenantId: req.tenantId },
        req.params.ticketId,
        req.params.agentId,
        req.body.reason,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Dashboard ──────────────────────────────────────────────────────────
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
