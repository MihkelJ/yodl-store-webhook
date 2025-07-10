import { EventEmitter } from 'events';
import { config as appConfig } from '../../config/index.js';
import { BeerTapQueueItem, QueueConfig, QueueEvent, QueueStatus, StatusChangeEvent } from '../../types/queue.js';
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

    console.log('Initializing Queue Integration Service...');

    // Store beer tap configurations
    for (const config of beerTapConfigs) {
      this.beerTapConfigs.set(config.id, config);
    }

    // Initialize status manager with beer tap configurations
    await this.initializeStatusManager();

    // Create queue services for each beer tap
    await this.initializeBeerTapQueues();

    // Set up event handlers
    this.setupEventHandlers();

    this.isInitialized = true;
    console.log('Queue Integration Service initialized');
  }

  private async initializeStatusManager(): Promise<void> {
    // Update the status manager to know about beer tap configurations
    // This is a workaround since StatusManager doesn't currently have access to configs
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
      concurrency: 1, // Only one beer tap operation at a time per tap
      statusPollingInterval: 5000,
      deadLetterQueueEnabled: true,
    };

    for (const [beerTapId, config] of this.beerTapConfigs) {
      const queueName = `beer-tap:${beerTapId}`;
      const queue = new QueueService<BeerTapQueueItem>(queueName, this.redis, this.statusManager, queueConfig);

      await queue.init();
      this.beerTapQueues.set(beerTapId, queue);

      // Set up callback to monitor queue state
      queue.setHasItemsCallback((hasItems) => {
        this.handleQueueStateChange();
      });

      console.log(`Initialized queue for beer tap: ${beerTapId}`);
    }
  }

  private setupEventHandlers(): void {
    // Handle queue events
    for (const [beerTapId, queue] of this.beerTapQueues) {
      queue.onQueueEvent((event: QueueEvent) => {
        this.handleQueueEvent(beerTapId, event);
      });
    }

    // Handle status change events
    this.statusManager.onStatusChange((event: StatusChangeEvent) => {
      this.handleStatusChange(event);
    });
  }

  private async handleQueueEvent(beerTapId: string, event: QueueEvent): Promise<void> {
    const config = this.beerTapConfigs.get(beerTapId);
    if (!config) {
      console.error(`No configuration found for beer tap: ${beerTapId}`);
      return;
    }

    switch (event.type) {
      case 'item_processing':
        await this.handleItemProcessing(beerTapId, config, event);
        break;
      case 'item_completed':
        await this.handleItemCompleted(beerTapId, config, event);
        break;
      case 'item_failed':
        await this.handleItemFailed(beerTapId, config, event);
        break;
      default:
        // Forward other events
        this.emit('queueEvent', { beerTapId, ...event });
    }
  }

  private async handleItemProcessing(beerTapId: string, config: BeerTapConfig, event: QueueEvent): Promise<void> {
    console.log(`Processing item ${event.itemId} for beer tap ${beerTapId}`);

    try {
      // First, wait for the beer tap to be ready (with on-demand status checking)
      console.log(`Waiting for beer tap ${beerTapId} to be ready before processing item ${event.itemId}...`);
      const isReady = await this.statusManager.waitForBeerTapReady(
        beerTapId,
        config.thingsBoardDeviceId,
        config.thingsBoardServerUrl,
        60000 // 60 second timeout
      );

      if (!isReady) {
        throw new Error(`Beer tap ${beerTapId} did not become ready within timeout for item ${event.itemId}`);
      }

      console.log(`Beer tap ${beerTapId} is ready, triggering for item ${event.itemId}`);

      // Trigger the beer tap (send RPC command with cup size)
      // The device will automatically set itself to BUSY when it starts dispensing
      await triggerBeerTap(
        config.thingsBoardDeviceId,
        config.thingsBoardCupSize,
        {
          serverUrl: appConfig.thingsBoard.serverUrl,
          username: appConfig.thingsBoard.username!,
          password: appConfig.thingsBoard.password!,
        }
      );

      console.log(`Successfully triggered beer tap ${beerTapId} for transaction ${event.itemId}`);

      // Emit success event
      this.emit('beerTapTriggered', {
        beerTapId,
        itemId: event.itemId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`Failed to trigger beer tap ${beerTapId} for item ${event.itemId}:`, error);

      // Emit error event
      this.emit('beerTapError', {
        beerTapId,
        itemId: event.itemId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      // Don't re-throw - the error has been logged and events emitted
      // The queue system will handle retries based on the failure event
    }
  }

  private async handleItemCompleted(beerTapId: string, config: BeerTapConfig, event: QueueEvent): Promise<void> {
    // The beer tap device will automatically set itself back to READY when done dispensing
    // We don't need to manually control the status

    console.log(`Beer tap ${beerTapId} processing completed for transaction ${event.itemId}`);

    // Emit completion event
    this.emit('beerTapCompleted', {
      beerTapId,
      itemId: event.itemId,
      timestamp: new Date(),
    });
  }

  private async handleItemFailed(beerTapId: string, config: BeerTapConfig, event: QueueEvent): Promise<void> {
    // The beer tap device manages its own status
    // We don't need to manually reset it on failure

    console.log(`Beer tap ${beerTapId} processing failed for transaction ${event.itemId}`);

    // Emit failure event
    this.emit('beerTapFailed', {
      beerTapId,
      itemId: event.itemId,
      attempts: event.data?.attempts || 0,
      errors: event.data?.errors || [],
      timestamp: new Date(),
    });
  }

  private async handleStatusChange(event: StatusChangeEvent): Promise<void> {
    console.log(`Status changed for beer tap ${event.beerTapId}: ${event.previousStatus} -> ${event.currentStatus}`);

    // Forward status change events
    this.emit('statusChange', event);

    // If beer tap became ready, it might be able to process queued items
    if (event.currentStatus === QueueStatus.READY && event.previousStatus !== QueueStatus.READY) {
      console.log(`Beer tap ${event.beerTapId} is now ready, checking for queued items`);
    }
  }

  // Public API methods
  public async enqueueBeerTapTask(beerTapId: string, task: BeerTapQueueItem): Promise<string> {
    const queue = this.beerTapQueues.get(beerTapId);
    if (!queue) {
      throw new Error(`No queue found for beer tap: ${beerTapId}`);
    }

    // Add beerTapId to the task
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

  public async processWebhookTransaction(
    transactionHash: string,
    receiverEns: string,
    memo: string,
    currency: string,
    amount: string
  ): Promise<void> {
    // Find matching beer tap configuration
    const matchingConfig = Array.from(this.beerTapConfigs.values()).find(
      config =>
        config.transactionReceiverEns === receiverEns &&
        config.transactionMemo === memo &&
        config.transactionCurrency === currency &&
        parseFloat(amount) >= parseFloat(config.transactionAmount)
    );

    if (!matchingConfig) {
      console.log(`No matching beer tap configuration found for transaction ${transactionHash}`);
      return;
    }

    // Create beer tap task
    const task: BeerTapQueueItem = {
      transactionHash,
      beerTapId: matchingConfig.id,
      receiverEns,
      memo,
      currency,
      amount,
      timestamp: new Date(),
    };

    // Enqueue the task
    const itemId = await this.enqueueBeerTapTask(matchingConfig.id, task);

    console.log(`Enqueued beer tap task ${itemId} for transaction ${transactionHash} on beer tap ${matchingConfig.id}`);

    // Emit event
    this.emit('transactionEnqueued', {
      transactionHash,
      beerTapId: matchingConfig.id,
      itemId,
      timestamp: new Date(),
    });
  }

  public async destroy(): Promise<void> {
    console.log('Destroying Queue Integration Service...');

    // Destroy all queue services
    for (const [beerTapId, queue] of this.beerTapQueues) {
      await queue.destroy();
      console.log(`Destroyed queue for beer tap: ${beerTapId}`);
    }

    this.beerTapQueues.clear();
    this.beerTapConfigs.clear();
    this.isInitialized = false;

    console.log('Queue Integration Service destroyed');
  }

  public setHasItemsCallback(callback: (hasItems: boolean) => void): void {
    this.hasItemsCallback = callback;
  }

  private async handleQueueStateChange(): Promise<void> {
    if (!this.hasItemsCallback) {
      return;
    }

    // Check if any queue has items (including processing items)
    let hasItems = false;
    for (const [beerTapId, queue] of this.beerTapQueues) {
      const metrics = await queue.getMetrics();
      const queueLength = await queue.getQueueLength();
      const processingItems = metrics?.processingItems || 0;
      
      if (queueLength > 0 || processingItems > 0) {
        hasItems = true;
        break;
      }
    }

    // Notify about the state change
    this.hasItemsCallback(hasItems);
  }
}
