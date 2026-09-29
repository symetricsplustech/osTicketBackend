const service = require("../../services/universalRequestService");

exports.list = async (req, res, next) => { try { res.json({ success: true, data: await service.list({ tenantId: req.tenantId }, req.query) }); } catch (error) { next(error); } };
exports.get = async (req, res, next) => { try { res.json({ success: true, data: await service.get({ tenantId: req.tenantId }, req.params.id) }); } catch (error) { next(error); } };
exports.create = async (req, res, next) => { try { res.status(201).json({ success: true, data: await service.create({ tenantId: req.tenantId }, req.body, req.user) }); } catch (error) { next(error); } };
exports.update = async (req, res, next) => { try { res.json({ success: true, data: await service.update({ tenantId: req.tenantId }, req.params.id, req.body) }); } catch (error) { next(error); } };
exports.transition = async (req, res, next) => { try { res.json({ success: true, data: await service.transition({ tenantId: req.tenantId }, req.params.id, req.body.status, req.user) }); } catch (error) { next(error); } };
exports.remove = async (req, res, next) => { try { res.json(await service.remove({ tenantId: req.tenantId }, req.params.id)); } catch (error) { next(error); } };
