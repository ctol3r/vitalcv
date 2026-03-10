import type { ApiContract, EndpointDef } from './types';
const contracts = new Map<string, ApiContract>();
export function registerContract(c: ApiContract): void { contracts.set(c.service, c); }
export function getContract(service: string): ApiContract | undefined { return contracts.get(service); }
export function listContracts(): ApiContract[] { return Array.from(contracts.values()); }
export function getEndpoint(service: string, endpointId: string): EndpointDef | undefined { return contracts.get(service)?.endpoints.find((e) => e.id === endpointId); }
