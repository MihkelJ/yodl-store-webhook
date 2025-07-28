import assert from 'assert';
import createHttpError from 'http-errors';
import { QueueStatus } from '../../types/queue.js';
import { ThingsBoardAuthService } from './thingsboard-auth.service.js';

interface ThingsBoardConfig {
  serverUrl: string;
  username: string;
  password: string;
  rpcTimeout: number;
}

interface MessageToThingsBoard {
  deviceId: string;
  method: string;
  params: number;
  config: ThingsBoardConfig;
  retryAttempts?: number;
}

interface ReadFromThingsBoard {
  deviceId: string;
  config: ThingsBoardConfig;
}

let authService: ThingsBoardAuthService | null = null;

function initializeServices(config: ThingsBoardConfig) {
  if (authService) {
    return;
  }

  authService = new ThingsBoardAuthService(config.serverUrl, config.username, config.password);
}

export async function communicateWithThingsBoard({
  deviceId,
  method,
  params,
  config,
  retryAttempts = 3,
}: MessageToThingsBoard): Promise<Response> {
  assert(deviceId, 'deviceId is required');
  assert(method, 'method is required');
  assert(params !== undefined && params !== null, 'params is required');

  initializeServices(config);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      if (!authService) {
        throw new Error('ThingsBoard authentication not configured');
      }

      // Use REST API with JWT authentication and device ID
      const response = await authService.makeAuthenticatedRequest(`/api/rpc/oneway/${deviceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          params,
          persistent: false,
          timeout: config.rpcTimeout,
        }),
      });

      if (!response.ok) {
        const error = createHttpError(response.status, `ThingsBoard REST API error: ${response.status} ${response.statusText}`);
        
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw error;
        }
        
        // Retry on server errors (5xx) and other issues
        if (attempt < retryAttempts) {
          console.warn(`ThingsBoard RPC attempt ${attempt} failed with ${response.status}, retrying immediately...`);
          lastError = error;
          continue;
        }
        
        throw error;
      }

      // Success - log if this was a retry
      if (attempt > 1) {
        console.info(`ThingsBoard RPC succeeded on attempt ${attempt}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on client errors (4xx) that we can detect
      if (error instanceof Error && error.message.includes('ThingsBoard authentication not configured')) {
        throw error;
      }
      
      if (attempt < retryAttempts) {
        console.warn(`ThingsBoard RPC attempt ${attempt} failed, retrying immediately...`, {
          error: lastError.message,
          deviceId,
          method
        });
        continue;
      }
      
      console.error('ThingsBoard RPC communication failed after all attempts:', lastError);
      throw lastError;
    }
  }

  // This should never be reached, but just in case
  throw lastError || new Error('ThingsBoard communication failed');
}

export async function readFromThingsBoard({
  deviceId,
  config,
}: ReadFromThingsBoard): Promise<{ status: QueueStatus; timestamp: Date }> {
  assert(deviceId, 'deviceId is required');

  initializeServices(config);

  try {
    if (!authService) {
      throw new Error('ThingsBoard authentication not configured');
    }

    // Get device attributes data (not telemetry)
    const response = await authService.makeAuthenticatedRequest(
      `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes`
    );

    if (!response.ok) {
      throw createHttpError(
        response.status,
        `ThingsBoard attributes API error: ${response.status} ${response.statusText}`
      );
    }

    const attributesData = await response.json();

    const cupSizeAttribute = attributesData.find(
      (attr: { key: string; value: unknown; lastUpdateTs: number }) => attr.key === 'cupSize'
    );
    if (!cupSizeAttribute) {
      throw new Error(`No 'cupSize' attribute found for device ${deviceId}`);
    }

    const rawValue = cupSizeAttribute.value;
    const timestamp = new Date(cupSizeAttribute.lastUpdateTs);

    let status: QueueStatus;
    if (rawValue === 0) {
      status = QueueStatus.READY;
    } else {
      status = QueueStatus.BUSY;
    }

    return { status, timestamp };
  } catch (error) {
    console.error('ThingsBoard attributes read failed:', error);
    throw error;
  }
}

export async function triggerBeerTap(deviceId: string, cupSize: number, config: ThingsBoardConfig, retryAttempts = 3): Promise<Response> {
  return await communicateWithThingsBoard({
    deviceId,
    method: 'setCupSize',
    params: cupSize,
    config,
    retryAttempts,
  });
}

export async function readBeerTapStatus(
  deviceId: string,
  config: ThingsBoardConfig
): Promise<{ status: QueueStatus; timestamp: Date }> {
  return await readFromThingsBoard({
    deviceId,
    config,
  });
}
