import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  QueueItem,
  QueueConfig,
  QueueStatus,
  RetryStrategy,
  QueueEvent,
  QueueEventHandler,
  QueueProcessingResult,
  QueueMetrics,
  BeerTapQueueItem,
} from '../types/queue.js';
import { RedisService } from './redis.service.js';
import { StatusManager } from './status.service.js';

export class QueueService<T = any> extends EventEmitter {
  private redis: RedisService;
  private statusManager: StatusManager;
  private queueName: string;
  private config: QueueConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isInitialized = false;
  private processingItems = new Map<string, QueueItem<T>>();

  constructor(queueName: string, redis: RedisService, statusManager: StatusManager, config: Partial<QueueConfig> = {}) {
    super();
    this.queueName = queueName;
    this.redis = redis;
    this.statusManager = statusManager;
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

    console.log(`Initializing Queue Service: ${this.queueName}`);

    if (!this.redis.isReady()) {
      await this.redis.connect();
    }

    this.startProcessing();
    this.startRetryProcessor();
    this.isInitialized = true;

    console.log(`Queue Service initialized: ${this.queueName}`);
  }

  public async destroy(): Promise<void> {
    console.log(`Destroying Queue Service: ${this.queueName}`);

    this.stopProcessing();
    this.stopRetryProcessor();
    this.isInitialized = false;

    // Wait for any ongoing processing to complete
    await this.waitForProcessingComplete();

    console.log(`Queue Service destroyed: ${this.queueName}`);
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
    }, 1000); // Check every second
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
    }, 5000); // Check every 5 seconds
  }

  private stopRetryProcessor(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  private async processQueueItems(): Promise<void> {
    if (this.processingItems.size >= this.config.concurrency) {
      return; // Already at max concurrency
    }

    const availableSlots = this.config.concurrency - this.processingItems.size;

    for (let i = 0; i < availableSlots; i++) {
      const item = await this.redis.dequeue<T>(this.queueName);
      if (!item) {
        break; // No more items in queue
      }

      this.processItem(item).catch(error => {
        console.error(`Error processing item ${item.id}:`, error);
      });
    }
  }

  private async processItem(item: QueueItem<T>): Promise<void> {
    // Check if this item is already being processed
    if (this.processingItems.has(item.id)) {
      console.log(`Item ${item.id} is already being processed, skipping`);
      return;
    }

    this.processingItems.set(item.id, item);

    try {
      console.log(`Starting to process item ${item.id} for beer tap ${item.beerTapId}`);

      // Emit processing event for integration service
      this.emitEvent({
        type: 'item_processing',
        queueId: this.queueName,
        itemId: item.id,
        beerTapId: item.beerTapId,
        data: item.data,
        timestamp: new Date(),
      });

      // The actual processing logic is handled by the integration service
      // We just mark it as successful here since the integration service
      // will handle the beer tap logic and any failures will throw errors
      const result: QueueProcessingResult = {
        success: true,
        itemId: item.id,
        processingTime: 100, // Placeholder
        shouldRetry: false,
      };

      await this.handleItemSuccess(item, result);
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
    }
  }

  private async processItemLogic(item: QueueItem<T>): Promise<QueueProcessingResult> {
    const startTime = Date.now();

    try {
      // This is where the actual processing logic would go
      // For now, we'll emit an event that the integration service can handle
      this.emitEvent({
        type: 'item_processing',
        queueId: this.queueName,
        itemId: item.id,
        beerTapId: item.beerTapId,
        data: item.data,
        timestamp: new Date(),
      });

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        itemId: item.id,
        processingTime: Date.now() - startTime,
        shouldRetry: false,
      };
    } catch (error) {
      return {
        success: false,
        itemId: item.id,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true,
      };
    }
  }

  private async handleItemSuccess(item: QueueItem<T>, result: QueueProcessingResult): Promise<void> {
    console.log(`Successfully processed item ${item.id} in ${result.processingTime}ms`);

    // Update metrics
    await this.updateMetrics('completed', result.processingTime);

    this.emitEvent({
      type: 'item_completed',
      queueId: this.queueName,
      itemId: item.id,
      beerTapId: item.beerTapId,
      data: result,
      timestamp: new Date(),
    });
  }

  private async handleItemFailure(item: QueueItem<T>, result: QueueProcessingResult): Promise<void> {
    item.attempts++;
    item.lastAttemptAt = new Date();
    item.errors.push(result.error || 'Unknown error');

    console.log(`Failed to process item ${item.id} (attempt ${item.attempts}/${item.maxAttempts}): ${result.error}`);

    if (item.attempts >= item.maxAttempts) {
      // Max attempts reached, move to dead letter queue
      if (this.config.deadLetterQueueEnabled) {
        await this.redis.moveToDeadLetter(this.queueName, item);
        console.log(`Moved item ${item.id} to dead letter queue after ${item.attempts} attempts`);
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
      // Schedule retry
      const retryDelay = this.calculateRetryDelay(item.attempts);
      const retryAt = new Date(Date.now() + retryDelay);

      await this.redis.scheduleRetry(this.queueName, item, retryAt);
      console.log(`Scheduled retry for item ${item.id} at ${retryAt.toISOString()}`);

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
      // Remove from retry queue and add back to main queue
      await this.redis.removeRetryItem(this.queueName, item);
      await this.redis.enqueue(this.queueName, item);

      console.log(`Moved item ${item.id} from retry queue back to main queue`);
    }
  }

  private async requeueItem(item: QueueItem<T>): Promise<void> {
    // Add a small delay before requeuing
    const retryAt = new Date(Date.now() + 5000); // 5 seconds
    await this.redis.scheduleRetry(this.queueName, item, retryAt);
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

  // Public API methods
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

    console.log(`Enqueued item ${item.id} to queue ${this.queueName}`);
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

  public async peek(count = 1): Promise<QueueItem<T>[]> {
    return await this.redis.peekQueue(this.queueName, count);
  }

  public onQueueEvent(handler: QueueEventHandler): void {
    this.on('queueEvent', handler);
  }

  public offQueueEvent(handler: QueueEventHandler): void {
    this.off('queueEvent', handler);
  }

  public getConfig(): QueueConfig {
    return { ...this.config };
  }

  public async clearQueue(): Promise<void> {
    // This would clear the entire queue - use with caution
    const queueLength = await this.getQueueLength();
    for (let i = 0; i < queueLength; i++) {
      await this.redis.dequeue(this.queueName);
    }
    console.log(`Cleared queue ${this.queueName}`);
  }
}
