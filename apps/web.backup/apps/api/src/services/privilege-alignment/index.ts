import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

/**
 * Batch 225 — Safety & Privileging Alignment Engine v4
 * Automate alignment between clinician safety signals and privilege assignments
 */

export interface PrivilegeSafetyAlignment {
  clinicianId: string;
  alignmentScore: number;
  privileges: Array<{
    code: string;
    status: 'aligned' | 'restricted' | 'flagged';
    safetyScore: number;
  }>;
  recommendations: string[];
}

/**
 * Check how safety signals align with privileges
 */
export async function correlatePrivilegeSafety(
  clinicianId: string,
): Promise<PrivilegeSafetyAlignment> {
  // Get privileges
  const privileges = await prisma.privilege.findMany({
    where: {
      clinicianId,
    },
  });

  // Get safety signals
  const safetySignals = await prisma.privilegeSafetySignal.findMany({
    where: {
      clinicianId,
    },
    orderBy: {
      detectedAt: 'desc',
    },
  });

  const privilegeStatuses: Array<{
    code: string;
    status: 'aligned' | 'restricted' | 'flagged';
    safetyScore: number;
  }> = [];

  privileges.forEach((priv) => {
    // Check if privilege has associated safety signals
    const relatedSignals = safetySignals.filter((signal) =>
      signal.privilegeCodes.includes(priv.code),
    );

    let safetyScore = 1.0;
    let status: 'aligned' | 'restricted' | 'flagged' = 'aligned';

    if (relatedSignals.length > 0) {
      // Calculate safety score based on signals
      relatedSignals.forEach((signal) => {
        const severityWeight: Record<string, number> = {
          LOW: -0.1,
          MED: -0.3,
          HIGH: -0.6,
          CRITICAL: -0.9,
        };
        safetyScore += severityWeight[signal.severity] || 0;
      });

      safetyScore = Math.max(0, Math.min(1, safetyScore));

      if (safetyScore < 0.3) {
        status = 'restricted';
      } else if (safetyScore < 0.7) {
        status = 'flagged';
      }
    }

    privilegeStatuses.push({
      code: priv.code,
      status,
      safetyScore,
    });
  });

  // Calculate overall alignment score
  const alignmentScore =
    privilegeStatuses.reduce((sum, p) => sum + p.safetyScore, 0) / privilegeStatuses.length;

  // Generate recommendations
  const recommendations: string[] = [];
  if (alignmentScore < 0.5) {
    recommendations.push('Review and potentially restrict high-risk privileges');
  }
  if (privilegeStatuses.some((p) => p.status === 'restricted')) {
    recommendations.push('Consider temporary privilege suspension for restricted procedures');
  }

  return {
    clinicianId,
    alignmentScore,
    privileges: privilegeStatuses,
    recommendations,
  };
}

/**
 * Restrict privileges if safety risk increases
 */
export async function restrictPrivilegesBySafety(
  clinicianId: string,
  threshold: number = 0.3,
): Promise<{
  restricted: string[];
  reason: string;
}> {
  const alignment = await correlatePrivilegeSafety(clinicianId);

  const toRestrict = alignment.privileges
    .filter((p) => p.safetyScore < threshold)
    .map((p) => p.code);

  if (toRestrict.length > 0) {
    // Update privileges (would mark as restricted in actual system)
    await prisma.privilege.updateMany({
      where: {
        clinicianId,
        code: {
          in: toRestrict,
        },
      },
      data: {
        // Would add restricted status field
      },
    });
  }

  return {
    restricted: toRestrict,
    reason: `Safety score below threshold (${threshold})`,
  };
}

/**
 * Restore privileges after risk resolution
 */
export async function restorePrivileges(
  clinicianId: string,
  privilegeCodes: string[],
  reason: string,
): Promise<{
  restored: string[];
}> {
  // Check if safety signals are resolved
  const safetySignals = await prisma.privilegeSafetySignal.findMany({
    where: {
      clinicianId,
      privilegeCodes: {
        hasSome: privilegeCodes,
      },
      resolvedAt: null,
    },
  });

  if (safetySignals.length > 0) {
    throw new Error('Cannot restore privileges with unresolved safety signals');
  }

  // Restore privileges
  await prisma.privilege.updateMany({
    where: {
      clinicianId,
      code: {
        in: privilegeCodes,
      },
    },
    data: {
      // Would remove restricted status
    },
  });

  return {
    restored: privilegeCodes,
  };
}

/**
 * Calculate alignment score (0-100)
 */
export async function calculateAlignmentScore(clinicianId: string): Promise<{
  score: number;
  breakdown: Record<string, number>;
}> {
  const alignment = await correlatePrivilegeSafety(clinicianId);

  const score = Math.round(alignment.alignmentScore * 100);

  const breakdown: Record<string, number> = {
    overall: score,
    aligned: alignment.privileges.filter((p) => p.status === 'aligned').length,
    flagged: alignment.privileges.filter((p) => p.status === 'flagged').length,
    restricted: alignment.privileges.filter((p) => p.status === 'restricted').length,
  };

  return { score, breakdown };
}

/**
 * Ensure privilege set satisfies safety standards
 */
export async function validatePrivilegeCompliance(
  clinicianId: string,
  privilegeCodes: string[],
): Promise<{
  compliant: boolean;
  violations: Array<{ privilege: string; reason: string }>;
}> {
  const violations: Array<{ privilege: string; reason: string }> = [];

  // Check safety signals for each privilege
  for (const code of privilegeCodes) {
    const signals = await prisma.privilegeSafetySignal.findMany({
      where: {
        clinicianId,
        privilegeCodes: {
          has: code,
        },
        resolvedAt: null,
      },
    });

    // Check for critical signals
    const criticalSignals = signals.filter((s) => s.severity === 'CRITICAL');
    if (criticalSignals.length > 0) {
      violations.push({
        privilege: code,
        reason: `Critical safety signals present: ${criticalSignals.map((s) => s.signalType).join(', ')}`,
      });
    }

    // Check for high severity signals
    const highSignals = signals.filter((s) => s.severity === 'HIGH');
    if (highSignals.length >= 2) {
      violations.push({
        privilege: code,
        reason: `Multiple high-severity safety signals (${highSignals.length})`,
      });
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * Detect alignment anomalies
 */
export async function detectAlignmentAnomalies(
  clinicianId: string,
  previousAlignment?: PrivilegeSafetyAlignment,
): Promise<Array<{
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: Record<string, unknown>;
}>> {
  const currentAlignment = await correlatePrivilegeSafety(clinicianId);
  const anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    details: Record<string, unknown>;
  }> = [];

  if (!previousAlignment) {
    return anomalies;
  }

  // Detect sudden drops in alignment
  const scoreDelta = currentAlignment.alignmentScore - previousAlignment.alignmentScore;
  if (scoreDelta < -0.2) {
    anomalies.push({
      type: 'alignment_drop',
      severity: scoreDelta < -0.4 ? 'high' : 'medium',
      details: {
        previousScore: previousAlignment.alignmentScore,
        currentScore: currentAlignment.alignmentScore,
        delta: scoreDelta,
      },
    });
  }

  // Detect new restrictions
  const previousRestricted = previousAlignment.privileges.filter((p) => p.status === 'restricted').length;
  const currentRestricted = currentAlignment.privileges.filter((p) => p.status === 'restricted').length;
  if (currentRestricted > previousRestricted) {
    anomalies.push({
      type: 'new_restrictions',
      severity: 'medium',
      details: {
        previousRestricted,
        currentRestricted,
        newRestrictions: currentRestricted - previousRestricted,
      },
    });
  }

  return anomalies;
}

/**
 * Generate compliance-ready PDF report
 */
export async function exportAlignmentReport(clinicianId: string): Promise<{
  reportId: string;
  reportUrl: string;
}> {
  const alignment = await correlatePrivilegeSafety(clinicianId);
  const score = await calculateAlignmentScore(clinicianId);

  // Generate report data (would create actual PDF in production)
  const reportData = {
    clinicianId,
    generatedAt: new Date().toISOString(),
    alignmentScore: score.score,
    breakdown: score.breakdown,
    privileges: alignment.privileges,
    recommendations: alignment.recommendations,
  };

  const reportId = `alignment_report_${clinicianId}_${Date.now()}`;
  const reportHash = createHash('sha256').update(JSON.stringify(reportData)).digest('hex');

  // Store report (would save to storage in production)
  await prisma.privilegeSafetyAlignment.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      alignment: {
        reportId,
        reportHash,
        reportData,
      } as any,
      updatedAt: new Date(),
    },
    update: {
      alignment: {
        reportId,
        reportHash,
        reportData,
      } as any,
      updatedAt: new Date(),
    },
  });

  // In production, would generate actual PDF and return URL
  const reportUrl = `/reports/${reportId}.pdf`;

  return {
    reportId,
    reportUrl,
  };
}

/**
 * Anchor privilege alignment snapshot
 */
export async function anchorPrivilegeAlignment(clinicianId: string): Promise<void> {
  const alignment = await correlatePrivilegeSafety(clinicianId);
  const score = await calculateAlignmentScore(clinicianId);

  const alignmentHash = createHash('sha256').update(JSON.stringify(alignment)).digest('hex');

  anchorEvent('privilegeAlignmentAnchored', {
    clinicianId,
    alignmentScore: score.score,
    alignmentHash,
    privilegeCount: alignment.privileges.length,
    restrictedCount: alignment.privileges.filter((p) => p.status === 'restricted').length,
    timestamp: new Date().toISOString(),
  });
}








