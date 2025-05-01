import { z } from 'zod';
import { addressInput } from './common.schemas.js';

export const txInputSchema = z.object({
  txHash: addressInput.shape.address,
});
