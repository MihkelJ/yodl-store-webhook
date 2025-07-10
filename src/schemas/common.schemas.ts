import { z } from 'zod';

// Shared input validation for address
export const addressInput = z.object({
  address: z.string(),
});

export const statusResponseSchema = z.object({
  status: z.string(),
});
