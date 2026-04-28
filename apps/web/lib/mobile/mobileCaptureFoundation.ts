/**
 * FOUNDATION-SWEEP-3 — mobile capture foundation.
 *
 * Truth invariants:
 *   - Native iOS and Android apps are NOT shipped. This foundation
 *     is mobile web / PWA only.
 *   - Native camera capture is NOT live. The "camera_capture_placeholder"
 *     capability documents the placeholder behavior and explicitly
 *     marks itself as `isLive: false`.
 *   - Offline sync is NOT implemented (see degraded-state foundation
 *     for the cross-cutting policy).
 *   - This module describes capability shape; it does not invoke
 *     device APIs.
 */

export type MobileCaptureCapability =
  | 'responsive_file_upload'
  | 'camera_capture_placeholder'
  | 'document_preview'
  | 'upload_error_handling'
  | 'mobile_touch_targets'
  | 'reduced_motion'
  | 'degraded_network_notice';

export type MobileCaptureStatus =
  | 'foundation_planned'
  | 'foundation_ready'
  | 'partial'
  | 'unavailable';

export interface MobileCaptureRequirement {
  capability: MobileCaptureCapability;
  label: string;
  /** What the foundation guarantees for this capability today. */
  description: string;
  /** Is this capability live (shipped + verified) today? */
  isLive: boolean;
  /** Phase label for the row, derived from isLive + scope. */
  status: MobileCaptureStatus;
}

export interface MobileCaptureFoundationPlan {
  scope: 'mobile_web_pwa_only';
  requirements: MobileCaptureRequirement[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

const NATIVE_DISCLAIMER =
  'Mobile document capture is a web/PWA foundation. Native camera workflows are not enabled yet.';
const NATIVE_APP_DISCLAIMER =
  'Native iOS and Android apps are not shipped. This page runs in mobile web / PWA only.';
const OFFLINE_DISCLAIMER =
  'Offline sync is not implemented. Working in degraded-network conditions stays in a local draft until a connection is restored.';

export function buildMobileCaptureFoundationPlan(): MobileCaptureFoundationPlan {
  const requirements: MobileCaptureRequirement[] = [
    {
      capability: 'responsive_file_upload',
      label: 'Responsive file upload',
      description:
        'A mobile-friendly file picker that accepts images and PDFs from the device gallery or files app.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'camera_capture_placeholder',
      label: 'Camera capture placeholder',
      description:
        'A clearly-labeled placeholder for native camera capture. NOT a working camera; clicking surfaces a "planned" notice.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'document_preview',
      label: 'Document preview',
      description:
        'A foundation-level preview of an uploaded image / PDF for the holder to confirm before submission.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'upload_error_handling',
      label: 'Upload error handling',
      description:
        'Surfaces user-safe error messages from the import-export foundation (no raw payload, stack, or secret).',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'mobile_touch_targets',
      label: 'Mobile touch targets',
      description:
        'All interactive controls follow the accessibility-foundation touch-target rule (≥ 44×44 CSS px on touch viewports).',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'reduced_motion',
      label: 'Reduced motion respect',
      description:
        'Animations gate on prefers-reduced-motion: reduce per the accessibility foundation.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'degraded_network_notice',
      label: 'Degraded network notice',
      description:
        'Surfaces the degraded-state foundation policy when the network is offline or upstream is unavailable.',
      isLive: false,
      status: 'foundation_planned',
    },
  ];

  return {
    scope: 'mobile_web_pwa_only',
    requirements,
    disclaimers: [NATIVE_DISCLAIMER, NATIVE_APP_DISCLAIMER, OFFLINE_DISCLAIMER],
  };
}

export function explainMobileCaptureStatus(status: MobileCaptureStatus): string {
  switch (status) {
    case 'foundation_planned':
      return 'Foundation is documented; capability has not shipped.';
    case 'foundation_ready':
      return 'Foundation is in place; capability is wired but not yet certified end-to-end.';
    case 'partial':
      return 'Capability ships in some flows; not yet uniform across mobile surfaces.';
    case 'unavailable':
      return 'Capability is unavailable in this environment.';
  }
}
