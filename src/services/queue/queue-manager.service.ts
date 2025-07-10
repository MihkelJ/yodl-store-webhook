import { config } from '../../config/index.js';
import { Payment } from '../../types/transaction.js';
import { RedisService } from '../redis.service.js';
import { StatusManager } from '../status.service.js';
import { QueueIntegrationService } from './queue-integration.service.js';

export class QueueManagerService {
  private static instance: QueueManagerService;
  private readonly redis: RedisService;
  private readonly statusManager: StatusManager;
  private queueIntegration: QueueIntegrationService;
  private isInitialized = false;
  private hasItemsInAnyQueue = false;

  private constructor() {
    this.redis = RedisService.getInstance(config.redis.url);

    this.statusManager = StatusManager.getInstance(this.redis, config.statusPolling.interval);

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

    await this.redis.connect();
    await this.statusManager.init();

    const beerTapConfigs = config.beerTaps.map((tap, index) => ({
      id: tap.id || `beer-tap-${index}`,
      ...tap,
    }));

    await this.queueIntegration.init(beerTapConfigs);

    this.setupPollingCoordination();

    this.isInitialized = true;
  }

  public async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.statusManager.stopConditionalPolling();

    await this.queueIntegration.destroy();
    await this.statusManager.destroy();
    await this.redis.disconnect();

    this.isInitialized = false;
  }




  public isReady(): boolean {
    return this.isInitialized && this.redis.isReady();
  }

  public async processWebhookTransaction(transaction: Payment): Promise<{ success: boolean; message: string }> {
    try {
      await this.queueIntegration.processWebhookTransaction(transaction);

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
    this.queueIntegration.setHasItemsCallback((hasItems: boolean) => {
      this.handleQueueStateChange(hasItems);
    });
  }

  private async handleQueueStateChange(hasItems: boolean): Promise<void> {
    if (this.hasItemsInAnyQueue === hasItems) {
      return;
    }

    this.hasItemsInAnyQueue = hasItems;

    if (hasItems) {
      await this.statusManager.startConditionalPolling();
    } else {
      await this.statusManager.stopConditionalPolling();
    }
  }
}
