/**
 * VitalCV Trust Client
 * Acts as the primary internal consumer of the newly created Trust API.
 * The frontend UI (Passport, Employer Review) must NEVER call internal backend engines directly.
 */

import { getApiBase } from '../api';

export interface TrustApiRequest {
  clinicianId: string;
  orgId: string;
  role?: string;
}

async function fetchTrustApi(endpoint: string, payload: TrustApiRequest) {
  const response = await fetch(`${getApiBase()}/api/trust/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Trust API ${endpoint} failed: ${response.statusText}`);
  }
  return response.json();
}

export async function getRecognition(payload: TrustApiRequest) {
  return fetchTrustApi('recognition', payload);
}

export async function getAcceptance(payload: TrustApiRequest) {
  return fetchTrustApi('acceptance', payload);
}

export async function getStartability(payload: TrustApiRequest) {
  return fetchTrustApi('startability', payload);
}

export async function getFullDecision(payload: TrustApiRequest) {
  return fetchTrustApi('full', payload);
}
