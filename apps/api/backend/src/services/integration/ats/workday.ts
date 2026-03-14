import { buildBasicAuth, fetchAtsJson, fetchAtsOk } from './common';

const WORKDAY_API_BASE = 'https://api.workday.com';

interface WorkdayAccessTokenResponse {
  access_token?: string;
}

export async function getWorkdayAccessToken(
  tenant: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
  });

  const response = await fetchAtsJson<WorkdayAccessTokenResponse>(
    'workday',
    'get_access_token',
    `${WORKDAY_API_BASE}/${encodeURIComponent(tenant)}/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: buildBasicAuth(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
    { tenant },
  );

  return response?.access_token ?? null;
}

export async function updateWorkdayWorkerNote(
  tenant: string,
  workerId: string,
  note: string,
  accessToken: string,
): Promise<boolean> {
  return fetchAtsOk(
    'workday',
    'update_worker_note',
    `${WORKDAY_API_BASE}/${encodeURIComponent(tenant)}/workers/${encodeURIComponent(workerId)}/notes`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    },
    { tenant, workerId },
  );
}
