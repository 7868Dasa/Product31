/**
 * Shared Knex instance. Import `db` anywhere that needs the database.
 */
import knexFactory from 'knex';
import knexConfig from '../knexfile.js';
import { config } from './config.js';

export const db = knexFactory(knexConfig[config.NODE_ENV] ?? knexConfig.development);

export async function pingDb() {
  await db.raw('select 1');
}

export async function closeDb() {
  await db.destroy();
}
