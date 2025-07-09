import assert from 'assert';
import createHttpError from 'http-errors';
import { QueueStatus, ThingsBoardStatusResponse } from '../types/queue.js';
import { ThingsBoardAuthService } from './thingsboard-auth.service.js';
import { ThingsBoardDeviceService } from './thingsboard-device.service.js';

interface ThingsBoardConfig {
  serverUrl: string;
  username?: string;
  password?: string;
}

interface MessageToThingsBoard {
  deviceToken: string;
  method: string;
  params: number;
  config: ThingsBoardConfig;
}

interface ReadFromThingsBoard {
  deviceToken: string;
  config: ThingsBoardConfig;
}

let authService: ThingsBoardAuthService | null = null;
let deviceService: ThingsBoardDeviceService | null = null;
let jwtAuthDisabled = false; // Disable JWT auth after repeated failures

function initializeServices(config: ThingsBoardConfig): void {
  if (!authService && config.username && config.password) {
    try {
      authService = ThingsBoardAuthService.getInstance({
        username: config.username,
        password: config.password,
        serverUrl: config.serverUrl,
      });
      
      deviceService = ThingsBoardDeviceService.getInstance(authService);
      console.log('ThingsBoard services initialized with JWT authentication');
    } catch (error) {
      console.warn('Failed to initialize ThingsBoard JWT services:', error);
      authService = null;
      deviceService = null;
    }
  }
}

export async function communicateWithThingsBoard({
  deviceToken,
  method,
  params,
  config,
}: MessageToThingsBoard): Promise<Response> {
  assert(deviceToken, 'deviceToken is required');
  assert(method, 'method is required');
  assert(params !== undefined && params !== null, 'params is required');

  initializeServices(config);

  try {
    if (!authService || !deviceService) {
      console.warn('ThingsBoard authentication not configured, falling back to device HTTP API');
      
      // Fallback to device HTTP API
      const response = await fetch(`${config.serverUrl}/api/v1/${deviceToken}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw createHttpError(
          response.status,
          `ThingsBoard Device API error: ${response.status} ${response.statusText}`
        );
      }

      return response;
    }

    // Use REST API with JWT authentication
    const deviceId = await deviceService.getDeviceIdByAccessToken(deviceToken);
    
    if (!deviceId) {
      console.warn(`Device not found for access token: ${deviceToken.substring(0, 8)}..., falling back to device HTTP API`);
      
      // Fallback to device HTTP API
      console.log(`Fallback HTTP API call: POST ${config.serverUrl}/api/v1/${deviceToken}/rpc`);
      const response = await fetch(`${config.serverUrl}/api/v1/${deviceToken}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          params,
        }),
      });

      console.log(`Fallback HTTP API response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Fallback API error response: ${errorText}`);
        throw createHttpError(
          response.status,
          `ThingsBoard Device API fallback error: ${response.status} ${response.statusText}`
        );
      }

      console.log('Fallback HTTP API call succeeded!');
      return response;
    }

    const response = await authService.makeAuthenticatedRequest(`/api/plugins/rpc/twoway/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify({
        method,
        params,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      throw createHttpError(
        response.status,
        `ThingsBoard REST API error: ${response.status} ${response.statusText}`
      );
    }

    return response;
    
  } catch (error) {
    console.error('ThingsBoard RPC communication failed:', error);
    
    // Last resort fallback - try device HTTP API even if JWT was configured
    if (authService && deviceService) {
      console.warn('Attempting final fallback to device HTTP API...');
      try {
        const response = await fetch(`${config.serverUrl}/api/v1/${deviceToken}/rpc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method,
            params,
          }),
        });

        if (!response.ok) {
          throw createHttpError(
            response.status,
            `ThingsBoard Device API final fallback error: ${response.status} ${response.statusText}`
          );
        }

        console.log('Final fallback to device HTTP API succeeded');
        return response;
      } catch (fallbackError) {
        console.error('Final fallback also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
    
    throw error;
  }
}

export async function readFromThingsBoard({
  deviceToken,
  config,
}: ReadFromThingsBoard): Promise<ThingsBoardStatusResponse> {
  assert(deviceToken, 'deviceToken is required');

  const timestamp = new Date();
  initializeServices(config);

  try {
    if (!authService || !deviceService) {
      console.warn('ThingsBoard authentication not configured, assuming READY status');
      return {
        status: QueueStatus.READY,
        timestamp,
        success: true,
      };
    }

    const deviceId = await deviceService.getDeviceIdByAccessToken(deviceToken);
    
    if (!deviceId) {
      console.warn(`Device not found for access token: ${deviceToken.substring(0, 8)}..., assuming READY status`);
      return {
        status: QueueStatus.READY,
        timestamp,
        success: true,
      };
    }

    // Get latest telemetry data for the 'ready' key
    const response = await authService.makeAuthenticatedRequest(
      `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=ready&limit=1`
    );

    if (!response.ok) {
      console.warn(`Failed to read telemetry data: ${response.status} ${response.statusText}, assuming READY status`);
      return {
        status: QueueStatus.READY,
        timestamp,
        success: true,
      };
    }

    const data = await response.json();
    console.log('ThingsBoard telemetry response:', JSON.stringify(data));
    
    // Parse telemetry response
    // Expected format: { "ready": [{"ts": 1234567890, "value": "1"}] }
    let statusValue: string | null = null;
    
    if (data && data.ready && Array.isArray(data.ready) && data.ready.length > 0) {
      statusValue = String(data.ready[0].value);
    } else {
      console.warn('No ready telemetry data found, assuming READY status');
      return {
        status: QueueStatus.READY,
        timestamp,
        success: true,
      };
    }

    console.log('Parsed status value:', statusValue);

    // Convert to QueueStatus (1 = READY/available, 0 = BUSY)
    const numericValue = parseInt(statusValue);
    console.log('Numeric value:', numericValue);
    
    if (numericValue === 1) {
      return {
        status: QueueStatus.READY,
        timestamp,
        success: true,
      };
    } else if (numericValue === 0) {
      return {
        status: QueueStatus.BUSY,
        timestamp,
        success: true,
      };
    } else {
      console.warn(`Unexpected status value from ThingsBoard: ${statusValue}, defaulting to READY for safety`);
      return {
        status: QueueStatus.READY,
        timestamp,
        success: true,
      };
    }
    
  } catch (error) {
    console.error('Error reading from ThingsBoard:', error);
    
    // Graceful fallback - assume READY status if we can't read telemetry
    console.warn('Falling back to READY status due to error');
    return {
      status: QueueStatus.READY,
      timestamp,
      success: true,
    };
  }
}

export async function readBeerTapStatus({
  deviceToken,
  config,
}: {
  deviceToken: string;
  config: ThingsBoardConfig;
}): Promise<ThingsBoardStatusResponse> {
  return readFromThingsBoard({
    deviceToken,
    config,
  });
}

export async function setBeerTapStatus({
  deviceToken,
  config,
  status,
}: {
  deviceToken: string;
  config: ThingsBoardConfig;
  status: QueueStatus.READY | QueueStatus.BUSY;
}): Promise<Response> {
  console.log(`Setting beer tap status: ${status}`);
  
  initializeServices(config);

  try {
    if (!authService || !deviceService) {
      console.warn('ThingsBoard authentication not configured, skipping status update');
      return new Response('OK', { status: 200 });
    }

    const deviceId = await deviceService.getDeviceIdByAccessToken(deviceToken);
    
    if (!deviceId) {
      console.warn(`Device not found for access token: ${deviceToken.substring(0, 8)}..., skipping status update`);
      return new Response('OK', { status: 200 });
    }

    // Send telemetry data to update the status
    const thingsBoardValue = status === QueueStatus.READY ? 1 : 0;
    
    const response = await authService.makeAuthenticatedRequest(`/api/plugins/telemetry/DEVICE/${deviceId}/TS_KV_OTHER`, {
      method: 'POST',
      body: JSON.stringify({
        ready: thingsBoardValue,
      }),
    });

    if (!response.ok) {
      console.warn(`Failed to update device status: ${response.status} ${response.statusText}`);
    }

    return response;
    
  } catch (error) {
    console.error('Error setting beer tap status:', error);
    // Don't throw error, just log it
    return new Response('OK', { status: 200 });
  }
}

export async function triggerBeerTap({
  deviceToken,
  config,
  cupSize,
}: {
  deviceToken: string;
  config: ThingsBoardConfig;
  cupSize: number;
}): Promise<Response> {
  console.log(`Triggering beer tap with cup size: ${cupSize}ml`);
  
  if (config.username && config.password) {
    console.log(`ThingsBoard REST API call: POST ${config.serverUrl}/api/plugins/rpc/twoway/{deviceId}`);
  } else {
    console.log(`ThingsBoard Device API call: POST ${config.serverUrl}/api/v1/${deviceToken}/rpc`);
  }
  
  console.log(`RPC payload: { method: 'setCupSize', params: ${cupSize} }`);
  
  try {
    const response = await communicateWithThingsBoard({
      deviceToken,
      method: 'setCupSize',
      params: cupSize,
      config,
    });
    
    console.log(`ThingsBoard RPC response: ${response.status} ${response.statusText}`);
    return response;
    
  } catch (error) {
    console.error(`ThingsBoard RPC error:`, error);
    throw error;
  }
}

export async function destroyThingsBoardServices(): Promise<void> {
  if (authService) {
    await authService.destroy();
    authService = null;
  }
  
  deviceService = null;
  console.log('ThingsBoard services destroyed');
}