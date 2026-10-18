import { Router } from 'express';
import { registerItsmCrudRoutes } from './crud.routes';
import { problemCategoryController, rootCauseCategoryController } from '../../controllers/itsm/problemconfig.controller';
import {
  createProblemCategorySchema,
  createRootCauseCategorySchema,
  problemCategoryIdParamSchema,
  rootCauseCategoryIdParamSchema,
  updateProblemCategorySchema,
  updateRootCauseCategorySchema,
} from '../../validators/itsm/problemconfig.validators';

export const problemConfigItsmRouter = Router();

registerItsmCrudRoutes(problemConfigItsmRouter, problemCategoryController, {
  idParam: 'problemCategoryId',
  basePath: '/categories',
  read: 'problem_configuration.read',
  manage: 'problem_configuration.manage',
  idSchema: problemCategoryIdParamSchema,
  createSchema: createProblemCategorySchema,
  updateSchema: updateProblemCategorySchema,
});

registerItsmCrudRoutes(problemConfigItsmRouter, rootCauseCategoryController, {
  idParam: 'rootCauseCategoryId',
  basePath: '/root-causes',
  read: 'problem_configuration.read',
  manage: 'problem_configuration.manage',
  idSchema: rootCauseCategoryIdParamSchema,
  createSchema: createRootCauseCategorySchema,
  updateSchema: updateRootCauseCategorySchema,
});
