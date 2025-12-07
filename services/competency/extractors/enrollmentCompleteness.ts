/**
 * B205A-CCI-005: EnrollmentCompletenessCalculator
 *
 * Scores PECOS+Medicaid+payer readiness; missing payers reduce score.
 */

export interface PECOSEnrollment {
  status: 'ENROLLED' | 'PENDING' | 'DEACTIVATED' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
}

export interface MedicaidEnrollment {
  state: string;
  status: 'ENROLLED' | 'PENDING' | 'REJECTED' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
  required?: boolean; // B212A-ENROLL-002: Whether this state enrollment is required
  lastUpdated?: Date; // B212A-ENROLL-002: Last update timestamp for freshness check
  pecosAligned?: boolean; // B212A-ENROLL-002: Alignment with PECOS enrollment
}

export interface PayerEnrollment {
  payerId: string;
  payerName: string;
  status: 'ENROLLED' | 'PENDING' | 'REJECTED' | 'PANEL_FULL' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
  isRequired?: boolean; // Whether this payer is required for the clinician's practice
  lastUpdated?: Date; // B212A-ENROLL-003: Last update timestamp for freshness check
  confidenceScore?: number; // B212A-ENROLL-001: Confidence score (0-1)
  failureReason?: 'MISSING_DOCS' | 'REJECTED' | 'PENDING_REVIEW' | 'PAYER_PANEL_FULL'; // B212A-ENROLL-001
}

export interface EnrollmentCompletenessResult {
  completeness: number; // 0-1 normalized score
  pecosScore: number; // 0-1
  medicaidScore: number; // 0-1
  payerScore: number; // 0-1
  enrollmentFreshness: number; // B212A-ENROLL-003: Freshness score (0-1, penalty if >6 months)
  enrollmentCoverageScore: number; // B212A-ENROLL-005: Coverage score relative to region payer distribution (0-1)
  missingRequiredPayers: string[]; // List of required payers that are missing
  expiredPECOS: boolean; // B212A-ENROLL-004: Whether PECOS enrollment is expired
  missingPayers: string[]; // B212A-ENROLL-004: List of missing payers
  medicaidGaps: string[]; // B212A-ENROLL-004: List of states with Medicaid enrollment gaps
  payerFailures: Array<{ payerId: string; payerName: string; reason: string }>; // B212A-ENROLL-004
  alignmentFailures: string[]; // B212A-ENROLL-004: Medicaid states not aligned with PECOS
  breakdown: {
    pecos: { status: string; score: number };
    medicaid: { enrolledStates: number; totalStates: number; score: number };
    payers: { enrolled: number; required: number; total: number; score: number };
    freshness: { penalty: number; staleCount: number }; // B212A-ENROLL-003
    coverage: { coverageRatio: number; regionMatch: number }; // B212A-ENROLL-005
  };
}

/**
 * Calculate enrollment completeness
 */
export class EnrollmentCompletenessCalculator {
  /**
   * Score PECOS enrollment
   */
  private scorePECOS(pecos: PECOSEnrollment | null): number {
    if (!pecos) return 0;

    switch (pecos.status) {
      case 'ENROLLED':
        // Check if expired
        if (pecos.expiryDate && pecos.expiryDate < new Date()) {
          return 0.3; // Expired but was enrolled
        }
        return 1.0;
      case 'PENDING':
        return 0.5;
      case 'DEACTIVATED':
        return 0.0;
      case 'UNKNOWN':
        return 0.2;
      default:
        return 0;
    }
  }

  /**
   * Score Medicaid enrollment
   * For multi-state practice, consider all states
   */
  private scoreMedicaid(medicaidEnrollments: MedicaidEnrollment[]): {
    score: number;
    enrolledStates: number;
    totalStates: number;
  } {
    if (medicaidEnrollments.length === 0) {
      return { score: 0, enrolledStates: 0, totalStates: 0 };
    }

    const stateSet = new Set(medicaidEnrollments.map((m) => m.state));
    const totalStates = stateSet.size;

    if (totalStates === 0) {
      return { score: 0, enrolledStates: 0, totalStates: 0 };
    }

    let enrolledCount = 0;
    let pendingCount = 0;

    for (const enrollment of medicaidEnrollments) {
      switch (enrollment.status) {
        case 'ENROLLED':
          // Check if expired
          if (enrollment.expiryDate && enrollment.expiryDate < new Date()) {
            pendingCount++; // Expired counts as pending
          } else {
            enrolledCount++;
          }
          break;
        case 'PENDING':
          pendingCount++;
          break;
        case 'REJECTED':
          // Rejected doesn't count
          break;
        case 'UNKNOWN':
          pendingCount += 0.5; // Partial credit
          break;
      }
    }

    // Score: full credit for enrolled, half credit for pending
    const score = (enrolledCount + pendingCount * 0.5) / totalStates;
    return {
      score: Math.min(1, score),
      enrolledStates: enrolledCount,
      totalStates,
    };
  }

  /**
   * B212A-ENROLL-003: Calculate enrollment freshness score
   * Applies penalty if lastUpdated > 6 months
   */
  private scoreFreshness(
    payers: PayerEnrollment[],
    medicaid: MedicaidEnrollment[],
    pecos: PECOSEnrollment | null
  ): {
    score: number;
    penalty: number;
    staleCount: number;
  } {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const now = new Date();

    let staleCount = 0;
    let totalItems = 0;

    // Check payer enrollments
    for (const payer of payers) {
      totalItems++;
      if (payer.lastUpdated) {
        if (payer.lastUpdated < sixMonthsAgo) {
          staleCount++;
        }
      } else if (payer.enrollmentDate && payer.enrollmentDate < sixMonthsAgo) {
        staleCount++;
      }
    }

    // Check Medicaid enrollments
    for (const med of medicaid) {
      totalItems++;
      if (med.lastUpdated) {
        if (med.lastUpdated < sixMonthsAgo) {
          staleCount++;
        }
      } else if (med.enrollmentDate && med.enrollmentDate < sixMonthsAgo) {
        staleCount++;
      }
    }

    // Check PECOS
    if (pecos) {
      totalItems++;
      // PECOS doesn't have lastUpdated, use enrollmentDate or consider stale if expired
      if (pecos.expiryDate && pecos.expiryDate < now) {
        staleCount++;
      }
    }

    if (totalItems === 0) {
      return { score: 1.0, penalty: 0, staleCount: 0 };
    }

    const staleRatio = staleCount / totalItems;
    // Penalty: 0.1 per stale item, max 0.5 penalty
    const penalty = Math.min(0.5, staleRatio * 0.5);
    const score = Math.max(0, 1.0 - penalty);

    return { score, penalty, staleCount };
  }

  /**
   * B212A-ENROLL-005: Calculate enrollment coverage score by payer mix region
   * Score reflects coverage relative to region payer distribution
   */
  private scoreCoverage(
    payerEnrollments: PayerEnrollment[],
    regionPayerDistribution?: Record<string, number> // payerId -> percentage in region
  ): {
    score: number;
    coverageRatio: number;
    regionMatch: number;
  } {
    if (!regionPayerDistribution || Object.keys(regionPayerDistribution).length === 0) {
      // No region data, return neutral score
      return { score: 0.5, coverageRatio: 0, regionMatch: 0 };
    }

    const enrolledPayerIds = new Set(
      payerEnrollments
        .filter((p) => p.status === 'ENROLLED' && (!p.expiryDate || p.expiryDate >= new Date()))
        .map((p) => p.payerId)
    );

    // Calculate coverage ratio: enrolled payers / total region payers
    const totalRegionPayers = Object.keys(regionPayerDistribution).length;
    const enrolledInRegion = Array.from(enrolledPayerIds).filter((id) =>
      regionPayerDistribution.hasOwnProperty(id)
    ).length;
    const coverageRatio = totalRegionPayers > 0 ? enrolledInRegion / totalRegionPayers : 0;

    // Calculate region match: weighted by region distribution
    let weightedMatch = 0;
    let totalWeight = 0;
    for (const [payerId, weight] of Object.entries(regionPayerDistribution)) {
      totalWeight += weight;
      if (enrolledPayerIds.has(payerId)) {
        weightedMatch += weight;
      }
    }
    const regionMatch = totalWeight > 0 ? weightedMatch / totalWeight : 0;

    // Combined score: 60% coverage ratio, 40% region match
    const score = coverageRatio * 0.6 + regionMatch * 0.4;

    return { score: Math.min(1, score), coverageRatio, regionMatch };
  }

  /**
   * B212A-ENROLL-004: Classify failures and gaps
   */
  private classifyFailures(
    pecos: PECOSEnrollment | null,
    medicaid: MedicaidEnrollment[],
    payers: PayerEnrollment[]
  ): {
    expiredPECOS: boolean;
    missingPayers: string[];
    medicaidGaps: string[];
    payerFailures: Array<{ payerId: string; payerName: string; reason: string }>;
    alignmentFailures: string[];
  } {
    const now = new Date();
    const expiredPECOS =
      pecos !== null &&
      pecos.status === 'ENROLLED' &&
      pecos.expiryDate !== undefined &&
      pecos.expiryDate < now;

    const missingPayers: string[] = [];
    const payerFailures: Array<{ payerId: string; payerName: string; reason: string }> = [];

    for (const payer of payers) {
      const isEnrolled =
        payer.status === 'ENROLLED' && (!payer.expiryDate || payer.expiryDate >= now);

      if (!isEnrolled) {
        if (payer.isRequired) {
          missingPayers.push(payer.payerName || payer.payerId);
        }

        // Classify failure reason
        if (payer.failureReason) {
          payerFailures.push({
            payerId: payer.payerId,
            payerName: payer.payerName || payer.payerId,
            reason: payer.failureReason,
          });
        } else if (payer.status === 'REJECTED') {
          payerFailures.push({
            payerId: payer.payerId,
            payerName: payer.payerName || payer.payerId,
            reason: 'REJECTED',
          });
        } else if (payer.status === 'PANEL_FULL') {
          payerFailures.push({
            payerId: payer.payerId,
            payerName: payer.payerName || payer.payerId,
            reason: 'PAYER_PANEL_FULL',
          });
        }
      }
    }

    // Find Medicaid gaps (required states without enrollment)
    const medicaidGaps: string[] = [];
    const enrolledStates = new Set(
      medicaid
        .filter(
          (m) =>
            m.status === 'ENROLLED' && (!m.expiryDate || m.expiryDate >= now)
        )
        .map((m) => m.state)
    );

    for (const med of medicaid) {
      if (med.required && !enrolledStates.has(med.state)) {
        medicaidGaps.push(med.state);
      }
    }

    // Find alignment failures (Medicaid states not aligned with PECOS)
    const alignmentFailures: string[] = [];
    const hasPECOS = pecos !== null && pecos.status === 'ENROLLED';
    if (hasPECOS) {
      for (const med of medicaid) {
        if (med.pecosAligned === false) {
          alignmentFailures.push(med.state);
        }
      }
    }

    return {
      expiredPECOS,
      missingPayers,
      medicaidGaps,
      payerFailures,
      alignmentFailures,
    };
  }

  /**
   * Score payer enrollments
   */
  private scorePayers(payerEnrollments: PayerEnrollment[]): {
    score: number;
    enrolled: number;
    required: number;
    total: number;
    missingRequired: string[];
  } {
    if (payerEnrollments.length === 0) {
      return { score: 0, enrolled: 0, required: 0, total: 0, missingRequired: [] };
    }

    const requiredPayers = payerEnrollments.filter((p) => p.isRequired === true);
    const totalRequired = requiredPayers.length;
    const totalPayers = payerEnrollments.length;

    let enrolledCount = 0;
    let requiredEnrolledCount = 0;
    const missingRequired: string[] = [];

    for (const payer of payerEnrollments) {
      const isEnrolled = payer.status === 'ENROLLED' &&
        (!payer.expiryDate || payer.expiryDate >= new Date());

      if (isEnrolled) {
        enrolledCount++;
        if (payer.isRequired) {
          requiredEnrolledCount++;
        }
      } else if (payer.isRequired) {
        missingRequired.push(payer.payerName || payer.payerId);
      }
    }

    // Score calculation:
    // - Required payers are weighted more heavily (70% of score)
    // - Optional payers contribute to remaining 30%
    let score = 0;

    if (totalRequired > 0) {
      const requiredScore = requiredEnrolledCount / totalRequired;
      score += requiredScore * 0.7;
    } else {
      // If no required payers, use 70% for general enrollment
      score += 0.7;
    }

    if (totalPayers > totalRequired) {
      const optionalEnrolled = enrolledCount - requiredEnrolledCount;
      const optionalTotal = totalPayers - totalRequired;
      const optionalScore = optionalTotal > 0 ? optionalEnrolled / optionalTotal : 0;
      score += optionalScore * 0.3;
    } else {
      // If all payers are required, remaining 30% comes from required score
      score += (requiredEnrolledCount / totalRequired) * 0.3;
    }

    return {
      score: Math.min(1, score),
      enrolled: enrolledCount,
      required: totalRequired,
      total: totalPayers,
      missingRequired,
    };
  }

  /**
   * Calculate overall enrollment completeness
   */
  calculate(input: {
    pecos?: PECOSEnrollment | null;
    medicaid?: MedicaidEnrollment[];
    payers?: PayerEnrollment[];
    regionPayerDistribution?: Record<string, number>; // B212A-ENROLL-005: Region payer distribution
  }): EnrollmentCompletenessResult {
    const pecos = input.pecos || null;
    const medicaid = input.medicaid || [];
    const payers = input.payers || [];

    const pecosScore = this.scorePECOS(pecos);
    const medicaidResult = this.scoreMedicaid(medicaid);
    const payerResult = this.scorePayers(payers);
    const freshnessResult = this.scoreFreshness(payers, medicaid, pecos); // B212A-ENROLL-003
    const coverageResult = this.scoreCoverage(payers, input.regionPayerDistribution); // B212A-ENROLL-005
    const failures = this.classifyFailures(pecos, medicaid, payers); // B212A-ENROLL-004

    // Overall completeness: weighted average
    // PECOS: 25%, Medicaid: 15%, Payers: 40%, Freshness: 10%, Coverage: 10%
    const baseCompleteness =
      pecosScore * 0.25 +
      medicaidResult.score * 0.15 +
      payerResult.score * 0.4 +
      freshnessResult.score * 0.1 +
      coverageResult.score * 0.1;

    const completeness = Math.min(1, baseCompleteness);

    return {
      completeness,
      pecosScore,
      medicaidScore: medicaidResult.score,
      payerScore: payerResult.score,
      enrollmentFreshness: freshnessResult.score, // B212A-ENROLL-003
      enrollmentCoverageScore: coverageResult.score, // B212A-ENROLL-005
      missingRequiredPayers: payerResult.missingRequired,
      expiredPECOS: failures.expiredPECOS, // B212A-ENROLL-004
      missingPayers: failures.missingPayers, // B212A-ENROLL-004
      medicaidGaps: failures.medicaidGaps, // B212A-ENROLL-004
      payerFailures: failures.payerFailures, // B212A-ENROLL-004
      alignmentFailures: failures.alignmentFailures, // B212A-ENROLL-004
      breakdown: {
        pecos: {
          status: pecos?.status || 'UNKNOWN',
          score: pecosScore,
        },
        medicaid: {
          enrolledStates: medicaidResult.enrolledStates,
          totalStates: medicaidResult.totalStates,
          score: medicaidResult.score,
        },
        payers: {
          enrolled: payerResult.enrolled,
          required: payerResult.required,
          total: payerResult.total,
          score: payerResult.score,
        },
        freshness: {
          penalty: freshnessResult.penalty,
          staleCount: freshnessResult.staleCount,
        }, // B212A-ENROLL-003
        coverage: {
          coverageRatio: coverageResult.coverageRatio,
          regionMatch: coverageResult.regionMatch,
        }, // B212A-ENROLL-005
      },
    };
  }
}

/**
 * Default calculator instance
 */
export const enrollmentCompletenessCalculator = new EnrollmentCompletenessCalculator();

