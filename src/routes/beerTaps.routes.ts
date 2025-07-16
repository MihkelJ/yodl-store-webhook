import { defaultEndpointsFactory } from 'express-zod-api';
import omit from 'lodash/omit.js';
import { config } from '../config/index.js';
import { beerTapsResponseSchema, locationQuerySchema } from '../schemas/common.schemas.js';

export const beerTapsEndpoint = defaultEndpointsFactory.build({
  method: 'get',
  input: locationQuerySchema,
  output: beerTapsResponseSchema,
  handler: async ({ input }) => {
    let filteredTaps = config.beerTaps;

    if (input.location) {
      filteredTaps = config.beerTaps.filter(tap => tap.location.toLowerCase().includes(input.location!.toLowerCase()));
    }

    const publicTaps = filteredTaps.map(tap => {
      // Omit internal configuration properties that shouldn't be exposed
      const baseTap = omit(tap, ['thingsBoardDeviceId', 'thingsBoardCupSize', 'thingsBoardServerUrl']);

      // Add computed identity verification properties
      const identityVerificationRequired = tap.identityVerification?.enabled ?? false;

      return {
        ...baseTap,
        identityVerificationRequired,
        identityVerificationConfig: identityVerificationRequired
          ? {
              minimumAge: tap.identityVerification!.minimumAge || config.self.defaultMinimumAge,
              sessionTimeout: tap.identityVerification!.sessionTimeout || config.self.sessionTimeout,
              excludedCountries: tap.identityVerification!.excludedCountries || config.self.defaultExcludedCountries,
              ofacCheck: tap.identityVerification!.ofacCheck ?? true,
            }
          : undefined,
      };
    });

    return {
      beerTaps: publicTaps,
    };
  },
  description: 'Get beer taps, optionally filtered by location',
});
