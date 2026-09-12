const svc = require("../../services/walkupService");

// ─── Locations ──────────────────────────────────────────────────────────
exports.listLocations = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listLocations({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getLocation = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getLocation({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createLocation = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createLocation(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateLocation = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateLocation(
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
exports.deleteLocation = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteLocation(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getOpenLocations = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getOpenLocations({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Services ──────────────────────────────────────────────────────────
exports.listServices = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listServices({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getService({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createService = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createService(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateService(
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
exports.deleteService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteService(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Queues ────────────────────────────────────────────────────────────
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

// ─── Check-ins ─────────────────────────────────────────────────────────
exports.checkIn = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.checkIn({ tenantId: req.tenantId }, req.body, req.user),
      });
  } catch (e) {
    next(e);
  }
};
exports.callCheckin = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.callCheckin(
        { tenantId: req.tenantId },
        req.params.id,
        req.body.technicianId,
        req.body.technicianName,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.startService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.startService(
        { tenantId: req.tenantId },
        req.params.id,
        req.body.technicianId,
        req.body.technicianName,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.completeCheckin = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.completeCheckin(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.cancelCheckin = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.cancelCheckin(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Appointments ──────────────────────────────────────────────────────
exports.listAppointments = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listAppointments({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getAppointment = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getAppointment({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createAppointment = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createAppointment(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateAppointment = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateAppointment(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.checkinAppointment = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.checkinAppointment(
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
exports.cancelAppointment = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.cancelAppointment(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Interactions ──────────────────────────────────────────────────────
exports.createInteraction = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createInteraction(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.getInteraction = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getInteraction({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.completeInteraction = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.completeInteraction(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Kiosks ────────────────────────────────────────────────────────────
exports.listKiosks = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listKiosks({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getKiosk = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getKiosk({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createKiosk = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createKiosk(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateKiosk = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateKiosk(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteKiosk = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteKiosk(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.heartbeat = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.heartbeat({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Wait Time ─────────────────────────────────────────────────────────
exports.recordWaitTime = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.recordWaitTime(
        { tenantId: req.tenantId },
        req.params.queueId,
        req.body.eventType,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getWaitTimeEstimate = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getWaitTimeEstimate(
        { tenantId: req.tenantId },
        req.params.queueId,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Dashboard ─────────────────────────────────────────────────────────
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

// ─── Queue Number Reset ────────────────────────────────────────────────
exports.resetQueueNumber = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.resetQueueNumber(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
