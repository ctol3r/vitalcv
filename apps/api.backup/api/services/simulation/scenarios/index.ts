/**
 * ScenarioLibrary
 *
 * Provides a catalogue of baseline scenarios:
 * - Credential issuance
 * - Privilege revocation
 * - Drift surge
 * - Multi-region failover
 * - Cross-org handoff
 */

import {
  SimulationScenarioType,
  type DomainState,
  type ExternalEvent,
  type ExpectedOutcome,
  type SuccessCriteria,
  type FaultInjectionConfig,
  createSimulationScenario,
} from '../models/SimulationScenario.js';

/**
 * Baseline scenario: Credential Issuance
 * Tests the credential issuance flow across modules
 */
export async function createCredentialIssuanceScenario(): Promise<string> {
  const domainState: DomainState = {
    clinicians: {
      clinician1: {
        id: 'clinician1',
        npi: '1234567890',
        credentials: [],
        privileges: [],
      },
    },
    organizations: {
      org1: {
        id: 'org1',
        name: 'Test Hospital',
        credentials: [],
      },
    },
  };

  const externalEvents: ExternalEvent[] = [
    {
      type: 'credential.request',
      timestamp: 0,
      payload: {
        clinicianId: 'clinician1',
        orgId: 'org1',
        credentialType: 'board_certification',
      },
      target: 'credentialing',
    },
    {
      type: 'credential.verified',
      timestamp: 1000,
      payload: {
        credentialId: 'cred1',
        clinicianId: 'clinician1',
        status: 'verified',
      },
      target: 'credentialing',
    },
    {
      type: 'credential.issued',
      timestamp: 2000,
      payload: {
        credentialId: 'cred1',
        clinicianId: 'clinician1',
        orgId: 'org1',
        credentialType: 'board_certification',
      },
      target: 'credentialing',
    },
  ];

  const expectedOutcomes: ExpectedOutcome[] = [
    {
      statePath: 'clinicians.clinician1.credentials',
      expectedValue: ['cred1'],
      operator: 'contains',
    },
    {
      statePath: 'organizations.org1.credentials',
      expectedValue: ['cred1'],
      operator: 'contains',
    },
  ];

  const successCriteria: SuccessCriteria = {
    allOutcomesMustPass: true,
    minOutcomePassRate: 1.0,
  };

  return createSimulationScenario({
    name: 'Credential Issuance Baseline',
    description: 'Tests the complete credential issuance flow',
    scenarioType: SimulationScenarioType.CREDENTIAL_ISSUANCE,
    domainState,
    externalEvents,
    expectedOutcomes,
    successCriteria,
    timeAcceleration: 1.0,
  });
}

/**
 * Baseline scenario: Privilege Revocation
 * Tests privilege revocation and its cascading effects
 */
export async function createPrivilegeRevocationScenario(): Promise<string> {
  const domainState: DomainState = {
    clinicians: {
      clinician1: {
        id: 'clinician1',
        npi: '1234567890',
        privileges: {
          priv1: { id: 'priv1', code: 'SURGERY', status: 'active' },
          priv2: { id: 'priv2', code: 'ANESTHESIA', status: 'active' },
        },
      },
    },
    organizations: {
      org1: {
        id: 'org1',
        name: 'Test Hospital',
        privileges: {
          priv1: { clinicianId: 'clinician1', status: 'active' },
          priv2: { clinicianId: 'clinician1', status: 'active' },
        },
      },
    },
  };

  const externalEvents: ExternalEvent[] = [
    {
      type: 'privilege.revocation.request',
      timestamp: 0,
      payload: {
        privilegeId: 'priv1',
        clinicianId: 'clinician1',
        reason: 'safety_concern',
      },
      target: 'privileging',
    },
    {
      type: 'privilege.revoked',
      timestamp: 1000,
      payload: {
        privilegeId: 'priv1',
        clinicianId: 'clinician1',
        status: 'revoked',
      },
      target: 'privileging',
    },
    {
      type: 'privilege.dependency.check',
      timestamp: 2000,
      payload: {
        privilegeId: 'priv1',
        checkDependencies: true,
      },
      target: 'privileging',
    },
  ];

  const expectedOutcomes: ExpectedOutcome[] = [
    {
      statePath: 'clinicians.clinician1.privileges.priv1.status',
      expectedValue: 'revoked',
      operator: 'equals',
    },
    {
      statePath: 'organizations.org1.privileges.priv1.status',
      expectedValue: 'revoked',
      operator: 'equals',
    },
  ];

  const successCriteria: SuccessCriteria = {
    allOutcomesMustPass: true,
    minOutcomePassRate: 1.0,
  };

  return createSimulationScenario({
    name: 'Privilege Revocation Baseline',
    description: 'Tests privilege revocation flow and dependency checks',
    scenarioType: SimulationScenarioType.PRIVILEGE_REVOCATION,
    domainState,
    externalEvents,
    expectedOutcomes,
    successCriteria,
    timeAcceleration: 1.0,
  });
}

/**
 * Baseline scenario: Drift Surge
 * Tests system behavior under high drift event volume
 */
export async function createDriftSurgeScenario(): Promise<string> {
  const domainState: DomainState = {
    clinicians: {
      clinician1: {
        id: 'clinician1',
        npi: '1234567890',
        driftEvents: [],
      },
      clinician2: {
        id: 'clinician2',
        npi: '0987654321',
        driftEvents: [],
      },
    },
  };

  // Generate a surge of drift events
  const externalEvents: ExternalEvent[] = [];
  for (let i = 0; i < 50; i++) {
    externalEvents.push({
      type: 'drift.detected',
      timestamp: i * 100,
      payload: {
        clinicianId: i % 2 === 0 ? 'clinician1' : 'clinician2',
        driftType: 'license_expiry',
        severity: 'high',
        eventId: `drift_${i}`,
      },
      target: 'drift',
    });
  }

  const expectedOutcomes: ExpectedOutcome[] = [
    {
      statePath: 'clinicians.clinician1.driftEvents',
      expectedValue: 25,
      operator: 'greaterThan',
    },
    {
      statePath: 'clinicians.clinician2.driftEvents',
      expectedValue: 25,
      operator: 'greaterThan',
    },
  ];

  const successCriteria: SuccessCriteria = {
    minOutcomePassRate: 0.8,
    maxDriftFrequency: 100, // events per second
  };

  const faultInjection: FaultInjectionConfig = {
    enabled: true,
    faultTypes: ['DELAYED_QUEUE', 'NETWORK_PARTITION'],
    probability: 0.1,
    timing: {
      startAfter: 2000,
      duration: 5000,
    },
  };

  return createSimulationScenario({
    name: 'Drift Surge Baseline',
    description: 'Tests system resilience under high drift event volume',
    scenarioType: SimulationScenarioType.DRIFT_SURGE,
    domainState,
    externalEvents,
    expectedOutcomes,
    successCriteria,
    timeAcceleration: 2.0, // Accelerate time to handle surge faster
    faultInjection,
    concurrentRuns: 1,
  });
}

/**
 * Baseline scenario: Multi-Region Failover
 * Tests failover behavior across multiple regions
 */
export async function createMultiRegionFailoverScenario(): Promise<string> {
  const domainState: DomainState = {
    regions: {
      region1: {
        id: 'region1',
        status: 'active',
        services: ['credentialing', 'privileging'],
      },
      region2: {
        id: 'region2',
        status: 'standby',
        services: ['credentialing', 'privileging'],
      },
      region3: {
        id: 'region3',
        status: 'standby',
        services: ['credentialing', 'privileging'],
      },
    },
    clinicians: {
      clinician1: {
        id: 'clinician1',
        npi: '1234567890',
        activeRegion: 'region1',
      },
    },
  };

  const externalEvents: ExternalEvent[] = [
    {
      type: 'region.failure',
      timestamp: 0,
      payload: {
        regionId: 'region1',
        failureType: 'network_partition',
      },
      target: 'infrastructure',
    },
    {
      type: 'failover.initiated',
      timestamp: 500,
      payload: {
        fromRegion: 'region1',
        toRegion: 'region2',
      },
      target: 'infrastructure',
    },
    {
      type: 'region.activated',
      timestamp: 2000,
      payload: {
        regionId: 'region2',
        status: 'active',
      },
      target: 'infrastructure',
    },
    {
      type: 'session.migrated',
      timestamp: 2500,
      payload: {
        clinicianId: 'clinician1',
        fromRegion: 'region1',
        toRegion: 'region2',
      },
      target: 'infrastructure',
    },
  ];

  const expectedOutcomes: ExpectedOutcome[] = [
    {
      statePath: 'regions.region1.status',
      expectedValue: 'failed',
      operator: 'equals',
    },
    {
      statePath: 'regions.region2.status',
      expectedValue: 'active',
      operator: 'equals',
    },
    {
      statePath: 'clinicians.clinician1.activeRegion',
      expectedValue: 'region2',
      operator: 'equals',
    },
  ];

  const successCriteria: SuccessCriteria = {
    allOutcomesMustPass: true,
    maxRecoveryTime: 5000, // 5 seconds max recovery time
  };

  const faultInjection: FaultInjectionConfig = {
    enabled: true,
    faultTypes: ['NETWORK_PARTITION', 'MODULE_CRASH'],
    probability: 1.0,
    timing: {
      startAfter: 0,
      duration: 3000,
    },
  };

  return createSimulationScenario({
    name: 'Multi-Region Failover Baseline',
    description: 'Tests failover behavior across multiple regions',
    scenarioType: SimulationScenarioType.MULTI_REGION_FAILOVER,
    domainState,
    externalEvents,
    expectedOutcomes,
    successCriteria,
    timeAcceleration: 1.0,
    faultInjection,
    concurrentRuns: 1,
  });
}

/**
 * Baseline scenario: Cross-Org Handoff
 * Tests credential/privilege handoff between organizations
 */
export async function createCrossOrgHandoffScenario(): Promise<string> {
  const domainState: DomainState = {
    clinicians: {
      clinician1: {
        id: 'clinician1',
        npi: '1234567890',
        currentOrg: 'org1',
        credentials: {
          cred1: { id: 'cred1', orgId: 'org1', status: 'active' },
        },
        privileges: {
          priv1: { id: 'priv1', orgId: 'org1', status: 'active' },
        },
      },
    },
    organizations: {
      org1: {
        id: 'org1',
        name: 'Source Hospital',
        clinicians: ['clinician1'],
      },
      org2: {
        id: 'org2',
        name: 'Destination Hospital',
        clinicians: [],
      },
    },
  };

  const externalEvents: ExternalEvent[] = [
    {
      type: 'org.transfer.request',
      timestamp: 0,
      payload: {
        clinicianId: 'clinician1',
        fromOrgId: 'org1',
        toOrgId: 'org2',
      },
      target: 'mobility',
    },
    {
      type: 'credential.transfer',
      timestamp: 1000,
      payload: {
        credentialId: 'cred1',
        fromOrgId: 'org1',
        toOrgId: 'org2',
      },
      target: 'mobility',
    },
    {
      type: 'privilege.transfer',
      timestamp: 2000,
      payload: {
        privilegeId: 'priv1',
        fromOrgId: 'org1',
        toOrgId: 'org2',
      },
      target: 'mobility',
    },
    {
      type: 'org.transfer.completed',
      timestamp: 3000,
      payload: {
        clinicianId: 'clinician1',
        fromOrgId: 'org1',
        toOrgId: 'org2',
        status: 'completed',
      },
      target: 'mobility',
    },
  ];

  const expectedOutcomes: ExpectedOutcome[] = [
    {
      statePath: 'clinicians.clinician1.currentOrg',
      expectedValue: 'org2',
      operator: 'equals',
    },
    {
      statePath: 'clinicians.clinician1.credentials.cred1.orgId',
      expectedValue: 'org2',
      operator: 'equals',
    },
    {
      statePath: 'clinicians.clinician1.privileges.priv1.orgId',
      expectedValue: 'org2',
      operator: 'equals',
    },
    {
      statePath: 'organizations.org2.clinicians',
      expectedValue: ['clinician1'],
      operator: 'contains',
    },
  ];

  const successCriteria: SuccessCriteria = {
    allOutcomesMustPass: true,
    minOutcomePassRate: 1.0,
  };

  return createSimulationScenario({
    name: 'Cross-Org Handoff Baseline',
    description: 'Tests credential and privilege handoff between organizations',
    scenarioType: SimulationScenarioType.CROSS_ORG_HANDOFF,
    domainState,
    externalEvents,
    expectedOutcomes,
    successCriteria,
    timeAcceleration: 1.0,
    concurrentRuns: 1,
  });
}

/**
 * Get all baseline scenarios
 */
export async function createAllBaselineScenarios(): Promise<string[]> {
  return Promise.all([
    createCredentialIssuanceScenario(),
    createPrivilegeRevocationScenario(),
    createDriftSurgeScenario(),
    createMultiRegionFailoverScenario(),
    createCrossOrgHandoffScenario(),
  ]);
}

/**
 * Scenario library metadata
 */
export const scenarioLibrary = {
  credentialIssuance: {
    name: 'Credential Issuance',
    type: SimulationScenarioType.CREDENTIAL_ISSUANCE,
    create: createCredentialIssuanceScenario,
  },
  privilegeRevocation: {
    name: 'Privilege Revocation',
    type: SimulationScenarioType.PRIVILEGE_REVOCATION,
    create: createPrivilegeRevocationScenario,
  },
  driftSurge: {
    name: 'Drift Surge',
    type: SimulationScenarioType.DRIFT_SURGE,
    create: createDriftSurgeScenario,
  },
  multiRegionFailover: {
    name: 'Multi-Region Failover',
    type: SimulationScenarioType.MULTI_REGION_FAILOVER,
    create: createMultiRegionFailoverScenario,
  },
  crossOrgHandoff: {
    name: 'Cross-Org Handoff',
    type: SimulationScenarioType.CROSS_ORG_HANDOFF,
    create: createCrossOrgHandoffScenario,
  },
};

