import { Router, type Request, type Response } from 'express';

const router = Router();
const ADMIN_URL = process.env.ACA_PY_ADMIN_URL;
const TAILS_URL = process.env.ACA_PY_TAILS_URL;
const API_KEY = process.env.ACA_PY_API_KEY;

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [agent, tails, credentialDefinitions] = await Promise.all([
      checkAgent(),
      checkTailsServer(),
      checkCredentialDefinitions(),
    ]);

    return res.json({
      status:
        agent.healthy && tails.healthy && credentialDefinitions.healthy ? 'ok' : 'degraded',
      components: {
        agent,
        tails,
        credentialDefinitions,
      },
      recommendations: buildRecommendations({ agent, tails, credentialDefinitions }),
    });
  } catch (error) {
    console.error('[aries][health]', error);
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

async function checkAgent() {
  if (!ADMIN_URL) {
    return { healthy: false, message: 'ACA_PY_ADMIN_URL not configured' };
  }
  try {
    const response = await fetch(`${ADMIN_URL}/status`, {
      headers: buildHeaders(),
    });
    return {
      healthy: response.ok,
      message: response.ok ? 'Agent reachable' : `Agent responded ${response.status}`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkTailsServer() {
  if (!TAILS_URL) {
    return { healthy: false, message: 'ACA_PY_TAILS_URL not configured' };
  }
  try {
    const response = await fetch(TAILS_URL, { method: 'HEAD' });
    return {
      healthy: response.ok,
      message: response.ok ? 'Tails server reachable' : `Tails server ${response.status}`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkCredentialDefinitions() {
  if (!ADMIN_URL) {
    return { healthy: false, message: 'ACA_PY_ADMIN_URL not configured' };
  }
  try {
    const response = await fetch(`${ADMIN_URL}/credential-definitions/created`, {
      headers: buildHeaders(),
    });
    if (!response.ok) {
      return {
        healthy: false,
        message: `Credential definition query failed (${response.status})`,
      };
    }
    const payload = (await response.json()) as { credential_definition_ids?: string[] };
    const count = payload.credential_definition_ids?.length ?? 0;
    return {
      healthy: count > 0,
      message: count > 0 ? `${count} credential definitions found` : 'No credential definitions',
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildRecommendations(components: Record<string, { healthy: boolean; message: string }>) {
  const recommendations: string[] = [];
  if (!components.agent.healthy) {
    recommendations.push('Restart ACA-Py agent or verify admin endpoint credentials.');
  }
  if (!components.tails.healthy) {
    recommendations.push('Validate tails server ingress and TLS configuration.');
  }
  if (!components.credentialDefinitions.healthy) {
    recommendations.push('Publish at least one credential definition for the active schema.');
  }
  return recommendations;
}

function buildHeaders() {
  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

export default router;










