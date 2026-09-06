import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as ctrl from './shops.controller.js';
import { nearbyQuerySchema, slugParamSchema, createShopSchema } from './shops.schemas.js';

export const shopsRouter = Router();

// ── shopkeeper: self-service onboarding (spec §5) ─────────────────────────
shopsRouter.post('/', requireAuth, validate({ body: createShopSchema }), asyncHandler(ctrl.createShop));
shopsRouter.get('/mine', requireAuth, asyncHandler(ctrl.listMine));

// ── public browsing (spec §11: look before registering) ──────────────────
shopsRouter.get('/', validate({ query: nearbyQuerySchema }), asyncHandler(ctrl.listNearby));
shopsRouter.get('/:slug', validate({ params: slugParamSchema }), asyncHandler(ctrl.getOne));
shopsRouter.get(
  '/:slug/inventory',
  validate({ params: slugParamSchema }),
  asyncHandler(ctrl.getInventory),
);

// ── QR + printable poster (spec §11) — public; the slug is the capability ─
shopsRouter.get('/:slug/qr.png', validate({ params: slugParamSchema }), asyncHandler(ctrl.qrPng));
shopsRouter.get(
  '/:slug/poster.pdf',
  validate({ params: slugParamSchema }),
  asyncHandler(ctrl.posterPdf),
);
