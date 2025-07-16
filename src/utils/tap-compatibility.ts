import { config } from '../config/index.js';

/**
 * Beer tap type from config
 */
type BeerTap = (typeof config.beerTaps)[0];

/**
 * Checks if two identity verification configurations are compatible
 * 
 * @param config1 - First identity verification config
 * @param config2 - Second identity verification config 
 * @returns True if configurations are compatible for shared verification
 */
function areIdentityConfigsCompatible(
  config1: BeerTap['identityVerification'],
  config2: BeerTap['identityVerification']
): boolean {
  // If both are undefined/disabled, they're compatible
  if (!config1?.enabled && !config2?.enabled) {
    return true;
  }

  // If one is enabled and other is not, they're incompatible
  if (config1?.enabled !== config2?.enabled) {
    return false;
  }

  // If both are enabled, check all verification requirements
  if (config1?.enabled && config2?.enabled) {
    return (
      config1.minimumAge === config2.minimumAge &&
      config1.ofacCheck === config2.ofacCheck &&
      config1.requireNationality === config2.requireNationality &&
      arraysEqual(config1.excludedCountries, config2.excludedCountries) &&
      arraysEqual(config1.allowedNationalities, config2.allowedNationalities) &&
      config1.sessionTimeout === config2.sessionTimeout
    );
  }

  return false;
}

/**
 * Utility function to check if two arrays are equal
 */
function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }
  
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  
  return sorted1.every((val, index) => val === sorted2[index]);
}

/**
 * Finds all beer taps that have compatible identity verification settings with the given tap
 * 
 * @param tapId - The ID of the tap to find compatible taps for
 * @returns Array of compatible beer tap objects
 */
export function findCompatibleTaps(tapId: string): BeerTap[] {
  const targetTap = config.beerTaps.find(tap => tap.id === tapId);
  
  if (!targetTap) {
    return [];
  }

  return config.beerTaps.filter(tap => {
    // Don't include the tap itself
    if (tap.id === tapId) {
      return false;
    }

    return areIdentityConfigsCompatible(targetTap.identityVerification, tap.identityVerification);
  });
}

/**
 * Gets all beer taps that share the same identity verification requirements as the given tap
 * (including the tap itself)
 * 
 * @param tapId - The ID of the tap to find the verification group for
 * @returns Array of all taps in the same verification group
 */
export function getVerificationGroup(tapId: string): BeerTap[] {
  const targetTap = config.beerTaps.find(tap => tap.id === tapId);
  
  if (!targetTap) {
    return [];
  }

  return config.beerTaps.filter(tap => {
    return areIdentityConfigsCompatible(targetTap.identityVerification, tap.identityVerification);
  });
}

/**
 * Generates a hash for identity verification configuration to use as a cache key
 * 
 * @param identityConfig - The identity verification configuration
 * @returns Hash string for cache key generation
 */
export function getVerificationConfigHash(identityConfig: BeerTap['identityVerification']): string {
  if (!identityConfig?.enabled) {
    return 'disabled';
  }

  const configString = JSON.stringify({
    enabled: identityConfig.enabled,
    minimumAge: identityConfig.minimumAge,
    excludedCountries: [...identityConfig.excludedCountries].sort(),
    ofacCheck: identityConfig.ofacCheck,
    requireNationality: identityConfig.requireNationality,
    allowedNationalities: [...identityConfig.allowedNationalities].sort(),
    sessionTimeout: identityConfig.sessionTimeout,
  });

  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < configString.length; i++) {
    const char = configString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Checks if a tap requires identity verification
 * 
 * @param tapId - The ID of the tap to check
 * @returns True if the tap requires identity verification
 */
export function requiresIdentityVerification(tapId: string): boolean {
  const tap = config.beerTaps.find(t => t.id === tapId);
  return tap?.identityVerification?.enabled ?? false;
}

/**
 * Gets the session timeout for a tap's identity verification
 * 
 * @param tapId - The ID of the tap
 * @returns Session timeout in seconds, or default if not specified
 */
export function getSessionTimeout(tapId: string): number {
  const tap = config.beerTaps.find(t => t.id === tapId);
  return tap?.identityVerification?.sessionTimeout ?? config.self.sessionTimeout;
}