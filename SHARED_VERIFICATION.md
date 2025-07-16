# Shared Identity Verification for Beer Taps

## Overview

This system implements shared identity verification for beer taps, reducing the verification burden on users when accessing multiple taps with identical identity requirements. When a user verifies their identity for one tap, they automatically gain access to all other compatible taps.

## How It Works

### Automatic Compatibility Detection

The system automatically detects which beer taps have compatible identity verification requirements by comparing their `identityVerification` configuration:

```typescript
// Two taps are compatible if they have identical:
{
  enabled: boolean,
  minimumAge: number,
  excludedCountries: string[],
  ofacCheck: boolean,
  requireNationality: boolean,
  allowedNationalities: string[],
  sessionTimeout: number
}
```

### Shared Verification Flow

1. **User requests verification for tap A**
2. **System finds all compatible taps** (taps with identical verification requirements)
3. **User completes verification once**
4. **Verification is cached for tap A and all compatible taps**
5. **User can immediately access any compatible tap without re-verification**

## API Behavior

### Existing Endpoints Enhanced

All existing endpoints maintain their original API contract but now provide shared verification:

#### `POST /v1/identity/config`

- **Input**: `{ tapId: string, userId: string }`
- **Enhanced Behavior**: Generates verification config that applies to the requested tap AND all compatible taps
- **No API Changes**: Frontend continues to work unchanged

#### `POST /v1/identity/verify`

- **Input**: `{ attestationId, proof, pubSignals, userContextData }`
- **Enhanced Behavior**: Caches verification for the target tap AND all compatible taps
- **No API Changes**: Frontend continues to work unchanged

#### `GET /v1/identity/status/:userId/:tapId`

- **Input**: URL parameters `userId` and `tapId`
- **Enhanced Behavior**: Checks verification for requested tap, falls back to compatible taps if not found
- **No API Changes**: Frontend continues to work unchanged

## Example Scenarios

### Scenario 1: Compatible Taps

```json
{
  "tap-1": {
    "identityVerification": {
      "enabled": true,
      "minimumAge": 21,
      "excludedCountries": ["IRN", "PRK"],
      "ofacCheck": true,
      "requireNationality": false,
      "allowedNationalities": [],
      "sessionTimeout": 1800
    }
  },
  "tap-2": {
    "identityVerification": {
      "enabled": true,
      "minimumAge": 21,
      "excludedCountries": ["IRN", "PRK"],
      "ofacCheck": true,
      "requireNationality": false,
      "allowedNationalities": [],
      "sessionTimeout": 1800
    }
  }
}
```

**Result**: User verifies once for tap-1, immediately gets access to tap-2.

### Scenario 2: Incompatible Taps

```json
{
  "tap-1": {
    "identityVerification": {
      "enabled": true,
      "minimumAge": 21,
      "excludedCountries": ["IRN", "PRK"],
      "ofacCheck": true,
      "requireNationality": false,
      "allowedNationalities": [],
      "sessionTimeout": 1800
    }
  },
  "tap-3": {
    "identityVerification": {
      "enabled": true,
      "minimumAge": 18,
      "excludedCountries": ["IRN", "PRK"],
      "ofacCheck": true,
      "requireNationality": false,
      "allowedNationalities": [],
      "sessionTimeout": 1800
    }
  }
}
```

**Result**: User must verify separately for tap-1 and tap-3 due to different minimum ages.

## Implementation Details

### Core Files

- **`src/utils/tap-compatibility.ts`**: Utility functions for compatibility detection
- **`src/services/self/self-verification.service.ts`**: Enhanced verification service with shared verification
- **`src/routes/identity.routes.ts`**: API endpoints (unchanged interface)

### Key Functions

#### `findCompatibleTaps(tapId: string)`

Returns array of taps compatible with the given tap (excluding the tap itself).

#### `getVerificationGroup(tapId: string)`

Returns array of all taps in the same verification group (including the tap itself).

#### `getVerificationConfigHash(config)`

Generates a hash for verification configuration, useful for cache keys.

### Cache Strategy

The system uses both individual and shared caching:

1. **Individual Cache Keys**: `self:verification:${userId}:${tapId}`
2. **Shared Verification**: All compatible taps get the same verification result
3. **Automatic Cleanup**: Expired verifications are removed from all compatible taps

## Benefits

### For Users

- **Reduced Verification Burden**: Verify once, access multiple compatible taps
- **Faster Access**: No waiting for re-verification at compatible taps
- **Seamless Experience**: No API changes required in frontend

### For Operators

- **Flexible Configuration**: Can group taps by verification requirements
- **Reduced Verification Load**: Fewer Self.xyz API calls
- **Better User Experience**: Happier users with less friction

### For System

- **Backward Compatible**: Existing integrations continue to work
- **Efficient Caching**: Reduced Redis operations
- **Scalable**: Works with any number of taps

## Configuration Examples

### Basic Setup (All Taps Compatible)

```json
[
  {
    "id": "tap-1",
    "identityVerification": {
      "enabled": true,
      "minimumAge": 21
    }
  },
  {
    "id": "tap-2",
    "identityVerification": {
      "enabled": true,
      "minimumAge": 21
    }
  }
]
```

### Mixed Setup (Different Requirements)

```json
[
  {
    "id": "premium-tap",
    "identityVerification": {
      "enabled": true,
      "minimumAge": 25,
      "excludedCountries": ["IRN", "PRK"],
      "ofacCheck": true,
      "requireNationality": true,
      "allowedNationalities": ["USA", "CAN"],
      "sessionTimeout": 3600
    }
  },
  {
    "id": "regular-tap",
    "identityVerification": {
      "enabled": true,
      "minimumAge": 21,
      "excludedCountries": ["IRN", "PRK"],
      "ofacCheck": true,
      "requireNationality": false,
      "allowedNationalities": [],
      "sessionTimeout": 1800
    }
  }
]
```
