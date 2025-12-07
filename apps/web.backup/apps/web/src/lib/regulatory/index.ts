/**
 * Regulatory Portal - Main Export
 * Task 40: Anchor Regulatory Portal v1.0 snapshot
 *
 * Version: 1.0.0
 * Release Date: 2024
 *
 * Features:
 * - State Board Integration (8 tasks)
 * - DEA & MATE Integration (8 tasks)
 * - CMS/PECOS Integration (8 tasks)
 * - Payer Enrollment Sync (8 tasks)
 * - Regulatory Portal Foundation (8 tasks)
 */

export * from './models';
export * from './view-model';
export * from './deep-links';

export const REGULATORY_PORTAL_VERSION = '1.0.0';
export const REGULATORY_PORTAL_FEATURES = [
  'State Board License Management',
  'DEA Compliance & MATE Act Verification',
  'CMS/PECOS Enrollment Tracking',
  'Payer Enrollment Management',
  'Chain-Anchored Regulatory Documents',
  'Regulatory Trust Score Calculation',
  'Automated Verification Packets',
  'Deep Link Support',
] as const;








