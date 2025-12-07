import { PrismaClient } from '@prisma/client';
import { setTimeout as delay } from 'timers/promises';

const prisma = new PrismaClient();
const ADMIN_URL = process.env.ACA_PY_ADMIN_URL;
const API_KEY = process.env.ACA_PY_API_KEY;

export interface BootstrapConnectionOptions {
  label: string;
  role: 'issuer' | 'verifier';
  alias?: string;
  waitForResponse?: boolean;
}

export interface BootstrapConnectionResult {
  connectionId: string;
  invitationUrl: string;
  invitation: Record<string, unknown>;
  state: string;
}

export async function bootstrapAriesConnection(
  options: BootstrapConnectionOptions,
): Promise<BootstrapConnectionResult> {
  if (!ADMIN_URL) {
    throw new Error('ACA_PY_ADMIN_URL is not configured');
  }

  const invitationResponse = await fetch(`${ADMIN_URL}/connections/create-invitation`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      my_label: options.label,
      alias: options.alias ?? `${options.role}-${Date.now()}`,
      auto_accept: true,
    }),
  });

  if (!invitationResponse.ok) {
    throw new Error(`ACA-Py invitation failed (${invitationResponse.status})`);
  }

  const payload = (await invitationResponse.json()) as {
    connection_id: string;
    invitation_url: string;
    invitation: Record<string, unknown>;
  };

  let state = 'invitation';
  if (options.waitForResponse !== false) {
    state = await waitForConnectionState(payload.connection_id);
  }

  await prisma.ariesConnection.upsert({
    where: { connectionId: payload.connection_id },
    update: {
      label: options.label,
      role: options.role,
      state,
      metadata: payload.invitation,
    },
    create: {
      connectionId: payload.connection_id,
      label: options.label,
      role: options.role,
      state,
      metadata: payload.invitation,
    },
  });

  return {
    connectionId: payload.connection_id,
    invitationUrl: payload.invitation_url,
    invitation: payload.invitation,
    state,
  };
}

async function waitForConnectionState(connectionId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`${ADMIN_URL}/connections/${connectionId}`, {
      method: 'GET',
      headers: buildHeaders(),
    });

    if (!response.ok) {
      break;
    }

    const payload = (await response.json()) as { state?: string };
    if (payload.state && ['response', 'active', 'completed'].includes(payload.state)) {
      return payload.state;
    }

    await delay(1_000);
  }

  return 'pending';
}

function buildHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}










