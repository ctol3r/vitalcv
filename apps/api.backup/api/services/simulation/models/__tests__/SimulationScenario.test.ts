/**
 * Tests for SimulationScenario model
 */

import {
  createSimulationScenario,
  getSimulationScenario,
  updateSimulationScenario,
  listSimulationScenarios,
  deleteSimulationScenario,
  SimulationScenarioType,
  SimulationScenarioStatus,
  type DomainState,
  type ExternalEvent,
  type ExpectedOutcome,
  type SuccessCriteria,
} from '../SimulationScenario.js';

describe('SimulationScenario', () => {
  const testDomainState: DomainState = {
    clinicians: {
      clinician1: {
        id: 'clinician1',
        npi: '1234567890',
      },
    },
  };

  const testEvents: ExternalEvent[] = [
    {
      type: 'test.event',
      timestamp: 0,
      payload: { test: 'data' },
    },
  ];

  const testOutcomes: ExpectedOutcome[] = [
    {
      statePath: 'clinicians.clinician1.id',
      expectedValue: 'clinician1',
      operator: 'equals',
    },
  ];

  const testSuccessCriteria: SuccessCriteria = {
    allOutcomesMustPass: true,
  };

  let scenarioId: string;

  beforeEach(async () => {
    // Clean up any existing test scenarios
    const scenarios = await listSimulationScenarios();
    for (const scenario of scenarios) {
      if (scenario.name.startsWith('Test Scenario')) {
        await deleteSimulationScenario(scenario.id);
      }
    }
  });

  afterEach(async () => {
    if (scenarioId) {
      try {
        await deleteSimulationScenario(scenarioId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('createSimulationScenario', () => {
    it('should create a new simulation scenario', async () => {
      scenarioId = await createSimulationScenario({
        name: 'Test Scenario',
        description: 'Test description',
        scenarioType: SimulationScenarioType.CUSTOM,
        domainState: testDomainState,
        externalEvents: testEvents,
        expectedOutcomes: testOutcomes,
        successCriteria: testSuccessCriteria,
      });

      expect(scenarioId).toBeDefined();
      expect(typeof scenarioId).toBe('string');
    });

    it('should create scenario with default values', async () => {
      scenarioId = await createSimulationScenario({
        name: 'Test Scenario Defaults',
        scenarioType: SimulationScenarioType.CUSTOM,
        domainState: testDomainState,
        externalEvents: testEvents,
        expectedOutcomes: testOutcomes,
        successCriteria: testSuccessCriteria,
      });

      const scenario = await getSimulationScenario(scenarioId);
      expect(scenario?.status).toBe(SimulationScenarioStatus.DRAFT);
      expect(scenario?.timeAcceleration).toBe(1.0);
      expect(scenario?.concurrentRuns).toBe(1);
    });
  });

  describe('getSimulationScenario', () => {
    it('should retrieve a scenario by ID', async () => {
      scenarioId = await createSimulationScenario({
        name: 'Test Scenario Get',
        scenarioType: SimulationScenarioType.CUSTOM,
        domainState: testDomainState,
        externalEvents: testEvents,
        expectedOutcomes: testOutcomes,
        successCriteria: testSuccessCriteria,
      });

      const scenario = await getSimulationScenario(scenarioId);
      expect(scenario).toBeDefined();
      expect(scenario?.id).toBe(scenarioId);
      expect(scenario?.name).toBe('Test Scenario Get');
    });

    it('should return null for non-existent scenario', async () => {
      const scenario = await getSimulationScenario('non-existent-id');
      expect(scenario).toBeNull();
    });
  });

  describe('updateSimulationScenario', () => {
    it('should update scenario fields', async () => {
      scenarioId = await createSimulationScenario({
        name: 'Test Scenario Update',
        scenarioType: SimulationScenarioType.CUSTOM,
        domainState: testDomainState,
        externalEvents: testEvents,
        expectedOutcomes: testOutcomes,
        successCriteria: testSuccessCriteria,
      });

      await updateSimulationScenario(scenarioId, {
        name: 'Updated Name',
        status: SimulationScenarioStatus.ACTIVE,
        timeAcceleration: 2.0,
      });

      const scenario = await getSimulationScenario(scenarioId);
      expect(scenario?.name).toBe('Updated Name');
      expect(scenario?.status).toBe(SimulationScenarioStatus.ACTIVE);
      expect(scenario?.timeAcceleration).toBe(2.0);
    });
  });

  describe('listSimulationScenarios', () => {
    it('should list all scenarios', async () => {
      scenarioId = await createSimulationScenario({
        name: 'Test Scenario List',
        scenarioType: SimulationScenarioType.CUSTOM,
        domainState: testDomainState,
        externalEvents: testEvents,
        expectedOutcomes: testOutcomes,
        successCriteria: testSuccessCriteria,
      });

      const scenarios = await listSimulationScenarios();
      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios.some((s) => s.id === scenarioId)).toBe(true);
    });

    it('should filter by scenario type', async () => {
      scenarioId = await createSimulationScenario({
        name: 'Test Scenario Filter',
        scenarioType: SimulationScenarioType.CREDENTIAL_ISSUANCE,
        domainState: testDomainState,
        externalEvents: testEvents,
        expectedOutcomes: testOutcomes,
        successCriteria: testSuccessCriteria,
      });

      const scenarios = await listSimulationScenarios({
        scenarioType: SimulationScenarioType.CREDENTIAL_ISSUANCE,
      });

      expect(scenarios.every((s) => s.scenarioType === SimulationScenarioType.CREDENTIAL_ISSUANCE)).toBe(true);
    });
  });

  describe('deleteSimulationScenario', () => {
    it('should delete a scenario', async () => {
      scenarioId = await createSimulationScenario({
        name: 'Test Scenario Delete',
        scenarioType: SimulationScenarioType.CUSTOM,
        domainState: testDomainState,
        externalEvents: testEvents,
        expectedOutcomes: testOutcomes,
        successCriteria: testSuccessCriteria,
      });

      await deleteSimulationScenario(scenarioId);

      const scenario = await getSimulationScenario(scenarioId);
      expect(scenario).toBeNull();
      scenarioId = ''; // Prevent cleanup in afterEach
    });
  });
});

