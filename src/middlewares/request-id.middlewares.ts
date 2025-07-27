import { randomUUID } from 'crypto';
import { Middleware } from 'express-zod-api';

/**
 * Request ID middleware that generates a unique request ID for tracing
 * requests through the entire processing flow
 */
const requestIdMiddleware = new Middleware({
  handler: async ({ request, logger }) => {
    const requestId = randomUUID();
    const startTime = Date.now();
    
    // Add request metadata to logger context
    logger.info('Request started', {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      contentLength: request.headers['content-length'],
      startTime,
    });

    return {
      requestId,
      startTime,
    };
  },
});

export default requestIdMiddleware;