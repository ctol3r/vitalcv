/**
 * @vitalcv/embed-sdk — Wave 50: Apply with VitalCV
 *
 * Zero-dependency embeddable SDK. Employers add a <script> tag and call
 * VitalCV.mount() to inject a secure credential verification widget.
 *
 * Usage:
 *   <script src="https://cdn.vitalcv.com/sdk/v1/embed.js"></script>
 *   <div id="vitalcv-widget"></div>
 *   <script>
 *     VitalCV.mount("#vitalcv-widget", {
 *       clientId: "org_abc123",
 *       jobId: "job_456",
 *       role: "Registered Nurse",
 *       requiredCredentials: ["medical_license", "board_certification"],
 *       onVerified: (receipt) => console.log("Verified!", receipt),
 *       onError: (err) => console.error(err),
 *     });
 *   </script>
 */

// ── Types ────────────────────────────────────────────────

export interface VitalCVConfig {
  clientId: string;
  jobId?: string;
  role?: string;
  requiredCredentials: string[];
  theme?: 'light' | 'dark';
  baseUrl?: string;
  onVerified?: (receipt: VerificationReceipt) => void;
  onError?: (error: WidgetError) => void;
  onClose?: () => void;
}

export interface VerificationReceipt {
  requestId: string;
  clinicianName: string;
  credentialsVerified: string[];
  readinessScore: number;
  verifiedAt: string;
  signature: string;
}

export interface WidgetError {
  code: string;
  message: string;
}

export interface VitalCVInstance {
  destroy: () => void;
  isReady: () => boolean;
}

// ── Message types from widget iframe ─────────────────────

interface VerifiedMessage {
  type: 'vitalcv:verified';
  payload: VerificationReceipt;
}

interface ErrorMessage {
  type: 'vitalcv:error';
  payload: WidgetError;
}

interface CloseMessage {
  type: 'vitalcv:close';
}

interface ResizeMessage {
  type: 'vitalcv:resize';
  height: number;
}

interface ReadyMessage {
  type: 'vitalcv:ready';
}

type WidgetMessage =
  | VerifiedMessage
  | ErrorMessage
  | CloseMessage
  | ResizeMessage
  | ReadyMessage;

// ── Helpers ──────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://app.vitalcv.com';

function isWidgetMessage(data: unknown): data is WidgetMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as WidgetMessage).type === 'string' &&
    (data as WidgetMessage).type.startsWith('vitalcv:')
  );
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

// ── Mount ────────────────────────────────────────────────

function mount(selector: string, config: VitalCVConfig): VitalCVInstance {
  // Validate required fields
  if (!config.clientId) {
    throw new Error('[VitalCV] clientId is required');
  }

  const container =
    typeof selector === 'string'
      ? document.querySelector<HTMLElement>(selector)
      : null;

  if (!container) {
    throw new Error(`[VitalCV] Element not found: ${selector}`);
  }

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const expectedOrigin = getOrigin(baseUrl);

  // Build iframe URL
  const iframeUrl = new URL('/embed/widget', baseUrl);
  iframeUrl.searchParams.set('clientId', config.clientId);
  if (config.jobId) iframeUrl.searchParams.set('jobId', config.jobId);
  if (config.role) iframeUrl.searchParams.set('role', config.role);
  if (config.requiredCredentials.length > 0) {
    iframeUrl.searchParams.set(
      'credentials',
      config.requiredCredentials.join(',')
    );
  }
  iframeUrl.searchParams.set('theme', config.theme || 'light');
  iframeUrl.searchParams.set('parentOrigin', window.location.origin);

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = iframeUrl.toString();
  iframe.style.width = '100%';
  iframe.style.minHeight = '400px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '12px';
  iframe.style.colorScheme = 'normal';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups'
  );
  iframe.title = 'VitalCV Credential Verification';

  let ready = false;

  // Message handler
  function handleMessage(event: MessageEvent): void {
    // Origin validation: only accept messages from our widget
    if (expectedOrigin && event.origin !== expectedOrigin) {
      return;
    }

    if (!isWidgetMessage(event.data)) {
      return;
    }

    const msg = event.data;

    switch (msg.type) {
      case 'vitalcv:ready':
        ready = true;
        break;

      case 'vitalcv:verified':
        config.onVerified?.(msg.payload);
        break;

      case 'vitalcv:error':
        config.onError?.(msg.payload);
        break;

      case 'vitalcv:close':
        config.onClose?.();
        break;

      case 'vitalcv:resize':
        if (typeof msg.height === 'number' && msg.height > 0) {
          iframe.style.height = `${msg.height}px`;
        }
        break;
    }
  }

  window.addEventListener('message', handleMessage);
  container.appendChild(iframe);

  // Return instance
  return {
    destroy() {
      window.removeEventListener('message', handleMessage);
      iframe.remove();
      ready = false;
    },
    isReady() {
      return ready;
    },
  };
}

// ── Attach to window ─────────────────────────────────────

declare global {
  interface Window {
    VitalCV: { mount: typeof mount };
  }
}

window.VitalCV = { mount };

export { mount };
