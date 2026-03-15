import type { FindingStore } from './findingStore';
import { InvestigatorRegistry } from './investigatorRegistry';
import { InvestigatorRunner } from './investigatorRunner';
import type {
  InvestigatorAudienceRole,
  InvestigatorDefinition,
  InvestigatorRunRequest,
  InvestigatorRunResult,
} from './investigatorTypes';

export function createInvestigatorEngine<TDependencies = Record<string, never>>(
  investigators: InvestigatorDefinition<TDependencies>[],
  store: FindingStore,
) {
  const registry = new InvestigatorRegistry<TDependencies>(investigators);
  const runner = new InvestigatorRunner<TDependencies>(store);

  async function runInvestigators(
    definitions: InvestigatorDefinition<TDependencies>[],
    request: InvestigatorRunRequest<TDependencies>,
  ): Promise<InvestigatorRunResult[]> {
    const results: InvestigatorRunResult[] = [];
    for (const definition of definitions) {
      results.push(await runner.run(definition, request));
    }
    return results;
  }

  return {
    listInvestigators(options?: {
      enabledOnly?: boolean;
      audienceRoles?: InvestigatorAudienceRole[];
      investigatorIds?: string[];
    }) {
      return registry.list(options);
    },

    async runScheduled(request: Omit<InvestigatorRunRequest<TDependencies>, 'trigger'> & {
      audienceRoles?: InvestigatorAudienceRole[];
    }) {
      const now = request.now ?? new Date().toISOString();
      const lastRunStartedAtById = await store.getLastRunStartedAt(request.investigatorIds);
      const dueInvestigators = registry.listDueInvestigators({
        now,
        lastRunStartedAtById,
        investigatorIds: request.investigatorIds,
        audienceRoles: request.audienceRoles,
      });
      return runInvestigators(dueInvestigators, {
        ...request,
        now,
        trigger: 'scheduled',
      });
    },

    async runTriggered(request: InvestigatorRunRequest<TDependencies>) {
      const definitions = registry.list({
        enabledOnly: true,
        investigatorIds: request.investigatorIds,
        trigger: request.trigger,
      });
      return runInvestigators(definitions, request);
    },

    listFindings: store.listFindings.bind(store),
    getFinding: store.getFinding.bind(store),
    updateFindingStatus: store.updateStatus.bind(store),
  };
}
