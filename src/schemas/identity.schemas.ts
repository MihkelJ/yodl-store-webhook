import { Country3LetterCode } from '@selfxyz/common/constants/countries';
import { isAddress } from 'viem';
import { z } from 'zod';

/**
 * Schema for Self.xyz proof verification input
 */
export const verificationInputSchema = z.object({}).passthrough();

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
  walletAddress: z.string().refine(isAddress, 'User ID must be a valid wallet address'),
});

/**
 * Schema for frontend configuration response
 */
export const configResponseSchema = z
  .object({
    appName: z.string().optional(),
    logoBase64: z.string().optional(),
    endpointType: z.enum(['https', 'celo', 'staging_celo', 'staging_https']).optional(),
    endpoint: z.string().url().optional(),
    header: z.string().optional(),
    scope: z.string().optional(),
    sessionId: z.string().optional(),
    userId: z.string().refine(isAddress, 'User ID must be a valid wallet address').optional(),
    userIdType: z.enum(['hex', 'uuid']).optional(),
    devMode: z.boolean().optional(),
    disclosures: z
      .object({
        issuing_state: z.boolean().optional(),
        name: z.boolean().optional(),
        passport_number: z.boolean().optional(),
        nationality: z.boolean().optional(),
        date_of_birth: z.boolean().optional(),
        gender: z.boolean().optional(),
        expiry_date: z.boolean().optional(),
        ofac: z.boolean().optional(),
        excludedCountries: z.array(z.custom<Country3LetterCode>()).optional(),
        minimumAge: z.number().min(18).max(99).optional(),
      })
      .optional(),
    userDefinedData: z.string().optional(),
  })
  .partial();

/**
 * Schema for verification status request
 */
export const statusRequestSchema = z.object({
  walletAddress: z.string().refine(isAddress, 'User ID must be a valid wallet address'),
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
  walletAddress: z.string().refine(isAddress, 'User ID must be a valid wallet address'),
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
