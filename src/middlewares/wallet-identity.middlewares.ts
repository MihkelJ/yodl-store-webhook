import { Middleware } from 'express-zod-api';
import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { getSelfVerificationService } from '../services/self/self-verification.service.js';
import { config } from '../config/index.js';

const verificationService = getSelfVerificationService();

/**
 * Wallet identity verification middleware for transaction processing
 *
 * @description
 * This middleware validates that the wallet address sending the transaction
 * has completed identity verification when required by the specific beer tap.
 * It extracts the wallet address from the transaction, finds the matching
 * beer tap config based on the transaction memo, and checks cached
 * verification results.
 *
 * @throws {Error} "Identity verification required" - If verification is required but missing
 * @throws {Error} "Identity verification expired" - If verification has expired
 * @throws {Error} "Identity verification failed" - If verification is invalid
 * @throws {Error} "No matching beer tap found" - If no tap matches the transaction memo
 *
 * @returns {Promise<{ walletVerificationResult?: any }>} Verification result if successful
 */
const walletIdentityVerificationMiddleware = new Middleware({
  input: z.object({
    transaction: z.object({
      senderAddress: z.string(),
      txHash: z.string(),
      memo: z.string(),
    }),
  }),
  handler: async ({ input, logger }) => {
    const { transaction } = input;
    const walletAddress = transaction.senderAddress;
    const transactionMemo = transaction.memo;

    // Find the matching beer tap configuration based on transaction memo
    const matchingTap = config.beerTaps.find(tap => 
      transactionMemo.includes(tap.transactionMemo)
    );

    if (!matchingTap) {
      logger.warn('No matching beer tap found for transaction memo', {
        transactionMemo,
        walletAddress,
        txHash: transaction.txHash,
      });

      throw createHttpError(
        StatusCodes.BAD_REQUEST,
        'No matching beer tap found for transaction memo'
      );
    }

    const tapId = matchingTap.id || 'default';
    const identityVerification = matchingTap.identityVerification;

    // Check if identity verification is required for this tap
    const isVerificationRequired = identityVerification?.enabled || false;

    if (!isVerificationRequired) {
      logger.info('Identity verification not required for tap', {
        tapId,
        walletAddress,
        txHash: transaction.txHash,
        transactionMemo,
      });
      return {};
    }

    logger.info('Checking wallet identity verification', {
      tapId,
      walletAddress,
      txHash: transaction.txHash,
      transactionMemo,
    });

    try {
      // Check verification status for this wallet and tap
      const verificationStatus = await verificationService.getVerificationStatus(walletAddress, tapId);

      if (!verificationStatus.isVerified) {
        logger.warn('Wallet identity verification required but not found or invalid', {
          walletAddress,
          tapId,
          txHash: transaction.txHash,
          transactionMemo,
          error: verificationStatus.error,
        });

        throw createHttpError(
          StatusCodes.UNAUTHORIZED,
          verificationStatus.error || 'Identity verification required for this wallet address'
        );
      }

      // Verification is valid
      logger.info('Wallet identity verification passed', {
        walletAddress,
        tapId,
        txHash: transaction.txHash,
        transactionMemo,
        verifiedAt: verificationStatus.result?.verifiedAt,
        expiresAt: verificationStatus.result?.expiresAt,
        nationality: verificationStatus.result?.nationality,
      });

      return {
        walletVerificationResult: verificationStatus.result,
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }

      logger.error('Wallet identity verification check failed', {
        walletAddress,
        tapId,
        txHash: transaction.txHash,
        transactionMemo,
        error,
      });

      throw createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Wallet identity verification check failed');
    }
  },
  security: {
    and: [{ type: 'header', name: 'x-yodl-signature' }],
  },
});

export default walletIdentityVerificationMiddleware;
