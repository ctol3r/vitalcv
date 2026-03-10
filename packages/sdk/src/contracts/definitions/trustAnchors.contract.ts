import { registerContract } from '../registry';
registerContract({ service: 'trust-anchors', version: '1.0.0', baseUrl: '/api/trust-anchors', endpoints: [
  { id: 'listAnchors', method: 'GET', path: '/', description: 'List all trust anchors', responseSchema: { type: 'object', properties: { anchors: { type: 'array' } } }, requiresAuth: false, featureFlag: 'FEATURE_TRUST_ANCHORS' },
  { id: 'getAnchor', method: 'GET', path: '/:id', description: 'Get a single trust anchor by ID', responseSchema: { type: 'object' }, requiresAuth: false },
  { id: 'ingestTrustLists', method: 'POST', path: '/ingest', description: 'Trigger ingestion of authoritative trust lists', responseSchema: { type: 'object' }, requiresAuth: true },
]});
