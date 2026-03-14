import { buildBasicAuth, fetchAtsJson, fetchAtsOk } from './common';

const LEVER_API_BASE = 'https://api.lever.co/v1';

export interface LeverCandidate {
  id: string;
  name?: string;
  emails?: Array<{ value?: string }>;
  [key: string]: unknown;
}

function leverHeaders(apiKey: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: buildBasicAuth(apiKey),
    'Content-Type': 'application/json',
  };
}

export async function getLeverCandidate(
  candidateId: string,
  apiKey: string,
): Promise<LeverCandidate | null> {
  return fetchAtsJson<LeverCandidate>(
    'lever',
    'get_candidate',
    `${LEVER_API_BASE}/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: 'GET',
      headers: leverHeaders(apiKey),
    },
    { candidateId },
  );
}

export async function addLeverNote(
  candidateId: string,
  note: string,
  apiKey: string,
): Promise<boolean> {
  return fetchAtsOk(
    'lever',
    'add_note',
    `${LEVER_API_BASE}/candidates/${encodeURIComponent(candidateId)}/notes`,
    {
      method: 'POST',
      headers: leverHeaders(apiKey),
      body: JSON.stringify({ note }),
    },
    { candidateId },
  );
}

export async function addLeverTag(
  candidateId: string,
  tag: string,
  apiKey: string,
): Promise<boolean> {
  return fetchAtsOk(
    'lever',
    'add_tag',
    `${LEVER_API_BASE}/candidates/${encodeURIComponent(candidateId)}/tags`,
    {
      method: 'POST',
      headers: leverHeaders(apiKey),
      body: JSON.stringify({ tag }),
    },
    { candidateId },
  );
}
