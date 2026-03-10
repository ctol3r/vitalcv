import { registerContract } from '../registry';
registerContract({ service: 'psv-adapters', version: '1.0.0', baseUrl: '/api/psv', endpoints: [
  { id: 'verify', method: 'POST', path: '/verify/:npi', description: 'Run all PSV adapters for an NPI', responseSchema: { type: 'object' }, requiresAuth: false, featureFlag: 'FEATURE_PSV_ADAPTERS' },
  { id: 'status', method: 'GET', path: '/status/:npi', description: 'Get PSV orchestration status for an NPI', responseSchema: { type: 'object' }, requiresAuth: false },
  { id: 'enroll', method: 'POST', path: '/enroll/:npi', description: 'Enroll NPI for continuous monitoring', responseSchema: { type: 'object' }, requiresAuth: false },
  { id: 'listAdapters', method: 'GET', path: '/adapters', description: 'List registered PSV adapters', responseSchema: { type: 'object' }, requiresAuth: false },
]});
