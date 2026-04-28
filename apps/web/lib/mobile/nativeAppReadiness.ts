/**
 * FOUNDATION-SWEEP-4 — native app readiness foundation.
 *
 * Truth invariants:
 *   1. No native iOS or Android app is live. This module documents
 *      the planned-control shape; it does not invoke any device API.
 *   2. App Store / Play Store readiness is NOT claimed. Any future
 *      claim of "ready for store submission" requires its own gate.
 *   3. Device attestation (App Attest / Play Integrity), native
 *      camera capture, push notifications, secure storage, and the
 *      offline queue are PLANNED capabilities — every spec carries
 *      `isLive: false`.
 *   4. The plan does not bind to a vendor or framework. It documents
 *      what would have to be true before a native shell could ship.
 */

export type NativePlatform = 'ios' | 'android';

export type NativeReadinessStatus =
  | 'foundation_planned'
  | 'foundation_in_progress'
  | 'foundation_ready'
  | 'unavailable';

export type NativeReadinessCapability =
  | 'native_shell_planned'
  | 'secure_storage_planned'
  | 'document_capture_planned'
  | 'push_notifications_planned'
  | 'device_attestation_planned'
  | 'biometric_gate_planned'
  | 'offline_queue_planned';

export interface NativeReadinessSpec {
  platform: NativePlatform;
  capability: NativeReadinessCapability;
  label: string;
  description: string;
  /** Is this capability shipped + verified on this platform today? Always false. */
  isLive: boolean;
  /** What additional control or wave is required to make this live. */
  blockedBy: string;
  status: NativeReadinessStatus;
}

export interface NativeReadinessPlan {
  /** Are any native apps live today? Always false. */
  nativeAppLive: false;
  /** Is App Store / Play Store readiness claimed today? Always false. */
  storeReadinessClaimed: false;
  /** Is device attestation (App Attest / Play Integrity) live today? Always false. */
  deviceAttestationLive: false;
  specs: NativeReadinessSpec[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

const NATIVE_DISCLAIMER =
  'Native iOS and Android apps are planned foundations. No native app is live yet.';
const PLANNED_CONTROLS_DISCLAIMER =
  'App Attest, Play Integrity, push notifications, and native camera capture are planned controls.';
const STORE_DISCLAIMER =
  'App Store / Play Store readiness is not claimed by this foundation.';

const CAPABILITY_DEFS: Array<{
  capability: NativeReadinessCapability;
  label: string;
  description: string;
  blockedBy: string;
}> = [
  {
    capability: 'native_shell_planned',
    label: 'Native shell',
    description:
      'A native iOS / Android shell that can host the credentialing flow. Not present today; the live product runs in mobile web / PWA only.',
    blockedBy: 'No native shell wave has been authorized.',
  },
  {
    capability: 'secure_storage_planned',
    label: 'Secure on-device storage',
    description:
      'Keychain / Keystore-backed storage for session tokens and recovery material. Required before any session credential can persist on device.',
    blockedBy: 'Depends on the native shell wave.',
  },
  {
    capability: 'document_capture_planned',
    label: 'Native document capture',
    description:
      'Native camera capture with edge detection and quality checks. The web/PWA foundation only ships a placeholder.',
    blockedBy: 'Depends on the native shell wave + camera permissions flow.',
  },
  {
    capability: 'push_notifications_planned',
    label: 'Push notifications',
    description:
      'Apple Push Notification service / Firebase Cloud Messaging integration for recovery, freshness, and review nudges. Not wired today.',
    blockedBy: 'Depends on the native shell wave + notification consent flow.',
  },
  {
    capability: 'device_attestation_planned',
    label: 'Device attestation',
    description:
      'App Attest (iOS) / Play Integrity (Android) device attestation tokens used to harden sensitive endpoints. Not implemented today.',
    blockedBy: 'Depends on the native shell wave + server-side verifier.',
  },
  {
    capability: 'biometric_gate_planned',
    label: 'Biometric gate',
    description:
      'Local device-auth (Face ID / Touch ID / fingerprint) gate for sensitive actions. See the biometric gating foundation for invariants.',
    blockedBy: 'Depends on biometric gating foundation + native shell.',
  },
  {
    capability: 'offline_queue_planned',
    label: 'Offline queue',
    description:
      'Durable on-device queue for actions taken while offline. Required before any "submit later" flow can ship truthfully.',
    blockedBy: 'Depends on the native shell wave + sync protocol.',
  },
];

export function buildNativeAppReadinessPlan(): NativeReadinessPlan {
  const specs: NativeReadinessSpec[] = [];
  for (const platform of ['ios', 'android'] as const) {
    for (const def of CAPABILITY_DEFS) {
      specs.push({
        platform,
        capability: def.capability,
        label: `${def.label} (${platform})`,
        description: def.description,
        isLive: false,
        blockedBy: def.blockedBy,
        status: 'foundation_planned',
      });
    }
  }
  return {
    nativeAppLive: false,
    storeReadinessClaimed: false,
    deviceAttestationLive: false,
    specs,
    disclaimers: [
      NATIVE_DISCLAIMER,
      PLANNED_CONTROLS_DISCLAIMER,
      STORE_DISCLAIMER,
    ],
  };
}

export function explainNativeReadinessStatus(status: NativeReadinessStatus): string {
  switch (status) {
    case 'foundation_planned':
      return 'Foundation is documented; capability has not shipped on this platform.';
    case 'foundation_in_progress':
      return 'Foundation work is underway; capability is not yet runnable.';
    case 'foundation_ready':
      return 'Foundation is in place; capability is wired but not yet certified end-to-end.';
    case 'unavailable':
      return 'Capability is unavailable in this environment.';
  }
}
