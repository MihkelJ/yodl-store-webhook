import { Middleware } from 'express-zod-api';
import createHttpError from 'http-errors';
import { txInputSchema } from '../schemas/tx.schemas.js';
import { fetchTransaction } from '../services/transaction.service.js';

// Amount in BRL - how many cups of beer\
const BEER_MAPPING = {
  20: {
    value: '1',
  },
  40: {
    value: '2',
  },
  60: {
    value: '3',
  },
} as const;

const INVOICE_CURRENCY = 'BRL';
const RECEIVER_ENS_PRIMARY_NAME = process.env.RECEIVER_ENS_PRIMARY_NAME;

if (!RECEIVER_ENS_PRIMARY_NAME) {
  throw new Error('RECEIVER_ENS_PRIMARY_NAME is not set');
}

const txValidationMiddleware = new Middleware({
  handler: async ({ input }) => {
    const txHash = input.txHash;

    if (!txHash || typeof txHash !== 'string') {
      console.error('Transaction hash is not set');
      throw createHttpError(400, 'Transaction hash is not set');
    }

    const { memo, invoiceCurrency, invoiceAmount, receiverEnsPrimaryName } =
      await fetchTransaction(txHash);

    const invoiceAmountNumber = Number(invoiceAmount);

    if (!memo) {
      console.error('Transaction has no memo', input.txHash);
      throw createHttpError(400, 'Transaction has no memo');
    }
    if (invoiceCurrency !== INVOICE_CURRENCY) {
      console.error('Invalid invoice currency', input.txHash, invoiceCurrency);
      throw createHttpError(
        400,
        `Invalid invoice currency: ${invoiceCurrency}`
      );
    }

    if (receiverEnsPrimaryName !== RECEIVER_ENS_PRIMARY_NAME) {
      console.error(
        'Invalid receiver ENS primary name',
        input.txHash,
        receiverEnsPrimaryName
      );
      throw createHttpError(
        400,
        `Invalid receiver ENS primary name: ${receiverEnsPrimaryName}`
      );
    }

    const validBeerAmounts = Object.entries(BEER_MAPPING)
      .filter(([amount]) => Number(amount) <= invoiceAmountNumber)
      .sort(([a], [b]) => Number(b) - Number(a));

    if (validBeerAmounts.length === 0) {
      console.error('Invalid invoice amount', input.txHash, invoiceAmountNumber);
      throw createHttpError(400, 'Invalid invoice amount');
    }

    const [beerAmount, beerValue] = validBeerAmounts[0];



    return {
      beerAmount,
      beerValue,
    };
  },
  input: txInputSchema,
  security: {
    and: [{ type: 'header', name: 'txHash' }],
  },
});

export default txValidationMiddleware;
