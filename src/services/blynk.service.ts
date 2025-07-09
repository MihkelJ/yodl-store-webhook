import assert from 'assert';
import createHttpError from 'http-errors';
import { QueueStatus, BlynkStatusResponse } from '../types/queue.js';

interface MessageToBlynk {
  token: string;
  pin: string;
  value: string | number;
  server: string;
}

interface ReadFromBlynk {
  token: string;
  pin: string;
  server: string;
}

export async function communicateWithBlynk({
  token,
  pin,
  value,
  server,
}: MessageToBlynk): Promise<Response> {
  assert(token, 'token is required');
  assert(pin, 'pin is required');
  assert(value !== undefined && value !== null, 'value is required');

  const response = await fetch(
    `${server}/external/api/update?token=${token}&${pin}=${value}`
  );

  if (!response.ok) {
    throw createHttpError(
      response.status,
      `Blynk API error: ${response.status} ${response.statusText}`
    );
  }

  return response;
}

export async function readFromBlynk({
  token,
  pin,
  server,
}: ReadFromBlynk): Promise<BlynkStatusResponse> {
  assert(token, 'token is required');
  assert(pin, 'pin is required');
  assert(server, 'server is required');

  const timestamp = new Date();

  try {
    const response = await fetch(
      `${server}/external/api/get?token=${token}&${pin}`
    );

    if (!response.ok) {
      throw createHttpError(
        response.status,
        `Blynk API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    
    console.log('Blynk API response:', JSON.stringify(data), 'Type:', typeof data);
    
    // Blynk can return various formats:
    // - Array: ["0"] or ["1"] 
    // - Single value: "0" or "1" or 0 or 1
    // - Object with value property
    let pinValue: string | null = null;
    
    if (Array.isArray(data) && data.length > 0) {
      pinValue = String(data[0]);
    } else if (typeof data === 'string' || typeof data === 'number') {
      pinValue = String(data);
    } else if (data && typeof data === 'object' && data.value !== undefined) {
      pinValue = String(data.value);
    } else {
      console.error('Unexpected Blynk API response format:', data);
      throw new Error(`Invalid response format from Blynk API: ${JSON.stringify(data)}`);
    }

    console.log('Parsed pin value:', pinValue);

    // Convert to QueueStatus (1 = READY/available, 0 = BUSY)
    const numericValue = parseInt(pinValue);
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
      console.warn(`Unexpected status value from Blynk V5 pin: ${pinValue}, defaulting to BUSY for safety`);
      return {
        status: QueueStatus.BUSY,
        timestamp,
        success: true,
      };
    }
  } catch (error) {
    console.error('Error reading from Blynk:', error);
    
    return {
      status: QueueStatus.ERROR,
      timestamp,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function readBeerTapStatus({
  token,
  server,
}: {
  token: string;
  server: string;
}): Promise<BlynkStatusResponse> {
  return readFromBlynk({
    token,
    pin: 'V5', // READY_BUSY_PIN is always V5
    server,
  });
}

export async function setBeerTapStatus({
  token,
  server,
  status,
}: {
  token: string;
  server: string;
  status: QueueStatus.READY | QueueStatus.BUSY;
}): Promise<Response> {
  // Convert QueueStatus to Blynk values: READY = 1, BUSY = 0
  const blynkValue = status === QueueStatus.READY ? 1 : 0;
  console.log(`Setting beer tap status: ${status} -> V5=${blynkValue}`);
  
  return communicateWithBlynk({
    token,
    pin: 'V5', // READY_BUSY_PIN is always V5
    value: blynkValue,
    server,
  });
}
