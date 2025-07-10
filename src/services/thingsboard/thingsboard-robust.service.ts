import assert from 'assert';
import createHttpError from 'http-errors';
import { QueueStatus } from '../../types/queue.js';
import { ThingsBoardAuthService } from './thingsboard-auth.service.js';
import { ThingsBoardDeviceService } from './thingsboard-device.service.js';

interface ThingsBoardConfig {
  serverUrl: string;
  username: string;
  password: string;
}

interface MessageToThingsBoard {
  deviceId: string;
  method: string;
  params: number;
  config: ThingsBoardConfig;
}

interface ReadFromThingsBoard {
  deviceId: string;
  config: ThingsBoardConfig;
}

let authService: ThingsBoardAuthService | null = null;
let deviceService: ThingsBoardDeviceService | null = null;

function initializeServices(config: ThingsBoardConfig) {
  if (authService && deviceService) {
    return;
  }

  try {
    authService = new ThingsBoardAuthService(config.serverUrl, config.username, config.password);
    deviceService = new ThingsBoardDeviceService(authService);
    console.log('ThingsBoard services initialized with JWT authentication');
  } catch (error) {
    console.warn('Failed to initialize ThingsBoard JWT services:', error);
    authService = null;
    deviceService = null;
  }
}

export async function communicateWithThingsBoard({
  deviceId,
  method,
  params,
  config,
}: MessageToThingsBoard): Promise<Response> {
  assert(deviceId, 'deviceId is required');
  assert(method, 'method is required');
  assert(params !== undefined && params !== null, 'params is required');

  initializeServices(config);

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
        timeout: 5000,
      }),
    });

    if (!response.ok) {
      throw createHttpError(response.status, `ThingsBoard REST API error: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('ThingsBoard RPC communication failed:', error);
    throw error;
  }
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

    const cupSizeAttribute = attributesData.find((attr: any) => attr.key === 'cupSize');
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

export async function triggerBeerTap(deviceId: string, cupSize: number, config: ThingsBoardConfig): Promise<Response> {
  console.log(`Triggering beer tap with cup size: ${cupSize}ml`);
  console.log(`ThingsBoard REST API call: POST ${config.serverUrl}/api/rpc/oneway/${deviceId}`);
  console.log(`RPC payload: { method: 'setCupSize', params: ${cupSize} }`);

  try {
    const response = await communicateWithThingsBoard({
      deviceId,
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

export async function readBeerTapStatus(
  deviceId: string,
  config: ThingsBoardConfig
): Promise<{ status: QueueStatus; timestamp: Date }> {
  console.log(`Making new ThingsBoard status request for device ${deviceId.substring(0, 8)}...`);

  try {
    const result = await readFromThingsBoard({
      deviceId,
      config,
    });

    console.log(`ThingsBoard status response: ${result.status} at ${result.timestamp.toISOString()}`);
    return result;
  } catch (error) {
    console.error(`ThingsBoard status read error:`, error);
    throw error;
  }
}
