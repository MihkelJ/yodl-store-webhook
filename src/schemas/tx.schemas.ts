import { isHex } from 'viem';
import { z } from 'zod';

export const txInputSchema = z.object({
  txHash: z.string().transform((txHash) => {
    if (!isHex(txHash)) {
      throw new Error('txHash is not a valid hex string');
    }
    return txHash;
  }),
});
