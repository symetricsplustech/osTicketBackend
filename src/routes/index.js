const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const ticketRoutes = require('./ticket.routes');
const kbRoutes = require('./kb.routes');
const agentRoutes = require('./agent.routes');
const adminRoutes = require('./admin.routes');
const superadminRoutes = require('./superadmin.routes');
const enterpriseRoutes = require('./enterprise.routes');
const publicRoutes = require('./public.routes');
const crmRoutes = require('./crm.routes');
const itomRoutes = require('./itom.routes');
const projectsRoutes = require('./projects.routes');
const hrRoutes = require('./hr.routes');
const fieldserviceRoutes = require('./fieldservice.routes');
const productRoutes = require('./product.routes');
const licenseRoutes = require('./license.routes');
const stockroomRoutes = require('./stockroom.routes');
const customerServiceRoutes = require('./customerservice.routes');
const platformRoutes = require('./platform.routes');
const bulkRoutes = require('./bulk.routes');
const remainingRoutes = require('./remaining.routes');
const opsRoutes = require('./ops.routes');
const fillgapsRoutes = require('./fillgaps.routes');
const fillgaps2Routes = require('./fillgaps2.routes');
const fillgaps3Routes = require('./fillgaps3.routes');
const crudRoutes = require('./crud.routes');
const rbacRoutes = require('./rbac.routes');
const i18nRoutes = require('./i18n.routes');
const gapsRoutes = require('./backendGaps.routes');
const { MaintenanceFlag } = require('../models/Platform6');

// Maintenance-mode gate: 503 for non-admins when tenant flag enabled
async function maintenanceGate(req, res, next) {
  try {
    if (req.path === '/health') return next();
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return next();
    const jwt = require('jsonwebtoken');
    const cfg = require('../config/config');
    let decoded; try { decoded = jwt.verify(auth.slice(7), cfg.jwt.secret); } catch (_) { return next(); }
    if (decoded.type !== 'user' || !decoded.id) return next();
    const User = require('../models/User');
    const u = await User.findById(decoded.id).select('role tenantId company').lean().catch(() => null);
    if (!u) return next();
    const tid = u.tenantId || u.companyId;
    if (!tid) return next();
    const mongoose = require('mongoose');
    const flag = await mongoose.connection.db.collection('maintenanceflags').findOne({ tenantId: new mongoose.Types.ObjectId(tid) });
    if (flag?.enabled && !['admin', 'superadmin'].includes(u.role)) {
      return res.status(503).json({ error: 'Scheduled maintenance in progress', message: flag.message });
    }
    next();
  } catch (_) { next(); }
}
const maintenanceGateMw = maintenanceGate;

const router = express.Router();

router.use(maintenanceGateMw);

router.get('/health', (req, res) =>
  res.json({ success: true, status: 'ok', time: new Date().toISOString() })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tickets', ticketRoutes);
router.use('/kb', kbRoutes);
router.use('/agent', agentRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/enterprise', enterpriseRoutes);
router.use('/public', publicRoutes);
router.use('/crm', crmRoutes);
router.use('/itom', itomRoutes);
router.use('/projects', projectsRoutes);
router.use('/hr', hrRoutes);
router.use('/field-service', fieldserviceRoutes);
router.use('/products', productRoutes);
router.use('/licenses', licenseRoutes);
router.use('/stockroom', stockroomRoutes);
router.use('/cs', customerServiceRoutes);
router.use('/platform', platformRoutes);
router.use('/bulk', bulkRoutes);
router.use('/extra', remainingRoutes);
router.use('/ops', opsRoutes);
router.use('/gaps', fillgapsRoutes);
router.use('/gaps2', fillgaps2Routes);
router.use('/gaps3', fillgaps3Routes);
router.use('/crud', crudRoutes);
router.use('/rbac', rbacRoutes);
router.use('/i18n', i18nRoutes);
router.use('/gaps4', gapsRoutes);

module.exports = router;
