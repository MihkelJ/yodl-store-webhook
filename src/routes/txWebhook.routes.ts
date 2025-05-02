import { defaultEndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { statusResponseSchema } from '../schemas/common.schemas.js';
import { openBeerTap } from '../services/blynk.service.js';
import { fetchTransaction } from '../services/transaction.service.js';

const BEER_TAP_TOKEN = process.env.BEER_TAP_TOKEN;

if (!BEER_TAP_TOKEN) {
  throw new Error('BEER_TAP_TOKEN is not set');
}

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

export const txWebhook = defaultEndpointsFactory
  // .addMiddleware(authMiddleware)
  .build({
    method: 'post',
    handler: async ({ input }) => {
      try {

        const txHash = input.txHash;

        if (!txHash || typeof txHash !== 'string') {
          console.error('Transaction hash is not set');
          throw createHttpError(401, 'Transaction hash is not set');
        }

        const { memo, invoiceCurrency, invoiceAmount, receiverEnsPrimaryName } =
          await fetchTransaction(txHash);

        const invoiceAmountNumber = Number(invoiceAmount);

        if (!memo) {
          console.error('Transaction has no memo', input.txHash);
          throw createHttpError(402, 'Transaction has no memo');
        }
        if (invoiceCurrency !== INVOICE_CURRENCY) {
          console.error('Invalid invoice currency', input.txHash, invoiceCurrency);
          throw createHttpError(
            403,
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
            404,
            `Invalid receiver ENS primary name: ${receiverEnsPrimaryName}`
          );
        }

        const validBeerAmounts = Object.entries(BEER_MAPPING)
          .filter(([amount]) => Number(amount) <= invoiceAmountNumber)
          .sort(([a], [b]) => Number(b) - Number(a));

        if (validBeerAmounts.length === 0) {
          console.error('Invalid invoice amount', input.txHash, invoiceAmountNumber);
          throw createHttpError(405, 'Invalid invoice amount');
        }

        const [beerAmount, beerMapping] = validBeerAmounts[0];

        try {
          await openBeerTap({
            token: BEER_TAP_TOKEN,
            value: beerMapping.value,
          });
        } catch (error) {
          throw createHttpError(500, 'Failed to open beer tap');
        }

        return { status: 'OK' };
      } catch (error) {
        throw createHttpError(500, 'Failed to open beer tap');
      }
    },
    output: statusResponseSchema,
    description: 'Sends a transaction to the given address',
  });
