import { defaultEndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import {
  configRequestSchema,
  configResponseSchema,
  statusRequestSchema,
  statusResponseSchema,
  verificationInputSchema,
  verificationResultSchema,
} from '../schemas/identity.schemas.js';
import { getSelfVerificationService } from '../services/self/self-verification.service.js';

const verificationService = getSelfVerificationService();

/**
 * POST /v1/identity/verify
 * Verifies a Self.xyz proof and caches the result
 */
export const verifyIdentity = defaultEndpointsFactory.build({
  method: 'post',
  input: verificationInputSchema,
  output: verificationResultSchema,
  handler: async ({ input, logger }) => {
    try {
      const { attestationId, proof, publicSignals, userContextData } = input;

      logger.info(JSON.stringify(input));

      const result = await verificationService.verifyProof(attestationId, proof, publicSignals, userContextData);

      if (!result.isVerified) {
        logger.warn('Identity verification failed', { error: result.error });
      } else {
        logger.info('Identity verification successful', {
          userIdentifier: result.result?.userIdentifier,
          attestationId: result.result?.attestationId,
        });
      }

      return result;
    } catch (error) {
      logger.error('Identity verification error', { error });
      throw createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR);
    }
  },
  description: 'Verifies a Self.xyz identity proof for beer tap access',
});

/**
 * POST /v1/identity/config
 * Generates frontend configuration for QR code creation
 */
export const generateConfig = defaultEndpointsFactory.build({
  method: 'post',
  input: configRequestSchema,
  output: configResponseSchema,
  handler: async ({ input, logger }) => {
    try {
      const { tapId, walletAddress } = input;

      if (!verificationService.isVerificationRequired(tapId)) {
        throw createHttpError(StatusCodes.BAD_REQUEST, `Identity verification not required for tap: ${tapId}`);
      }

      const config = await verificationService.getFrontendConfig(tapId, walletAddress);

      return config;
    } catch (error) {
      logger.error('Error generating identity verification config', { error });

      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }

      throw createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR);
    }
  },
  description: 'Generates configuration for Self.xyz QR code creation',
});

/**
 * GET /v1/identity/status/:userId/:tapId
 * Checks verification status for a user and tap
 */
export const checkStatus = defaultEndpointsFactory.build({
  method: 'get',
  input: statusRequestSchema,
  output: statusResponseSchema,
  handler: async ({ input, logger }) => {
    try {
      const { userId, tapId } = input;

      logger.info('Checking identity verification status', { userId, tapId });

      const status = await verificationService.getVerificationStatus(userId, tapId);

      logger.info('Identity verification status checked', {
        userId,
        tapId,
        isVerified: status.isVerified,
      });

      return status;
    } catch (error) {
      logger.error('Error checking identity verification status', { error });
      throw createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR);
    }
  },
  description: 'Checks the verification status for a user and beer tap',
});
