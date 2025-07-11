import { isAddress } from 'viem';
import { z } from 'zod';
import { RetryStrategy } from '../types/queue.js';

const beerTapSchema = z.object({
  id: z.string().optional(),
  transactionReceiverEns: z.string(),
  transactionMemo: z.string(),
  transactionCurrency: z.string(),
  transactionAmount: z.string(),
  thingsBoardDeviceId: z.string().min(1, 'ThingsBoard device ID cannot be empty'),
  thingsBoardCupSize: z.number().positive().default(500),
  thingsBoardServerUrl: z
    .string()
    .url('ThingsBoard server URL must be a valid URL')
    .refine(
      url => {
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
        } catch {
          return false;
        }
      },
      {
        message: 'ThingsBoard server URL must be a valid HTTP/HTTPS URL',
      }
    )
    .optional()
    .default('https://thingsboard.cloud'),
  title: z.string(),
  location: z.string(),
  description: z.string().optional(),
});

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).optional().default('3000'),
    YODL_INDEXER_URL: z.string().url().optional().default('https://tx.yodl.me/api'),
    YODL_ADDRESS: z
      .string()
      .optional()
      .default('0x66a31Aa400dd8C11f9af054c3b7bCcB783B4901B')
      .transform(address => {
        if (!isAddress(address)) {
          throw new Error('YODL_ADDRESS is not a valid address');
        }
        return address;
      }),
    BEER_TAPS: z
      .string()
      .transform(str => {
        try {
          return JSON.parse(str);
        } catch {
          throw new Error('BEER_TAPS must be a valid JSON array');
        }
      })
      .pipe(z.array(beerTapSchema))
      .default('[]'),

    // Redis configuration
    REDIS_URL: z.string().url(),

    // ThingsBoard configuration
    THINGSBOARD_SERVER_URL: z
      .string()
      .url('ThingsBoard server URL must be a valid URL')
      .refine(
        url => {
          try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
          } catch {
            return false;
          }
        },
        {
          message: 'ThingsBoard server URL must be a valid HTTP/HTTPS URL',
        }
      )
      .default('https://thingsboard.cloud'),
    THINGSBOARD_USERNAME: z
      .string()
      .optional()
      .refine(val => !val || val.trim().length > 0, {
        message: 'ThingsBoard username cannot be empty if provided',
      }),
    THINGSBOARD_PASSWORD: z
      .string()
      .optional()
      .refine(val => !val || val.trim().length > 0, {
        message: 'ThingsBoard password cannot be empty if provided',
      }),

    // Development configuration
    DEV_DISABLE_AUTH: z
      .string()
      .transform(val => val === 'true')
      .default('false'),
    DEV_DISABLE_STATUS_POLLING: z
      .string()
      .transform(val => val === 'true')
      .default('false'),

    // Queue configuration
    QUEUE_MAX_ATTEMPTS: z.string().transform(Number).pipe(z.number().min(1).max(10)).default('3'),
    QUEUE_BASE_DELAY: z.string().transform(Number).pipe(z.number().min(100).max(60000)).default('1000'),
    QUEUE_MAX_DELAY: z.string().transform(Number).pipe(z.number().min(1000).max(300000)).default('30000'),
    QUEUE_CONCURRENCY: z.string().transform(Number).pipe(z.number().min(1).max(10)).default('1'),
    QUEUE_POLLING_INTERVAL: z.string().transform(Number).pipe(z.number().min(1000).max(60000)).default('5000'),
    QUEUE_RETRY_STRATEGY: z
      .string()
      .default('exponential')
      .refine(strategy => Object.values(RetryStrategy).includes(strategy as RetryStrategy), {
        message: 'Invalid retry strategy',
      }),
    QUEUE_DEAD_LETTER_ENABLED: z
      .string()
      .transform(val => val === 'true')
      .default('true'),
    STATUS_POLLING_INTERVAL: z.string().transform(Number).pipe(z.number().min(1000).max(60000)).default('2000'),
  })
  .refine(
    data => {
      return !(!data.THINGSBOARD_USERNAME || !data.THINGSBOARD_PASSWORD);
    },
    {
      message: 'ThingsBoard authentication requires both username and password to be provided',
      path: ['THINGSBOARD_USERNAME', 'THINGSBOARD_PASSWORD'],
    }
  );

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 4));
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
  thingsBoard: {
    serverUrl: env.THINGSBOARD_SERVER_URL,
    username: env.THINGSBOARD_USERNAME,
    password: env.THINGSBOARD_PASSWORD,
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
  statusPolling: {
    interval: env.STATUS_POLLING_INTERVAL,
  },
} as const;

export function getBeerTapsByLocation(location: string) {
  return config.beerTaps.filter(tap => tap.location.toLowerCase().includes(location.toLowerCase()));
}
