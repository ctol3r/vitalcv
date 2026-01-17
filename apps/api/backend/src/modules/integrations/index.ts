export interface IntegrationResult<TData = unknown> {
  source: string;
  fetchedAt: string;
  data: TData;
}

export interface IntegrationAdapter<TInput = unknown, TOutput = unknown> {
  id: string;
  fetch(input: TInput): Promise<IntegrationResult<TOutput>>;
}

export interface IntegrationRegistry {
  getAdapter(id: string): IntegrationAdapter | undefined;
  listAdapters(): IntegrationAdapter[];
}
