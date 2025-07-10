import { config } from '../config/index.js';
import { RedisService } from './redis.service.js';
import { StatusManager } from './status.service.js';
import { QueueIntegrationService } from './queue-integration.service.js';
import { QueueConfig } from '../types/queue.js';
import { destroyThingsBoardServices } from './thingsboard-robust.service.js';

export class QueueManagerService {
  private static instance: QueueManagerService;
  private redis: RedisService;
  private statusManager: StatusManager;
  private queueIntegration: QueueIntegrationService;
  private isInitialized = false;

  private constructor() {
    // Initialize Redis service
    this.redis = RedisService.getInstance(config.redis.url);

    // Initialize Status Manager
    this.statusManager = StatusManager.getInstance(this.redis, config.queue.pollingInterval);

    // Initialize Queue Integration Service
    this.queueIntegration = QueueIntegrationService.getInstance(this.redis, this.statusManager);
  }

  public static getInstance(): QueueManagerService {
    if (!QueueManagerService.instance) {
      QueueManagerService.instance = new QueueManagerService();
    }
    return QueueManagerService.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing Queue Manager Service...');

    // Connect to Redis
    await this.redis.connect();

    // Initialize Status Manager
    await this.statusManager.init();

    // Transform beer tap configs to include IDs
    const beerTapConfigs = config.beerTaps.map((tap, index) => ({
      id: tap.id || `beer-tap-${index}`,
      ...tap,
    }));

    // Initialize Queue Integration Service
    await this.queueIntegration.init(beerTapConfigs);

    this.isInitialized = true;
    console.log('Queue Manager Service initialized successfully');
  }

  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('Destroying Queue Manager Service...');

    await this.queueIntegration.destroy();
    await this.statusManager.destroy();
    await destroyThingsBoardServices();
    await this.redis.disconnect();

    this.isInitialized = false;
    console.log('Queue Manager Service destroyed');
  }

  public getQueueIntegration(): QueueIntegrationService {
    if (!this.isInitialized) {
      throw new Error('QueueManagerService not initialized');
    }
    return this.queueIntegration;
  }

  public getStatusManager(): StatusManager {
    if (!this.isInitialized) {
      throw new Error('QueueManagerService not initialized');
    }
    return this.statusManager;
  }

  public getRedis(): RedisService {
    return this.redis;
  }

  public isReady(): boolean {
    return this.isInitialized && this.redis.isReady();
  }

  // Helper method to process webhook transactions
  public async processWebhookTransaction(
    txHash: string,
    receiverEns: string,
    memo: string,
    currency: string,
    amount: string
  ): Promise<{ success: boolean; message: string; itemId?: string }> {
    try {
      await this.queueIntegration.processWebhookTransaction(txHash, receiverEns, memo, currency, amount);

      return {
        success: true,
        message: 'Transaction successfully queued for processing',
      };
    } catch (error) {
      console.error('Failed to process webhook transaction:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
