import { isAddress } from 'viem';
import { z } from 'zod';

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
  BEER_TAP_TOKEN: z.string(),
  RECEIVER_ENS_PRIMARY_NAME: z.string(),
  BLYNK_SERVER: z.string().url(),
  BEER_IDENTIFIER: z.string(),
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
  beerTap: {
    token: env.BEER_TAP_TOKEN,
    receiverEnsPrimaryName: env.RECEIVER_ENS_PRIMARY_NAME,
    identifier: env.BEER_IDENTIFIER,
    invoiceCurrency: 'BRL',
    // 1 BRL = 1 cup of beer, happy BTC pizza day
    beerMapping: {
      1: '1',
      2: '2',
      3: '3',
    } as const,
  },
  blynk: {
    server: env.BLYNK_SERVER,
  },
} as const;
