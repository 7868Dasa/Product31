import * as service from './auth.service.js';
import { publicUser } from './auth.service.js';

const ctxOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') || '' });

export async function requestOtp(req, res) {
  const result = await service.requestOtp(req.body, ctxOf(req));
  res.status(201).json(result);
}

export async function verifyOtp(req, res) {
  const result = await service.verifyOtp(req.body, ctxOf(req));
  res.status(200).json(result);
}

export async function refresh(req, res) {
  const result = await service.rotateRefreshToken(req.body.refresh_token, ctxOf(req));
  res.status(200).json(result);
}

export async function logout(req, res) {
  await service.revokeRefreshToken(req.body.refresh_token, ctxOf(req));
  res.status(204).end();
}

export async function me(req, res) {
  res.status(200).json({ user: publicUser(req.user) });
}
