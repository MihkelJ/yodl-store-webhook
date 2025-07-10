import { Middleware } from 'express-zod-api';
import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { isHex, verifyMessage } from 'viem';
import { config } from '../config/index.js';

/**
 * Authentication middleware that verifies requests are signed by Yodl
 *
 * @description
 * This middleware validates that incoming requests are authentic by verifying
 * a signature provided in the x-yodl-signature header against the request body.
 * The signature must be created by the Yodl address specified in YODL_ADDRESS env variable.
 *
 * @throws {Error} "Invalid signature" - If the signature header is missing, malformed, or invalid
 * @throws {Error} "Signature verification failed" - If the signature verification process fails
 *
 * @returns {Promise<{}>} Empty object if verification succeeds
 */
const authMiddleware = new Middleware({
  handler: async ({ request, logger }) => {
    // Skip authentication in development mode if disabled
    if (config.dev.disableAuth) {
      logger.info('Authentication disabled for development');
      return {};
    }

    const signature = request.headers['x-yodl-signature'];

    if (!isHex(signature)) {
      logger.error('Invalid signature', { signature });
      throw createHttpError(StatusCodes.BAD_REQUEST);
    }

    const message = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

    try {
      logger.info('Verifying signature', { signature });
      const isValid = await verifyMessage({
        message,
        signature,
        address: config.yodl.address,
      });

      if (!isValid) {
        logger.error('Signature verification failed', { signature });
        throw createHttpError(StatusCodes.BAD_REQUEST);
      }

      return {};
    } catch (error) {
      logger.error('Signature verification failed', { error });
      throw createHttpError(StatusCodes.BAD_REQUEST);
    }
  },
  security: {
    and: [{ type: 'header', name: 'x-yodl-signature' }],
  },
});

export default authMiddleware;
