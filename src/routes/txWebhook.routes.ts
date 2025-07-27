import { defaultEndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import authMiddleware from '../middlewares/auth.middlewares.js';
import requestIdMiddleware from '../middlewares/request-id.middlewares.js';
import txValidationMiddleware from '../middlewares/validation.middlewares.js';
import walletIdentityVerificationMiddleware from '../middlewares/wallet-identity.middlewares.js';
import { statusResponseSchema } from '../schemas/common.schemas.js';
import { txInputSchema } from '../schemas/tx.schemas.js';
import { QueueManagerService } from '../services/queue/queue-manager.service.js';

export const txWebhook = defaultEndpointsFactory
  .addMiddleware(requestIdMiddleware)
  .addMiddleware(authMiddleware)
  .addMiddleware(txValidationMiddleware)
  .addMiddleware(walletIdentityVerificationMiddleware)
  .build({
    method: 'post',
    handler: async ({ options: { requestId, startTime, transaction, walletVerificationResult }, logger }) => {
      const handlerStartTime = Date.now();
      
      logger.info('Starting webhook transaction processing', {
        requestId,
        txHash: transaction.txHash,
        totalRequestTime: handlerStartTime - startTime,
        senderAddress: transaction.senderAddress,
        receiverAddress: transaction.receiverAddress,
        invoiceAmount: transaction.invoiceAmount,
        invoiceCurrency: transaction.invoiceCurrency,
        memo: transaction.memo,
      });

      try {
        // Log identity verification result if present
        if (walletVerificationResult) {
          logger.info('Transaction processed with verified wallet identity', {
            requestId,
            txHash: transaction.txHash,
            walletAddress: transaction.senderAddress,
            verifiedAt: walletVerificationResult.verifiedAt,
            nationality: walletVerificationResult.nationality,
          });
        }

        // Get the queue manager instance
        const queueManager = QueueManagerService.getInstance();

        // Ensure queue manager is initialized
        if (!queueManager.isReady()) {
          logger.error('Queue service not available', {
            requestId,
            txHash: transaction.txHash,
          });
          throw createHttpError(StatusCodes.SERVICE_UNAVAILABLE, 'Queue service not available');
        }

        // Process the transaction through the queue system using data from middleware
        const result = await queueManager.processWebhookTransaction(transaction, logger);

        if (!result.success) {
          logger.error('Queue manager processing failed', {
            requestId,
            txHash: transaction.txHash,
            error: result.message,
          });
          throw createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, result.message);
        }

        const totalDuration = Date.now() - startTime;
        const handlerDuration = Date.now() - handlerStartTime;

        logger.info('Webhook transaction processing completed successfully', {
          requestId,
          txHash: transaction.txHash,
          totalDuration,
          handlerDuration,
        });

        return {
          status: 'Transaction queued for processing',
        };
      } catch (error) {
        const errorDuration = Date.now() - startTime;
        
        logger.error('Webhook processing failed', {
          requestId,
          txHash: transaction.txHash,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          errorDuration,
        });

        // If it's already an HTTP error, re-throw it
        if (error instanceof Error && 'statusCode' in error) {
          throw error;
        }

        // Otherwise, wrap in a generic error
        throw createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
    },
    output: statusResponseSchema,
    input: txInputSchema,
    description: 'Queues a transaction for beer tap processing',
  });
