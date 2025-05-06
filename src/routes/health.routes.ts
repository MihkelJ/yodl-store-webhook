import { defaultEndpointsFactory } from "express-zod-api";
import { ReasonPhrases } from 'http-status-codes';
import { statusResponseSchema } from "../schemas/common.schemas.js";

export const healthEndpoint = defaultEndpointsFactory.build({
  handler: async () => {
    return { status: ReasonPhrases.OK };
  },
  output: statusResponseSchema,
  description: 'Health check to see if the server is running',
});
