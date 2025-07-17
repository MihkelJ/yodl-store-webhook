import { defaultEndpointsFactory, ResultHandler, EndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import {
  configRequestSchema,
  configResponseSchema,
  statusRequestSchema,
  statusResponseSchema,
  verificationInputSchema,
  selfVerificationResponseSchema,
} from '../schemas/identity.schemas.js';
import { getSelfVerificationService } from '../services/self/self-verification.service.js';

const verificationService = getSelfVerificationService();

/**
 * Error schema for Self.xyz responses
 */
const selfErrorSchema = z.object({
  status: z.literal('error'),
  error: z.string(),
});

/**
 * Custom result handler for Self.xyz compatible responses
 */
const selfResultHandler = new ResultHandler({
  positive: () => ({
    statusCode: 200,
    schema: selfVerificationResponseSchema,
  }),
  negative: [
    {
      statusCode: [400, 500],
      schema: selfErrorSchema,
    },
  ],
  handler: ({ error, response, output }) => {
    if (error) {
      const statusCode = 'statusCode' in error ? (error as { statusCode: number }).statusCode : 500;
      response.status(statusCode).json({
        status: 'error',
        error: error.message,
      });
      return;
    }

    if (!output) {
      response.status(500).json({
        status: 'error',
        error: 'No output received',
      });
      return;
    }

    response.status(200).json(output as { status: 'success'; result: boolean });
  },
});

/**
 * Custom endpoints factory for Self.xyz verification
 */
const selfEndpointsFactory = new EndpointsFactory(selfResultHandler);

/**
 * POST /v1/identity/verify
 * Verifies a Self.xyz proof and caches the result
 */
export const verifyIdentity = selfEndpointsFactory.build({
  method: 'post',
  input: verificationInputSchema,
  output: selfVerificationResponseSchema,
  handler: async ({ input, logger }) => {
    try {
      const { attestationId, proof, publicSignals, userContextData } = input;

      const result = await verificationService.verifyProof(attestationId, proof, publicSignals, userContextData);

      if (!result.isVerified) {
        logger.warn('Identity verification failed', { error: result.error });
      } else {
        logger.info('Identity verification successful', {
          userIdentifier: result.result?.userIdentifier,
          attestationId: result.result?.attestationId,
        });
      }

      return {
        status: 'success' as const,
        result: result.isVerified,
      };
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
      const { walletAddress, tapId } = input;

      logger.info('Checking identity verification status', { walletAddress, tapId });

      const status = await verificationService.getVerificationStatus(walletAddress, tapId);

      logger.info('Identity verification status checked', {
        walletAddress,
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
