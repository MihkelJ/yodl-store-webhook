import { defaultEndpointsFactory } from 'express-zod-api';
import createHttpError from 'http-errors';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import authMiddleware from '../middlewares/auth.middlewares.js';
import txValidationMiddleware from '../middlewares/validation.middlewares.js';
import { statusResponseSchema } from '../schemas/common.schemas.js';
import { txInputSchema } from '../schemas/tx.schemas.js';
import { communicateWithBlynk } from '../services/blynk.service.js';

export const txWebhook = defaultEndpointsFactory
  .addMiddleware(authMiddleware)
  .addMiddleware(txValidationMiddleware)
  .build({
    method: 'post',
    handler: async ({ options: { validMethod }, logger }) => {
      try {
        try {
          const response = await communicateWithBlynk({
            token: validMethod.blynkDeviceToken,
            value: validMethod.blynkDevicePinValue,
            pin: validMethod.blynkDevicePin,
            server: validMethod.blynkServer,
          });

          if (!response.ok) {
            logger.error('Failed to open beer tap', { response });
            throw createHttpError(
              StatusCodes.INTERNAL_SERVER_ERROR,
              ReasonPhrases.INTERNAL_SERVER_ERROR
            );
          }

          return {
            status: ReasonPhrases.OK,
          };
        } catch (error) {
          logger.error('Failed to open beer tap', { error });
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
