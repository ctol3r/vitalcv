import type { CopilotQueryResponse } from '../../../../../../core/copilot/copilotEngine';
import type { SearchRequestContext } from '../search/requestContext';
import { executeCopilotQuery } from './copilotQueryService';

export async function runCopilotQuery(input: {
  query: string;
  requestContext: SearchRequestContext;
  limit?: number;
}): Promise<CopilotQueryResponse> {
  return executeCopilotQuery({
    query: input.query,
    requestContext: input.requestContext,
    limit: input.limit ?? 20,
  });
}
