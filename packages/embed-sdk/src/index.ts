export interface VitalCVWidgetConfig {
  clientId: string;
  baseUrl?: string;
  jobId?: string;
  role?: string;
  /** 10-digit clinician NPI. When supplied, the widget requests the
   *  matching manifest server-side and renders readiness + claims +
   *  limitations + a single action button for that clinician. */
  npi?: string;
  /** Employer identity used in manifest attribution + audit rows.
   *  Defaults to clientId when omitted. */
  employerId?: string;
  creds?: string | string[];
  theme?: string;
  width?: number | string;
  height?: number | string;
  title?: string;
  onVerified?: (message: VitalCVVerifiedMessage) => void;
  onError?: (message: VitalCVErrorMessage) => void;
  onClose?: () => void;
}

export interface VitalCVVerifiedMessage {
  type: 'VITALCV_VERIFIED';
  payload?: Record<string, unknown>;
}

export interface VitalCVErrorMessage {
  type: 'VITALCV_ERROR';
  payload?: Record<string, unknown>;
}

export interface VitalCVCloseMessage {
  type: 'VITALCV_CLOSE';
  payload?: Record<string, unknown>;
}

type VitalCVIncomingMessage =
  | VitalCVVerifiedMessage
  | VitalCVErrorMessage
  | VitalCVCloseMessage;

export interface VitalCVGlobal {
  mount(selector: string, config: VitalCVWidgetConfig): VitalCVWidget;
}

type ResolvedVitalCVWidgetConfig = Omit<VitalCVWidgetConfig, 'baseUrl'> & {
  baseUrl: string;
};

function normalizeBaseUrl(baseUrl?: string): string {
  const fallbackOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://vitalcv.com';
  return new URL(baseUrl ?? fallbackOrigin).toString().replace(/\/$/, '');
}

function normalizeDimension(
  value: number | string | undefined,
  fallback: string,
): string {
  if (typeof value === 'number') {
    return `${value}px`;
  }

  return value ?? fallback;
}

function serializeCreds(creds: string | string[] | undefined): string | null {
  if (Array.isArray(creds)) {
    return creds.join(',');
  }

  return creds ?? null;
}

function isWidgetMessage(data: unknown): data is VitalCVIncomingMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const candidate = data as { type?: unknown };
  return (
    candidate.type === 'VITALCV_VERIFIED'
    || candidate.type === 'VITALCV_ERROR'
    || candidate.type === 'VITALCV_CLOSE'
  );
}

export class VitalCVWidget {
  private readonly config: ResolvedVitalCVWidgetConfig;
  private readonly widgetOrigin: string;
  private container: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;

  constructor(config: VitalCVWidgetConfig) {
    this.config = {
      baseUrl: normalizeBaseUrl(config.baseUrl),
      jobId: '',
      role: '',
      creds: undefined,
      theme: 'light',
      width: '100%',
      height: 320,
      title: 'Apply with VitalCV',
      onVerified: undefined,
      onError: undefined,
      onClose: undefined,
      ...config,
    };
    this.widgetOrigin = new URL(this.config.baseUrl).origin;
    this._handleMessage = this._handleMessage.bind(this);
  }

  mount(selector: string): this {
    const container = document.querySelector<HTMLElement>(selector);

    if (!container) {
      throw new Error(`VitalCV mount target not found: ${selector}`);
    }

    this.unmount();
    this.container = container;
    window.addEventListener('message', this._handleMessage);
    this._renderIframe();
    return this;
  }

  unmount(): void {
    window.removeEventListener('message', this._handleMessage);
    this.iframe?.remove();
    this.iframe = null;
    this.container = null;
  }

  private _renderIframe(): void {
    if (!this.container) {
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = this.buildIframeSrc();
    iframe.title = this.config.title ?? 'Apply with VitalCV';
    iframe.loading = 'lazy';
    iframe.allow = 'clipboard-write';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.width = normalizeDimension(this.config.width, '100%');
    iframe.style.height = normalizeDimension(this.config.height, '320px');
    iframe.style.border = '0';
    iframe.style.borderRadius = '24px';
    iframe.style.background = 'transparent';
    iframe.style.overflow = 'hidden';

    this.container.replaceChildren(iframe);
    this.iframe = iframe;
  }

  private buildIframeSrc(): string {
    const url = new URL('/widget/apply', this.config.baseUrl);
    const creds = serializeCreds(this.config.creds);

    url.searchParams.set('clientId', this.config.clientId);
    url.searchParams.set('org', this.config.clientId);

    if (this.config.jobId) {
      url.searchParams.set('jobId', this.config.jobId);
      url.searchParams.set('job_id', this.config.jobId);
    }

    if (this.config.role) {
      url.searchParams.set('role', this.config.role);
    }

    if (this.config.npi) {
      url.searchParams.set('npi', this.config.npi);
    }

    const employerId = this.config.employerId ?? this.config.clientId;
    if (employerId) {
      url.searchParams.set('employerId', employerId);
    }

    if (creds) {
      url.searchParams.set('creds', creds);
    }

    if (this.config.theme) {
      url.searchParams.set('theme', this.config.theme);
    }

    if (typeof window !== 'undefined') {
      url.searchParams.set('parent_origin', window.location.origin);
      url.searchParams.set('return_url', window.location.href);
    }

    return url.toString();
  }

  private _handleMessage(event: MessageEvent<unknown>): void {
    if (event.origin !== this.widgetOrigin || !isWidgetMessage(event.data)) {
      return;
    }

    switch (event.data.type) {
      case 'VITALCV_VERIFIED':
        this.config.onVerified?.(event.data);
        return;

      case 'VITALCV_ERROR':
        this.config.onError?.(event.data);
        return;

      case 'VITALCV_CLOSE':
        this.config.onClose?.();
        this.unmount();
        return;
    }
  }
}

export const VitalCV: VitalCVGlobal = {
  mount(selector: string, config: VitalCVWidgetConfig): VitalCVWidget {
    return new VitalCVWidget(config).mount(selector);
  },
};

declare global {
  interface Window {
    VitalCV: VitalCVGlobal;
  }
}

if (typeof window !== 'undefined') {
  window.VitalCV = VitalCV;
}

export default VitalCV;
