import { isHex } from 'viem';
import { z } from 'zod';

export const statusInputSchema = z.object({
  txHash: z.string().transform(txHash => {
    if (!isHex(txHash)) {
      throw new Error('txHash is not a valid hex string');
    }
    return txHash;
  }),
});

export const statusResponseSchema = z.object({
  txHash: z.string(),
  status: z.enum(['not_found', 'queued', 'processing', 'completed', 'failed']),
  queuePosition: z.number().optional(),
});
