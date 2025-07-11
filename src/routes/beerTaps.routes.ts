import { defaultEndpointsFactory } from 'express-zod-api';
import { config } from '../config/index.js';
import { locationQuerySchema, beerTapsResponseSchema } from '../schemas/common.schemas.js';

export const beerTapsEndpoint = defaultEndpointsFactory.build({
  method: 'get',
  input: locationQuerySchema,
  output: beerTapsResponseSchema,
  handler: async ({ input }) => {
    let filteredTaps = config.beerTaps;

    if (input.location) {
      filteredTaps = config.beerTaps.filter(tap => tap.location.toLowerCase().includes(input.location!.toLowerCase()));
    }

    const publicTaps = filteredTaps.map(tap => ({
      id: tap.id,
      title: tap.title,
      location: tap.location,
      description: tap.description,
      transactionCurrency: tap.transactionCurrency,
      transactionAmount: tap.transactionAmount,
      transactionMemo: tap.transactionMemo,
      transactionReceiverEns: tap.transactionReceiverEns,
    }));

    return {
      beerTaps: publicTaps,
    };
  },
  description: 'Get beer taps, optionally filtered by location',
});
