export interface KeyRotationRecord {
  currentKey: string;
  nextKey?: string;
  transitionTime?: number;
}

export class KeyRotationPolicy {
  private record: KeyRotationRecord;

  constructor(initialKey: string) {
    this.record = { currentKey: initialKey };
  }

  /**
   * Schedule a key rotation.
   * @param newKey The key that will become active after the transition time.
   * @param transitionTime Unix timestamp (ms) when the new key becomes active.
   */
  scheduleRotation(newKey: string, transitionTime: number): void {
    const now = Date.now();
    if (transitionTime <= now) {
      throw new Error('transitionTime must be in the future');
    }
    this.record.nextKey = newKey;
    this.record.transitionTime = transitionTime;
  }

  /**
   * Get the currently active key. If the transition time has passed, the
   * key rotation is applied automatically.
   * @param currentTime Optional time override for testing.
   */
  getActiveKey(currentTime: number = Date.now()): string {
    if (
      this.record.nextKey &&
      this.record.transitionTime !== undefined &&
      currentTime >= this.record.transitionTime
    ) {
      // Perform rotation
      this.record.currentKey = this.record.nextKey;
      this.record.nextKey = undefined;
      this.record.transitionTime = undefined;
    }
    return this.record.currentKey;
  }

  /**
   * Determine whether a key rotation is pending.
   */
  hasPendingRotation(): boolean {
    return this.record.nextKey !== undefined;
  }
}
