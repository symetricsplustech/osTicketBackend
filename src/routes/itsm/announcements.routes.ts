import { Router } from 'express';
import { registerItsmCrudRoutes } from './crud.routes';
import { announcementController } from '../../controllers/itsm/announcements.controller';
import {
  announcementIdParamSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '../../validators/itsm/announcements.validators';

export const announcementsItsmRouter = Router();

registerItsmCrudRoutes(announcementsItsmRouter, announcementController, {
  idParam: 'announcementId',
  read: 'announcements.read',
  manage: 'announcements.manage',
  idSchema: announcementIdParamSchema,
  createSchema: createAnnouncementSchema,
  updateSchema: updateAnnouncementSchema,
  transitions: [
    { path: '/publish', action: 'published', status: 'PUBLISHED' },
    { path: '/archive', action: 'archived', status: 'ARCHIVED' },
    { path: '/expire', action: 'expired', status: 'EXPIRED' },
  ],
});
