import { z } from 'zod';

export const txInputSchema = z.object({
  txHash: z.string(),
  chainId: z.number(),
  paymentIndex: z.number(),
});


