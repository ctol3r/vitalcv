/**
 * LumenEventsBus
 * Central event bus for identity, chain, and trust events
 */

import type { LumenEvent } from './types';

type EventListener = (event: LumenEvent) => void;

export class LumenEventsBus {
  private listeners: Map<LumenEvent['type'], Set<EventListener>> = new Map();
  private eventHistory: LumenEvent[] = [];
  private maxHistorySize: number = 100;

  /**
   * Subscribe to events of a specific type
   */
  on(eventType: LumenEvent['type'], listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(listener: EventListener): () => void {
    const unsubscribers: Array<() => void> = [];

    // Subscribe to all known event types
    const eventTypes: Array<LumenEvent['type']> = [
      'TRUST_CHANGE',
      'ANCHOR_CONFIRMED',
      'COMPLIANCE_UPDATE',
      'SKILL_VERIFIED',
      'ZK_REVEAL',
      'RISK_DETECTED',
      'CHAIN_HEALTH_CHANGE',
    ];

    eventTypes.forEach((eventType) => {
      const unsub = this.on(eventType, listener);
      unsubscribers.push(unsub);
    });

    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Emit an event
   */
  emit(event: LumenEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[LumenEventsBus] Error in listener for ${event.type}:`, error);
        }
      });
    }

    // Also notify "all" listeners
    this.listeners.forEach((listeners, eventType) => {
      if (eventType !== event.type) return;
      // Already handled above
    });
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): LumenEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Get events of a specific type from history
   */
  getHistoryByType(eventType: LumenEvent['type'], limit?: number): LumenEvent[] {
    const filtered = this.eventHistory.filter((event) => event.type === eventType);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get listener count for an event type
   */
  getListenerCount(eventType: LumenEvent['type']): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Remove listeners for a specific event type
   */
  removeListeners(eventType: LumenEvent['type']): void {
    this.listeners.delete(eventType);
  }
}

// Singleton instance
let globalEventsBus: LumenEventsBus | null = null;

export function getLumenEventsBus(): LumenEventsBus {
  if (!globalEventsBus) {
    globalEventsBus = new LumenEventsBus();
  }
  return globalEventsBus;
}

