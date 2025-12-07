export interface AgentContext {
  npi: string;
}

export interface Agent {
  name: string;
  run(ctx: AgentContext): Promise<{ tags?: Record<string, string[]>; notes?: string[] }>;
}
