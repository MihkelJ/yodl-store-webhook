import { defaultEndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import authMiddleware from '../middlewares/auth.middlewares.js';
import txValidationMiddleware from '../middlewares/validation.middlewares.js';
import { statusResponseSchema } from '../schemas/common.schemas.js';
import { txInputSchema } from '../schemas/tx.schemas.js';
import { QueueManagerService } from '../services/queue-manager.service.js';

export const txWebhook = defaultEndpointsFactory
  .addMiddleware(authMiddleware)
  .addMiddleware(txValidationMiddleware)
  .build({
    method: 'post',
    handler: async ({ options: { validMethod, transaction }, input: { txHash }, logger }) => {
      try {
        // Get the queue manager instance
        const queueManager = QueueManagerService.getInstance();

        // Ensure queue manager is initialized
        if (!queueManager.isReady()) {
          logger.error('Queue manager not ready');
          throw createHttpError(StatusCodes.SERVICE_UNAVAILABLE, 'Queue service not available');
        }

        // Process the transaction through the queue system using data from middleware
        const result = await queueManager.processWebhookTransaction(
          txHash,
          transaction.receiverEnsPrimaryName,
          transaction.memo,
          transaction.invoiceCurrency,
          transaction.invoiceAmount
        );

        if (!result.success) {
          logger.error('Failed to queue transaction', {
            txHash,
            error: result.message,
            transaction: {
              receiverEns: transaction.receiverEnsPrimaryName,
              memo: transaction.memo,
              currency: transaction.invoiceCurrency,
              amount: transaction.invoiceAmount,
            },
          });

          throw createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, result.message);
        }

        logger.info('Transaction successfully queued', {
          txHash,
          itemId: result.itemId,
          receiverEns: transaction.receiverEnsPrimaryName,
          memo: transaction.memo,
          currency: transaction.invoiceCurrency,
          amount: transaction.invoiceAmount,
        });

        return {
          status: 'Transaction queued for processing',
        };
      } catch (error) {
        logger.error('Webhook processing failed', { error, txHash });

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
