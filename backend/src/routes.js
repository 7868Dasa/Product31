/**
 * Mounts every module router under /api/v1.
 */
import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { accountRouter } from './modules/account/account.routes.js';
import { shopsRouter } from './modules/shops/shops.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users/me', accountRouter); // consent, export, delete
apiRouter.use('/users', usersRouter);
apiRouter.use('/shops', shopsRouter);

// Future build steps mount here: cart, orders, wishlist, shopkeeper
// onboarding + dashboard, voice, s/:slug deep link.
