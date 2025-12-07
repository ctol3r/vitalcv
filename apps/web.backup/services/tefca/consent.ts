/**
 * Simple in-memory consent store for TEFCA directory sharing.
 * Clinicians can opt out of sharing location details in PractitionerRole resources.
 */

export interface DirectoryConsentRecord {
  subjectId: string;
  shareDirectory: boolean;
  updatedAt: string;
}

const consentStore = new Map<string, DirectoryConsentRecord>();

export function setDirectoryConsent(subjectId: string, shareDirectory: boolean): DirectoryConsentRecord {
  const record: DirectoryConsentRecord = {
    subjectId,
    shareDirectory,
    updatedAt: new Date().toISOString(),
  };
  consentStore.set(subjectId, record);
  return record;
}

export function getDirectoryConsent(subjectId: string): boolean {
  return consentStore.get(subjectId)?.shareDirectory ?? true;
}

export function resetDirectoryConsents(): void {
  consentStore.clear();
}

export function applyDirectoryConsent<T extends Record<string, any>>(resource: T): T {
  if (!resource || resource.resourceType !== 'PractitionerRole') {
    return resource;
  }

  const practitionerRef: string | undefined = resource.practitioner?.reference;
  const practitionerId = practitionerRef?.split('/')[1] || resource.id;

  if (!practitionerId) {
    return resource;
  }

  if (getDirectoryConsent(practitionerId)) {
    return resource;
  }

  const clone = { ...resource };
  delete clone.location;
  return clone;
}
/**
 * B166B-TEFCA-006: TEFCA consent stub (data-sharing toggle)
 *
 * Stores clinician consent flags for sharing directory info. When consent is disabled,
 * PractitionerRole location details must be hidden.
 */

const DEFAULT_CONSENTS: Record<string, boolean> = {
  'practitioner-1': true,
  'practitioner-2': false,
};

const consentStore = new Map<string, boolean>(Object.entries(DEFAULT_CONSENTS));

export function setDirectoryConsent(practitionerId: string, allowed: boolean): void {
  consentStore.set(practitionerId, allowed);
}

export function hasDirectoryConsent(practitionerId: string): boolean {
  if (!consentStore.has(practitionerId)) {
    return true;
  }
  return consentStore.get(practitionerId) ?? true;
}

export function resetConsentStore(): void {
  consentStore.clear();
  for (const [practitionerId, allowed] of Object.entries(DEFAULT_CONSENTS)) {
    consentStore.set(practitionerId, allowed);
  }
}


