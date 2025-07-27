import { EventEmitter } from 'events';
import { config as appConfig } from '../../config/index.js';
import {
  BeerTapQueueItem,
  QueueConfig,
  QueueEvent,
  QueueItem,
  QueueProcessingResult,
  QueueStatus,
  StatusChangeEvent,
} from '../../types/queue.js';
import { Payment } from '../../types/transaction.js';
import { RedisService } from '../redis.service.js';
import { StatusManager } from '../status.service.js';
import { triggerBeerTap } from '../thingsboard/thingsboard-robust.service.js';
import { QueueService } from './queue.service.js';

interface BeerTapConfig {
  id: string;
  transactionReceiverEns: string;
  transactionMemo: string;
  transactionCurrency: string;
  transactionAmount: string;
  thingsBoardDeviceId: string;
  thingsBoardCupSize: number;
  thingsBoardServerUrl: string;
}

export class QueueIntegrationService extends EventEmitter {
  private static instance: QueueIntegrationService;
  private redis: RedisService;
  private statusManager: StatusManager;
  private beerTapQueues = new Map<string, QueueService<BeerTapQueueItem>>();
  private beerTapConfigs = new Map<string, BeerTapConfig>();
  private isInitialized = false;
  private hasItemsCallback?: (hasItems: boolean) => void;

  private constructor(redis: RedisService, statusManager: StatusManager) {
    super();
    this.redis = redis;
    this.statusManager = statusManager;
  }

  public static getInstance(redis: RedisService, statusManager: StatusManager): QueueIntegrationService {
    if (!QueueIntegrationService.instance) {
      QueueIntegrationService.instance = new QueueIntegrationService(redis, statusManager);
    }
    return QueueIntegrationService.instance;
  }

  public async init(beerTapConfigs: BeerTapConfig[]): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    for (const config of beerTapConfigs) {
      this.beerTapConfigs.set(config.id, config);
    }

    await this.initializeStatusManager();

    await this.initializeBeerTapQueues();

    this.setupEventHandlers();

    this.isInitialized = true;
  }

  private async initializeStatusManager(): Promise<void> {
    const statusManagerPrototype = Object.getPrototypeOf(this.statusManager);
    statusManagerPrototype.getBeerTapConfigs = () => {
      return Array.from(this.beerTapConfigs.values()).map(config => ({
        id: config.id,
        deviceId: config.thingsBoardDeviceId,
        serverUrl: config.thingsBoardServerUrl,
      }));
    };
  }

  private async initializeBeerTapQueues(): Promise<void> {
    const queueConfig: Partial<QueueConfig> = {
      maxAttempts: 3,
      baseDelay: 5000,
      maxDelay: 30000,
      concurrency: 1,
      statusPollingInterval: 5000,
      deadLetterQueueEnabled: true,
    };

    for (const beerTapId of this.beerTapConfigs.keys()) {
      const queueName = `beer-tap:${beerTapId}`;
      const processor = this.createBeerTapProcessor(beerTapId);
      const queue = new QueueService<BeerTapQueueItem>(queueName, this.redis, queueConfig, processor);

      await queue.init();
      this.beerTapQueues.set(beerTapId, queue);

      queue.setHasItemsCallback(() => {
        this.handleQueueStateChange();
      });
    }
  }

  private createBeerTapProcessor(beerTapId: string) {
    return async (item: QueueItem<BeerTapQueueItem>): Promise<QueueProcessingResult> => {
      const startTime = Date.now();
      const config = this.beerTapConfigs.get(beerTapId);

      if (!config) {
        return {
          success: false,
          itemId: item.id,
          processingTime: Date.now() - startTime,
          error: `No configuration found for beer tap: ${beerTapId}`,
          shouldRetry: false,
        };
      }

      try {
        // Wait for beer tap to be ready with a reasonable timeout
        const isReady = await this.statusManager.waitForBeerTapReady(
          beerTapId,
          config.thingsBoardDeviceId,
          config.thingsBoardServerUrl,
          60000
        );

        if (!isReady) {
          return {
            success: false,
            itemId: item.id,
            processingTime: Date.now() - startTime,
            error: `Beer tap ${beerTapId} did not become ready within 30 seconds`,
            shouldRetry: true,
          };
        }

        // Trigger the beer tap
        const triggerResponse = await triggerBeerTap(config.thingsBoardDeviceId, config.thingsBoardCupSize, {
          serverUrl: appConfig.thingsBoard.serverUrl,
          username: appConfig.thingsBoard.username!,
          password: appConfig.thingsBoard.password!,
          rpcTimeout: appConfig.thingsBoard.rpcTimeout,
        });

        if (!triggerResponse.ok) {
          throw new Error(`Failed to trigger beer tap: ${triggerResponse.status} ${triggerResponse.statusText}`);
        }

        this.emit('beerTapTriggered', {
          beerTapId,
          itemId: item.id,
          timestamp: new Date(),
        });

        // Wait a moment for the beer tap to start pouring, then return success
        // The beer tap will become busy and then ready again on its own
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
          success: true,
          itemId: item.id,
          processingTime: Date.now() - startTime,
          shouldRetry: false,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to trigger beer tap ${beerTapId} for item ${item.id}:`, error);

        this.emit('beerTapError', {
          beerTapId,
          itemId: item.id,
          error: errorMessage,
          timestamp: new Date(),
        });

        return {
          success: false,
          itemId: item.id,
          processingTime: Date.now() - startTime,
          error: errorMessage,
          shouldRetry: true,
        };
      }
    };
  }

  private setupEventHandlers(): void {
    for (const [beerTapId, queue] of this.beerTapQueues) {
      queue.onQueueEvent((event: QueueEvent) => {
        this.handleQueueEvent(beerTapId, event);
      });
    }

    this.statusManager.onStatusChange((event: StatusChangeEvent) => {
      this.handleStatusChange(event);
    });
  }

  private async handleQueueEvent(beerTapId: string, event: QueueEvent): Promise<void> {
    switch (event.type) {
      case 'item_completed':
        await this.handleItemCompleted(beerTapId, event);
        break;
      case 'item_failed':
        await this.handleItemFailed(beerTapId, event);
        break;
      default:
        this.emit('queueEvent', { beerTapId, ...event });
    }
  }

  private async handleItemCompleted(beerTapId: string, event: QueueEvent): Promise<void> {
    this.emit('beerTapCompleted', {
      beerTapId,
      itemId: event.itemId,
      timestamp: new Date(),
    });
  }

  private async handleItemFailed(beerTapId: string, event: QueueEvent): Promise<void> {
    const attempts = (event.data as { attempts: number })?.attempts || 0;
    const errors = (event.data as { errors: string[] })?.errors || [];

    this.emit('beerTapFailed', {
      beerTapId,
      itemId: event.itemId,
      attempts,
      errors,
      timestamp: new Date(),
    });
  }

  private async handleStatusChange(event: StatusChangeEvent): Promise<void> {
    this.emit('statusChange', event);
  }

  public async enqueueBeerTapTask(beerTapId: string, task: BeerTapQueueItem): Promise<string> {
    const queue = this.beerTapQueues.get(beerTapId);
    if (!queue) {
      throw new Error(`No queue found for beer tap: ${beerTapId}`);
    }

    const taskWithBeerTapId = { ...task, beerTapId };

    return await queue.enqueue(taskWithBeerTapId, {
      beerTapId,
      maxAttempts: 3,
    });
  }

  public async getBeerTapQueueLength(beerTapId: string): Promise<number> {
    const queue = this.beerTapQueues.get(beerTapId);
    if (!queue) {
      throw new Error(`No queue found for beer tap: ${beerTapId}`);
    }

    return await queue.getQueueLength();
  }

  public async getBeerTapStatus(beerTapId: string): Promise<QueueStatus> {
    return await this.statusManager.getBeerTapStatus(beerTapId);
  }

  public async forceBeerTapStatusUpdate(beerTapId: string): Promise<QueueStatus> {
    const config = this.beerTapConfigs.get(beerTapId);
    if (!config) {
      throw new Error(`No configuration found for beer tap: ${beerTapId}`);
    }

    return await this.statusManager.forcePollBeerTapStatus(
      beerTapId,
      config.thingsBoardDeviceId,
      config.thingsBoardServerUrl
    );
  }

  public async getAllBeerTapStatuses(): Promise<Map<string, QueueStatus>> {
    return await this.statusManager.getAllBeerTapStatuses();
  }

  public async getAllQueueLengths(): Promise<Map<string, number>> {
    const queueLengths = new Map<string, number>();

    for (const [beerTapId, queue] of this.beerTapQueues) {
      const length = await queue.getQueueLength();
      queueLengths.set(beerTapId, length);
    }

    return queueLengths;
  }

  public getBeerTapConfigs(): Map<string, BeerTapConfig> {
    return new Map(this.beerTapConfigs);
  }

  public async findTransactionStatus(txHash: string): Promise<{
    status: 'not_found' | 'queued' | 'processing' | 'completed' | 'failed';
    queuePosition?: number;
    beerTapId?: string;
  }> {
    // First check if transaction was completed recently
    const completedStatus = await this.redis.getStatus(`completed:${txHash}`);
    if (completedStatus !== null) {
      return {
        status: 'completed',
      };
    }

    // Search through all beer tap queues for the transaction
    for (const [beerTapId] of this.beerTapQueues) {
      const queueName = `beer-tap:${beerTapId}`;

      // Check the main queue
      const queueLength = await this.redis.getQueueLength(queueName);
      if (queueLength > 0) {
        const items = await this.redis.peekQueue<BeerTapQueueItem>(queueName, queueLength);
        for (let i = 0; i < items.length; i++) {
          if (items[i].data.transactionHash === txHash) {
            return {
              status: 'queued',
              queuePosition: i + 1,
              beerTapId,
            };
          }
        }
      }

      // Check retry queue
      const retryItems = await this.redis.getRetryItems<BeerTapQueueItem>(queueName);
      for (const item of retryItems) {
        if (item.data.transactionHash === txHash) {
          return {
            status: 'queued',
            beerTapId,
          };
        }
      }

      // Check dead letter queue (failed transactions)
      try {
        const deadItems = await this.redis.peekQueue<BeerTapQueueItem>(`${queueName}:dead`, 100);
        for (const item of deadItems) {
          if (item.data.transactionHash === txHash) {
            return {
              status: 'failed',
              beerTapId,
            };
          }
        }
      } catch {
        // Dead letter queue might not exist, that's okay
      }
    }

    return {
      status: 'not_found',
    };
  }

  public async processWebhookTransaction(transaction: Payment): Promise<void> {
    const matchingConfig = Array.from(this.beerTapConfigs.values()).find(config => {
      return (
        config.transactionReceiverEns === transaction.receiverEnsPrimaryName &&
        config.transactionMemo === transaction.memo &&
        config.transactionCurrency === transaction.invoiceCurrency &&
        Number(transaction.invoiceAmount) >= Number(config.transactionAmount)
      );
    });

    if (!matchingConfig) return;

    const task: BeerTapQueueItem = {
      transactionHash: transaction.txHash,
      beerTapId: matchingConfig.id,
      receiverEns: transaction.receiverEnsPrimaryName,
      memo: transaction.memo,
      currency: transaction.invoiceCurrency,
      amount: transaction.invoiceAmount,
      timestamp: new Date(),
    };

    const itemId = await this.enqueueBeerTapTask(matchingConfig.id, task);

    this.emit('transactionEnqueued', {
      transactionHash: transaction.txHash,
      beerTapId: matchingConfig.id,
      itemId,
      timestamp: new Date(),
    });
  }

  public async destroy(): Promise<void> {
    for (const queue of this.beerTapQueues.values()) {
      await queue.destroy();
    }

    this.beerTapQueues.clear();
    this.beerTapConfigs.clear();
    this.isInitialized = false;
  }

  public setHasItemsCallback(callback: (hasItems: boolean) => void): void {
    this.hasItemsCallback = callback;
  }

  private async handleQueueStateChange(): Promise<void> {
    if (!this.hasItemsCallback) {
      return;
    }

    let hasItems = false;
    for (const queue of this.beerTapQueues.values()) {
      const metrics = await queue.getMetrics();
      const queueLength = await queue.getQueueLength();
      const processingItems = metrics?.processingItems || 0;

      if (queueLength > 0 || processingItems > 0) {
        hasItems = true;
        break;
      }
    }

    this.hasItemsCallback(hasItems);
  }
}
