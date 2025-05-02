import { defaultEndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { statusResponseSchema } from '../schemas/common.schemas.js';
import { txInputSchema } from '../schemas/tx.schemas.js';
import { openBeerTap } from '../services/blynk.service.js';

const BEER_TAP_TOKEN = process.env.BEER_TAP_TOKEN;

if (!BEER_TAP_TOKEN) {
  throw new Error('BEER_TAP_TOKEN is not set');
}

export const txWebhook = defaultEndpointsFactory
  // .addMiddleware(authMiddleware)
  // .addMiddleware(txValidationMiddleware)
  .build({
    method: 'post',
    handler: async ({ options }) => {
      try {
        const { beerValue } = options;

        try {
          await openBeerTap({
            token: BEER_TAP_TOKEN,
            value: "1",
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
    input: txInputSchema,
    description: 'Sends a transaction to the given address',
  });
