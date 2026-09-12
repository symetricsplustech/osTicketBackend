const svc = require("../../services/cmdbService");

// ─── Service Portfolio ───────────────────────────────────────────────────
exports.listPortfolios = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listPortfolios({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getPortfolio = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getPortfolio({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createPortfolio = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createPortfolio(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updatePortfolio = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updatePortfolio(
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
exports.deletePortfolio = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deletePortfolio(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Business Services ──────────────────────────────────────────────────
exports.listBusinessServices = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listBusinessServices(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getBusinessService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getBusinessService(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createBusinessService = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createBusinessService(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateBusinessService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateBusinessService(
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
exports.deleteBusinessService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteBusinessService(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Technical Services ─────────────────────────────────────────────────
exports.listTechnicalServices = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listTechnicalServices(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getTechnicalService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getTechnicalService(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createTechnicalService = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createTechnicalService(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateTechnicalService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateTechnicalService(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteTechnicalService = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteTechnicalService(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Service Offerings ──────────────────────────────────────────────────
exports.listServiceOfferings = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listServiceOfferings(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getServiceOffering = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getServiceOffering(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createServiceOffering = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createServiceOffering(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateServiceOffering = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateServiceOffering(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteServiceOffering = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteServiceOffering(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Configuration Items ────────────────────────────────────────────────
exports.listCIs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listCIs({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getCI = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getCI({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createCI = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createCI(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateCI = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateCI(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteCI = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteCI(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.searchCIs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.searchCIs({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.certifyCI = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.certifyCI(
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
exports.getNonCompliantCIs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getNonCompliantCIs({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};

// ─── CI Relationships ──────────────────────────────────────────────────
exports.listRelationships = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listRelationships({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getRelationship = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getRelationship(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createRelationship = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createRelationship(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateRelationship = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateRelationship(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteRelationship = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteRelationship(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Service Owners ────────────────────────────────────────────────────
exports.listServiceOwners = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listServiceOwners(
        { tenantId: req.tenantId },
        req.params.serviceId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.assignServiceOwner = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.assignServiceOwner(
          { tenantId: req.tenantId },
          req.params.serviceId,
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.removeServiceOwner = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.removeServiceOwner(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Service Commitments ───────────────────────────────────────────────
exports.listServiceCommitments = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listServiceCommitments(
        { tenantId: req.tenantId },
        req.query,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getServiceCommitment = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getServiceCommitment(
        { tenantId: req.tenantId },
        req.params.id,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.createServiceCommitment = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createServiceCommitment(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateServiceCommitment = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateServiceCommitment(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteServiceCommitment = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteServiceCommitment(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Service Level Commitments ──────────────────────────────────────────
exports.listSLCs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listSLCs({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getSLC = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getSLC({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createSLC = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createSLC(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateSLC = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateSLC(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteSLC = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteSLC(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Dependencies ───────────────────────────────────────────────────────
exports.listDependencies = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listDependencies({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.getDependency = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getDependency({ tenantId: req.tenantId }, req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
exports.createDependency = async (req, res, next) => {
  try {
    res
      .status(201)
      .json({
        success: true,
        data: await svc.createDependency(
          { tenantId: req.tenantId },
          req.body,
          req.user,
        ),
      });
  } catch (e) {
    next(e);
  }
};
exports.updateDependency = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.updateDependency(
        { tenantId: req.tenantId },
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.deleteDependency = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.deleteDependency(
        { tenantId: req.tenantId },
        req.params.id,
        req.user,
      ),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Impact Analysis ────────────────────────────────────────────────────
exports.analyzeImpact = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.analyzeImpact(
        { tenantId: req.tenantId },
        req.params.ciId,
        req.body,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.analyzeServiceImpact = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.analyzeServiceImpact(
        { tenantId: req.tenantId },
        req.params.serviceId,
      ),
    });
  } catch (e) {
    next(e);
  }
};
exports.getDependencyGraph = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getDependencyGraph({ tenantId: req.tenantId }, req.body),
    });
  } catch (e) {
    next(e);
  }
};

// ─── Dashboard / Search / Compliance ───────────────────────────────────
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
exports.searchCIs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.searchCIs({ tenantId: req.tenantId }, req.query),
    });
  } catch (e) {
    next(e);
  }
};
exports.certifyCI = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.certifyCI(
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
exports.getNonCompliantCIs = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.getNonCompliantCIs({ tenantId: req.tenantId }),
    });
  } catch (e) {
    next(e);
  }
};
