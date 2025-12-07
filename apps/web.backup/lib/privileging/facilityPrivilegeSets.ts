/**
 * Facility Privileging Engine - Facility-Specific Privilege Sets
 * Phase 1: Facility-specific privilege sets (cardiology, ICU, OR, psych)
 */

import type { FacilityPrivilegeSet, Privilege } from './models';

/**
 * Cardiology Unit Privilege Set
 */
export const cardiologyPrivilegeSet: FacilityPrivilegeSet = {
  facilityId: 'FACILITY-001',
  facilityName: 'General Hospital',
  unit: 'Cardiology',
  privileges: [
    {
      procedureName: 'Cardiac Catheterization - Adult',
      specialty: 'Cardiology',
      privilegeCode: 'CARD-CATH-ADULT',
      requiredCredentials: ['Board Certification - Cardiology', 'State Medical License'],
      requiredSkills: ['Central Line Placement', 'Vascular Access'],
      requiredAttestations: ['Supervisor Attestation - Interventional Cardiology'],
      deaRequired: false,
      mateRequired: false,
      deaSchedules: [],
      riskLevel: 'high',
      description: 'Perform diagnostic and interventional cardiac catheterization procedures in adult patients',
      facilityUnits: ['Cardiology', 'Cath Lab'],
      isActive: true,
    },
    {
      procedureName: 'Percutaneous Coronary Intervention',
      specialty: 'Cardiology',
      privilegeCode: 'CARD-PCI',
      requiredCredentials: ['Board Certification - Cardiology', 'State Medical License'],
      requiredSkills: ['Cardiac Catheterization - Adult', 'Interventional Cardiology'],
      requiredAttestations: ['Supervisor Attestation - Interventional Cardiology', 'Volume Attestation - PCI'],
      deaRequired: false,
      mateRequired: false,
      deaSchedules: [],
      riskLevel: 'critical',
      description: 'Perform percutaneous coronary interventions including stenting',
      facilityUnits: ['Cardiology', 'Cath Lab'],
      isActive: true,
    },
    {
      procedureName: 'Transesophageal Echocardiography',
      specialty: 'Cardiology',
      privilegeCode: 'CARD-TEE',
      requiredCredentials: ['Board Certification - Cardiology', 'State Medical License'],
      requiredSkills: ['Echocardiography', 'Sedation Management'],
      requiredAttestations: ['Supervisor Attestation - Echocardiography'],
      deaRequired: false,
      mateRequired: false,
      deaSchedules: [],
      riskLevel: 'medium',
      description: 'Perform and interpret transesophageal echocardiography',
      facilityUnits: ['Cardiology', 'Echo Lab'],
      isActive: true,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * ICU Unit Privilege Set
 */
export const icuPrivilegeSet: FacilityPrivilegeSet = {
  facilityId: 'FACILITY-001',
  facilityName: 'General Hospital',
  unit: 'ICU',
  privileges: [
    {
      procedureName: 'Mechanical Ventilation Management',
      specialty: 'Critical Care',
      privilegeCode: 'ICU-VENT',
      requiredCredentials: ['Board Certification - Critical Care', 'State Medical License'],
      requiredSkills: ['Airway Management', 'Ventilator Management'],
      requiredAttestations: ['Supervisor Attestation - Critical Care'],
      deaRequired: false,
      mateRequired: false,
      deaSchedules: [],
      riskLevel: 'high',
      description: 'Manage mechanical ventilation in critically ill patients',
      facilityUnits: ['ICU', 'Critical Care'],
      isActive: true,
    },
    {
      procedureName: 'Central Venous Catheter Placement',
      specialty: 'Critical Care',
      privilegeCode: 'ICU-CVC',
      requiredCredentials: ['Board Certification - Critical Care', 'State Medical License'],
      requiredSkills: ['Central Line Placement', 'Ultrasound Guidance'],
      requiredAttestations: ['Supervisor Attestation - Procedures'],
      deaRequired: false,
      mateRequired: false,
      deaSchedules: [],
      riskLevel: 'medium',
      description: 'Place central venous catheters using ultrasound guidance',
      facilityUnits: ['ICU', 'Critical Care'],
      isActive: true,
    },
    {
      procedureName: 'Continuous Renal Replacement Therapy',
      specialty: 'Critical Care',
      privilegeCode: 'ICU-CRRT',
      requiredCredentials: ['Board Certification - Critical Care', 'State Medical License'],
      requiredSkills: ['Dialysis Management', 'Critical Care Procedures'],
      requiredAttestations: ['Supervisor Attestation - CRRT'],
      deaRequired: false,
      mateRequired: false,
      deaSchedules: [],
      riskLevel: 'high',
      description: 'Manage continuous renal replacement therapy in ICU patients',
      facilityUnits: ['ICU', 'Critical Care'],
      isActive: true,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Operating Room Privilege Set
 */
export const orPrivilegeSet: FacilityPrivilegeSet = {
  facilityId: 'FACILITY-001',
  facilityName: 'General Hospital',
  unit: 'OR',
  privileges: [
    {
      procedureName: 'General Surgery',
      specialty: 'General Surgery',
      privilegeCode: 'OR-GEN-SURG',
      requiredCredentials: ['Board Certification - General Surgery', 'State Medical License'],
      requiredSkills: ['Laparoscopic Surgery', 'Surgical Techniques'],
      requiredAttestations: ['Supervisor Attestation - General Surgery'],
      deaRequired: true,
      mateRequired: false,
      deaSchedules: ['II', 'III', 'IV'],
      riskLevel: 'high',
      description: 'Perform general surgical procedures',
      facilityUnits: ['OR', 'Surgery'],
      isActive: true,
    },
    {
      procedureName: 'Robotic Surgery',
      specialty: 'General Surgery',
      privilegeCode: 'OR-ROBOTIC',
      requiredCredentials: ['Board Certification - General Surgery', 'State Medical License'],
      requiredSkills: ['General Surgery', 'Robotic Surgery Training'],
      requiredAttestations: ['Supervisor Attestation - Robotic Surgery', 'Vendor Certification'],
      deaRequired: true,
      mateRequired: false,
      deaSchedules: ['II', 'III', 'IV'],
      riskLevel: 'critical',
      description: 'Perform robotic-assisted surgical procedures',
      facilityUnits: ['OR', 'Surgery'],
      isActive: true,
    },
    {
      procedureName: 'Emergency Surgery',
      specialty: 'General Surgery',
      privilegeCode: 'OR-EMERG',
      requiredCredentials: ['Board Certification - General Surgery', 'State Medical License'],
      requiredSkills: ['General Surgery', 'Trauma Surgery'],
      requiredAttestations: ['Supervisor Attestation - Emergency Surgery'],
      deaRequired: true,
      mateRequired: false,
      deaSchedules: ['II', 'III', 'IV'],
      riskLevel: 'critical',
      description: 'Perform emergency surgical procedures',
      facilityUnits: ['OR', 'ED', 'Surgery'],
      isActive: true,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Psychiatry Unit Privilege Set
 */
export const psychPrivilegeSet: FacilityPrivilegeSet = {
  facilityId: 'FACILITY-001',
  facilityName: 'General Hospital',
  unit: 'Psychiatry',
  privileges: [
    {
      procedureName: 'Psychiatric Evaluation',
      specialty: 'Psychiatry',
      privilegeCode: 'PSYCH-EVAL',
      requiredCredentials: ['Board Certification - Psychiatry', 'State Medical License'],
      requiredSkills: ['Psychiatric Assessment', 'Mental Status Examination'],
      requiredAttestations: ['Supervisor Attestation - Psychiatry'],
      deaRequired: true,
      mateRequired: true,
      deaSchedules: ['II', 'III', 'IV'],
      riskLevel: 'medium',
      description: 'Perform comprehensive psychiatric evaluations',
      facilityUnits: ['Psychiatry', 'Behavioral Health'],
      isActive: true,
    },
    {
      procedureName: 'Electroconvulsive Therapy',
      specialty: 'Psychiatry',
      privilegeCode: 'PSYCH-ECT',
      requiredCredentials: ['Board Certification - Psychiatry', 'State Medical License'],
      requiredSkills: ['ECT Administration', 'Anesthesia Management'],
      requiredAttestations: ['Supervisor Attestation - ECT', 'Volume Attestation - ECT'],
      deaRequired: true,
      mateRequired: true,
      deaSchedules: ['II', 'III', 'IV'],
      riskLevel: 'high',
      description: 'Administer electroconvulsive therapy',
      facilityUnits: ['Psychiatry', 'Behavioral Health'],
      isActive: true,
    },
    {
      procedureName: 'Psychiatric Medication Management',
      specialty: 'Psychiatry',
      privilegeCode: 'PSYCH-MEDS',
      requiredCredentials: ['Board Certification - Psychiatry', 'State Medical License'],
      requiredSkills: ['Psychopharmacology', 'Medication Management'],
      requiredAttestations: ['Supervisor Attestation - Psychopharmacology'],
      deaRequired: true,
      mateRequired: true,
      deaSchedules: ['II', 'III', 'IV'],
      riskLevel: 'medium',
      description: 'Prescribe and manage psychiatric medications including controlled substances',
      facilityUnits: ['Psychiatry', 'Behavioral Health'],
      isActive: true,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * All facility privilege sets
 */
export const facilityPrivilegeSets: FacilityPrivilegeSet[] = [
  cardiologyPrivilegeSet,
  icuPrivilegeSet,
  orPrivilegeSet,
  psychPrivilegeSet,
];

/**
 * Get privilege set by unit
 */
export function getPrivilegeSetByUnit(unit: string): FacilityPrivilegeSet | undefined {
  return facilityPrivilegeSets.find((set) => set.unit === unit);
}

/**
 * Get all privileges for a specialty
 */
export function getPrivilegesBySpecialty(specialty: string): Privilege[] {
  const privileges: Privilege[] = [];
  for (const set of facilityPrivilegeSets) {
    for (const privilege of set.privileges) {
      if (privilege.specialty === specialty) {
        privileges.push(privilege);
      }
    }
  }
  return privileges;
}

