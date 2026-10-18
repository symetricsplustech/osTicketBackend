import { Router } from 'express';
import { problemController } from '../../controllers/itsm/problems.controller';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import {
  assignProblemSchema,
  createProblemCommentSchema,
  createProblemSchema,
  problemIdParamSchema,
  resolveProblemSchema,
  updateProblemSchema,
} from '../../validators/itsm/problems.validators';

export const problemsItsmRouter = Router();

problemsItsmRouter.get('/', requireTenantPermission('problems.read'), problemController.list);
problemsItsmRouter.post(
  '/',
  requireTenantPermission('problems.create'),
  validateRequest({ body: createProblemSchema }),
  problemController.create,
);
problemsItsmRouter.get(
  '/:problemId',
  requireTenantPermission('problems.read'),
  validateRequest({ params: problemIdParamSchema }),
  problemController.get,
);
problemsItsmRouter.patch(
  '/:problemId',
  requireTenantPermission('problems.update'),
  validateRequest({ params: problemIdParamSchema, body: updateProblemSchema }),
  problemController.update,
);
problemsItsmRouter.delete(
  '/:problemId',
  requireTenantPermission('problems.update'),
  validateRequest({ params: problemIdParamSchema }),
  problemController.remove,
);
problemsItsmRouter.post(
  '/:problemId/assign',
  requireTenantPermission('problems.update'),
  validateRequest({ params: problemIdParamSchema, body: assignProblemSchema }),
  problemController.assign,
);
problemsItsmRouter.post(
  '/:problemId/resolve',
  requireTenantPermission('problems.resolve'),
  validateRequest({ params: problemIdParamSchema, body: resolveProblemSchema }),
  problemController.resolve,
);
problemsItsmRouter.get(
  '/:problemId/comments',
  requireTenantPermission('problems.read'),
  validateRequest({ params: problemIdParamSchema }),
  problemController.listComments,
);
problemsItsmRouter.post(
  '/:problemId/comments',
  requireTenantPermission('problems.update'),
  validateRequest({ params: problemIdParamSchema, body: createProblemCommentSchema }),
  problemController.addComment,
);
