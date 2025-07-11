import { z } from 'zod';

// Shared input validation for address
export const addressInput = z.object({
  address: z.string(),
});

export const statusResponseSchema = z.object({
  status: z.string(),
});

export const locationQuerySchema = z.object({
  location: z.string(),
});

export const publicBeerTapSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  location: z.string(),
  description: z.string().optional(),
  transactionCurrency: z.string(),
  transactionAmount: z.string(),
  transactionMemo: z.string(),
  transactionReceiverEns: z.string(),
});

export const beerTapsResponseSchema = z.object({
  beerTaps: z.array(publicBeerTapSchema),
});
