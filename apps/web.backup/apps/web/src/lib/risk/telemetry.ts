const STORAGE_KEY = 'risk:deviceId';
const DEFAULT_ENDPOINT = '/risk/telemetry';

let inMemoryDeviceId: string | null = null;
let pendingRetry: (() => void) | null = null;

export interface TelemetryOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  suppressErrors?: boolean;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function safeLocalStorage(): Storage | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getOrCreateDeviceId(): string {
  const storage = safeLocalStorage();
  if (storage) {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing) {
      inMemoryDeviceId = existing;
      return existing;
    }
  }

  if (inMemoryDeviceId) {
    return inMemoryDeviceId;
  }

  const id = generateDeviceId();
  inMemoryDeviceId = id;
  storage?.setItem(STORAGE_KEY, id);
  return id;
}

function collectSignals() {
  if (!isBrowser()) {
    return {};
  }

  const tz =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined;

  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const signals: Record<string, unknown> = {
    userAgent: navigator.userAgent || undefined,
    timezone: tz,
    tzOffset: -tzOffsetMinutes,
    languages: navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
      ? [navigator.language]
      : undefined,
    platform: navigator.platform || undefined,
    hardwareConcurrency: navigator.hardwareConcurrency || undefined,
  };

  if (window.screen) {
    const { width, height, colorDepth } = window.screen;
    signals.screen = {
      width,
      height,
      colorDepth,
    };
  }

  return Object.entries(signals).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return acc;
      }
      acc[key] = value;
      return acc;
    },
    {}
  );
}

async function postTelemetry(
  payload: { deviceId: string; signals: Record<string, unknown> },
  endpoint: string,
  fetchImpl: typeof fetch
) {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    keepalive: true,
  });

  if (!response.ok && response.status !== 429) {
    throw new Error(`Telemetry rejected (${response.status})`);
  }
}

function scheduleRetry(callback: () => void) {
  if (!isBrowser()) return;
  if (pendingRetry) return;

  const handler = () => {
    pendingRetry = null;
    window.removeEventListener('online', handler);
    callback();
  };

  pendingRetry = handler;
  window.addEventListener('online', handler, { once: true });
}

export async function sendRiskTelemetry(options: TelemetryOptions = {}) {
  if (!isBrowser()) {
    return;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const deviceId = getOrCreateDeviceId();
  const signals = collectSignals();

  if (Object.keys(signals).length === 0) {
    return;
  }

  try {
    await postTelemetry({ deviceId, signals }, endpoint, fetchImpl);
  } catch (error) {
    if (navigator.onLine === false) {
      scheduleRetry(() => {
        sendRiskTelemetry(options).catch((err) => {
          if (options.suppressErrors === false) {
            throw err;
          }
        });
      });
      return;
    }

    if (options.suppressErrors !== false) {
      console.warn('[risk][telemetry] failed to send payload', error);
      return;
    }

    throw error;
  }
}
/**
 * B160A-FE-003: Client telemetry script to capture browser/device signals
 *
 * Collects userAgent, timezone, languages, screen size, navigator.platform.
 * Posts to /risk/telemetry with stable deviceId (stored in localStorage).
 * Retried if offline.
 */

const DEVICE_ID_KEY = 'vitalcv_device_id';
const TELEMETRY_ENDPOINT = '/api/risk/telemetry';
const RETRY_DELAY_MS = 5000; // 5 seconds
const MAX_RETRIES = 3;

/**
 * Generate or retrieve device ID from localStorage
 */
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    // Server-side rendering
    return 'ssr-device-id';
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate UUID v4
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Collect browser/device signals
 */
function collectSignals(): {
  userAgent: string;
  timezone: string;
  languages: string[];
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  tzOffset: number;
  platform: string;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    // Server-side rendering - return minimal data
    return {
      userAgent: 'SSR',
      timezone: 'UTC',
      languages: ['en'],
      screen: {
        width: 0,
        height: 0,
        colorDepth: 0,
      },
      tzOffset: 0,
      platform: 'unknown',
    };
  }

  return {
    userAgent: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: navigator.languages || [navigator.language || 'en'],
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth || 0,
    },
    tzOffset: new Date().getTimezoneOffset(),
    platform: navigator.platform || 'unknown',
  };
}

/**
 * Send telemetry data to server
 */
async function sendTelemetry(
  deviceId: string,
  signals: ReturnType<typeof collectSignals>,
  retryCount: number = 0
): Promise<void> {
  try {
    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId,
        signals,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telemetry request failed: ${response.status}`);
    }

    // Success - no need to retry
    return;
  } catch (error) {
    // If offline or network error, retry
    if (retryCount < MAX_RETRIES) {
      console.warn(
        `[TELEMETRY] Failed to send (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying...`,
        error
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

      return sendTelemetry(deviceId, signals, retryCount + 1);
    } else {
      console.error('[TELEMETRY] Failed to send after max retries', error);
      // Store in localStorage for later retry when online
      if (typeof window !== 'undefined') {
        const pendingTelemetry = JSON.parse(
          localStorage.getItem('vitalcv_pending_telemetry') || '[]'
        );
        pendingTelemetry.push({
          deviceId,
          signals,
          timestamp: Date.now(),
        });
        // Keep only last 10 pending telemetry entries
        localStorage.setItem(
          'vitalcv_pending_telemetry',
          JSON.stringify(pendingTelemetry.slice(-10))
        );
      }
    }
  }
}

/**
 * Send pending telemetry when online
 */
async function sendPendingTelemetry(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const pendingTelemetry = JSON.parse(
    localStorage.getItem('vitalcv_pending_telemetry') || '[]'
  );

  if (pendingTelemetry.length === 0) {
    return;
  }

  // Send each pending telemetry entry
  for (const entry of pendingTelemetry) {
    try {
      await sendTelemetry(entry.deviceId, entry.signals);
      // Remove from pending after successful send
      const updated = pendingTelemetry.filter(
        (e: any) => e.timestamp !== entry.timestamp
      );
      localStorage.setItem(
        'vitalcv_pending_telemetry',
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('[TELEMETRY] Failed to send pending telemetry', error);
    }
  }
}

/**
 * Initialize telemetry collection
 * Call this on page load or app initialization
 */
export function initTelemetry(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Collect and send telemetry
  const deviceId = getOrCreateDeviceId();
  const signals = collectSignals();

  // Send immediately
  sendTelemetry(deviceId, signals).catch((error) => {
    console.error('[TELEMETRY] Failed to send initial telemetry', error);
  });

  // Listen for online event to send pending telemetry
  window.addEventListener('online', () => {
    sendPendingTelemetry().catch((error) => {
      console.error('[TELEMETRY] Failed to send pending telemetry on online', error);
    });
  });

  // Periodically send telemetry (every 5 minutes)
  setInterval(() => {
    const currentDeviceId = getOrCreateDeviceId();
    const currentSignals = collectSignals();
    sendTelemetry(currentDeviceId, currentSignals).catch((error) => {
      console.error('[TELEMETRY] Failed to send periodic telemetry', error);
    });
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Manually send telemetry (useful for testing or specific events)
 */
export async function sendTelemetryNow(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const deviceId = getOrCreateDeviceId();
  const signals = collectSignals();
  await sendTelemetry(deviceId, signals);
}

/**
 * Get current device ID (useful for debugging or passing to API)
 */
export function getDeviceId(): string {
  return getOrCreateDeviceId();
}

