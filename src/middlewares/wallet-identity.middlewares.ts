import { Middleware } from 'express-zod-api';
import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config/index.js';
import { getSelfVerificationService } from '../services/self/self-verification.service.js';
import type { Payment } from '../types/transaction.js';

const verificationService = getSelfVerificationService();

/**
 * Verifies wallet identity when required by beer tap configuration
 */
const walletIdentityVerificationMiddleware = new Middleware({
  handler: async ({ options, logger }) => {
    const { transaction } = options as { transaction: Payment };

    const walletAddress = transaction.senderAddress;
    const transactionMemo = transaction.memo;

    // Find the matching beer tap configuration based on transaction memo
    const matchingTap = config.beerTaps.find(tap => transactionMemo.includes(tap.transactionMemo));

    if (!matchingTap) {
      logger.warn('No matching beer tap found for transaction memo', {
        transactionMemo,
        walletAddress,
        txHash: transaction.txHash,
      });

      throw createHttpError(StatusCodes.BAD_REQUEST, 'No matching beer tap found for transaction memo');
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
