import { config } from '../../config/index.js';
import { RedisService } from '../redis.service.js';
import { StatusManager } from '../status.service.js';
import { QueueIntegrationService } from './queue-integration.service.js';

export class QueueManagerService {
  private static instance: QueueManagerService;
  private redis: RedisService;
  private statusManager: StatusManager;
  private queueIntegration: QueueIntegrationService;
  private isInitialized = false;
  private hasItemsInAnyQueue = false;

  private constructor() {
    // Initialize Redis service
    this.redis = RedisService.getInstance(config.redis.url);

    // Initialize Status Manager with status polling interval
    this.statusManager = StatusManager.getInstance(this.redis, config.statusPolling.interval);

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

    // Set up polling coordination
    this.setupPollingCoordination();

    this.isInitialized = true;
    console.log('Queue Manager Service initialized successfully');
  }

  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('Destroying Queue Manager Service...');

    // Stop polling when shutting down
    await this.statusManager.stopConditionalPolling();
    
    await this.queueIntegration.destroy();
    await this.statusManager.destroy();
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

  private setupPollingCoordination(): void {
    // Set up callbacks for all queues managed by the integration service
    this.queueIntegration.setHasItemsCallback((hasItems: boolean) => {
      this.handleQueueStateChange(hasItems);
    });
  }

  private async handleQueueStateChange(hasItems: boolean): Promise<void> {
    // If state hasn't changed, do nothing
    if (this.hasItemsInAnyQueue === hasItems) {
      return;
    }

    this.hasItemsInAnyQueue = hasItems;

    if (hasItems) {
      // Start polling when we have items
      console.log('Starting status polling - queues have items');
      await this.statusManager.startConditionalPolling();
    } else {
      // Stop polling when all queues are empty
      console.log('Stopping status polling - all queues are empty');
      await this.statusManager.stopConditionalPolling();
    }
  }
}
