import assert from 'assert';
import createHttpError from 'http-errors';
import { config } from '../config/index.js';


interface MessageToBlynk {
  token: string;
  pin: string;
  value: string | number;
}

export async function communicateWithBlynk({
  token,
  pin,
  value,
}: MessageToBlynk): Promise<Response> {
  assert(token, 'token is required');
  assert(pin, 'pin is required');
  assert(value, 'value is required');

  const response = await fetch(
    `${config.blynk.server}/external/api/update?token=${token}&${pin}=${value}`
  );

  if (!response.ok) {
    throw createHttpError(
      response.status,
      `Blynk API error: ${response.status} ${response.statusText}`
    );
  }

  return response;
}

type MessageToBeerTap = Omit<MessageToBlynk, 'pin' | 'value'> & {
  pin?: string;
  value: '1' | '2' | '3';
};

export async function openBeerTap({
  token,
  value,
  pin = 'v2',
}: MessageToBeerTap) {
  console.log('Opening beer tap', { token, pin, value });
  return communicateWithBlynk({ token, pin, value });
}
