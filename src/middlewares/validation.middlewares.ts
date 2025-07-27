import { Middleware } from 'express-zod-api';
import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config/index.js';
import { txInputSchema } from '../schemas/tx.schemas.js';
import { fetchTransaction } from '../services/transaction.service.js';

/**
 * Middleware for validating transaction inputs and determining beer amounts.
 *
 * This middleware:
 * 1. Validates the provided transaction hash
 * 2. Fetches transaction details
 * 3. Verifies the transaction memo contains the required identifier
 * 4. Checks that currency and receiver information match configuration
 * 5. Determines the appropriate beer amount based on the invoice amount
 *
 * @returns {Object} - Contains beerAmount (invoice amount) and beerValue (quantity of beer)
 * @throws {HttpError} - 400 if memo is missing
 * @throws {HttpError} - 404 if memo doesn't contain identifier or currency doesn't match
 * @throws {HttpError} - 404 if receiver ENS name doesn't match configuration
 * @throws {HttpError} - 402 if invoice amount doesn't match any valid beer amount
 */
const txValidationMiddleware = new Middleware({
  handler: async ({ input: { txHash }, options, logger }) => {
    const middlewareStartTime = Date.now();
    const { requestId, startTime } = options || {};
    const requestStartTime = typeof startTime === 'number' ? startTime : middlewareStartTime;
    
    logger.info('Starting transaction validation middleware', {
      requestId,
      txHash,
      middlewareStartTime: middlewareStartTime - requestStartTime,
    });

    const transaction = await fetchTransaction(txHash, logger);

    const { memo, invoiceCurrency, invoiceAmount, receiverEnsPrimaryName } = transaction;

    logger.info('Transaction fetched successfully', {
      requestId,
      txHash,
      senderAddress: transaction.senderAddress,
      receiverAddress: transaction.receiverAddress,
      receiverEnsPrimaryName,
      invoiceAmount,
      invoiceCurrency,
      memo,
      availableTaps: config.beerTaps.map(tap => ({
        id: tap.id || 'unnamed',
        transactionMemo: tap.transactionMemo,
        transactionReceiverEns: tap.transactionReceiverEns,
        transactionCurrency: tap.transactionCurrency,
        transactionAmount: tap.transactionAmount,
      })),
    });

    const validMethod = config.beerTaps.find(tap => memo.includes(tap.transactionMemo));

    if (!validMethod) {
      logger.error('No matching beer tap method found', {
        requestId,
        txHash,
        memo,
        availableMemos: config.beerTaps.map(tap => tap.transactionMemo),
      });
      throw createHttpError(StatusCodes.BAD_REQUEST);
    }

    logger.info('Found matching beer tap method', {
      requestId,
      txHash,
      tapId: validMethod.id || 'unnamed',
      transactionMemo: validMethod.transactionMemo,
    });

    if (invoiceCurrency !== validMethod.transactionCurrency) {
      logger.error('Invoice currency mismatch', {
        requestId,
        txHash,
        invoiceCurrency,
        expectedCurrency: validMethod.transactionCurrency,
        tapId: validMethod.id || 'unnamed',
      });
      throw createHttpError(StatusCodes.FORBIDDEN);
    }

    if (receiverEnsPrimaryName !== validMethod.transactionReceiverEns) {
      logger.error('Receiver ENS name mismatch', {
        requestId,
        txHash,
        receiverEnsPrimaryName,
        expectedReceiverEns: validMethod.transactionReceiverEns,
        tapId: validMethod.id || 'unnamed',
      });
      throw createHttpError(StatusCodes.NOT_FOUND);
    }

    if (Number(invoiceAmount) < Number(validMethod.transactionAmount)) {
      logger.error('Invoice amount below required minimum', {
        requestId,
        txHash,
        invoiceAmount,
        requiredAmount: validMethod.transactionAmount,
        shortfall: Number(validMethod.transactionAmount) - Number(invoiceAmount),
        tapId: validMethod.id || 'unnamed',
      });
      throw createHttpError(StatusCodes.PAYMENT_REQUIRED);
    }

    const validationDuration = Date.now() - middlewareStartTime;
    
    logger.info('Transaction validation completed successfully', {
      requestId,
      txHash,
      tapId: validMethod.id || 'unnamed',
      validationDuration,
    });

    return {
      validMethod,
      transaction,
    };
  },
  input: txInputSchema,
  security: {
    and: [{ type: 'header', name: 'txHash' }],
  },
});

export default txValidationMiddleware;
