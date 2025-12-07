'use client';

const DEVICE_SIG_STORAGE_KEY = 'bot.device.signature';

export interface StatsSummary {
  samples: number;
  average: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface TimingJitterSignal extends StatsSummary {
  deltas: number[];
}

export interface CanvasEntropySignal {
  hash: string | null;
  entropy: number;
  width: number;
  height: number;
}

export interface WebglFingerprintSignal {
  vendor: string | null;
  renderer: string | null;
  shadingLanguage: string | null;
  extensionsHash: string | null;
  antialias: boolean | null;
  maxTextureSize: number | null;
}

export interface PointerVelocitySignal extends StatsSummary {
  curve: number[];
}

export interface BotSignalSnapshot {
  capturedAt: string;
  timingJitter: TimingJitterSignal;
  canvasEntropy: CanvasEntropySignal;
  webglFingerprint: WebglFingerprintSignal;
  pointerVelocity: PointerVelocitySignal;
}

export interface BotSignalOptions {
  pointerWindowMs?: number;
  jitterSamples?: number;
}

export async function collectBotSignals(options: BotSignalOptions = {}): Promise<BotSignalSnapshot> {
  if (!isBrowser()) {
    return buildEmptySnapshot();
  }

  const jitterSamples = options.jitterSamples ?? 24;
  const pointerWindowMs = options.pointerWindowMs ?? 600;

  const canvasEntropy = measureCanvasEntropy();
  const webglFingerprint = captureWebglFingerprint();
  const [timingJitter, pointerVelocity] = await Promise.all([
    measureTimingJitter(jitterSamples),
    measurePointerVelocity(pointerWindowMs),
  ]);

  return {
    capturedAt: new Date().toISOString(),
    timingJitter,
    canvasEntropy,
    webglFingerprint,
    pointerVelocity,
  };
}

export function getBotDeviceSignature(): string {
  if (!isBrowser()) {
    return 'server-device';
  }

  try {
    const cached = window.localStorage.getItem(DEVICE_SIG_STORAGE_KEY);
    if (cached) {
      return cached;
    }
  } catch {
    /* ignore */
  }

  const next = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `bot-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

  try {
    window.localStorage.setItem(DEVICE_SIG_STORAGE_KEY, next);
  } catch {
    /* ignore storage errors */
  }
  return next;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function buildEmptyStats(): StatsSummary {
  return {
    samples: 0,
    average: 0,
    stdDev: 0,
    min: 0,
    max: 0,
  };
}

function buildEmptySnapshot(): BotSignalSnapshot {
  const stats = buildEmptyStats();
  return {
    capturedAt: new Date().toISOString(),
    timingJitter: { ...stats, deltas: [] },
    canvasEntropy: {
      hash: null,
      entropy: 0,
      width: 0,
      height: 0,
    },
    webglFingerprint: {
      vendor: null,
      renderer: null,
      shadingLanguage: null,
      extensionsHash: null,
      antialias: null,
      maxTextureSize: null,
    },
    pointerVelocity: { ...stats, curve: [] },
  };
}

async function measureTimingJitter(samples: number): Promise<TimingJitterSignal> {
  if (!isBrowser() || typeof requestAnimationFrame === 'undefined' || typeof performance === 'undefined') {
    return { ...buildEmptyStats(), deltas: [] };
  }

  const deltas: number[] = [];
  let last = performance.now();

  for (let i = 0; i < samples; i += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const now = performance.now();
        deltas.push(Number((now - last).toFixed(3)));
        last = now;
        resolve();
      });
    });
  }

  return { ...summarize(deltas), deltas };
}

function measureCanvasEntropy(): CanvasEntropySignal {
  if (!isBrowser()) {
    return {
      hash: null,
      entropy: 0,
      width: 0,
      height: 0,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      hash: null,
      entropy: 0,
      width: canvas.width,
      height: canvas.height,
    };
  }

  ctx.textBaseline = 'top';
  ctx.font = '16px "Courier New", monospace';
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#223');
  gradient.addColorStop(1, '#9cf');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  const text = `${navigator.userAgent}|${getBotDeviceSignature()}|${Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'tz'}`;
  ctx.fillText(text, 8, 8);

  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = `rgba(${(i * 17) % 255}, ${(i * 31) % 255}, ${(i * 43) % 255}, 0.6)`;
    ctx.fillRect((i * 13) % canvas.width, (i * 19) % canvas.height, 32, 8);
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const histogram = new Map<number, number>();

  for (let i = 0; i < imageData.length; i += 4) {
    const channel = imageData[i];
    histogram.set(channel, (histogram.get(channel) ?? 0) + 1);
  }

  const total = Array.from(histogram.values()).reduce((sum, count) => sum + count, 0);
  let entropy = 0;
  histogram.forEach((count) => {
    const prob = count / (total || 1);
    entropy -= prob * Math.log2(prob);
  });
  const normalizedEntropy = Number((entropy / 8).toFixed(4)); // normalize to 0-1

  const sample = imageData.slice(0, 512);
  const hash = hashByteArray(sample);

  return {
    hash,
    entropy: normalizedEntropy,
    width: canvas.width,
    height: canvas.height,
  };
}

function captureWebglFingerprint(): WebglFingerprintSignal {
  if (!isBrowser()) {
    return {
      vendor: null,
      renderer: null,
      shadingLanguage: null,
      extensionsHash: null,
      antialias: null,
      maxTextureSize: null,
    };
  }

  const canvas = document.createElement('canvas');
  const gl =
    (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
    (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

  if (!gl) {
    return {
      vendor: null,
      renderer: null,
      shadingLanguage: null,
      extensionsHash: null,
      antialias: null,
      maxTextureSize: null,
    };
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as
    | {
        UNMASKED_VENDOR_WEBGL: number;
        UNMASKED_RENDERER_WEBGL: number;
      }
    | null;

  const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const shadingLanguage = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
  const extensions = gl.getSupportedExtensions() ?? [];
  const extensionsHash = extensions.length ? hashString(extensions.sort().join('|')) : null;
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const antialias = gl.getContextAttributes()?.antialias ?? null;

  return {
    vendor: typeof vendor === 'string' ? vendor : null,
    renderer: typeof renderer === 'string' ? renderer : null,
    shadingLanguage: typeof shadingLanguage === 'string' ? shadingLanguage : null,
    extensionsHash,
    antialias,
    maxTextureSize: typeof maxTextureSize === 'number' ? maxTextureSize : null,
  };
}

function measurePointerVelocity(windowMs: number): Promise<PointerVelocitySignal> {
  if (!isBrowser() || typeof performance === 'undefined') {
    return Promise.resolve({ ...buildEmptyStats(), curve: [] });
  }

  return new Promise((resolve) => {
    const velocities: number[] = [];
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastTime = performance.now();

    const handler = (event: PointerEvent | MouseEvent) => {
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const x = event.clientX;
      const y = event.clientY;

      if (lastX !== null && lastY !== null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const speed = (Math.hypot(dx, dy) / dt) * 1_000; // px per second
        if (Number.isFinite(speed)) {
          velocities.push(Number(speed.toFixed(2)));
        }
      }

      lastX = x;
      lastY = y;
      lastTime = now;
    };

    window.addEventListener('pointermove', handler, { passive: true });
    window.addEventListener('mousemove', handler, { passive: true });

    window.setTimeout(() => {
      window.removeEventListener('pointermove', handler);
      window.removeEventListener('mousemove', handler);
      resolve({ ...summarize(velocities), curve: velocities.slice(0, 64) });
    }, windowMs);
  });
}

function summarize(values: number[]): StatsSummary {
  if (!values.length) {
    return buildEmptyStats();
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  const average = sum / values.length;
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - average, 2), 0) / Math.max(1, values.length - 1);
  return {
    samples: values.length,
    average: Number(average.toFixed(3)),
    stdDev: Number(Math.sqrt(Math.max(variance, 0)).toFixed(3)),
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
  };
}

function hashByteArray(data: Uint8ClampedArray | Uint8Array): string {
  let hash = 2166136261;
  for (let i = 0; i < data.length; i += 1) {
    hash ^= data[i];
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}



