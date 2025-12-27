export type LifecycleActor = 'HOLDER' | 'EMPLOYER' | 'AUTHORITY' | 'SYSTEM';

export type RenewalStep = {
  id: string;
  title: string;
  description?: string;
  actor: LifecycleActor;
  referenceUrl?: string;
  expectedDurationDays?: number;
  metadata?: Record<string, unknown>;
};

export type CredentialAuthority = {
  id: string;
  name: string;
  jurisdiction?: string;
  contactUrl?: string;
  escalationEmail?: string;
  phoneNumber?: string;
  metadata?: Record<string, unknown>;
};

export type CredentialLifecycle = {
  expiresAt: Date;
  renewalWindowDays: number;
  renewalSteps: RenewalStep[];
};
