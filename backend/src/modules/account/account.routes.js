import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as ctrl from './account.controller.js';
import { consentSchema, deleteAccountSchema } from './account.schemas.js';

// mounted at /api/v1/users/me
export const accountRouter = Router();

accountRouter.post(
  '/consent',
  requireAuth,
  validate({ body: consentSchema }),
  asyncHandler(ctrl.consent),
);

accountRouter.get('/export', requireAuth, asyncHandler(ctrl.exportData));

accountRouter.delete(
  '/',
  requireAuth,
  validate({ body: deleteAccountSchema }),
  asyncHandler(ctrl.deleteAccount),
);
