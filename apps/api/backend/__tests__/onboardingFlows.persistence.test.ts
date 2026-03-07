import { InMemoryOnboardingFlowsRepository } from '../repositories/onboardingFlows.repo';
import {
  getOrCreateOnboardingFlow,
  initializeOnboardingFlowsPersistence,
  listOnboardingFlows,
  resetOnboardingFlowsRepository,
  setOnboardingFlowsRepository,
  updateOnboardingStage,
} from '../src/services/missionOps/onboardingFlows';

describe('onboardingFlows persistence', () => {
  let repository: InMemoryOnboardingFlowsRepository;

  beforeEach(async () => {
    repository = new InMemoryOnboardingFlowsRepository();
    setOnboardingFlowsRepository(repository);
    await initializeOnboardingFlowsPersistence();
  });

  afterEach(() => {
    resetOnboardingFlowsRepository();
  });

  test('persists created flows across cache reinitialization', async () => {
    await getOrCreateOnboardingFlow('ISSUER', 'did:vitalcv:test:issuer', 'Issuer Persistence');

    setOnboardingFlowsRepository(repository);
    await initializeOnboardingFlowsPersistence();

    const flow = listOnboardingFlows('ISSUER').find((entry) => entry.entityId === 'did:vitalcv:test:issuer');
    expect(flow).toBeDefined();
    expect(flow?.entityName).toBe('Issuer Persistence');
    expect(flow?.stages).toHaveLength(6);
  });

  test('persists stage updates and progress', async () => {
    await getOrCreateOnboardingFlow('VERIFIER', 'verifier-123', 'Verifier Persistence');
    await updateOnboardingStage('VERIFIER', 'verifier-123', 'sdk', 'COMPLETE');
    await updateOnboardingStage('VERIFIER', 'verifier-123', 'api-key', 'BLOCKED', 'Awaiting contract approval');

    setOnboardingFlowsRepository(repository);
    await initializeOnboardingFlowsPersistence();

    const flow = listOnboardingFlows('VERIFIER').find((entry) => entry.entityId === 'verifier-123');
    expect(flow).toBeDefined();
    expect(flow?.overallProgress).toBeGreaterThan(0);
    expect(flow?.stages.find((stage) => stage.id === 'sdk')?.status).toBe('COMPLETE');
    expect(flow?.stages.find((stage) => stage.id === 'api-key')?.blockedReason).toBe('Awaiting contract approval');
  });
});
