import { getPublicApiBase } from '@/lib/api';

export function buildApiReferenceUrls(baseUrl = getPublicApiBase()) {
  return {
    baseUrl,
    openApiUiUrl: `${baseUrl}/api-docs`,
    openApiJsonUrl: `${baseUrl}/api/docs/openapi.json`,
  };
}

export function buildWebhookSubscribeExample(baseUrl = getPublicApiBase()): string {
  return `// Register a webhook endpoint
const response = await fetch('${baseUrl}/api/network/webhooks/register', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <api_key>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    organizationId: 'org_demo_hospital',
    url: 'https://your-app.com/webhooks/vitalcv',
    events: ['credential_revoked', 'trust_state_changed'],
  }),
});`;
}
