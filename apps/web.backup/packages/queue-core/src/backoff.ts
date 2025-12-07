export interface BackoffSettings {
  baseMs: number;
  multiplier: number;
  maxMs: number;
  jitterRatio?: number;
}

export function calculateBackoffDelay(
  attempt: number,
  settings: BackoffSettings
): number {
  const { baseMs, multiplier, maxMs, jitterRatio = 0 } = settings;
  const exponential = baseMs * Math.pow(multiplier, Math.max(attempt - 1, 0));
  const clamped = Math.min(exponential, maxMs);
  if (jitterRatio <= 0) {
    return clamped;
  }
  const jitter = clamped * jitterRatio;
  const randomOffset = (Math.random() * jitter * 2) - jitter;
  return Math.max(baseMs, Math.floor(clamped + randomOffset));
}

