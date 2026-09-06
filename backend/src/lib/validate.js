/**
 * Request validation middleware. Every route validates its input against an
 * explicit zod schema at the boundary (spec §8). Replaces req[part] with the
 * parsed (and coerced) value.
 */
import { badRequest } from './errors.js';

/**
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        return next(
          badRequest('VALIDATION_ERROR', `Invalid request ${part}`, {
            issues: result.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          }),
        );
      }
      req[part] = result.data;
    }
    return next();
  };
}
