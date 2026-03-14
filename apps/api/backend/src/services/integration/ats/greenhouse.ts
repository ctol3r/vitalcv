import { buildBasicAuth, fetchAtsJson, fetchAtsOk } from './common';

const GREENHOUSE_API_BASE = 'https://harvest.greenhouse.io/v1';

export interface GreenhouseCandidate {
  id: number | string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

function greenhouseHeaders(apiKey: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: buildBasicAuth(apiKey),
    'Content-Type': 'application/json',
  };
}

export async function getGreenhouseCandidate(
  candidateId: string,
  apiKey: string,
): Promise<GreenhouseCandidate | null> {
  return fetchAtsJson<GreenhouseCandidate>(
    'greenhouse',
    'get_candidate',
    `${GREENHOUSE_API_BASE}/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: 'GET',
      headers: greenhouseHeaders(apiKey),
    },
    { candidateId },
  );
}

export async function addGreenhouseNote(
  candidateId: string,
  note: string,
  apiKey: string,
): Promise<boolean> {
  return fetchAtsOk(
    'greenhouse',
    'add_note',
    `${GREENHOUSE_API_BASE}/candidates/${encodeURIComponent(candidateId)}/activity_feed/notes`,
    {
      method: 'POST',
      headers: greenhouseHeaders(apiKey),
      body: JSON.stringify({ body: note }),
    },
    { candidateId },
  );
}

export async function tagGreenhouseCandidate(
  candidateId: string,
  tag: string,
  apiKey: string,
): Promise<boolean> {
  return fetchAtsOk(
    'greenhouse',
    'add_tag',
    `${GREENHOUSE_API_BASE}/candidates/${encodeURIComponent(candidateId)}/tags`,
    {
      method: 'POST',
      headers: greenhouseHeaders(apiKey),
      body: JSON.stringify({ tag }),
    },
    { candidateId },
  );
}
