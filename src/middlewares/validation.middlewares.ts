import { Middleware } from 'express-zod-api';
import createHttpError from 'http-errors';
import { txInputSchema } from '../schemas/tx.schemas.js';
import { fetchTransaction } from '../services/transaction.service.js';

// Amount in BRL - how many cups of beer\
const BEER_MAPPING = {
  20: {
    value: '1',
    memo: 'beer_1',
  },
  40: {
    value: '2',
    memo: 'beer_2',
  },
  60: {
    value: '3',
    memo: 'beer_3',
  },
} as const;

const INVOICE_CURRENCY = 'BRL';
const RECEIVER_ENS_PRIMARY_NAME = 'founderhaus.ipecity.eth';

const txValidationMiddleware = new Middleware({
  handler: async ({ input }) => {
    const { memo, invoiceCurrency, invoiceAmount, receiverEnsPrimaryName } =
      await fetchTransaction(input.txHash);

    const invoiceAmountNumber = Number(invoiceAmount);

    if (!memo) {
      throw createHttpError(400, 'Transaction has no memo');
    }
    if (invoiceCurrency !== INVOICE_CURRENCY) {
      throw createHttpError(
        400,
        `Invalid invoice currency: ${invoiceCurrency}`
      );
    }

    if (receiverEnsPrimaryName !== RECEIVER_ENS_PRIMARY_NAME) {
      throw createHttpError(
        400,
        `Invalid receiver ENS primary name: ${receiverEnsPrimaryName}`
      );
    }

    const validBeerAmounts = Object.entries(BEER_MAPPING)
      .filter(([amount]) => Number(amount) <= invoiceAmountNumber)
      .sort(([a], [b]) => Number(b) - Number(a));

    if (validBeerAmounts.length === 0) {
      throw createHttpError(400, 'Invalid invoice amount');
    }

    const [beerAmount, beerValue] = validBeerAmounts[0];

    if (memo !== beerValue.memo) {
      throw createHttpError(400, 'Invalid memo for the selected beer amount');
    }

    return {
      beerAmount,
      beerValue,
    };
  },
  input: txInputSchema,
});

export default txValidationMiddleware;
