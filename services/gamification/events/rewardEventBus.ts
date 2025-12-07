/**
 * B247A-GAM-005: RewardEventBus
 *
 * Publishes and subscribes to reward-related events: pointAwarded, pointsRedeemed
 * Supports asynchronous handlers; used by analytics and notifications
 */

import { EventEmitter } from 'events';
import { RewardActionType } from '../models/RewardPointsTransaction';

export interface PointAwardedEvent {
  type: 'pointAwarded';
  userId: string;
  actionType: RewardActionType;
  points: number;
  description: string;
  transactionId: string;
  timestamp: Date;
}

export interface PointsRedeemedEvent {
  type: 'pointsRedeemed';
  userId: string;
  points: number;
  description: string;
  transactionId: string;
  timestamp: Date;
}

export interface PointsExpiredEvent {
  type: 'pointsExpired';
  userId: string;
  points: number;
  description: string;
  transactionId: string;
  timestamp: Date;
}

export type RewardEvent = PointAwardedEvent | PointsRedeemedEvent | PointsExpiredEvent;

export type RewardEventHandler = (event: RewardEvent) => void | Promise<void>;

class RewardEventBus extends EventEmitter {
  /**
   * Publish a point awarded event
   */
  emitPointAwarded(event: Omit<PointAwardedEvent, 'type' | 'timestamp'>): void {
    const fullEvent: PointAwardedEvent = {
      type: 'pointAwarded',
      ...event,
      timestamp: new Date(),
    };
    this.emit('pointAwarded', fullEvent);
  }

  /**
   * Publish a points redeemed event
   */
  emitPointsRedeemed(event: Omit<PointsRedeemedEvent, 'type' | 'timestamp'>): void {
    const fullEvent: PointsRedeemedEvent = {
      type: 'pointsRedeemed',
      ...event,
      timestamp: new Date(),
    };
    this.emit('pointsRedeemed', fullEvent);
  }

  /**
   * Publish a points expired event
   */
  emitPointsExpired(event: Omit<PointsExpiredEvent, 'type' | 'timestamp'>): void {
    const fullEvent: PointsExpiredEvent = {
      type: 'pointsExpired',
      ...event,
      timestamp: new Date(),
    };
    this.emit('pointsExpired', fullEvent);
  }

  /**
   * Subscribe to point awarded events
   */
  onPointAwarded(handler: (event: PointAwardedEvent) => void | Promise<void>): void {
    this.on('pointAwarded', handler);
  }

  /**
   * Subscribe to points redeemed events
   */
  onPointsRedeemed(handler: (event: PointsRedeemedEvent) => void | Promise<void>): void {
    this.on('pointsRedeemed', handler);
  }

  /**
   * Subscribe to points expired events
   */
  onPointsExpired(handler: (event: PointsExpiredEvent) => void | Promise<void>): void {
    this.on('pointsExpired', handler);
  }

  /**
   * Subscribe to all reward events
   */
  onRewardEvent(handler: RewardEventHandler): void {
    this.on('pointAwarded', handler);
    this.on('pointsRedeemed', handler);
    this.on('pointsExpired', handler);
  }

  /**
   * Unsubscribe from an event
   */
  offRewardEvent(handler: RewardEventHandler): void {
    this.off('pointAwarded', handler);
    this.off('pointsRedeemed', handler);
    this.off('pointsExpired', handler);
  }
}

// Singleton instance
export const rewardEventBus = new RewardEventBus();

