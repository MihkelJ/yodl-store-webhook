import { isAddress } from 'viem';
import { z } from 'zod';
import { RetryStrategy } from '../types/queue.js';

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
  
  // Redis configuration
  REDIS_URL: z.string().url(),
  
  // Development configuration
  DEV_DISABLE_AUTH: z.string().transform((val) => val === 'true').default('false'),
  DEV_DISABLE_STATUS_POLLING: z.string().transform((val) => val === 'true').default('false'),
  
  // Queue configuration
  QUEUE_MAX_ATTEMPTS: z.string().transform(Number).pipe(z.number().min(1).max(10)).default('3'),
  QUEUE_BASE_DELAY: z.string().transform(Number).pipe(z.number().min(100).max(60000)).default('1000'),
  QUEUE_MAX_DELAY: z.string().transform(Number).pipe(z.number().min(1000).max(300000)).default('30000'),
  QUEUE_CONCURRENCY: z.string().transform(Number).pipe(z.number().min(1).max(10)).default('1'),
  QUEUE_POLLING_INTERVAL: z.string().transform(Number).pipe(z.number().min(1000).max(60000)).default('5000'),
  QUEUE_RETRY_STRATEGY: z.string().default('exponential').refine((strategy) => 
    Object.values(RetryStrategy).includes(strategy as RetryStrategy), {
    message: 'Invalid retry strategy',
  }),
  QUEUE_DEAD_LETTER_ENABLED: z.string().transform((val) => val === 'true').default('true'),
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
  redis: {
    url: env.REDIS_URL,
  },
  dev: {
    disableAuth: env.DEV_DISABLE_AUTH,
    disableStatusPolling: env.DEV_DISABLE_STATUS_POLLING,
  },
  queue: {
    maxAttempts: env.QUEUE_MAX_ATTEMPTS,
    baseDelay: env.QUEUE_BASE_DELAY,
    maxDelay: env.QUEUE_MAX_DELAY,
    concurrency: env.QUEUE_CONCURRENCY,
    pollingInterval: env.QUEUE_POLLING_INTERVAL,
    retryStrategy: env.QUEUE_RETRY_STRATEGY as RetryStrategy,
    deadLetterEnabled: env.QUEUE_DEAD_LETTER_ENABLED,
  },
} as const;
