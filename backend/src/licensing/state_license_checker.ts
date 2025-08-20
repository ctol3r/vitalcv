// state_license_checker.ts - Automates retrieval of state licensing data

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * License information result.
 */
export interface LicenseResult {
  status: string;
  expirationDate?: string;
  raw?: any;
}

/**
 * Mapping of states that expose public licensing APIs.
 * The endpoint should accept a `license` query parameter.
 */
const API_ENDPOINTS: Record<string, string> = {
  // Example for states that provide a REST API endpoint:
  // CA: 'https://api.example.ca.gov/licenses',
};

/**
 * Query a state licensing API if it exists for the given state. Returns null if
 * the state is not configured with an API endpoint.
 */
export async function checkLicenseViaApi(
  state: string,
  licenseNumber: string
): Promise<LicenseResult | null> {
  const endpoint = API_ENDPOINTS[state];
  if (!endpoint) return null;

  const url = `${endpoint}?license=${encodeURIComponent(licenseNumber)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API request failed with status ${res.status}`);
  }
  return (await res.json()) as LicenseResult;
}

/**
 * Scrape license status from a web page if no API is available.
 * Selectors specify where to find the status and expiration date in the page.
 */
export async function scrapeLicenseStatus(
  url: string,
  selectors: { status: string; expiration: string }
): Promise<LicenseResult> {
  const html = await fetch(url).then((r) => r.text());
  const $ = cheerio.load(html);

  const status = $(selectors.status).text().trim();
  const expirationDate = $(selectors.expiration).text().trim();

  return { status, expirationDate };
}

