import { registerContract, type ApiContract } from '../registry';
import type {} from '../types';
const contract: ApiContract = { service: 'readiness', version: '1.0.0', baseUrl: '/api/readiness', endpoints: [
  { id: 'getClearToStart', method: 'GET', path: '/:npi/clear-to-start', description: 'Get employer-facing clear-to-start status for a clinician', responseSchema: { type: 'object', properties: { clearToStart: { type: 'boolean' }, daysEstimate: { type: 'number' }, report: { type: 'object' } } }, requiresAuth: false, featureFlag: 'FEATURE_READINESS_ENGINE' },
  { id: 'getReport', method: 'GET', path: '/:npi/report', description: 'Full readiness report with what_you_have, what_is_missing, what_is_pending', responseSchema: { type: 'object' }, requiresAuth: false, featureFlag: 'FEATURE_READINESS_ENGINE' },
]};
registerContract(contract);
export { contract as readinessContract };
