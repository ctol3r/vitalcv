/**
 * Facility Privileging Engine - Growth Engine Integration
 * Phase 5: Specialty-Privilege Map in Growth Engine
 */

import type { Privilege } from './models';
import { facilityPrivilegeSets } from './facilityPrivilegeSets';

export interface SpecialtyPrivilegeMap {
  specialty: string;
  availablePrivileges: Privilege[];
  recommendedPathway: PrivilegePathway;
  careerProgression: CareerStage[];
}

export interface PrivilegePathway {
  entryLevel: Privilege[];
  intermediate: Privilege[];
  advanced: Privilege[];
  expert: Privilege[];
}

export interface CareerStage {
  stage: string;
  privileges: Privilege[];
  requirements: string[];
  estimatedTime: string;
  nextStage?: string;
}

export class GrowthEngineIntegration {
  /**
   * Get specialty-privilege map for career growth
   * Phase 5: Specialty-Privilege Map in Growth Engine
   */
  getSpecialtyPrivilegeMap(specialty: string): SpecialtyPrivilegeMap | null {
    // Get all privileges for the specialty
    const availablePrivileges = facilityPrivilegeSets
      .flatMap((set) => set.privileges)
      .filter((p) => p.specialty === specialty);

    if (availablePrivileges.length === 0) {
      return null;
    }

    // Build recommended pathway
    const pathway = this.buildPrivilegePathway(availablePrivileges);

    // Build career progression stages
    const careerProgression = this.buildCareerProgression(availablePrivileges, specialty);

    return {
      specialty,
      availablePrivileges,
      recommendedPathway: pathway,
      careerProgression,
    };
  }

  /**
   * Build privilege pathway by risk level and complexity
   */
  private buildPrivilegePathway(privileges: Privilege[]): PrivilegePathway {
    const entryLevel: Privilege[] = [];
    const intermediate: Privilege[] = [];
    const advanced: Privilege[] = [];
    const expert: Privilege[] = [];

    for (const privilege of privileges) {
      // Categorize by risk level and prerequisites
      if (privilege.riskLevel === 'low' && privilege.requiredSkills.length === 0) {
        entryLevel.push(privilege);
      } else if (privilege.riskLevel === 'low' || privilege.riskLevel === 'medium') {
        intermediate.push(privilege);
      } else if (privilege.riskLevel === 'high') {
        advanced.push(privilege);
      } else if (privilege.riskLevel === 'critical') {
        expert.push(privilege);
      }
    }

    return {
      entryLevel,
      intermediate,
      advanced,
      expert,
    };
  }

  /**
   * Build career progression stages
   */
  private buildCareerProgression(
    privileges: Privilege[],
    specialty: string
  ): CareerStage[] {
    const stages: CareerStage[] = [];

    // Entry Stage
    const entryPrivileges = privileges.filter(
      (p) => p.riskLevel === 'low' && p.requiredSkills.length === 0
    );
    if (entryPrivileges.length > 0) {
      stages.push({
        stage: 'Entry Level',
        privileges: entryPrivileges,
        requirements: ['Board certification', 'State license', 'Basic credentials'],
        estimatedTime: '0-6 months',
        nextStage: 'Intermediate',
      });
    }

    // Intermediate Stage
    const intermediatePrivileges = privileges.filter(
      (p) => p.riskLevel === 'medium' || (p.riskLevel === 'low' && p.requiredSkills.length > 0)
    );
    if (intermediatePrivileges.length > 0) {
      stages.push({
        stage: 'Intermediate',
        privileges: intermediatePrivileges,
        requirements: [
          'Entry level privileges',
          'Skill verification',
          'Supervisor attestation',
        ],
        estimatedTime: '6-18 months',
        nextStage: 'Advanced',
      });
    }

    // Advanced Stage
    const advancedPrivileges = privileges.filter((p) => p.riskLevel === 'high');
    if (advancedPrivileges.length > 0) {
      stages.push({
        stage: 'Advanced',
        privileges: advancedPrivileges,
        requirements: [
          'Intermediate privileges',
          'High competency scores',
          'Volume attestations',
          'Peer review',
        ],
        estimatedTime: '18-36 months',
        nextStage: 'Expert',
      });
    }

    // Expert Stage
    const expertPrivileges = privileges.filter((p) => p.riskLevel === 'critical');
    if (expertPrivileges.length > 0) {
      stages.push({
        stage: 'Expert',
        privileges: expertPrivileges,
        requirements: [
          'Advanced privileges',
          'Exceptional competency',
          'Leadership attestation',
          'Research/publications',
        ],
        estimatedTime: '36+ months',
      });
    }

    return stages;
  }

  /**
   * Get next recommended privileges for career growth
   */
  getNextRecommendedPrivileges(
    specialty: string,
    currentPrivileges: string[]
  ): Array<{ privilege: Privilege; reason: string; priority: 'high' | 'medium' | 'low' }> {
    const map = this.getSpecialtyPrivilegeMap(specialty);
    if (!map) return [];

    const recommendations: Array<{
      privilege: Privilege;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Find next stage privileges
    for (const stage of map.careerProgression) {
      const nextPrivileges = stage.privileges.filter(
        (p) => !currentPrivileges.includes(p.privilegeCode)
      );

      for (const privilege of nextPrivileges) {
        const priority =
          stage.stage === 'Entry Level'
            ? 'high'
            : stage.stage === 'Intermediate'
            ? 'high'
            : stage.stage === 'Advanced'
            ? 'medium'
            : 'low';

        recommendations.push({
          privilege,
          reason: `Next step in ${stage.stage} progression`,
          priority,
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get career pathway visualization data
   */
  getCareerPathwayVisualization(specialty: string) {
    const map = this.getSpecialtyPrivilegeMap(specialty);
    if (!map) return null;

    return {
      specialty,
      stages: map.careerProgression.map((stage) => ({
        name: stage.stage,
        privileges: stage.privileges.map((p) => ({
          code: p.privilegeCode,
          name: p.procedureName,
          riskLevel: p.riskLevel,
        })),
        requirements: stage.requirements,
        estimatedTime: stage.estimatedTime,
      })),
      totalPrivileges: map.availablePrivileges.length,
    };
  }
}
