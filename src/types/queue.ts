export enum QueueStatus {
  READY = 0,
  BUSY = 1,
  PROCESSING = 2,
  ERROR = 3,
}

export enum RetryStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  CONSTANT = 'constant',
}

export interface QueueItem<T = unknown> {
  id: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt: Date;
  lastAttemptAt?: Date;
  errors: string[];
  beerTapId?: string;
}

export interface QueueConfig {
  maxAttempts: number;
  retryStrategy: RetryStrategy;
  baseDelay: number;
  maxDelay: number;
  concurrency: number;
  statusPollingInterval: number;
  deadLetterQueueEnabled: boolean;
}

export interface BeerTapQueueItem {
  transactionHash: string;
  beerTapId: string;
  receiverEns: string;
  memo: string;
  currency: string;
  amount: string;
  timestamp: Date;
}

export interface StatusChangeEvent {
  beerTapId: string;
  previousStatus: QueueStatus;
  currentStatus: QueueStatus;
  timestamp: Date;
}

export interface QueueEvent {
  type: 'item_added' | 'item_processing' | 'item_completed' | 'item_failed' | 'item_retry' | 'status_changed';
  queueId: string;
  itemId?: string;
  beerTapId?: string;
  data?: unknown;
  timestamp: Date;
}

export interface QueueMetrics {
  totalItems: number;
  processingItems: number;
  failedItems: number;
  completedItems: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
}

export interface ThingsBoardStatusResponse {
  status: QueueStatus;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface QueueProcessingResult {
  success: boolean;
  itemId: string;
  processingTime: number;
  error?: string;
  shouldRetry: boolean;
}

export type QueueEventHandler = (event: QueueEvent) => void | Promise<void>;
export type StatusChangeHandler = (event: StatusChangeEvent) => void | Promise<void>;
