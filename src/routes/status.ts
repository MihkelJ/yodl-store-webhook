import { defaultEndpointsFactory } from 'express-zod-api';
import { statusInputSchema, statusResponseSchema } from '../schemas/status.js';
import { QueueManagerService } from '../services/queue/queue-manager.service.js';

export const statusEndpoint = defaultEndpointsFactory.build({
  method: 'get',
  input: statusInputSchema,
  output: statusResponseSchema,
  handler: async ({ input }) => {
    const { txHash } = input;
    const queueManager = QueueManagerService.getInstance();

    const result = await queueManager.findTransactionStatus(txHash);

    return {
      txHash,
      status: result.status,
      queuePosition: result.queuePosition,
    };
  },
  description: 'Get transaction processing status by transaction hash',
});
