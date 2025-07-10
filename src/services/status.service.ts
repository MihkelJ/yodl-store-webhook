import { EventEmitter } from 'events';
import { QueueStatus, StatusChangeEvent, StatusChangeHandler, ThingsBoardStatusResponse } from '../types/queue.js';
import { readBeerTapStatus, setBeerTapStatus } from './thingsboard-robust.service.js';
import { RedisService } from './redis.service.js';
import { config as appConfig } from '../config/index.js';

export class StatusManager extends EventEmitter {
  private static instance: StatusManager;
  private redis: RedisService;
  private statusPollingInterval: NodeJS.Timeout | null = null;
  private readonly pollingIntervalMs: number;
  private readonly statusCacheTtl = 30; // 30 seconds TTL for status cache
  private isPolling = false;

  // Request deduplication - key: "deviceToken:serverUrl", value: Promise
  private pendingStatusRequests = new Map<string, Promise<ThingsBoardStatusResponse>>();

  private constructor(redis: RedisService, pollingIntervalMs = 5000) {
    super();
    this.redis = redis;
    this.pollingIntervalMs = pollingIntervalMs;
  }

  public static getInstance(redis: RedisService, pollingIntervalMs = 5000): StatusManager {
    if (!StatusManager.instance) {
      StatusManager.instance = new StatusManager(redis, pollingIntervalMs);
    }
    return StatusManager.instance;
  }

  public async init(): Promise<void> {
    console.log('Initializing Status Manager...');

    if (!this.redis.isReady()) {
      await this.redis.connect();
    }

    // No automatic polling - we'll fetch on-demand
    console.log('Status Manager initialized (on-demand polling mode)');
  }

  public async destroy(): Promise<void> {
    console.log('Destroying Status Manager...');
    this.stopStatusPolling();

    // Clear any pending requests
    this.pendingStatusRequests.clear();

    await this.redis.disconnect();
  }

  // Status polling is now disabled - using on-demand checking instead

  private stopStatusPolling(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
    this.isPolling = false;
    console.log('Status polling stopped');
  }

  // Request deduplication and caching method
  private async getThingsBoardStatusWithDedup(
    beerTapId: string,
    deviceToken: string,
    serverUrl: string
  ): Promise<ThingsBoardStatusResponse> {
    const requestKey = `${deviceToken}:${serverUrl}`;
    const cacheKey = `status:${beerTapId}`;

    // First check if we have a cached status (valid for some time)
    const cachedStatus = await this.redis.getStatus(cacheKey);
    if (cachedStatus !== null) {
      console.log(`Using cached status for beer tap ${beerTapId}: ${cachedStatus}`);
      return {
        status: cachedStatus,
        timestamp: new Date(),
        success: true,
      };
    }

    // If there's already a pending request for this token/server, return the same promise
    if (this.pendingStatusRequests.has(requestKey)) {
      console.log(`Reusing pending ThingsBoard status request for token ${deviceToken.substring(0, 8)}...`);
      return this.pendingStatusRequests.get(requestKey)!;
    }

    // Create new request
    console.log(`Making new ThingsBoard status request for token ${deviceToken.substring(0, 8)}...`);
    const requestPromise = readBeerTapStatus({
      deviceToken,
      config: appConfig.thingsBoard,
    });

    // Store the promise
    this.pendingStatusRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;

      // Cache the result if successful
      if (result.success) {
        await this.redis.setStatus(cacheKey, result.status, 15); // Cache for 15 seconds
      }

      return result;
    } finally {
      // Clean up the promise from the map when done
      this.pendingStatusRequests.delete(requestKey);
    }
  }

  public async getBeerTapStatus(beerTapId: string): Promise<QueueStatus> {
    const cacheKey = `status:${beerTapId}`;
    const cachedStatus = await this.redis.getStatus(cacheKey);

    if (cachedStatus !== null) {
      return cachedStatus;
    }

    // If not in cache, return READY as default (will be updated by next poll)
    return QueueStatus.READY;
  }

  public async updateBeerTapStatus(beerTapId: string, newStatus: QueueStatus): Promise<void> {
    const cacheKey = `status:${beerTapId}`;
    const previousStatus = await this.redis.getStatus(cacheKey);

    // Update status in Redis with TTL
    await this.redis.setStatus(cacheKey, newStatus, this.statusCacheTtl);

    // If status changed, emit event
    if (previousStatus !== null && previousStatus !== newStatus) {
      const statusChangeEvent: StatusChangeEvent = {
        beerTapId,
        previousStatus,
        currentStatus: newStatus,
        timestamp: new Date(),
      };

      this.emit('statusChange', statusChangeEvent);

      // Publish to Redis pub/sub for other services
      await this.redis.publish(`status:${beerTapId}:change`, JSON.stringify(statusChangeEvent));

      console.log(`Status changed for beer tap ${beerTapId}: ${previousStatus} -> ${newStatus}`);
    }
  }

  public async setBeerTapStatus(
    beerTapId: string,
    status: QueueStatus.READY | QueueStatus.BUSY,
    deviceToken: string,
    serverUrl: string
  ): Promise<void> {
    try {
      // Update ThingsBoard device first
      await setBeerTapStatus({
        deviceToken,
        config: appConfig.thingsBoard,
        status,
      });

      // Then update our cache
      await this.updateBeerTapStatus(beerTapId, status);

      console.log(`Successfully set beer tap ${beerTapId} status to ${status}`);
    } catch (error) {
      console.error(`Failed to set beer tap ${beerTapId} status:`, error);

      // Mark as error status
      await this.updateBeerTapStatus(beerTapId, QueueStatus.ERROR);
      throw error;
    }
  }

  public async isBeerTapReady(beerTapId: string): Promise<boolean> {
    const status = await this.getBeerTapStatus(beerTapId);
    return status === QueueStatus.READY;
  }

  public async isBeerTapBusy(beerTapId: string): Promise<boolean> {
    const status = await this.getBeerTapStatus(beerTapId);
    return status === QueueStatus.BUSY;
  }

  public async waitForBeerTapReady(
    beerTapId: string,
    deviceToken: string,
    serverUrl: string,
    timeoutMs = 30000
  ): Promise<boolean> {
    const startTime = Date.now();
    console.log(`Checking if beer tap ${beerTapId} is ready for processing...`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Fetch current status from ThingsBoard (with deduplication)
        const statusResponse = await this.getThingsBoardStatusWithDedup(beerTapId, deviceToken, serverUrl);

        if (statusResponse.success) {
          await this.updateBeerTapStatus(beerTapId, statusResponse.status);

          if (statusResponse.status === QueueStatus.READY) {
            console.log(`Beer tap ${beerTapId} is ready (ready=1)!`);
            return true;
          } else {
            console.log(
              `Beer tap ${beerTapId} is busy (ready=0, status: ${statusResponse.status}), waiting 5 seconds...`
            );
          }
        } else {
          console.error(`Failed to check beer tap ${beerTapId} status:`, statusResponse.error);
          // Continue trying even if one check fails
        }
      } catch (error) {
        console.error(`Error checking beer tap ${beerTapId} status:`, error);
        // Continue trying even if one check fails
      }

      // Wait for 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(`Timeout waiting for beer tap ${beerTapId} to become ready`);
    return false;
  }

  public onStatusChange(handler: StatusChangeHandler): void {
    this.on('statusChange', handler);
  }

  public offStatusChange(handler: StatusChangeHandler): void {
    this.off('statusChange', handler);
  }

  public async subscribeToStatusChanges(
    beerTapId: string,
    callback: (event: StatusChangeEvent) => void
  ): Promise<void> {
    await this.redis.subscribe(`status:${beerTapId}:change`, message => {
      try {
        const event = JSON.parse(message) as StatusChangeEvent;
        event.timestamp = new Date(event.timestamp); // Convert back to Date
        callback(event);
      } catch (error) {
        console.error('Error parsing status change event:', error);
      }
    });
  }

  public async getStatusMetrics(beerTapId: string): Promise<{
    currentStatus: QueueStatus;
    lastUpdated: Date;
    isOnline: boolean;
  }> {
    const currentStatus = await this.getBeerTapStatus(beerTapId);
    const isOnline = currentStatus !== QueueStatus.ERROR;

    return {
      currentStatus,
      lastUpdated: new Date(),
      isOnline,
    };
  }

  public async getAllBeerTapStatuses(): Promise<Map<string, QueueStatus>> {
    const statuses = new Map<string, QueueStatus>();
    // Note: This would need to be called with specific beer tap IDs
    // since we no longer have automatic discovery of beer tap configs
    return statuses;
  }

  public async forcePollBeerTapStatus(beerTapId: string, deviceToken: string, serverUrl: string): Promise<QueueStatus> {
    const statusResponse = await this.getThingsBoardStatusWithDedup(beerTapId, deviceToken, serverUrl);

    if (statusResponse.success) {
      await this.updateBeerTapStatus(beerTapId, statusResponse.status);
      return statusResponse.status;
    } else {
      await this.updateBeerTapStatus(beerTapId, QueueStatus.ERROR);
      throw new Error(`Failed to read status: ${statusResponse.error}`);
    }
  }
}
