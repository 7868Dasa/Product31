/**
 * Process entry point. Starts the HTTP server after verifying the DB is
 * reachable. Background sweep jobs (spec §3/§4) are wired in at build step 4.
 */
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { pingDb, closeDb } from './db.js';

const app = createApp();

async function start() {
  try {
    await pingDb();
    logger.info('database connection ok');
  } catch (err) {
    logger.error({ err }, 'cannot reach the database — check DATABASE_URL in backend/.env');
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    logger.info(`product31-api listening on http://localhost:${config.PORT}`);
  });

  const shutdown = async (sig) => {
    logger.info({ sig }, 'shutting down');
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
