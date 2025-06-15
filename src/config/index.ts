import { isAddress } from 'viem';
import { z } from 'zod';

const beerTapSchema = z.object({
  transactionReceiverEns: z.string(),
  transactionMemo: z.string(),
  transactionCurrency: z.string(),
  transactionAmount: z.string(),

  blynkDeviceToken: z.string(), // blynk device token
  blynkDevicePin: z.string().refine((pin) => pin.startsWith('V'), {
    message: 'Pin must start with V',
  }), // pin to be used to trigger the beer tap
  blynkDevicePinValue: z.string(), // value to be used to trigger the beer tap
  blynkServer: z.string().url().optional().default('https://blynk.cloud'), // blynk server url
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3000'),
  YODL_INDEXER_URL: z.string().url(),
  YODL_ADDRESS: z.string().transform((address) => {
    if (!isAddress(address)) {
      throw new Error('YODL_ADDRESS is not a valid address');
    }
    return address;
  }),
  BEER_TAPS: z
    .string()
    .transform((str) => {
      try {
        return JSON.parse(str);
      } catch (e) {
        throw new Error('BEER_TAPS must be a valid JSON array');
      }
    })
    .pipe(z.array(beerTapSchema))
    .default('[]'),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(parsed.error.format(), null, 4)
    );
    process.exit(1);
  }

  return parsed.data;
}

const env = validateEnv();

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  server: {
    port: env.PORT,
  },
  yodl: {
    indexerUrl: env.YODL_INDEXER_URL,
    address: env.YODL_ADDRESS,
  },
  beerTaps: env.BEER_TAPS,
} as const;
