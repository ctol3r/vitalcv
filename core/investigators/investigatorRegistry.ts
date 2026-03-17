import type {
  InvestigatorAudienceRole,
  InvestigatorDefinition,
  InvestigatorRunTrigger,
} from './investigatorTypes';

function includesRole(
  investigatorRoles: InvestigatorAudienceRole[],
  requestedRoles: InvestigatorAudienceRole[] | undefined,
): boolean {
  if (!requestedRoles || requestedRoles.length === 0) {
    return true;
  }

  return requestedRoles.some((role) => investigatorRoles.includes(role));
}

function supportsTrigger<TDependencies = Record<string, never>>(
  investigator: InvestigatorDefinition<TDependencies>,
  trigger: InvestigatorRunTrigger | undefined,
): boolean {
  if (!trigger) {
    return true;
  }

  if (investigator.schedule.triggers.includes(trigger)) {
    return true;
  }

  // Manual/demo runs should be able to invoke the same investigators that
  // support targeted execution without forcing every definition to duplicate
  // trigger declarations.
  return trigger === 'manual' && investigator.schedule.triggers.includes('targeted');
}

export class InvestigatorRegistry<TDependencies = Record<string, never>> {
  private readonly investigators = new Map<string, InvestigatorDefinition<TDependencies>>();

  constructor(definitions: InvestigatorDefinition<TDependencies>[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: InvestigatorDefinition<TDependencies>): void {
    this.investigators.set(definition.id, definition);
  }

  get(id: string): InvestigatorDefinition<TDependencies> | null {
    return this.investigators.get(id) ?? null;
  }

  list(options?: {
    enabledOnly?: boolean;
    audienceRoles?: InvestigatorAudienceRole[];
    investigatorIds?: string[];
    trigger?: InvestigatorRunTrigger;
  }): InvestigatorDefinition<TDependencies>[] {
    const investigatorIds = options?.investigatorIds ?? [];

    return [...this.investigators.values()].filter((investigator) => {
      if (options?.enabledOnly !== false && !investigator.enabled) {
        return false;
      }
      if (investigatorIds.length > 0 && !investigatorIds.includes(investigator.id)) {
        return false;
      }
      if (!includesRole(investigator.audienceRoles, options?.audienceRoles)) {
        return false;
      }
      if (!supportsTrigger(investigator, options?.trigger)) {
        return false;
      }
      return true;
    });
  }

  listDueInvestigators(input: {
    now: string;
    lastRunStartedAtById: Record<string, string>;
    investigatorIds?: string[];
    audienceRoles?: InvestigatorAudienceRole[];
  }): InvestigatorDefinition<TDependencies>[] {
    const nowMs = new Date(input.now).getTime();

    return this.list({
      enabledOnly: true,
      audienceRoles: input.audienceRoles,
      investigatorIds: input.investigatorIds,
      trigger: 'scheduled',
    }).filter((investigator) => {
      const lastRun = input.lastRunStartedAtById[investigator.id];
      if (!lastRun) {
        return true;
      }

      const elapsedMinutes = Math.floor((nowMs - new Date(lastRun).getTime()) / 60_000);
      return elapsedMinutes >= investigator.schedule.cadenceMinutes;
    });
  }
}
