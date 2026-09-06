import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import * as ctrl from './auth.controller.js';
import {
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  logoutSchema,
} from './auth.schemas.js';

export const authRouter = Router();

authRouter.post(
  '/otp/request',
  authLimiter,
  validate({ body: otpRequestSchema }),
  asyncHandler(ctrl.requestOtp),
);

authRouter.post(
  '/otp/verify',
  authLimiter,
  validate({ body: otpVerifySchema }),
  asyncHandler(ctrl.verifyOtp),
);

authRouter.post('/refresh', validate({ body: refreshSchema }), asyncHandler(ctrl.refresh));

authRouter.post('/logout', validate({ body: logoutSchema }), asyncHandler(ctrl.logout));

authRouter.get('/me', requireAuth, asyncHandler(ctrl.me));
