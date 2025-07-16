import { RedisService } from '../redis.service.js';
import { getSelfBackendVerifierService } from './self-backend-verifier.service.js';
import { getSelfConfigStorageService } from './self-config-storage.service.js';
import { getVerificationGroup, findCompatibleTaps } from '../../utils/tap-compatibility.js';

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
    attestationId: 1 | 2,
    proof: any,
    pubSignals: any,
    userContextData: string
  ): Promise<VerificationStatus> {
    try {
      // Parse user context to get tap ID and user identifier
      const userData = JSON.parse(userContextData);
      const tapId = userData.tapId || 'default';

      // Verify the proof
      const verificationResult = await this.verifierService.verifyProof(
        attestationId,
        proof,
        pubSignals,
        userContextData
      );

      if (!verificationResult.success) {
        return {
          isVerified: false,
          error: verificationResult.error || 'Verification failed',
        };
      }

      const result = verificationResult.result!;

      // Check if verification is valid
      if (!result.isValid || !result.isAgeValid) {
        return {
          isVerified: false,
          error: 'Identity verification requirements not met',
        };
      }

      // Get session timeout for this tap
      const sessionTimeout = this.configStorage.getSessionTimeout(tapId);
      const now = Date.now();
      const expiresAt = now + sessionTimeout * 1000;

      // Create verification result
      const verificationResult_final: VerificationResult = {
        isValid: result.isValid,
        isAgeValid: result.isAgeValid,
        isOfacValid: result.isOfacValid,
        nationality: result.nationality,
        userIdentifier: result.userIdentifier,
        attestationId: result.attestationId,
        verifiedAt: now,
        expiresAt,
      };

      // Cache the verification result for this tap and all compatible taps
      await this.cacheVerificationResultForCompatibleTaps(result.userIdentifier, tapId, verificationResult_final);

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
   * @param userId - User identifier
   * @param tapId - Beer tap identifier
   * @returns Promise resolving to verification status
   */
  async getVerificationStatus(userId: string, tapId: string): Promise<VerificationStatus> {
    try {
      // First check if there's a cached result for this specific tap
      let cachedResult = await this.getCachedVerificationResult(userId, tapId);

      // If not found, check compatible taps
      if (!cachedResult) {
        const compatibleTaps = findCompatibleTaps(tapId);
        
        for (const compatibleTap of compatibleTaps) {
          const compatibleResult = await this.getCachedVerificationResult(userId, compatibleTap.id!);
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
        await this.removeVerificationResultForCompatibleTaps(userId, tapId);
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
   * @param userId - User identifier
   * @returns configuration object for SelfAppBuilder
   */
  async getFrontendConfig(tapId: string, userId: string) {
    return this.verifierService.getFrontendConfig(tapId, userId);
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
   * @param userId - User identifier
   * @param tapId - Beer tap identifier
   */
  async removeVerificationResult(userId: string, tapId: string): Promise<void> {
    const cacheKey = this.getVerificationCacheKey(userId, tapId);
    await this.redisService.del(cacheKey);
  }

  /**
   * Removes verification result from cache for all compatible taps
   *
   * @param userId - User identifier
   * @param tapId - Beer tap identifier
   */
  async removeVerificationResultForCompatibleTaps(userId: string, tapId: string): Promise<void> {
    const verificationGroup = getVerificationGroup(tapId);
    const deletePromises = verificationGroup.map(tap => 
      this.removeVerificationResult(userId, tap.id!)
    );
    await Promise.all(deletePromises);
  }

  /**
   * Caches verification result with TTL
   *
   * @param userId - User identifier
   * @param tapId - Beer tap identifier
   * @param result - Verification result to cache
   */
  private async cacheVerificationResult(userId: string, tapId: string, result: VerificationResult): Promise<void> {
    const cacheKey = this.getVerificationCacheKey(userId, tapId);
    const ttl = Math.ceil((result.expiresAt - Date.now()) / 1000); // TTL in seconds

    await this.redisService.setex(cacheKey, ttl, JSON.stringify(result));
  }

  /**
   * Caches verification result for all compatible taps
   *
   * @param userId - User identifier
   * @param tapId - Beer tap identifier
   * @param result - Verification result to cache
   */
  private async cacheVerificationResultForCompatibleTaps(userId: string, tapId: string, result: VerificationResult): Promise<void> {
    const verificationGroup = getVerificationGroup(tapId);
    const cachePromises = verificationGroup.map(tap => 
      this.cacheVerificationResult(userId, tap.id!, result)
    );
    await Promise.all(cachePromises);
  }

  /**
   * Gets cached verification result
   *
   * @param userId - User identifier
   * @param tapId - Beer tap identifier
   * @returns Promise resolving to cached verification result or null
   */
  private async getCachedVerificationResult(userId: string, tapId: string): Promise<VerificationResult | null> {
    const cacheKey = this.getVerificationCacheKey(userId, tapId);
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
   * @param userId - User identifier
   * @param tapId - Beer tap identifier
   * @returns Redis cache key
   */
  private getVerificationCacheKey(userId: string, tapId: string): string {
    return `self:verification:${userId}:${tapId}`;
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
