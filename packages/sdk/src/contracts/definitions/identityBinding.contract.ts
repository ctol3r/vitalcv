import { registerContract } from '../registry';
registerContract({ service: 'identity-binding', version: '1.0.0', baseUrl: '/api/identity', endpoints: [
  { id: 'getBinding', method: 'GET', path: '/npi/:npi/binding', description: 'Get or create DID binding for an NPI', responseSchema: { type: 'object', properties: { npi: { type: 'string' }, did: { type: 'string' }, status: { type: 'string' } } }, requiresAuth: false, featureFlag: 'FEATURE_NPI_DID_BINDING' },
  { id: 'listContested', method: 'GET', path: '/contested', description: 'List all contested NPI-DID bindings', responseSchema: { type: 'object' }, requiresAuth: true },
]});
