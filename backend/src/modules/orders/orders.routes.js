/**
 * Order routes. Placement and the shopkeeper queue are shop-scoped
 * (/shops/:slug/orders); a shopper's own history and single-order actions
 * live under /orders. All require a signed-in user (spec §11: browse freely,
 * but ordering needs an identity for the counter).
 */
import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { slugParamSchema } from '../shops/shops.schemas.js';
import * as ctrl from './orders.controller.js';
import {
  placeOrderSchema,
  orderIdParamSchema,
  shopOrdersQuerySchema,
  transitionSchema,
} from './orders.schemas.js';

export const ordersRouter = Router();

// ── shop-scoped ─────────────────────────────────────────────────────────────
ordersRouter.post(
  '/shops/:slug/orders',
  requireAuth,
  validate({ params: slugParamSchema, body: placeOrderSchema }),
  asyncHandler(ctrl.place),
);
ordersRouter.get(
  '/shops/:slug/orders',
  requireAuth,
  validate({ params: slugParamSchema, query: shopOrdersQuerySchema }),
  asyncHandler(ctrl.shopQueue),
);

// ── shopper's own ───────────────────────────────────────────────────────────
ordersRouter.get('/orders/mine', requireAuth, asyncHandler(ctrl.myOrders));
ordersRouter.get(
  '/orders/:id',
  requireAuth,
  validate({ params: orderIdParamSchema }),
  asyncHandler(ctrl.getOne),
);
ordersRouter.post(
  '/orders/:id/transitions',
  requireAuth,
  validate({ params: orderIdParamSchema, body: transitionSchema }),
  asyncHandler(ctrl.transition),
);
