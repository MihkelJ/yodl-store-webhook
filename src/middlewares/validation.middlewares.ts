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
 * @throws {HttpError} - 403 if memo doesn't contain identifier or currency doesn't match
 * @throws {HttpError} - 404 if receiver ENS name doesn't match configuration
 * @throws {HttpError} - 405 if invoice amount doesn't match any valid beer amount
 */
const txValidationMiddleware = new Middleware({
  handler: async ({ input }) => {
    const txHash = input.txHash;

    const { memo, invoiceCurrency, invoiceAmount, receiverEnsPrimaryName } =
      await fetchTransaction(txHash);

    const invoiceAmountNumber = Number(invoiceAmount);

    // TODO: Parse this with zod
    if (!memo) {
      throw createHttpError(StatusCodes.BAD_REQUEST);
    }

    if (!memo.includes(config.beerTap.identifier)) {
      throw createHttpError(StatusCodes.FORBIDDEN);
    }
    if (invoiceCurrency !== config.beerTap.invoiceCurrency) {
      throw createHttpError(StatusCodes.FORBIDDEN);
    }

    if (receiverEnsPrimaryName !== config.beerTap.receiverEnsPrimaryName) {
      throw createHttpError(StatusCodes.NOT_FOUND);
    }

    const validBeerAmounts = Object.entries(config.beerTap.beerMapping)
      .filter(([amount]) => Number(amount) <= invoiceAmountNumber)
      .sort(([a], [b]) => Number(b) - Number(a));

    if (validBeerAmounts.length === 0) {
      throw createHttpError(StatusCodes.METHOD_NOT_ALLOWED);
    }

    const [beerAmount, beerValue] = validBeerAmounts[0];

    return {
      beerAmount,
      beerValue, // 1 for one cup of beer, 2 for two cups of beer, etc.
    };
  },
  input: txInputSchema,
  security: {
    and: [{ type: 'header', name: 'txHash' }],
  },
});

export default txValidationMiddleware;
