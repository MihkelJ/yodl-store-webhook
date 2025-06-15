import assert from 'assert';
import createHttpError from 'http-errors';

interface MessageToBlynk {
  token: string;
  pin: string;
  value: string | number;
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
  assert(value, 'value is required');

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
