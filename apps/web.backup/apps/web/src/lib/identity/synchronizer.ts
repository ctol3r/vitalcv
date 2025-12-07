/**
 * Identity Synchronizer
 * Task 3: Add Identity Synchronizer (multi-device coherence)
 *
 * Ensures identity state remains coherent across multiple devices
 * and platforms, detecting and resolving conflicts.
 */

export interface DeviceIdentity {
  deviceId: string;
  platform: 'web' | 'ios' | 'android' | 'desktop';
  lastSync: Date;
  credentialCount: number;
  stateVersion: number;
  fingerprints: string[]; // Credential hashes or IDs
}

export interface SyncEvent {
  id: string;
  timestamp: Date;
  deviceId: string;
  eventType: 'credential_added' | 'credential_updated' | 'credential_removed' | 'identity_updated';
  payload: Record<string, unknown>;
  conflict?: boolean;
  resolved?: boolean;
}

export interface CoherenceMetrics {
  deviceCount: number;
  syncFrequency: number; // events per hour
  conflictRate: number; // 0-1
  coherenceScore: number; // 0-1
  lastCoherenceCheck: Date;
  driftAmount: number; // 0-1, how much devices have diverged
}

export interface SyncConflict {
  id: string;
  detectedAt: Date;
  devices: string[];
  conflictType: 'credential_mismatch' | 'state_divergence' | 'version_conflict';
  severity: 'low' | 'medium' | 'high';
  resolution?: SyncResolution;
}

export interface SyncResolution {
  strategy: 'merge' | 'overwrite' | 'user_choice' | 'latest_wins';
  resolvedAt: Date;
  resolvedBy: string; // deviceId or 'system'
  outcome: Record<string, unknown>;
}

export class IdentitySynchronizer {
  private devices: Map<string, DeviceIdentity>;
  private syncEvents: SyncEvent[];
  private conflicts: SyncConflict[];
  private coherenceWindow: number; // milliseconds for coherence check

  constructor(coherenceWindowMs: number = 3600000) {
    this.devices = new Map();
    this.syncEvents = [];
    this.conflicts = [];
    this.coherenceWindow = coherenceWindowMs;
  }

  /**
   * Register a device
   */
  registerDevice(device: DeviceIdentity): void {
    this.devices.set(device.deviceId, device);
    this.recordSyncEvent({
      id: this.generateId(),
      timestamp: new Date(),
      deviceId: device.deviceId,
      eventType: 'identity_updated',
      payload: { action: 'device_registered', device },
    });
  }

  /**
   * Record a sync event from a device
   */
  recordSyncEvent(event: SyncEvent): void {
    this.syncEvents.push(event);

    // Check for conflicts
    const conflict = this.detectConflict(event);
    if (conflict) {
      event.conflict = true;
      this.conflicts.push(conflict);
    }

    // Update device state
    const device = this.devices.get(event.deviceId);
    if (device) {
      device.lastSync = event.timestamp;
      device.stateVersion += 1;
    }
  }

  /**
   * Calculate coherence metrics across all devices
   */
  calculateCoherenceMetrics(): CoherenceMetrics {
    const deviceCount = this.devices.size;
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.coherenceWindow);

    const recentEvents = this.syncEvents.filter((e) => e.timestamp >= windowStart);
    const syncFrequency = recentEvents.length / (this.coherenceWindow / (1000 * 60 * 60));

    const recentConflicts = this.conflicts.filter(
      (c) => !c.resolution && c.detectedAt >= windowStart
    );
    const conflictRate = recentEvents.length > 0
      ? recentConflicts.length / recentEvents.length
      : 0;

    // Calculate drift by comparing device fingerprints
    const driftAmount = this.calculateDrift();

    // Coherence score: higher is better
    const coherenceScore = Math.max(0, Math.min(1,
      1 - conflictRate * 0.5 - driftAmount * 0.5
    ));

    return {
      deviceCount,
      syncFrequency,
      conflictRate,
      coherenceScore,
      lastCoherenceCheck: now,
      driftAmount,
    };
  }

  /**
   * Synchronize identity state across devices
   */
  async synchronize(deviceId: string): Promise<{
    success: boolean;
    changes: SyncEvent[];
    conflicts: SyncConflict[];
  }> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not registered`);
    }

    // Find conflicts for this device
    const deviceConflicts = this.conflicts.filter(
      (c) => c.devices.includes(deviceId) && !c.resolution
    );

    // Calculate what needs to sync
    const otherDevices = Array.from(this.devices.values()).filter(
      (d) => d.deviceId !== deviceId
    );

    const changes: SyncEvent[] = [];

    // Check for state differences
    for (const otherDevice of otherDevices) {
      const differences = this.findStateDifferences(device, otherDevice);
      differences.forEach((diff) => {
        changes.push({
          id: this.generateId(),
          timestamp: new Date(),
          deviceId: otherDevice.deviceId,
          eventType: diff.type as SyncEvent['eventType'],
          payload: diff.payload,
        });
      });
    }

    // Resolve conflicts
    const resolvedConflicts: SyncConflict[] = [];
    for (const conflict of deviceConflicts) {
      const resolution = await this.resolveConflict(conflict, deviceId);
      if (resolution) {
        conflict.resolution = resolution;
        resolvedConflicts.push(conflict);
      }
    }

    return {
      success: deviceConflicts.length === resolvedConflicts.length,
      changes,
      conflicts: deviceConflicts,
    };
  }

  /**
   * Detect if an event creates a conflict
   */
  private detectConflict(event: SyncEvent): SyncConflict | null {
    if (!event.deviceId) return null;

    const device = this.devices.get(event.deviceId);
    if (!device) return null;

    // Check for credential mismatches
    const otherDevices = Array.from(this.devices.values()).filter(
      (d) => d.deviceId !== event.deviceId
    );

    for (const otherDevice of otherDevices) {
      // Check if credentials differ significantly
      if (event.eventType === 'credential_added' || event.eventType === 'credential_updated') {
        const fingerprint = (event.payload as { fingerprint?: string }).fingerprint;
        if (fingerprint && !otherDevice.fingerprints.includes(fingerprint)) {
          // Check if this is a conflict or just a new addition
          const recentEvent = this.syncEvents
            .slice()
            .reverse()
            .find(
              (e) => e.deviceId === otherDevice.deviceId &&
                (e.eventType === 'credential_removed' || e.eventType === 'credential_updated') &&
                e.payload &&
                (e.payload as { fingerprint?: string }).fingerprint === fingerprint
            );

          if (recentEvent) {
            return {
              id: this.generateId(),
              detectedAt: new Date(),
              devices: [event.deviceId, otherDevice.deviceId],
              conflictType: 'credential_mismatch',
              severity: 'medium',
            };
          }
        }
      }

      // Check version conflicts
      if (otherDevice.stateVersion > device.stateVersion + 5) {
        return {
          id: this.generateId(),
          detectedAt: new Date(),
          devices: [event.deviceId, otherDevice.deviceId],
          conflictType: 'version_conflict',
          severity: 'high',
        };
      }
    }

    return null;
  }

  /**
   * Calculate drift amount between devices
   */
  private calculateDrift(): number {
    const devices = Array.from(this.devices.values());
    if (devices.length < 2) return 0;

    let totalDrift = 0;
    let comparisons = 0;

    for (let i = 0; i < devices.length; i++) {
      for (let j = i + 1; j < devices.length; j++) {
        const device1 = devices[i];
        const device2 = devices[j];

        // Compare fingerprint sets
        const set1 = new Set(device1.fingerprints);
        const set2 = new Set(device2.fingerprints);

        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        const similarity = intersection.size / Math.max(1, union.size);
        const drift = 1 - similarity;

        totalDrift += drift;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDrift / comparisons : 0;
  }

  /**
   * Find state differences between two devices
   */
  private findStateDifferences(
    device1: DeviceIdentity,
    device2: DeviceIdentity
  ): Array<{ type: string; payload: Record<string, unknown> }> {
    const differences: Array<{ type: string; payload: Record<string, unknown> }> = [];

    const set1 = new Set(device1.fingerprints);
    const set2 = new Set(device2.fingerprints);

    // Find credentials in device2 but not in device1
    set2.forEach((fingerprint) => {
      if (!set1.has(fingerprint)) {
        differences.push({
          type: 'credential_added',
          payload: { fingerprint, sourceDevice: device2.deviceId },
        });
      }
    });

    // Find credentials in device1 but not in device2
    set1.forEach((fingerprint) => {
      if (!set2.has(fingerprint)) {
        differences.push({
          type: 'credential_removed',
          payload: { fingerprint, sourceDevice: device1.deviceId },
        });
      }
    });

    return differences;
  }

  /**
   * Resolve a conflict
   */
  private async resolveConflict(
    conflict: SyncConflict,
    resolvingDeviceId: string
  ): Promise<SyncResolution | null> {
    // Auto-resolve using latest-wins strategy for now
    // In production, this would prompt the user
    const resolution: SyncResolution = {
      strategy: 'latest_wins',
      resolvedAt: new Date(),
      resolvedBy: resolvingDeviceId,
      outcome: {
        conflictId: conflict.id,
        resolutionStrategy: conflict.conflictType === 'version_conflict' ? 'merge' : 'latest_wins',
      },
    };

    return resolution;
  }

  /**
   * Get all devices
   */
  getDevices(): DeviceIdentity[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get unresolved conflicts
   */
  getUnresolvedConflicts(): SyncConflict[] {
    return this.conflicts.filter((c) => !c.resolution);
  }

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

