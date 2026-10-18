import { Router } from 'express';
import { requireTenantPermission } from '../../api/middleware';
import { dashboardController } from '../../controllers/itsm/dashboard.controller';

export const dashboardItsmRouter = Router();

dashboardItsmRouter.get('/overview', requireTenantPermission('dashboard.read'), dashboardController.overview);
dashboardItsmRouter.get('/incidents', requireTenantPermission('dashboard.read'), dashboardController.incidentSummary);
dashboardItsmRouter.get('/workload', requireTenantPermission('dashboard.read'), dashboardController.workload);
dashboardItsmRouter.get('/trends', requireTenantPermission('dashboard.read'), dashboardController.trends);
dashboardItsmRouter.get('/activity', requireTenantPermission('dashboard.read'), dashboardController.activity);
