/**
 * B137A-PECOS-006: PECOS status update stub
 *
 * Simulates CMS PECOS (Provider Enrollment, Chain, and Ownership System) API
 * for checking Medicare enrollment and revalidation status.
 *
 * Implements mocked 855I (initial enrollment) and 855R (revalidation) state tracking.
 *
 * Real integration TODO:
 * - Implement PECOS API authentication via CMS Enterprise Portal
 * - Use actual PECOS enrollment verification endpoints
 * - Handle async status checks and callbacks
 * - Implement proper error handling and retry logic
 */

export interface PecosEnrollmentStatus {
  pecosEnrollmentId: string;
  npi: string;
  enrollmentType: '855I' | '855R' | '855A' | '855B'; // Initial, Revalidation, Reassignment, Ordering/Referring
  status:
    | 'PENDING'
    | 'IN_REVIEW'
    | 'APPROVED'
    | 'DENIED'
    | 'REVOKED'
    | 'DEACTIVATED'
    | 'REVALIDATION_DUE';
  effectiveDate: string | null; // ISO date when enrollment became effective
  expirationDate: string | null; // ISO date when enrollment expires
  revalidationDueDate: string | null; // ISO date when revalidation is due
  lastRevalidationDate: string | null;
  cycle: '5year' | '3year'; // Standard 5-year or DMEPOS 3-year
  specialty: string; // Taxonomy code
  practiceLocations: Array<{
    address: string;
    city: string;
    state: string;
    zip: string;
  }>;
  details?: {
    applicationDate?: string;
    approvalDate?: string;
    denialReason?: string;
    notes?: string;
  };
}

export interface PecosStatusCheckOptions {
  enrollmentId?: string;
  npi?: string;
}

export interface PecosStatusCheckResult {
  success: boolean;
  status?: PecosEnrollmentStatus;
  error?: string;
  lastCheckedAt: Date;
}

/**
 * Gets PECOS enrollment status (MOCKED for demo/testing)
 *
 * @param options - Check options (enrollmentId or NPI)
 * @returns Mocked PECOS status
 */
export async function getPecosStatus(
  options: PecosStatusCheckOptions
): Promise<PecosStatusCheckResult> {
  const { enrollmentId, npi } = options;

  if (!enrollmentId && !npi) {
    return {
      success: false,
      error: 'Either enrollmentId or NPI is required',
      lastCheckedAt: new Date(),
    };
  }

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Generate mock enrollment ID if not provided
  const mockEnrollmentId = enrollmentId || `PECOS-${npi}-${Date.now()}`;

  // Mock successful response with various states
  const mockStatuses: PecosEnrollmentStatus[] = [
    {
      pecosEnrollmentId: mockEnrollmentId,
      npi: npi || '1234567890',
      enrollmentType: '855I',
      status: 'APPROVED',
      effectiveDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000).toISOString(), // 3 years ago
      expirationDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years from now
      revalidationDueDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(),
      lastRevalidationDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000).toISOString(),
      cycle: '5year',
      specialty: '207R00000X', // Internal Medicine
      practiceLocations: [
        {
          address: '123 Medical Plaza',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
        },
      ],
      details: {
        applicationDate: new Date(Date.now() - 1125 * 24 * 60 * 60 * 1000).toISOString(),
        approvalDate: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    {
      pecosEnrollmentId: mockEnrollmentId,
      npi: npi || '1234567890',
      enrollmentType: '855R',
      status: 'REVALIDATION_DUE',
      effectiveDate: new Date(Date.now() - 1825 * 24 * 60 * 60 * 1000).toISOString(), // 5 years ago
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      revalidationDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastRevalidationDate: new Date(Date.now() - 1825 * 24 * 60 * 60 * 1000).toISOString(),
      cycle: '5year',
      specialty: '207R00000X',
      practiceLocations: [
        {
          address: '123 Medical Plaza',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
        },
      ],
      details: {
        notes: 'Revalidation required within 30 days to maintain enrollment',
      },
    },
  ];

  // Randomly select a status (90% approved, 10% revalidation due)
  const mockStatus =
    Math.random() < 0.9 ? mockStatuses[0] : mockStatuses[1];

  // Simulate occasional errors (5% chance)
  if (Math.random() < 0.05) {
    return {
      success: false,
      error: 'PECOS system temporarily unavailable',
      lastCheckedAt: new Date(),
    };
  }

  return {
    success: true,
    status: mockStatus,
    lastCheckedAt: new Date(),
  };
}

/**
 * Validates if PECOS enrollment is active and current
 *
 * @param status - PECOS enrollment status
 * @returns Validation result with details
 */
export function validatePecosStatus(status: PecosEnrollmentStatus): {
  isValid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check enrollment status
  if (status.status !== 'APPROVED') {
    reasons.push(`PECOS enrollment status is ${status.status}, must be APPROVED`);
  }

  // Check if enrollment is expired
  if (status.expirationDate) {
    const expirationDate = new Date(status.expirationDate);
    if (expirationDate < new Date()) {
      reasons.push('PECOS enrollment has expired');
    }
  }

  // Check if revalidation is overdue
  if (status.revalidationDueDate) {
    const revalidationDue = new Date(status.revalidationDueDate);
    if (revalidationDue < new Date()) {
      reasons.push('PECOS revalidation is overdue');
    }
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

/**
 * Checks if PECOS revalidation is due soon
 *
 * @param status - PECOS enrollment status
 * @param daysThreshold - Days before revalidation due to trigger warning
 * @returns True if revalidation is needed soon
 */
export function needsPecosRevalidation(
  status: PecosEnrollmentStatus,
  daysThreshold: number = 90
): boolean {
  if (!status.revalidationDueDate) return false;

  const revalidationDue = new Date(status.revalidationDueDate);
  const daysUntilRevalidation =
    (revalidationDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilRevalidation <= daysThreshold && daysUntilRevalidation >= 0;
}

/**
 * Calculates next revalidation date based on approval date and cycle
 *
 * @param approvalDate - Date when enrollment was approved
 * @param cycle - Revalidation cycle (5-year or 3-year DMEPOS)
 * @returns Next revalidation due date
 */
export function calculatePecosRevalidationDate(
  approvalDate: Date,
  cycle: '5year' | '3year' = '5year'
): Date {
  const revalidationDate = new Date(approvalDate);
  const years = cycle === '5year' ? 5 : 3;
  revalidationDate.setFullYear(revalidationDate.getFullYear() + years);
  return revalidationDate;
}

/**
 * Gets reminder schedule for PECOS revalidation
 *
 * @param revalidationDate - Date when revalidation is due
 * @returns Array of reminder dates
 */
export function getPecosRevalidationReminders(revalidationDate: Date): Date[] {
  const reminders: Date[] = [];
  const intervals = [90, 60, 30, 14, 7]; // Days before revalidation

  for (const days of intervals) {
    const reminderDate = new Date(revalidationDate);
    reminderDate.setDate(reminderDate.getDate() - days);

    // Only include future reminders
    if (reminderDate > new Date()) {
      reminders.push(reminderDate);
    }
  }

  return reminders;
}

// Mock PECOS status for unit tests
export const MOCK_PECOS_STATUS_APPROVED: PecosEnrollmentStatus = {
  pecosEnrollmentId: 'PECOS-TEST-001',
  npi: '1234567890',
  enrollmentType: '855I',
  status: 'APPROVED',
  effectiveDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  expirationDate: new Date(Date.now() + 1460 * 24 * 60 * 60 * 1000).toISOString(),
  revalidationDueDate: new Date(Date.now() + 1460 * 24 * 60 * 60 * 1000).toISOString(),
  lastRevalidationDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  cycle: '5year',
  specialty: '207R00000X',
  practiceLocations: [
    {
      address: '123 Test St',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
    },
  ],
};

export const MOCK_PECOS_STATUS_REVALIDATION_DUE: PecosEnrollmentStatus = {
  ...MOCK_PECOS_STATUS_APPROVED,
  status: 'REVALIDATION_DUE',
  revalidationDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

