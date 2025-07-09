import { z } from 'zod';
import { QueueStatus, RetryStrategy } from '../types/queue.js';

// Queue configuration schemas
export const retryStrategySchema = z.nativeEnum(RetryStrategy);

export const queueConfigSchema = z.object({
  maxAttempts: z.number().min(1).max(10).default(3),
  retryStrategy: retryStrategySchema.default(RetryStrategy.EXPONENTIAL),
  baseDelay: z.number().min(100).max(60000).default(1000), // 100ms to 60s
  maxDelay: z.number().min(1000).max(300000).default(30000), // 1s to 5min
  concurrency: z.number().min(1).max(10).default(1),
  statusPollingInterval: z.number().min(1000).max(60000).default(5000), // 1s to 60s
  deadLetterQueueEnabled: z.boolean().default(true),
});

// Queue item schemas
export const queueItemSchema = z.object({
  id: z.string().uuid(),
  data: z.any(),
  attempts: z.number().min(0),
  maxAttempts: z.number().min(1),
  createdAt: z.date(),
  scheduledAt: z.date(),
  lastAttemptAt: z.date().optional(),
  errors: z.array(z.string()),
  beerTapId: z.string().optional(),
});

export const beerTapQueueItemSchema = z.object({
  transactionHash: z.string().min(1),
  beerTapId: z.string().min(1),
  receiverEns: z.string().min(1),
  memo: z.string().min(1),
  currency: z.string().min(1),
  amount: z.string().min(1),
  timestamp: z.date(),
});

// Status schemas
export const queueStatusSchema = z.nativeEnum(QueueStatus);

export const statusChangeEventSchema = z.object({
  beerTapId: z.string().min(1),
  previousStatus: queueStatusSchema,
  currentStatus: queueStatusSchema,
  timestamp: z.date(),
});

export const blynkStatusResponseSchema = z.object({
  status: queueStatusSchema,
  timestamp: z.date(),
  success: z.boolean(),
  error: z.string().optional(),
});

// Queue event schemas
export const queueEventTypeSchema = z.enum([
  'item_added',
  'item_processing',
  'item_completed',
  'item_failed',
  'item_retry',
  'status_changed',
]);

export const queueEventSchema = z.object({
  type: queueEventTypeSchema,
  queueId: z.string().min(1),
  itemId: z.string().optional(),
  beerTapId: z.string().optional(),
  data: z.any().optional(),
  timestamp: z.date(),
});

// Queue metrics schemas
export const queueMetricsSchema = z.object({
  totalItems: z.number().min(0),
  processingItems: z.number().min(0),
  failedItems: z.number().min(0),
  completedItems: z.number().min(0),
  averageProcessingTime: z.number().min(0),
  lastProcessedAt: z.date().optional(),
});

// Queue processing result schemas
export const queueProcessingResultSchema = z.object({
  success: z.boolean(),
  itemId: z.string().min(1),
  processingTime: z.number().min(0),
  error: z.string().optional(),
  shouldRetry: z.boolean(),
});

// Redis connection schema
export const redisConfigSchema = z.object({
  url: z.string().url(),
  maxReconnectAttempts: z.number().min(1).max(100).default(10),
  reconnectDelay: z.number().min(100).max(30000).default(1000),
  commandTimeout: z.number().min(1000).max(60000).default(5000),
});

// Beer tap configuration schema (enhanced from existing)
export const beerTapConfigSchema = z.object({
  id: z.string().min(1),
  transactionReceiverEns: z.string().min(1),
  transactionMemo: z.string().min(1),
  transactionCurrency: z.string().min(1),
  transactionAmount: z.string().min(1),
  blynkDeviceToken: z.string().min(1),
  blynkDevicePin: z.string().refine((pin) => pin.startsWith('V'), {
    message: 'Pin must start with V',
  }),
  blynkDevicePinValue: z.string().min(1),
  blynkServer: z.string().url().default('https://blynk.cloud'),
  // Queue-specific settings
  queueConfig: queueConfigSchema.optional(),
  statusPollingInterval: z.number().min(1000).max(60000).default(5000),
});

// Queue integration service configuration
export const queueIntegrationConfigSchema = z.object({
  redisUrl: z.string().url(),
  beerTaps: z.array(beerTapConfigSchema),
  defaultQueueConfig: queueConfigSchema.optional(),
  globalStatusPollingInterval: z.number().min(1000).max(60000).default(5000),
  enableMetrics: z.boolean().default(true),
  enableDeadLetterQueue: z.boolean().default(true),
});

// Environment variable validation for queue system
export const queueEnvSchema = z.object({
  REDIS_URL: z.string().url(),
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

// API request/response schemas
export const enqueueRequestSchema = z.object({
  data: z.any(),
  beerTapId: z.string().optional(),
  maxAttempts: z.number().min(1).max(10).optional(),
  scheduledAt: z.date().optional(),
});

export const enqueueResponseSchema = z.object({
  itemId: z.string().uuid(),
  queueId: z.string(),
  enqueuedAt: z.date(),
});

export const queueStatusResponseSchema = z.object({
  queueId: z.string(),
  length: z.number().min(0),
  processingItems: z.number().min(0),
  status: queueStatusSchema,
  lastProcessedAt: z.date().optional(),
});

export const beerTapStatusResponseSchema = z.object({
  beerTapId: z.string(),
  status: queueStatusSchema,
  queueLength: z.number().min(0),
  lastStatusUpdate: z.date(),
  isOnline: z.boolean(),
});

// Validation helper functions
export function validateQueueConfig(config: unknown): z.infer<typeof queueConfigSchema> {
  return queueConfigSchema.parse(config);
}

export function validateBeerTapConfig(config: unknown): z.infer<typeof beerTapConfigSchema> {
  return beerTapConfigSchema.parse(config);
}

export function validateQueueItem(item: unknown): z.infer<typeof queueItemSchema> {
  return queueItemSchema.parse(item);
}

export function validateBeerTapQueueItem(item: unknown): z.infer<typeof beerTapQueueItemSchema> {
  return beerTapQueueItemSchema.parse(item);
}

export function validateQueueEvent(event: unknown): z.infer<typeof queueEventSchema> {
  return queueEventSchema.parse(event);
}

export function validateStatusChangeEvent(event: unknown): z.infer<typeof statusChangeEventSchema> {
  return statusChangeEventSchema.parse(event);
}

export function validateRedisConfig(config: unknown): z.infer<typeof redisConfigSchema> {
  return redisConfigSchema.parse(config);
}

export function validateQueueIntegrationConfig(config: unknown): z.infer<typeof queueIntegrationConfigSchema> {
  return queueIntegrationConfigSchema.parse(config);
}

// Type exports for TypeScript
export type QueueConfig = z.infer<typeof queueConfigSchema>;
export type BeerTapConfig = z.infer<typeof beerTapConfigSchema>;
export type QueueItem = z.infer<typeof queueItemSchema>;
export type BeerTapQueueItem = z.infer<typeof beerTapQueueItemSchema>;
export type QueueEvent = z.infer<typeof queueEventSchema>;
export type StatusChangeEvent = z.infer<typeof statusChangeEventSchema>;
export type QueueMetrics = z.infer<typeof queueMetricsSchema>;
export type QueueProcessingResult = z.infer<typeof queueProcessingResultSchema>;
export type RedisConfig = z.infer<typeof redisConfigSchema>;
export type QueueIntegrationConfig = z.infer<typeof queueIntegrationConfigSchema>;
export type EnqueueRequest = z.infer<typeof enqueueRequestSchema>;
export type EnqueueResponse = z.infer<typeof enqueueResponseSchema>;
export type QueueStatusResponse = z.infer<typeof queueStatusResponseSchema>;
export type BeerTapStatusResponse = z.infer<typeof beerTapStatusResponseSchema>;