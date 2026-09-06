/**
 * Wrap an async route handler so rejected promises reach Express's error
 * middleware (Express 4 does not do this automatically).
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
