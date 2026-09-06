/**
 * Auth middleware. `requireAuth` populates req.user from a Bearer access token.
 */
import { verifyAccessToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';
import { db } from '../db.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    const payload = verifyAccessToken(token);
    const user = await db('users').where({ id: payload.sub }).first();
    if (!user) throw unauthorized('USER_GONE', 'Account no longer exists');
    if (user.status !== 'active') throw unauthorized('ACCOUNT_SUSPENDED', 'Account is not active');

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}
