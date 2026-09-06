/**
 * Typed application errors. Anything thrown that isn't an AppError is treated
 * as a 500 by the global handler and its detail is NOT sent to the client.
 */
export class AppError extends Error {
  /**
   * @param {number} status  HTTP status
   * @param {string} code    stable machine code, e.g. 'OTP_EXPIRED'
   * @param {string} message client-safe message
   * @param {object} [details] optional client-safe extra data
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (code, msg, details) => new AppError(400, code, msg, details);
export const unauthorized = (code = 'UNAUTHORIZED', msg = 'Authentication required') =>
  new AppError(401, code, msg);
export const forbidden = (code = 'FORBIDDEN', msg = 'Not allowed') => new AppError(403, code, msg);
export const notFound = (code = 'NOT_FOUND', msg = 'Not found') => new AppError(404, code, msg);
export const conflict = (code, msg, details) => new AppError(409, code, msg, details);
export const tooManyRequests = (code = 'RATE_LIMITED', msg = 'Too many requests', details) =>
  new AppError(429, code, msg, details);
