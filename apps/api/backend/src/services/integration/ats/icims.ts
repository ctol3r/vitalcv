import { buildBasicAuth, fetchAtsJson, fetchAtsOk } from './common';

const ICIMS_API_BASE = 'https://api.icims.com/customers';

export interface ICIMSCandidate {
  id: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

function icimsHeaders(username: string, password: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: buildBasicAuth(username, password),
    'Content-Type': 'application/json',
  };
}

export async function getICIMSCandidate(
  candidateId: string,
  customerId: string,
  username: string,
  password: string,
): Promise<ICIMSCandidate | null> {
  return fetchAtsJson<ICIMSCandidate>(
    'icims',
    'get_candidate',
    `${ICIMS_API_BASE}/${encodeURIComponent(customerId)}/people/${encodeURIComponent(candidateId)}`,
    {
      method: 'GET',
      headers: icimsHeaders(username, password),
    },
    { candidateId, customerId },
  );
}

export async function addICIMSNote(
  candidateId: string,
  note: string,
  customerId: string,
  username: string,
  password: string,
): Promise<boolean> {
  return fetchAtsOk(
    'icims',
    'add_note',
    `${ICIMS_API_BASE}/${encodeURIComponent(customerId)}/people/${encodeURIComponent(candidateId)}/notes`,
    {
      method: 'POST',
      headers: icimsHeaders(username, password),
      body: JSON.stringify({ note }),
    },
    { candidateId, customerId },
  );
}
