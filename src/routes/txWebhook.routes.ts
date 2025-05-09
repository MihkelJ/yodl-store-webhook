import { defaultEndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import authMiddleware from '../middlewares/auth.middlewares.js';
import txValidationMiddleware from '../middlewares/validation.middlewares.js';
import { statusResponseSchema } from '../schemas/common.schemas.js';
import { txInputSchema } from '../schemas/tx.schemas.js';

export const txWebhook = defaultEndpointsFactory
  .addMiddleware(authMiddleware)
  .addMiddleware(txValidationMiddleware)
  .build({
    method: 'post',
    handler: async ({ options: { beerValue } }) => {
      try {
        try {
          console.log('Opening beer tap');
          // await openBeerTap({
          //   token: config.beerTap.token,
          //   value: beerValue,
          // });
          return {
            status: ReasonPhrases.OK,
          };
        } catch (error) {
          throw createHttpError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            ReasonPhrases.INTERNAL_SERVER_ERROR
          );
        }
      } catch (error) {
        throw createHttpError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
    },
    output: statusResponseSchema,
    input: txInputSchema,
    description: 'Sends a transaction to the given address',
  });
