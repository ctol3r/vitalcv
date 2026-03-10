export interface EndpointDef { id: string; method: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'; path: string; description: string; requestSchema?: Record<string,unknown>; responseSchema: Record<string,unknown>; requiresAuth: boolean; featureFlag?: string }
export interface ApiContract { service: string; version: string; baseUrl: string; endpoints: EndpointDef[] }
