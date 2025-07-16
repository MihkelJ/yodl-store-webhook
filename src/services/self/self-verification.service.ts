import { AttestationId } from '@selfxyz/core';
import { BigNumberish } from 'ethers';
import { userContextDataSchema } from '../../schemas/identity.schemas.js';
import { findCompatibleTaps, getVerificationGroup } from '../../utils/tap-compatibility.js';
import { RedisService } from '../redis.service.js';
import { getSelfBackendVerifierService } from './self-backend-verifier.service.js';
import { getSelfConfigStorageService } from './self-config-storage.service.js';

/**
 * VcAndDiscloseProof type from Self.xyz
 */
type VcAndDiscloseProof = {
  a: [BigNumberish, BigNumberish];
  b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
  c: [BigNumberish, BigNumberish];
};

/**
 * Verification result interface
 */
export interface VerificationResult {
  isValid: boolean;
  isAgeValid: boolean;
  isOfacValid: boolean;
  nationality?: string;
  userIdentifier: string;
  attestationId: 1 | 2;
  verifiedAt: number;
  expiresAt: number;
}

/**
 * Verification status interface
 */
export interface VerificationStatus {
  isVerified: boolean;
  result?: VerificationResult;
  error?: string;
  cachedAt?: number;
}

/**
 * Self.xyz verification service with caching and session management
 *
 * This service orchestrates the verification workflow, manages caching,
 * and provides verification status checks.
 */
export class SelfVerificationService {
  private verifierService = getSelfBackendVerifierService();
  private configStorage = getSelfConfigStorageService();
  private redisService = RedisService.getInstance(process.env.REDIS_URL || 'redis://localhost:6379');

  /**
   * Verifies a Self.xyz proof with caching
   *
   * @param attestationId - The attestation ID from the proof
   * @param proof - The cryptographic proof
   * @param pubSignals - Public signals from the proof
   * @param userContextData - User context data (contains tap ID, etc.)
   * @returns Promise resolving to verification result
   */
  async verifyProof(
    attestationId: AttestationId,
    proof: VcAndDiscloseProof,
    pubSignals: BigNumberish[],
    userContextData: string
  ): Promise<VerificationStatus> {
    try {
      // Verify the proof
      const verificationResult = await this.verifierService.verifyProof(
        attestationId,
        proof,
        pubSignals,
        userContextData
      );

      if (!verificationResult.isValidDetails.isValid) {
        return {
          isVerified: false,
          error: 'Verification failed',
        };
      }

      let contextData;
      try {
        const parsedData = JSON.parse(userContextData);
        contextData = userContextDataSchema.parse(parsedData);
      } catch (error) {
        console.error('Error parsing user context data', error);
        return {
          isVerified: false,
          error: 'Invalid user context data: Failed to parse JSON',
        };
      }

      const verificationResult_final: VerificationResult = {
        isValid: verificationResult.isValidDetails.isValid,
        isAgeValid: verificationResult.isValidDetails.isMinimumAgeValid,
        isOfacValid: verificationResult.isValidDetails.isOfacValid,
        nationality: verificationResult.discloseOutput.nationality,
        userIdentifier: verificationResult.userData.userIdentifier,
        attestationId: verificationResult.attestationId,
        verifiedAt: Date.now(),
        expiresAt: Date.now() + this.configStorage.getSessionTimeout(contextData.tapId) * 1000,
      };

      // Cache the verification result for this tap and all compatible taps
      await this.cacheVerificationResultForCompatibleTaps(
        verificationResult.userData.userIdentifier,
        contextData.tapId,
        verificationResult_final
      );

      return {
        isVerified: true,
        result: verificationResult_final,
      };
    } catch (error) {
      return {
        isVerified: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  /**
   * Checks the verification status for a user and tap
   *
   * @param walletAddress - User wallet address
   * @param tapId - Beer tap identifier
   * @returns Promise resolving to verification status
   */
  async getVerificationStatus(walletAddress: string, tapId: string): Promise<VerificationStatus> {
    try {
      // First check if there's a cached result for this specific tap
      let cachedResult = await this.getCachedVerificationResult(walletAddress, tapId);

      // If not found, check compatible taps
      if (!cachedResult) {
        const compatibleTaps = findCompatibleTaps(tapId);

        for (const compatibleTap of compatibleTaps) {
          const compatibleResult = await this.getCachedVerificationResult(walletAddress, compatibleTap.id!);
          if (compatibleResult) {
            cachedResult = compatibleResult;
            break;
          }
        }
      }

      if (!cachedResult) {
        return {
          isVerified: false,
          error: 'No verification found for this user and tap',
        };
      }

      // Check if verification has expired
      const now = Date.now();
      if (now > cachedResult.expiresAt) {
        // Remove expired verification from all compatible taps
        await this.removeVerificationResultForCompatibleTaps(walletAddress, tapId);
        return {
          isVerified: false,
          error: 'Verification has expired',
        };
      }

      return {
        isVerified: true,
        result: cachedResult,
        cachedAt: cachedResult.verifiedAt,
      };
    } catch (error) {
      return {
        isVerified: false,
        error: error instanceof Error ? error.message : 'Error checking verification status',
      };
    }
  }

  /**
   * Checks if identity verification is required for a specific beer tap
   *
   * @param tapId - Beer tap identifier
   * @returns boolean indicating if verification is required
   */
  isVerificationRequired(tapId: string): boolean {
    return this.verifierService.isVerificationRequired(tapId);
  }

  /**
   * Gets frontend configuration for QR code generation
   *
   * @param tapId - Beer tap identifier
   * @param walletAddress - User wallet address
   * @returns configuration object for SelfAppBuilder
   */
  async getFrontendConfig(tapId: string, walletAddress: string) {
    return this.verifierService.getFrontendConfig(tapId, walletAddress);
  }

  /**
   * Gets session timeout for a specific beer tap
   *
   * @param tapId - Beer tap identifier
   * @returns session timeout in seconds
   */
  getSessionTimeout(tapId: string): number {
    return this.verifierService.getSessionTimeout(tapId);
  }

  /**
   * Removes verification result from cache
   *
   * @param walletAddress - User wallet address
   * @param tapId - Beer tap identifier
   */
  async removeVerificationResult(walletAddress: string, tapId: string): Promise<void> {
    const cacheKey = this.getVerificationCacheKey(walletAddress, tapId);
    await this.redisService.del(cacheKey);
  }

  /**
   * Removes verification result from cache for all compatible taps
   *
   * @param walletAddress - User wallet address
   * @param tapId - Beer tap identifier
   */
  async removeVerificationResultForCompatibleTaps(walletAddress: string, tapId: string): Promise<void> {
    const verificationGroup = getVerificationGroup(tapId);
    const deletePromises = verificationGroup.map(tap => this.removeVerificationResult(walletAddress, tap.id!));
    await Promise.all(deletePromises);
  }

  /**
   * Caches verification result with TTL
   *
   * @param wallet
   * @param tapId - Beer tap identifier
   * @param result - Verification result to cache
   */
  private async cacheVerificationResult(
    walletAddress: string,
    tapId: string,
    result: VerificationResult
  ): Promise<void> {
    const cacheKey = this.getVerificationCacheKey(walletAddress, tapId);
    const ttl = Math.ceil((result.expiresAt - Date.now()) / 1000); // TTL in seconds

    await this.redisService.setex(cacheKey, ttl, JSON.stringify(result));
  }

  /**
   * Caches verification result for all compatible taps
   *
   * @param walletAddress - User wallet address
   * @param tapId - Beer tap identifier
   * @param result - Verification result to cache
   */
  private async cacheVerificationResultForCompatibleTaps(
    walletAddress: string,
    tapId: string,
    result: VerificationResult
  ): Promise<void> {
    const verificationGroup = getVerificationGroup(tapId);
    const cachePromises = verificationGroup.map(tap => this.cacheVerificationResult(walletAddress, tap.id!, result));
    await Promise.all(cachePromises);
  }

  /**
   * Gets cached verification result
   *
   * @param walletAddress - User wallet address
   * @param tapId - Beer tap identifier
   * @returns Promise resolving to cached verification result or null
   */
  private async getCachedVerificationResult(walletAddress: string, tapId: string): Promise<VerificationResult | null> {
    const cacheKey = this.getVerificationCacheKey(walletAddress, tapId);
    const cachedData = await this.redisService.get(cacheKey);

    if (!cachedData) {
      return null;
    }

    try {
      return JSON.parse(cachedData) as VerificationResult;
    } catch (error: unknown) {
      console.error('Error parsing cached verification result', error);
      // If parsing fails, remove the corrupted cache entry
      await this.redisService.del(cacheKey);
      return null;
    }
  }

  /**
   * Generates cache key for verification results
   *
   * @param walletAddress - User wallet address
   * @param tapId - Beer tap identifier
   * @returns Redis cache key
   */
  private getVerificationCacheKey(walletAddress: string, tapId: string): string {
    return `self:verification:${walletAddress}:${tapId}`;
  }
}

// Singleton instance
let verificationInstance: SelfVerificationService | null = null;

/**
 * Gets the singleton instance of SelfVerificationService
 */
export function getSelfVerificationService(): SelfVerificationService {
  if (!verificationInstance) {
    verificationInstance = new SelfVerificationService();
  }
  return verificationInstance;
}
