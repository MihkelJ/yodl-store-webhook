import { SelfBackendVerifier, AllIds } from '@selfxyz/core';
import { config } from '../../config/index.js';
import { getSelfConfigStorageService } from './self-config-storage.service.js';

/**
 * Self.xyz backend verifier service for identity verification
 *
 * This service manages the SelfBackendVerifier instance and handles
 * proof verification for identity documents.
 */
export class SelfBackendVerifierService {
  private verifier!: SelfBackendVerifier;
  private configStorage = getSelfConfigStorageService();

  constructor() {
    this.initializeVerifier();
  }

  /**
   * Initializes the SelfBackendVerifier instance
   */
  private initializeVerifier(): void {
    this.verifier = new SelfBackendVerifier(
      config.self.appScope,
      config.self.endpoint,
      config.self.mockMode,
      AllIds, // Use AllIds for all document types
      this.configStorage,
      'hex' // Using hex for wallet addresses
    );
  }

  /**
   * Verifies a Self.xyz proof
   *
   * @param attestationId - The attestation ID from the proof
   * @param proof - The cryptographic proof
   * @param pubSignals - Public signals from the proof
   * @param userContextData - User context data (contains tap ID, etc.)
   * @returns Promise resolving to verification result
   */
  async verifyProof(attestationId: 1 | 2, proof: any, pubSignals: any, userContextData: string) {
    try {
      const result = await this.verifier.verify(attestationId, proof, pubSignals, userContextData);

      return {
        success: true,
        result: {
          isValid: result.isValidDetails.isValid,
          isAgeValid: result.isValidDetails.isMinimumAgeValid,
          isOfacValid: result.isValidDetails.isOfacValid,
          nationality: result.discloseOutput?.nationality,
          userIdentifier: result.userData.userIdentifier,
          attestationId: result.attestationId,
        },
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown verification error',
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
    return this.configStorage.isVerificationRequired(tapId);
  }

  /**
   * Gets session timeout for a specific beer tap
   *
   * @param tapId - Beer tap identifier
   * @returns session timeout in seconds
   */
  getSessionTimeout(tapId: string): number {
    return this.configStorage.getSessionTimeout(tapId);
  }

  /**
   * Gets frontend configuration for QR code generation
   *
   * @param tapId - Beer tap identifier
   * @param userId - User identifier
   * @returns configuration object for SelfAppBuilder
   */
  async getFrontendConfig(tapId: string, userId: string) {
    return this.configStorage.getFrontendConfig(tapId, userId);
  }
}

// Singleton instance
let verifierInstance: SelfBackendVerifierService | null = null;

/**
 * Gets the singleton instance of SelfBackendVerifierService
 */
export function getSelfBackendVerifierService(): SelfBackendVerifierService {
  if (!verifierInstance) {
    verifierInstance = new SelfBackendVerifierService();
  }
  return verifierInstance;
}
