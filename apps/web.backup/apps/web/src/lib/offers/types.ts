/**
 * Offer Management Types
 * Phase 1-5: Complete offer lifecycle types
 */

export type OfferStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revoked'
  | 'withdrawn';

export type DeliveryMethod = 'email' | 'qr' | 'in-app' | 'chat';

export type CredentialRequirementType = 'license' | 'certification' | 'dea' | 'board' | 'other';

export interface CredentialRequirement {
  type: CredentialRequirementType;
  name: string;
  jurisdiction?: string;
  required: boolean;
  description?: string;
}

export interface OfferDraft {
  roleId: string;
  roleTitle: string;
  facilityName: string;
  facilityId?: string;
  startDate: string;
  salary: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
  notes?: string;
  recruiterDid: string;
  recruiterId: string;
  credentialRequirements: CredentialRequirement[];
  expirationHours?: number; // Default 48
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  offerId: string;
  roleId: string;
  roleTitle: string;
  facilityName: string;
  facilityId?: string;
  facilityTrustScore?: number;
  startDate: string;
  salary: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
  notes?: string;
  recruiterDid: string;
  recruiterId: string;
  recruiterName?: string;
  recruiterOrgName?: string;
  clinicianId?: string;
  clinicianDid?: string;
  credentialRequirements: CredentialRequirement[];
  status: OfferStatus;
  deliveryMethod?: DeliveryMethod;
  sentAt?: string;
  openedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  expiresAt?: string;
  expirationHours: number;
  matchScore?: number;
  trustScore?: number;
  signature?: {
    recruiterSignature: string;
    timestamp: string;
    algorithm: string;
  };
  chainAnchor?: {
    anchorId: string;
    txHash: string;
    blockHash: string;
    network: string;
    timestamp: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OfferLink {
  offerId: string;
  signedUrl: string;
  expiresAt: string;
  dpopToken: string;
  qrCodeDataUrl?: string;
}

export interface OfferNotification {
  offerId: string;
  recipientId: string;
  recipientDid?: string;
  channel: 'email' | 'in-app' | 'push';
  payload: {
    title: string;
    body: string;
    offerId: string;
    deepLink?: string;
  };
  sentAt: string;
  deliveredAt?: string;
}

export interface OfferAcceptancePayload {
  offerId: string;
  clinicianDid: string;
  clinicianId: string;
  acceptanceTimestamp: string;
  faceIdVerified: boolean;
  encryptedPayload: string; // AES-GCM encrypted
  dpopJwt: string;
  chainAnchorIntent?: {
    eventType: 'EmploymentIntent';
    metadata: Record<string, unknown>;
  };
}

export interface OfferAcceptanceReceipt {
  offerId: string;
  acceptanceId: string;
  receiptJwt: string;
  chainHash: string;
  timestamp: string;
  deepLink: string;
}

export interface CredentialReadinessCheck {
  requirement: CredentialRequirement;
  status: 'ready' | 'missing' | 'expiring' | 'expired';
  credentialId?: string;
  expiresInDays?: number;
  warning?: string;
}

export interface OfferPreviewData {
  offer: Offer;
  matchScore: number;
  trustScore: number;
  credentialReadiness: CredentialReadinessCheck[];
  complianceWarnings: string[];
}

export interface OfferTrackingEvent {
  offerId: string;
  event: 'sent' | 'opened' | 'accepted' | 'declined' | 'expired';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface RecruiterOfferView {
  offer: Offer;
  tracking: OfferTrackingEvent[];
  clinicianTrustScore?: number;
  credentialReadinessSnapshot?: CredentialReadinessCheck[];
}

export interface ClinicianAcceptedOfferView {
  offer: Offer;
  acceptanceTimestamp: string;
  trustLedgerEntry: {
    entryId: string;
    chainHash: string;
    timestamp: string;
  };
  nextSteps: {
    credentialOnboardingPacket?: string;
    facilityContact?: {
      name: string;
      email: string;
      phone?: string;
    };
  };
}

export interface OfferRevocationPayload {
  offerId: string;
  reason: string;
  revokedBy: string;
  revokedAt: string;
  chainAnchor?: {
    anchorId: string;
    txHash: string;
  };
}

