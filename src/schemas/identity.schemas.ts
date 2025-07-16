import { z } from 'zod';

/**
 * Schema for Self.xyz proof verification input
 */
export const verificationInputSchema = z.object({
  attestationId: z.union([z.literal(1), z.literal(2)], {
    errorMap: () => ({ message: 'Attestation ID must be 1 or 2' }),
  }),
  proof: z.any().describe('Cryptographic proof from Self.xyz'),
  pubSignals: z.any().describe('Public signals from Self.xyz proof'),
  userContextData: z.string().min(1, 'User context data is required'),
});

/**
 * Schema for verification result output
 */
export const verificationResultSchema = z.object({
  isVerified: z.boolean(),
  result: z
    .object({
      isValid: z.boolean(),
      isAgeValid: z.boolean(),
      isOfacValid: z.boolean(),
      nationality: z.string().optional(),
      userIdentifier: z.string(),
      attestationId: z.number(),
      verifiedAt: z.number(),
      expiresAt: z.number(),
    })
    .optional(),
  error: z.string().optional(),
  cachedAt: z.number().optional(),
});

/**
 * Schema for frontend configuration request
 */
export const configRequestSchema = z.object({
  tapId: z.string().min(1, 'Beer tap ID is required'),
  userId: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'User ID must be a valid wallet address'),
});

/**
 * Schema for frontend configuration response
 */
export const configResponseSchema = z.object({
  appName: z.string(),
  scope: z.string(),
  endpoint: z.string().url(),
  userId: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'User ID must be a valid wallet address'),
  disclosures: z.object({
    minimumAge: z.number().min(18).max(99),
    excludedCountries: z.array(z.string().length(3)),
    ofac: z.boolean(),
    name: z.boolean(),
    nationality: z.boolean(),
  }),
  userDefinedData: z.string(),
});

/**
 * Schema for verification status request
 */
export const statusRequestSchema = z.object({
  userId: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'User ID must be a valid wallet address'),
  tapId: z.string().min(1, 'Beer tap ID is required'),
});

/**
 * Schema for verification status response
 */
export const statusResponseSchema = z.object({
  isVerified: z.boolean(),
  result: z
    .object({
      isValid: z.boolean(),
      isAgeValid: z.boolean(),
      isOfacValid: z.boolean(),
      nationality: z.string().optional(),
      userIdentifier: z.string(),
      attestationId: z.number(),
      verifiedAt: z.number(),
      expiresAt: z.number(),
    })
    .optional(),
  error: z.string().optional(),
  cachedAt: z.number().optional(),
});

/**
 * Schema for user context data validation
 */
export const userContextDataSchema = z.object({
  tapId: z.string().min(1, 'Beer tap ID is required'),
  transactionMemo: z.string().optional(),
  timestamp: z.number().optional(),
});

/**
 * Schema for verification configuration validation
 */
export const verificationConfigSchema = z.object({
  olderThan: z.number().min(18).max(99),
  excludedCountries: z.array(z.string().length(3)).optional(),
  ofac: z.boolean(),
});

/**
 * Schema for attestation ID validation
 */
export const attestationIdSchema = z.number().int().positive('Attestation ID must be a positive integer');
