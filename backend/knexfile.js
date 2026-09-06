/**
 * Knex config. One Postgres engine for every environment (see
 * docs/ARCHITECTURE.md). Reads DATABASE_URL / DATABASE_SSL from the env,
 * which `npm run migrate` / `npm run seed` load via `node --env-file=.env`.
 */
const connectionString = process.env.DATABASE_URL;
const ssl =
  process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false };

/** @type {import('knex').Knex.Config} */
const base = {
  client: 'pg',
  connection: connectionString ? { connectionString, ssl } : undefined,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: './src/migrations',
    extension: 'js',
    loadExtensions: ['.js'],
  },
  seeds: {
    directory: './src/seeds',
  },
};

export default {
  development: base,
  test: base,
  production: base,
};
