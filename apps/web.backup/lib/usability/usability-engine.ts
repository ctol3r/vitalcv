/**
 * UsabilityEngine - Core engine for zero-step identity activation and automation
 * Manages auto-detection, auto-restore, and all usability features
 */

export interface UsabilitySettings {
  oneTapMode: boolean;
  autoDetectIdentity: boolean;
  autoRestoreState: boolean;
  autoSyncCredentials: boolean;
  autoSyncStateBoards: boolean;
  autoSyncDEA: boolean;
  autoSyncCompact: boolean;
  smartNotifications: boolean;
  zeroRedundancyMode: boolean;
  lightModeUX: boolean;
  gestureOnlyMode: boolean;
  undergroundMode: boolean;
  peakEfficiencyMode: boolean;
  zeroCognitiveLoadMode: boolean;
}

export interface AppState {
  lastRoute?: string;
  lastTimestamp?: number;
  lastContext?: Record<string, unknown>;
}

export interface IdentityHint {
  npi?: string;
  email?: string;
  deviceId?: string;
  role?: string;
  confidence: number;
}

const STORAGE_KEY_SETTINGS = 'vitalcv_usability_settings';
const STORAGE_KEY_STATE = 'vitalcv_app_state';
const STORAGE_KEY_IDENTITY_HINTS = 'vitalcv_identity_hints';

const DEFAULT_SETTINGS: UsabilitySettings = {
  oneTapMode: false,
  autoDetectIdentity: true,
  autoRestoreState: true,
  autoSyncCredentials: true,
  autoSyncStateBoards: false,
  autoSyncDEA: false,
  autoSyncCompact: false,
  smartNotifications: true,
  zeroRedundancyMode: false,
  lightModeUX: false,
  gestureOnlyMode: false,
  undergroundMode: false,
  peakEfficiencyMode: false,
  zeroCognitiveLoadMode: false,
};

export class UsabilityEngine {
  private settings: UsabilitySettings;
  private state: AppState | null = null;
  private identityHints: IdentityHint[] = [];

  constructor() {
    this.settings = this.loadSettings();
    this.state = this.loadState();
    this.identityHints = this.loadIdentityHints();
  }

  // Settings Management
  getSettings(): UsabilitySettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<UsabilitySettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.saveSettings();
  }

  private loadSettings(): UsabilitySettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to load settings:', error);
    }
    return DEFAULT_SETTINGS;
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to save settings:', error);
    }
  }

  // State Management
  saveState(state: AppState): void {
    this.state = {
      ...state,
      lastTimestamp: Date.now(),
    };
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(this.state));
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to save state:', error);
    }
  }

  getState(): AppState | null {
    return this.state ? { ...this.state } : null;
  }

  private loadState(): AppState | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_STATE);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore if less than 24 hours old
        if (parsed.lastTimestamp && Date.now() - parsed.lastTimestamp < 24 * 60 * 60 * 1000) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to load state:', error);
    }
    return null;
  }

  clearState(): void {
    this.state = null;
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY_STATE);
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to clear state:', error);
    }
  }

  // Identity Detection
  async detectIdentity(): Promise<IdentityHint | null> {
    if (!this.settings.autoDetectIdentity) return null;

    // Check for stored NPI in session
    try {
      const session = localStorage.getItem('vital-cv-session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.npi) {
          return {
            npi: parsed.npi,
            email: parsed.email,
            role: parsed.roles?.[0],
            confidence: 0.9,
          };
        }
      }
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to detect identity from session:', error);
    }

    // Check for NPI in device autofill (iOS Keychain simulation)
    // In production, this would use Web Credentials API or similar
    try {
      const autofillNpi = localStorage.getItem('vitalcv_autofill_npi');
      if (autofillNpi) {
        return {
          npi: autofillNpi,
          confidence: 0.7,
        };
      }
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to detect identity from autofill:', error);
    }

    // Check identity hints
    if (this.identityHints.length > 0) {
      const bestHint = this.identityHints.sort((a, b) => b.confidence - a.confidence)[0];
      if (bestHint.confidence > 0.5) {
        return bestHint;
      }
    }

    return null;
  }

  addIdentityHint(hint: IdentityHint): void {
    this.identityHints.push(hint);
    // Keep only top 10 hints
    this.identityHints = this.identityHints
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    this.saveIdentityHints();
  }

  private loadIdentityHints(): IdentityHint[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_IDENTITY_HINTS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to load identity hints:', error);
    }
    return [];
  }

  private saveIdentityHints(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_IDENTITY_HINTS, JSON.stringify(this.identityHints));
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to save identity hints:', error);
    }
  }

  // Auto-claim NPI flow
  async autoClaimNPI(npi: string): Promise<boolean> {
    if (!this.settings.oneTapMode) return false;

    try {
      // In production, this would call the actual claim API
      const response = await fetch('/api/claim/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi, auto: true }),
      });

      if (response.ok) {
        this.addIdentityHint({
          npi,
          confidence: 0.95,
        });
        return true;
      }
    } catch (error) {
      console.warn('[UsabilityEngine] Auto-claim failed:', error);
    }

    return false;
  }

  // Auto-restore last state
  shouldRestoreState(): boolean {
    return this.settings.autoRestoreState && this.state !== null;
  }

  // Refresh everything
  async refreshEverything(): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    if (this.settings.autoSyncCredentials) {
      tasks.push(this.refreshCredentials());
    }

    if (this.settings.autoSyncStateBoards) {
      tasks.push(this.refreshStateBoards());
    }

    if (this.settings.autoSyncDEA) {
      tasks.push(this.refreshDEA());
    }

    if (this.settings.autoSyncCompact) {
      tasks.push(this.refreshCompact());
    }

    await Promise.allSettled(tasks);
  }

  private async refreshCredentials(): Promise<void> {
    try {
      await fetch('/api/credentials/refresh', { method: 'POST' });
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to refresh credentials:', error);
    }
  }

  private async refreshStateBoards(): Promise<void> {
    try {
      await fetch('/api/state-boards/sync', { method: 'POST' });
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to sync state boards:', error);
    }
  }

  private async refreshDEA(): Promise<void> {
    try {
      await fetch('/api/dea/sync', { method: 'POST' });
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to sync DEA:', error);
    }
  }

  private async refreshCompact(): Promise<void> {
    try {
      await fetch('/api/compact/eligibility', { method: 'POST' });
    } catch (error) {
      console.warn('[UsabilityEngine] Failed to refresh Compact:', error);
    }
  }
}

// Singleton instance
let engineInstance: UsabilityEngine | null = null;

export function getUsabilityEngine(): UsabilityEngine {
  if (typeof window === 'undefined') {
    // Server-side: return a mock that does nothing
    return {
      getSettings: () => DEFAULT_SETTINGS,
      updateSettings: () => {},
      saveState: () => {},
      getState: () => null,
      clearState: () => {},
      detectIdentity: async () => null,
      addIdentityHint: () => {},
      autoClaimNPI: async () => false,
      shouldRestoreState: () => false,
      refreshEverything: async () => {},
    } as UsabilityEngine;
  }

  if (!engineInstance) {
    engineInstance = new UsabilityEngine();
  }
  return engineInstance;
}






