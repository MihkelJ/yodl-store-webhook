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
  handler: async ({ input: { txHash }, logger }) => {
    const transaction = await fetchTransaction(txHash);

    const { memo, invoiceCurrency, invoiceAmount, receiverEnsPrimaryName } = transaction;

    const validMethod = config.beerTaps.find(tap => memo.includes(tap.transactionMemo));

    if (!validMethod) {
      logger.error('Method not found', { memo, txHash });
      throw createHttpError(StatusCodes.BAD_REQUEST);
    }

    if (invoiceCurrency !== validMethod.transactionCurrency) {
      logger.error('Invalid invoice currency', {
        invoiceCurrency,
        txHash,
      });
      throw createHttpError(StatusCodes.FORBIDDEN);
    }

    if (receiverEnsPrimaryName !== validMethod.transactionReceiverEns) {
      logger.error('Invalid receiver ENS name', {
        receiverEnsPrimaryName,
        txHash,
      });
      throw createHttpError(StatusCodes.NOT_FOUND);
    }

    if (Number(invoiceAmount) < Number(validMethod.transactionAmount)) {
      logger.error('Invalid invoice amount', {
        invoiceAmount,
        requiredAmount: validMethod.transactionAmount,
        txHash,
      });
      throw createHttpError(StatusCodes.PAYMENT_REQUIRED);
    }

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
