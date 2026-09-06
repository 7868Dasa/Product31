import { db } from '../../db.js';
import { publicUser } from '../auth/auth.service.js';

export async function updateMe(req, res) {
  const patch = { ...req.body };
  if (patch.email === '') patch.email = null;

  const [row] = await db('users').where({ id: req.user.id }).update(patch).returning('*');
  res.status(200).json({ user: publicUser(row) });
}
