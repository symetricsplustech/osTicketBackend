/**
 * Service Level Management controller — HTTP layer for SLA plans, OLA, UC targets,
 * schedules, calendars, conditions, events, breakdowns, repair jobs, dashboard.
 */
const slmService = require("../../services/slmService");

// ─── SLA Plans ──────────────────────────────────────────────────────────
exports.listPlans = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.listPlans({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getPlan = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.getPlan({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createPlan = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.createPlan(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updatePlan = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.updatePlan(
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
exports.deletePlan = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.deletePlan(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.clonePlan = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.clonePlan(
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

// ─── OLA ────────────────────────────────────────────────────────────────
exports.listOLAs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.listOLAs({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getOLA = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.getOLA({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createOLA = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.createOLA(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateOLA = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.updateOLA(
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
exports.deleteOLA = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.deleteOLA(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── UC Targets ─────────────────────────────────────────────────────────
exports.listUCTargets = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.listUCTargets(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createUCTarget = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.createUCTarget(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateUCTarget = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.updateUCTarget(
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
exports.deleteUCTarget = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.deleteUCTarget(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.measureUCTarget = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.measureUCTarget(
        { tenantId: req.tenantId },
        req.params.id,
        req.body.actualValue,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Schedules ──────────────────────────────────────────────────────────
exports.listSchedules = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.listSchedules(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getSchedule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.getSchedule(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createSchedule = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.createSchedule(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateSchedule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.updateSchedule(
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
exports.deleteSchedule = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.deleteSchedule(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Holiday Calendars ──────────────────────────────────────────────────
exports.listCalendars = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.listCalendars(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createCalendar = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.createCalendar(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateCalendar = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.updateCalendar(
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
exports.deleteCalendar = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.deleteCalendar(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Conditions ─────────────────────────────────────────────────────────
exports.listConditions = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.listConditions(
        { tenantId: req.tenantId },
        req.params.slaPlanId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createCondition = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.createCondition(
          { tenantId: req.tenantId },
          req.params.slaPlanId,
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateCondition = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.updateCondition(
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
exports.deleteCondition = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.deleteCondition(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Events / Timeline ──────────────────────────────────────────────────
exports.getSLAEvents = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.getSLAEvents(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getTicketSLATimeline = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.getTicketSLATimeline(
        { tenantId: req.tenantId },
        req.params.ticketId,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Breakdowns ─────────────────────────────────────────────────────────
exports.getBreakdowns = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.getBreakdowns(
        { tenantId: req.tenantId },
        req.params.ticketId,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Repair Jobs ────────────────────────────────────────────────────────
exports.listRepairJobs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.listRepairJobs(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createRepairJob = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await slmService.createRepairJob(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.startRepairJob = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.startRepairJob(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.completeRepairJob = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.completeRepairJob(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
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
      data: await slmService.getDashboard({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Recalculate ────────────────────────────────────────────────────────
exports.recalculateDueDates = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await slmService.recalculateDueDates(
        { tenantId: req.tenantId },
        req.body.slaPlanId,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
