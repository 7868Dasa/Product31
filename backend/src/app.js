/**
 * Express app assembly. Kept separate from server.js so tests can import the
 * app without binding a port.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render / any reverse proxy — correct req.ip
  app.disable('x-powered-by');

  app.use(helmet()); // spec §8: security headers
  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / curl (no Origin header) and the allowlist only
        if (!origin || config.CORS_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' })); // spec §8: explicit body size limit
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(pinoHttp({ logger, quietReqLogger: true }));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'product31-api' }));

  app.use('/api/v1', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
