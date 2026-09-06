import * as service from './account.service.js';

const ctxOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') || '' });

export async function consent(req, res) {
  const user = await service.recordConsent(req.user, req.body, ctxOf(req));
  res.status(200).json({ user });
}

export async function exportData(req, res) {
  const data = await service.exportData(req.user, ctxOf(req));
  res
    .status(200)
    .set('Content-Disposition', `attachment; filename="product31-my-data-${req.user.id}.json"`)
    .json(data);
}

export async function deleteAccount(req, res) {
  await service.deleteAccount(req.user, ctxOf(req));
  res.status(204).end();
}
