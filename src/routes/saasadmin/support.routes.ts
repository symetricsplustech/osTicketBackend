import { Router } from 'express';
import * as supportController from '../../controllers/saasadmin/support.controller';
import { authorize, validateRequest } from '../../api/middleware';
import {
  assignTicketSchema,
  createQueueSchema,
  createTicketSchema,
  queueIdParamSchema,
  replyTicketSchema,
  resolveTicketSchema,
  ticketIdParamSchema,
  updateQueueSchema,
  updateTicketSchema,
} from '../../validators/saasadmin/support.validators';

export const supportAdminRouter = Router();

supportAdminRouter.get('/tickets', authorize('admin.support.read'), supportController.listTicketsHandler);
supportAdminRouter.post(
  '/tickets',
  authorize('admin.support.manage'),
  validateRequest({ body: createTicketSchema }),
  supportController.createTicketHandler,
);
supportAdminRouter.get(
  '/tickets/:ticketId',
  authorize('admin.support.read'),
  validateRequest({ params: ticketIdParamSchema }),
  supportController.getTicketHandler,
);
supportAdminRouter.patch(
  '/tickets/:ticketId',
  authorize('admin.support.manage'),
  validateRequest({ params: ticketIdParamSchema, body: updateTicketSchema }),
  supportController.updateTicketHandler,
);
supportAdminRouter.post(
  '/tickets/:ticketId/assign',
  authorize('admin.support.manage'),
  validateRequest({ params: ticketIdParamSchema, body: assignTicketSchema }),
  supportController.assignTicketHandler,
);
supportAdminRouter.post(
  '/tickets/:ticketId/reply',
  authorize('admin.support.manage'),
  validateRequest({ params: ticketIdParamSchema, body: replyTicketSchema }),
  supportController.replyToTicketHandler,
);
supportAdminRouter.post(
  '/tickets/:ticketId/resolve',
  authorize('admin.support.manage'),
  validateRequest({ params: ticketIdParamSchema, body: resolveTicketSchema }),
  supportController.resolveTicketHandler,
);
supportAdminRouter.post(
  '/tickets/:ticketId/reopen',
  authorize('admin.support.manage'),
  validateRequest({ params: ticketIdParamSchema }),
  supportController.reopenTicketHandler,
);
supportAdminRouter.get(
  '/tickets/:ticketId/history',
  authorize('admin.support.read'),
  validateRequest({ params: ticketIdParamSchema }),
  supportController.ticketHistoryHandler,
);

supportAdminRouter.get('/queues', authorize('admin.support.read'), supportController.listQueuesHandler);
supportAdminRouter.post(
  '/queues',
  authorize('admin.support.manage'),
  validateRequest({ body: createQueueSchema }),
  supportController.createQueueHandler,
);
supportAdminRouter.patch(
  '/queues/:queueId',
  authorize('admin.support.manage'),
  validateRequest({ params: queueIdParamSchema, body: updateQueueSchema }),
  supportController.updateQueueHandler,
);
