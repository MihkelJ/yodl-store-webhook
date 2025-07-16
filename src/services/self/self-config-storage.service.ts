import { Country3LetterCode } from '@selfxyz/common/constants/countries';
import { SelfApp } from '@selfxyz/common/utils/appType';
import { DefaultConfigStore } from '@selfxyz/core';
import { config } from '../../config/index.js';

/**
 * Configuration storage implementation for Self.xyz identity verification
 *
 * This service extends DefaultConfigStore to provide verification
 * requirements based on beer tap configuration and user context.
 */
export class SelfConfigStorageService extends DefaultConfigStore {
  /**
   * Gets verification configuration for a specific config ID
   *
   * @param configId - Configuration identifier (typically beer tap ID)
   * @returns Promise resolving to verification configuration
   */
  async getConfig(configId: string) {
    // Find the beer tap configuration
    const beerTap = config.beerTaps.find(tap => tap.id === configId);

    if (!beerTap || !beerTap.identityVerification?.enabled) {
      // Return default configuration if no tap-specific config or verification disabled
      return {
        minimumAge: config.self.defaultMinimumAge,
        excludedCountries: config.self.defaultExcludedCountries as Country3LetterCode[],
        ofac: true,
      };
    }

    const identityConfig = beerTap.identityVerification;

    // Build verification config from beer tap settings
    const verificationConfig: any = {
      minimumAge: identityConfig.minimumAge || config.self.defaultMinimumAge,
      ofac: identityConfig.ofacCheck ?? true,
    };

    // Add excluded countries if specified
    if (identityConfig.excludedCountries && identityConfig.excludedCountries.length > 0) {
      verificationConfig.excludedCountries = identityConfig.excludedCountries as Country3LetterCode[];
    } else if (config.self.defaultExcludedCountries.length > 0) {
      verificationConfig.excludedCountries = config.self.defaultExcludedCountries as Country3LetterCode[];
    }

    return verificationConfig;
  }

  /**
   * Determines the configuration ID to use based on user context
   *
   * @param userIdentifier - Unique user identifier
   * @param userDefinedData - User context data (typically contains beer tap ID)
   * @returns Promise resolving to configuration ID
   */
  async getActionId(_userIdentifier: string, userDefinedData: string): Promise<string> {
    try {
      // Parse user defined data to extract beer tap information
      const userData = JSON.parse(userDefinedData);

      // Check if tapId is provided in user data
      if (userData.tapId) {
        const beerTap = config.beerTaps.find(tap => tap.id === userData.tapId);
        if (beerTap && beerTap.identityVerification?.enabled) {
          return userData.tapId;
        }
      }

      // Check if transactionMemo matches any beer tap
      if (userData.transactionMemo) {
        const beerTap = config.beerTaps.find(tap => tap.transactionMemo === userData.transactionMemo);
        if (beerTap && beerTap.identityVerification?.enabled) {
          return beerTap.id || 'default';
        }
      }

      // Fallback to default configuration
      return 'default';
    } catch (error) {
      console.error('Error getting action ID', error);
      // If parsing fails, return default configuration
      return 'default';
    }
  }

  /**
   * Checks if identity verification is required for a specific beer tap
   *
   * @param tapId - Beer tap identifier
   * @returns boolean indicating if verification is required
   */
  isVerificationRequired(tapId: string): boolean {
    const beerTap = config.beerTaps.find(tap => tap.id === tapId);
    return beerTap?.identityVerification?.enabled ?? false;
  }

  /**
   * Gets session timeout for a specific beer tap
   *
   * @param tapId - Beer tap identifier
   * @returns session timeout in seconds
   */
  getSessionTimeout(tapId: string): number {
    const beerTap = config.beerTaps.find(tap => tap.id === tapId);
    return beerTap?.identityVerification?.sessionTimeout ?? config.self.sessionTimeout;
  }

  /**
   * Gets verification configuration for frontend QR code generation
   *
   * @param tapId - Beer tap identifier
   * @param userId - User identifier
   * @returns configuration object for SelfAppBuilder
   */
  async getFrontendConfig(tapId: string, walletAddress: string): Promise<Partial<SelfApp>> {
    const beerTap = config.beerTaps.find(tap => tap.id === tapId);

    if (!beerTap || !beerTap.identityVerification?.enabled) {
      throw new Error(`Identity verification not enabled for tap: ${tapId}`);
    }

    const identityConfig = beerTap.identityVerification;
    // const userDefinedData = JSON.stringify({
    //   tapId,
    //   walletAddress,
    // });

    return {
      appName: config.self.appName,
      scope: config.self.appScope,
      endpoint: config.self.endpoint,

      userId: walletAddress,
      userIdType: 'hex',

      disclosures: {
        minimumAge: identityConfig.minimumAge || config.self.defaultMinimumAge,
        excludedCountries: (identityConfig.excludedCountries ||
          config.self.defaultExcludedCountries) as Country3LetterCode[],
        ofac: identityConfig.ofacCheck ?? true,
        name: false,
        nationality: identityConfig.requireNationality ?? false,
      },

      userDefinedData: `testing`,
    };
  }
}

// Singleton instance
let configStorageInstance: SelfConfigStorageService | null = null;

/**
 * Gets the singleton instance of SelfConfigStorageService
 */
export function getSelfConfigStorageService(): SelfConfigStorageService {
  if (!configStorageInstance) {
    configStorageInstance = new SelfConfigStorageService({});
  }
  return configStorageInstance;
}
