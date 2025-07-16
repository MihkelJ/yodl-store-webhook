import { createClient, RedisClientType } from 'redis';
import { QueueItem, QueueMetrics, QueueStatus } from '../types/queue.js';

export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 1000;

  private constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: retries => {
          if (retries > this.maxReconnectAttempts) {
            return false;
          }
          return Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
        },
      },
    });

    this.setupEventHandlers();
  }

  public static getInstance(redisUrl: string): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService(redisUrl);
    }
    return RedisService.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('error', () => {
      this.isConnected = false;
    });

    this.client.on('end', () => {
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    await this.client.connect();
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  public isReady(): boolean {
    return this.isConnected && this.client.isReady;
  }

  public async enqueue<T>(queueName: string, item: QueueItem<T>): Promise<void> {
    const serializedItem = JSON.stringify(item);
    await this.client.lPush(queueName, serializedItem);

    await this.client.hSet(`queue:${queueName}:metadata:${item.id}`, {
      id: item.id,
      attempts: item.attempts.toString(),
      maxAttempts: item.maxAttempts.toString(),
      createdAt: item.createdAt.toISOString(),
      scheduledAt: item.scheduledAt.toISOString(),
      beerTapId: item.beerTapId || '',
    });
  }

  public async dequeue<T>(queueName: string): Promise<QueueItem<T> | null> {
    const serializedItem = await this.client.rPop(queueName);
    if (!serializedItem) {
      return null;
    }

    try {
      const item = JSON.parse(serializedItem) as QueueItem<T>;
      item.createdAt = new Date(item.createdAt);
      item.scheduledAt = new Date(item.scheduledAt);
      if (item.lastAttemptAt) {
        item.lastAttemptAt = new Date(item.lastAttemptAt);
      }
      return item;
    } catch {
      return null;
    }
  }

  public async getQueueLength(queueName: string): Promise<number> {
    return await this.client.lLen(queueName);
  }

  public async peekQueue<T>(queueName: string, count = 1): Promise<QueueItem<T>[]> {
    const items = await this.client.lRange(queueName, -count, -1);
    return items.map(item => {
      const parsed = JSON.parse(item) as QueueItem<T>;
      parsed.createdAt = new Date(parsed.createdAt);
      parsed.scheduledAt = new Date(parsed.scheduledAt);
      if (parsed.lastAttemptAt) {
        parsed.lastAttemptAt = new Date(parsed.lastAttemptAt);
      }
      return parsed;
    });
  }

  public async scheduleRetry<T>(queueName: string, item: QueueItem<T>, retryAt: Date): Promise<void> {
    const serializedItem = JSON.stringify(item);
    await this.client.zAdd(`${queueName}:retry`, {
      score: retryAt.getTime(),
      value: serializedItem,
    });
  }

  public async getRetryItems<T>(queueName: string, beforeTime = Date.now()): Promise<QueueItem<T>[]> {
    const items = await this.client.zRangeByScore(`${queueName}:retry`, 0, beforeTime);
    const parsedItems: QueueItem<T>[] = [];

    for (const item of items) {
      try {
        const parsed = JSON.parse(item) as QueueItem<T>;
        parsed.createdAt = new Date(parsed.createdAt);
        parsed.scheduledAt = new Date(parsed.scheduledAt);
        if (parsed.lastAttemptAt) {
          parsed.lastAttemptAt = new Date(parsed.lastAttemptAt);
        }
        parsedItems.push(parsed);
      } catch {
        // Ignore
      }
    }

    return parsedItems;
  }

  public async removeRetryItem(queueName: string, item: QueueItem): Promise<void> {
    const serializedItem = JSON.stringify(item);
    await this.client.zRem(`${queueName}:retry`, serializedItem);
  }

  public async moveToDeadLetter<T>(queueName: string, item: QueueItem<T>): Promise<void> {
    const serializedItem = JSON.stringify(item);
    await this.client.lPush(`${queueName}:dead`, serializedItem);
  }

  public async setStatus(key: string, status: QueueStatus, ttl?: number): Promise<void> {
    await this.client.set(key, status.toString());
    if (ttl) {
      await this.client.expire(key, ttl);
    }
  }

  public async getStatus(key: string): Promise<QueueStatus | null> {
    const status = await this.client.get(key);
    if (!status) return null;

    const parsedStatus = parseInt(status);
    return isNaN(parsedStatus) ? null : (parsedStatus as QueueStatus);
  }

  public async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  public async setMetrics(key: string, metrics: QueueMetrics): Promise<void> {
    await this.client.hSet(key, {
      totalItems: metrics.totalItems.toString(),
      processingItems: metrics.processingItems.toString(),
      failedItems: metrics.failedItems.toString(),
      completedItems: metrics.completedItems.toString(),
      averageProcessingTime: metrics.averageProcessingTime.toString(),
      lastProcessedAt: metrics.lastProcessedAt?.toISOString() || '',
    });
  }

  public async getMetrics(key: string): Promise<QueueMetrics | null> {
    const metrics = await this.client.hGetAll(key);
    if (Object.keys(metrics).length === 0) {
      return null;
    }

    return {
      totalItems: parseInt(metrics.totalItems) || 0,
      processingItems: parseInt(metrics.processingItems) || 0,
      failedItems: parseInt(metrics.failedItems) || 0,
      completedItems: parseInt(metrics.completedItems) || 0,
      averageProcessingTime: parseFloat(metrics.averageProcessingTime) || 0,
      lastProcessedAt: metrics.lastProcessedAt ? new Date(metrics.lastProcessedAt) : undefined,
    };
  }

  // Additional methods for Self.xyz verification caching
  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.client.setEx(key, ttl, value);
  }

  public async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
