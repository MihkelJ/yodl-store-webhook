import { defaultEndpointsFactory } from "express-zod-api";
import { statusResponseSchema } from "../schemas/common.schemas.js";

export const healthEndpoint = defaultEndpointsFactory.build({
  handler: async () => {
    return { status: "ok" };
  },
  output: statusResponseSchema,
  description: "Health check to see if the server is running",
});
