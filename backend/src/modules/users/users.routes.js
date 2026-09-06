import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { updateMeSchema } from './users.schemas.js';
import * as ctrl from './users.controller.js';

export const usersRouter = Router();

usersRouter.patch(
  '/me',
  requireAuth,
  validate({ body: updateMeSchema }),
  asyncHandler(ctrl.updateMe),
);
