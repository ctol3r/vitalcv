/**
 * Payer Enrollment API Client
 *
 * Client-side functions for interacting with payer enrollment APIs
 */

import type {
  PayerEnrollment,
  PayerEnrollmentListResponse,
  PayerEnrollmentFilters,
  EnrollmentDraftData,
  PayerInfo,
  RevalidationReminder,
  PayerBillingMetrics,
  ApplicationPayerStatus,
} from './payer-types';

/**
 * Get list of enrollments for the current clinician
 */
export async function getEnrollments(
  filters?: PayerEnrollmentFilters
): Promise<PayerEnrollmentListResponse> {
  const params = new URLSearchParams();

  if (filters?.status) {
    filters.status.forEach(s => params.append('status', s));
  }
  if (filters?.payerId) params.append('payerId', filters.payerId);
  if (filters?.productLine) params.append('productLine', filters.productLine);
  if (filters?.revalidationDue) params.append('revalidationDue', 'true');
  if (filters?.search) params.append('search', filters.search);

  const response = await fetch(`/api/payer/enrollments?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch enrollments');
  }

  return response.json();
}

/**
 * Get a single enrollment by ID
 */
export async function getEnrollment(enrollmentId: string): Promise<PayerEnrollment> {
  const response = await fetch(`/api/payer/enrollments/${enrollmentId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch enrollment');
  }

  return response.json();
}

/**
 * Start a new enrollment draft (prepopulated from CAQH + VitalCV)
 */
export async function startEnrollmentDraft(
  payerId: string,
  clinicianNpi: string
): Promise<EnrollmentDraftData> {
  const response = await fetch('/api/payer/enrollments/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payerId, clinicianNpi }),
  });

  if (!response.ok) {
    throw new Error('Failed to start enrollment draft');
  }

  return response.json();
}

/**
 * Submit enrollment draft
 */
export async function submitEnrollment(
  draftData: Partial<PayerEnrollment>
): Promise<PayerEnrollment> {
  const response = await fetch('/api/payer/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draftData),
  });

  if (!response.ok) {
    throw new Error('Failed to submit enrollment');
  }

  return response.json();
}

/**
 * Update an existing enrollment
 */
export async function updateEnrollment(
  enrollmentId: string,
  updates: Partial<PayerEnrollment>
): Promise<PayerEnrollment> {
  const response = await fetch(`/api/payer/enrollments/${enrollmentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update enrollment');
  }

  return response.json();
}

/**
 * Upload evidence document
 */
export async function uploadEvidence(
  enrollmentId: string,
  file: File,
  type: string
): Promise<PayerEnrollment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await fetch(`/api/payer/enrollments/${enrollmentId}/evidence`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload evidence');
  }

  return response.json();
}

/**
 * Download evidence ZIP for an enrollment
 */
export async function downloadEvidenceZip(enrollmentId: string): Promise<Blob> {
  const response = await fetch(`/api/payer/enrollments/${enrollmentId}/evidence/zip`);

  if (!response.ok) {
    throw new Error('Failed to download evidence');
  }

  return response.blob();
}

/**
 * Get available payers
 */
export async function getPayers(): Promise<PayerInfo[]> {
  const response = await fetch('/api/payer/payers');

  if (!response.ok) {
    throw new Error('Failed to fetch payers');
  }

  return response.json();
}

/**
 * Get revalidation reminders
 */
export async function getRevalidationReminders(): Promise<RevalidationReminder[]> {
  const response = await fetch('/api/payer/reminders');

  if (!response.ok) {
    throw new Error('Failed to fetch reminders');
  }

  return response.json();
}

/**
 * Dismiss a revalidation reminder
 */
export async function dismissReminder(enrollmentId: string): Promise<void> {
  const response = await fetch(`/api/payer/reminders/${enrollmentId}/dismiss`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to dismiss reminder');
  }
}

/**
 * Get billing metrics for org
 */
export async function getPayerBillingMetrics(
  filters?: { payerId?: string }
): Promise<PayerBillingMetrics[]> {
  const params = new URLSearchParams();
  if (filters?.payerId) params.append('payerId', filters.payerId);

  const response = await fetch(`/api/org/billing/payers?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch billing metrics');
  }

  return response.json();
}

/**
 * Get payer status for a job application
 */
export async function getApplicationPayerStatus(
  jobId: string
): Promise<ApplicationPayerStatus> {
  const response = await fetch(`/api/jobs/${jobId}/payer-status`);

  if (!response.ok) {
    throw new Error('Failed to fetch application payer status');
  }

  return response.json();
}

