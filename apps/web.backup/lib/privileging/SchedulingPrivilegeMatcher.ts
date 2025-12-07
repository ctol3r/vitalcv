/**
 * Facility Privileging Engine - Scheduling Integration
 * Phase 5: Unit-level privilege matching in Scheduling Engine
 */

import type { Privilege, ClinicianProfile } from './models';

export interface ShiftAssignment {
  shiftId: string;
  unit: string; // OR, ICU, ED, Cardiology, etc.
  requiredPrivileges: string[]; // Privilege codes
  startTime: string;
  endTime: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ClinicianShiftMatch {
  clinicianId: string;
  shiftId: string;
  matchScore: number; // 0-100
  matchedPrivileges: string[];
  missingPrivileges: string[];
  canAssign: boolean;
  reasons: string[];
}

export class SchedulingPrivilegeMatcher {
  /**
   * Match clinicians to shifts based on unit-level privileges
   * Phase 5: Unit-level privilege matching in Scheduling Engine
   */
  matchCliniciansToShift(
    shift: ShiftAssignment,
    clinicians: Array<{ profile: ClinicianProfile; privileges: Privilege[] }>
  ): ClinicianShiftMatch[] {
    const matches: ClinicianShiftMatch[] = [];

    for (const { profile, privileges } of clinicians) {
      const match = this.evaluateShiftMatch(shift, profile, privileges);
      matches.push(match);
    }

    // Sort by match score (highest first)
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Evaluate if a clinician matches a shift
   */
  private evaluateShiftMatch(
    shift: ShiftAssignment,
    profile: ClinicianProfile,
    availablePrivileges: Privilege[]
  ): ClinicianShiftMatch {
    const matchedPrivileges: string[] = [];
    const missingPrivileges: string[] = [];
    const reasons: string[] = [];

    // Check if clinician has privileges for the unit
    const unitPrivileges = availablePrivileges.filter((p) =>
      p.facilityUnits.includes(shift.unit)
    );

    if (unitPrivileges.length === 0) {
      return {
        clinicianId: profile.clinicianId,
        shiftId: shift.shiftId,
        matchScore: 0,
        matchedPrivileges: [],
        missingPrivileges: shift.requiredPrivileges,
        canAssign: false,
        reasons: [`No privileges for unit: ${shift.unit}`],
      };
    }

    // Check required privileges
    for (const requiredPrivilege of shift.requiredPrivileges) {
      const hasPrivilege = unitPrivileges.some(
        (p) => p.privilegeCode === requiredPrivilege
      );

      if (hasPrivilege) {
        matchedPrivileges.push(requiredPrivilege);
      } else {
        missingPrivileges.push(requiredPrivilege);
      }
    }

    // Calculate match score
    const matchScore =
      shift.requiredPrivileges.length > 0
        ? Math.round((matchedPrivileges.length / shift.requiredPrivileges.length) * 100)
        : 50; // Default score if no requirements

    // Determine if can assign
    const canAssign = missingPrivileges.length === 0 && matchScore >= 80;

    // Generate reasons
    if (matchedPrivileges.length > 0) {
      reasons.push(`Has ${matchedPrivileges.length} required privilege(s)`);
    }
    if (missingPrivileges.length > 0) {
      reasons.push(`Missing privileges: ${missingPrivileges.join(', ')}`);
    }
    if (matchScore < 80) {
      reasons.push('Match score below threshold (80%)');
    }

    return {
      clinicianId: profile.clinicianId,
      shiftId: shift.shiftId,
      matchScore,
      matchedPrivileges,
      missingPrivileges,
      canAssign,
      reasons,
    };
  }

  /**
   * Get recommended clinicians for a shift
   */
  getRecommendedClinicians(
    shift: ShiftAssignment,
    clinicians: Array<{ profile: ClinicianProfile; privileges: Privilege[] }>
  ): Array<{ clinicianId: string; matchScore: number; recommendation: string }> {
    const matches = this.matchCliniciansToShift(shift, clinicians);

    return matches
      .filter((m) => m.canAssign || m.matchScore >= 60)
      .map((m) => ({
        clinicianId: m.clinicianId,
        matchScore: m.matchScore,
        recommendation:
          m.canAssign
            ? 'Fully qualified - ready to assign'
            : m.matchScore >= 80
            ? 'Highly qualified - minor gaps'
            : 'Partially qualified - needs review',
      }));
  }

  /**
   * Check if a clinician can be assigned to a shift
   */
  canAssignToShift(
    shift: ShiftAssignment,
    profile: ClinicianProfile,
    privileges: Privilege[]
  ): { canAssign: boolean; reason: string; missingPrivileges?: string[] } {
    const match = this.evaluateShiftMatch(shift, profile, privileges);

    if (match.canAssign) {
      return {
        canAssign: true,
        reason: 'All required privileges are met',
      };
    }

    return {
      canAssign: false,
      reason: match.reasons.join('; '),
      missingPrivileges: match.missingPrivileges,
    };
  }

  /**
   * Get unit-level privilege requirements
   */
  getUnitPrivilegeRequirements(unit: string, privileges: Privilege[]): string[] {
    return privileges
      .filter((p) => p.facilityUnits.includes(unit))
      .map((p) => p.privilegeCode);
  }
}
