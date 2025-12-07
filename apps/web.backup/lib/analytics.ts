/**
 * Analytics & Telemetry Library
 * Frontend event tracking with opt-out support
 * Task: 1104-frontend-0023
 */

'use client';

const ANALYTICS_OPT_OUT_KEY = 'vitalcv:analytics-opt-out';
const SESSION_ID_KEY = 'vitalcv:session-id';

// Event types
export type AnalyticsEventName =
  | 'npi_lookup'
  | 'npi_lookup_success'
  | 'npi_lookup_failure'
  | 'share_start'
  | 'share_done'
  | 'share_cancel'
  | 'disclosure_preset_selected'
  | 'vp_verify_start'
  | 'vp_verify_success'
  | 'vp_verify_failure'
  | 'credential_view'
  | 'credential_share'
  | 'qr_scan_start'
  | 'qr_scan_success'
  | 'qr_scan_failure'
  | 'camera_permission_granted'
  | 'camera_permission_denied'
  | 'torch_toggle'
  | 'camera_switch'
  | 'issuer_upload_start'
  | 'issuer_upload_complete'
  | 'ocr_prefill_used'
  | 'role_switch'
  | 'page_view'
  | 'error';

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  timestamp: string;
  sessionId: string;
  requestId?: string;
  properties?: Record<string, any>;
  userId?: string;
  userAgent?: string;
  page?: string;
}

class Analytics {
  private sessionId: string;
  private isOptedOut: boolean;
  private queue: AnalyticsEvent[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionId = this.initializeSession();
    this.isOptedOut = this.checkOptOut();
  }

  /**
   * Initialize or retrieve session ID
   */
  private initializeSession(): string {
    if (typeof window === 'undefined') return 'server-session';

    try {
      const existingSessionId = sessionStorage.getItem(SESSION_ID_KEY);
      if (existingSessionId) {
        return existingSessionId;
      }

      const newSessionId = this.generateSessionId();
      sessionStorage.setItem(SESSION_ID_KEY, newSessionId);
      return newSessionId;
    } catch (error) {
      console.error('Failed to initialize analytics session:', error);
      return this.generateSessionId();
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Check if user has opted out of analytics
   */
  private checkOptOut(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const optOut = localStorage.getItem(ANALYTICS_OPT_OUT_KEY);
      return optOut === 'true';
    } catch (error) {
      console.error('Failed to check analytics opt-out:', error);
      return false;
    }
  }

  /**
   * Track an analytics event
   */
  track(name: AnalyticsEventName, properties?: Record<string, any>): void {
    if (this.isOptedOut) {
      return;
    }

    const event: AnalyticsEvent = {
      name,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      properties: properties || {},
      page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    // Add to queue
    this.queue.push(event);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event.name, event.properties);
    }

    // Schedule flush
    this.scheduleFlush();
  }

  /**
   * Track page view
   */
  pageView(path?: string): void {
    this.track('page_view', {
      path: path || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    });
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.track('error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...context,
    });
  }

  /**
   * Schedule batch flush of events
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      return;
    }

    this.flushTimeout = setTimeout(() => {
      this.flush();
      this.flushTimeout = null;
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Flush queued events to backend
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isOptedOut) {
      return;
    }

    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

      await fetch(`${backendUrl}/api/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsToSend }),
      });
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      // Re-queue events on failure
      this.queue.push(...eventsToSend);
    }
  }

  /**
   * Opt out of analytics
   */
  optOut(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
      this.isOptedOut = true;
      this.queue = [];
      console.log('[Analytics] User opted out of tracking');
    } catch (error) {
      console.error('Failed to opt out of analytics:', error);
    }
  }

  /**
   * Opt back in to analytics
   */
  optIn(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
      this.isOptedOut = false;
      console.log('[Analytics] User opted in to tracking');
    } catch (error) {
      console.error('Failed to opt in to analytics:', error);
    }
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return !this.isOptedOut;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Create singleton instance
const analytics = new Analytics();

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    analytics.flush();
  });
}

export default analytics;

/**
 * React hook for analytics
 */
export function useAnalytics() {
  return {
    track: analytics.track.bind(analytics),
    pageView: analytics.pageView.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    optOut: analytics.optOut.bind(analytics),
    optIn: analytics.optIn.bind(analytics),
    isEnabled: analytics.isEnabled.bind(analytics),
  };
}

