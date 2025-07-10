import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  QueueConfig,
  QueueEvent,
  QueueEventHandler,
  QueueItem,
  QueueMetrics,
  QueueProcessingResult,
  RetryStrategy,
} from '../../types/queue.js';
import { RedisService } from '../redis.service.js';

export class QueueService<T> extends EventEmitter {
  private redis: RedisService;
  private readonly queueName: string;
  private config: QueueConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isInitialized = false;
  private processingItems = new Map<string, QueueItem<T>>();
  private hasItemsCallback?: (hasItems: boolean) => void;

  constructor(queueName: string, redis: RedisService, config: Partial<QueueConfig> = {}) {
    super();
    this.queueName = queueName;
    this.redis = redis;
    this.config = {
      maxAttempts: config.maxAttempts || 3,
      retryStrategy: config.retryStrategy || RetryStrategy.EXPONENTIAL,
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      concurrency: config.concurrency || 1,
      statusPollingInterval: config.statusPollingInterval || 5000,
      deadLetterQueueEnabled: config.deadLetterQueueEnabled !== false,
    };
  }

  public async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!this.redis.isReady()) {
      await this.redis.connect();
    }

    this.startProcessing();
    this.startRetryProcessor();
    this.isInitialized = true;
  }

  public async destroy(): Promise<void> {
    this.stopProcessing();
    this.stopRetryProcessor();
    this.isInitialized = false;

    // Wait for any ongoing processing to complete
    await this.waitForProcessingComplete();
  }

  private async waitForProcessingComplete(): Promise<void> {
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingItems.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processQueueItems().catch(error => {
        console.error(`Error processing queue ${this.queueName}:`, error);
      });
    }, 1000);
  }

  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
  }

  private startRetryProcessor(): void {
    this.retryInterval = setInterval(() => {
      this.processRetryItems().catch(error => {
        console.error(`Error processing retry items for queue ${this.queueName}:`, error);
      });
    }, 5000);
  }

  private stopRetryProcessor(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  private async processQueueItems(): Promise<void> {
    if (this.processingItems.size >= this.config.concurrency) {
      return;
    }

    const availableSlots = this.config.concurrency - this.processingItems.size;

    for (let i = 0; i < availableSlots; i++) {
      const item = await this.redis.dequeue<T>(this.queueName);
      if (!item) {
        break;
      }

      this.processItem(item).catch(error => {
        console.error(`Error processing item ${item.id}:`, error);
      });
    }

    const queueLength = await this.getQueueLength();
    const totalItems = queueLength + this.processingItems.size;

    if (this.hasItemsCallback) {
      this.hasItemsCallback(totalItems > 0);
    }
  }

  private async processItem(item: QueueItem<T>): Promise<void> {
    if (this.processingItems.has(item.id)) {
      return;
    }

    this.processingItems.set(item.id, item);

    try {
      this.emitEvent({
        type: 'item_processing',
        queueId: this.queueName,
        itemId: item.id,
        beerTapId: item.beerTapId,
        data: item.data,
        timestamp: new Date(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Unexpected error processing item ${item.id}:`, error);

      const result: QueueProcessingResult = {
        success: false,
        itemId: item.id,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true,
      };

      await this.handleItemFailure(item, result);
    } finally {
      this.processingItems.delete(item.id);

      const queueLength = await this.getQueueLength();
      const totalItems = queueLength + this.processingItems.size;

      if (this.hasItemsCallback) {
        this.hasItemsCallback(totalItems > 0);
      }
    }
  }

  private async handleItemFailure(item: QueueItem<T>, result: QueueProcessingResult): Promise<void> {
    item.attempts++;
    item.lastAttemptAt = new Date();
    item.errors.push(result.error || 'Unknown error');

    if (item.attempts >= item.maxAttempts) {
      if (this.config.deadLetterQueueEnabled) {
        await this.redis.moveToDeadLetter(this.queueName, item);
      }

      await this.updateMetrics('failed');

      this.emitEvent({
        type: 'item_failed',
        queueId: this.queueName,
        itemId: item.id,
        beerTapId: item.beerTapId,
        data: { attempts: item.attempts, errors: item.errors },
        timestamp: new Date(),
      });
    } else if (result.shouldRetry) {
      const retryDelay = this.calculateRetryDelay(item.attempts);
      const retryAt = new Date(Date.now() + retryDelay);

      await this.redis.scheduleRetry(this.queueName, item, retryAt);

      this.emitEvent({
        type: 'item_retry',
        queueId: this.queueName,
        itemId: item.id,
        beerTapId: item.beerTapId,
        data: { retryAt, attempt: item.attempts },
        timestamp: new Date(),
      });
    }
  }

  private calculateRetryDelay(attempts: number): number {
    switch (this.config.retryStrategy) {
      case RetryStrategy.EXPONENTIAL:
        return Math.min(this.config.baseDelay * Math.pow(2, attempts - 1), this.config.maxDelay);
      case RetryStrategy.LINEAR:
        return Math.min(this.config.baseDelay * attempts, this.config.maxDelay);
      case RetryStrategy.CONSTANT:
        return this.config.baseDelay;
      default:
        return this.config.baseDelay;
    }
  }

  private async processRetryItems(): Promise<void> {
    const retryItems = await this.redis.getRetryItems<T>(this.queueName);

    for (const item of retryItems) {
      await this.redis.removeRetryItem(this.queueName, item);
      await this.redis.enqueue(this.queueName, item);
    }
  }

  private async updateMetrics(type: 'completed' | 'failed', processingTime?: number): Promise<void> {
    const metricsKey = `queue:${this.queueName}:metrics`;

    const currentMetrics = (await this.redis.getMetrics(metricsKey)) || {
      totalItems: 0,
      processingItems: 0,
      failedItems: 0,
      completedItems: 0,
      averageProcessingTime: 0,
    };

    if (type === 'completed') {
      currentMetrics.completedItems++;
      currentMetrics.totalItems++;
      if (processingTime) {
        currentMetrics.averageProcessingTime = (currentMetrics.averageProcessingTime + processingTime) / 2;
      }
      currentMetrics.lastProcessedAt = new Date();
    } else if (type === 'failed') {
      currentMetrics.failedItems++;
      currentMetrics.totalItems++;
    }

    await this.redis.setMetrics(metricsKey, currentMetrics);
  }

  private emitEvent(event: QueueEvent): void {
    this.emit('queueEvent', event);
  }

  public async enqueue(data: T, options: Partial<QueueItem<T>> = {}): Promise<string> {
    const item: QueueItem<T> = {
      id: options.id || randomUUID(),
      data,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.config.maxAttempts,
      createdAt: new Date(),
      scheduledAt: options.scheduledAt || new Date(),
      errors: [],
      beerTapId: options.beerTapId,
    };

    await this.redis.enqueue(this.queueName, item);

    this.emitEvent({
      type: 'item_added',
      queueId: this.queueName,
      itemId: item.id,
      beerTapId: item.beerTapId,
      data,
      timestamp: new Date(),
    });

    if (this.hasItemsCallback) {
      this.hasItemsCallback(true);
    }

    return item.id;
  }

  public async getQueueLength(): Promise<number> {
    return await this.redis.getQueueLength(this.queueName);
  }

  public async getMetrics(): Promise<QueueMetrics | null> {
    const metricsKey = `queue:${this.queueName}:metrics`;
    const metrics = await this.redis.getMetrics(metricsKey);

    if (metrics) {
      metrics.processingItems = this.processingItems.size;
    }

    return metrics;
  }


  public onQueueEvent(handler: QueueEventHandler): void {
    this.on('queueEvent', handler);
  }


  public setHasItemsCallback(callback: (hasItems: boolean) => void): void {
    this.hasItemsCallback = callback;
  }
}
