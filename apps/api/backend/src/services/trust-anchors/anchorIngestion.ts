/**
 * Wave 197 — Trust Anchor Ingestion
 *
 * Seeds authoritative trust lists: AAMVA VICAL, Apple IACA roots, EU LOTL.
 * These are realistic stubs — production deployment should fetch live lists
 * from their authoritative endpoints and verify signatures.
 */

import { createHash } from 'node:crypto';
import { registerAnchor, type TrustAnchor } from './anchors/anchorRegistry';
import { emitAnchorUpdateArtifact } from './auditEmitter';

let initialized = false;

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function stubPem(label: string): string {
  return `-----BEGIN CERTIFICATE-----\nSTUB_${label.replace(/\s+/g, '_').toUpperCase()}_CERTIFICATE\n-----END CERTIFICATE-----`;
}

export function ingestAamvaVical(): TrustAnchor[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'aamva-vical-root-1',
      name: 'AAMVA VICAL Root CA 1',
      issuerUri: 'https://vical.aamva.org',
      publicKey: stubPem('AAMVA VICAL Root CA 1'),
      keyFormat: 'pem',
      rootType: 'AAMVA_VICAL',
      status: 'ACTIVE',
      validFrom: '2020-01-01T00:00:00Z',
      validUntil: '2030-01-01T00:00:00Z',
      crl: 'https://crl.aamva.org/vical-root-1.crl',
      ocsp: 'https://ocsp.aamva.org',
      chainHash: sha256('aamva-vical-root-1-stub-pem'),
      metadata: { country: 'US', certType: 'mDL_root', specVersion: 'ISO18013-5' },
      lastVerifiedAt: now,
      ttlSeconds: 86_400,
    },
    {
      id: 'aamva-vical-root-2',
      name: 'AAMVA VICAL Root CA 2',
      issuerUri: 'https://vical.aamva.org',
      publicKey: stubPem('AAMVA VICAL Root CA 2'),
      keyFormat: 'pem',
      rootType: 'AAMVA_VICAL',
      status: 'ACTIVE',
      validFrom: '2022-01-01T00:00:00Z',
      validUntil: '2032-01-01T00:00:00Z',
      crl: 'https://crl.aamva.org/vical-root-2.crl',
      chainHash: sha256('aamva-vical-root-2-stub-pem'),
      metadata: { country: 'US', certType: 'mDL_root', specVersion: 'ISO18013-5' },
      lastVerifiedAt: now,
      ttlSeconds: 86_400,
    },
  ];
}

export function ingestAppleIaca(): TrustAnchor[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'apple-iaca-root-1',
      name: 'Apple IACA Root 1',
      issuerUri: 'https://id.apple.com',
      publicKey: stubPem('Apple IACA Root 1'),
      keyFormat: 'pem',
      rootType: 'APPLE_IACA',
      status: 'ACTIVE',
      validFrom: '2021-01-01T00:00:00Z',
      validUntil: '2031-01-01T00:00:00Z',
      chainHash: sha256('apple-iaca-root-1-stub'),
      metadata: { platform: 'iOS', walletType: 'Apple_Wallet', specVersion: 'ISO18013-5' },
      lastVerifiedAt: now,
      ttlSeconds: 86_400,
    },
    {
      id: 'apple-iaca-root-2',
      name: 'Apple IACA Root 2 (backup)',
      issuerUri: 'https://id.apple.com',
      publicKey: stubPem('Apple IACA Root 2'),
      keyFormat: 'pem',
      rootType: 'APPLE_IACA',
      status: 'ACTIVE',
      validFrom: '2023-01-01T00:00:00Z',
      validUntil: '2033-01-01T00:00:00Z',
      chainHash: sha256('apple-iaca-root-2-stub'),
      metadata: { platform: 'iOS', walletType: 'Apple_Wallet' },
      lastVerifiedAt: now,
      ttlSeconds: 86_400,
    },
  ];
}

export function ingestEuLotl(): TrustAnchor[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'eu-lotl-ec-root',
      name: 'EU LOTL — European Commission Root',
      issuerUri: 'https://ec.europa.eu/tools/lotl',
      publicKey: stubPem('EU LOTL EC Root'),
      keyFormat: 'pem',
      rootType: 'EU_LOTL',
      status: 'ACTIVE',
      validFrom: '2019-01-01T00:00:00Z',
      validUntil: '2029-01-01T00:00:00Z',
      crl: 'https://crl.ec.europa.eu/lotl-root.crl',
      chainHash: sha256('eu-lotl-ec-root-stub'),
      metadata: { region: 'EU', trustListVersion: 'v2', sourceUrl: 'https://ec.europa.eu/tools/lotl/eu-lotl.xml' },
      lastVerifiedAt: now,
      ttlSeconds: 3_600,
    },
    {
      id: 'eu-lotl-de-national',
      name: 'Germany National Trusted List',
      issuerUri: 'https://www.bundesnetzagentur.de',
      publicKey: stubPem('DE National Trusted List'),
      keyFormat: 'pem',
      rootType: 'NATIONAL',
      status: 'ACTIVE',
      validFrom: '2020-01-01T00:00:00Z',
      chainHash: sha256('eu-lotl-de-national-stub'),
      metadata: { country: 'DE', region: 'EU' },
      lastVerifiedAt: now,
      ttlSeconds: 86_400,
    },
    {
      id: 'eu-lotl-fr-national',
      name: 'France National Trusted List (ANSSI)',
      issuerUri: 'https://www.ssi.gouv.fr',
      publicKey: stubPem('FR National Trusted List'),
      keyFormat: 'pem',
      rootType: 'NATIONAL',
      status: 'ACTIVE',
      validFrom: '2020-01-01T00:00:00Z',
      chainHash: sha256('eu-lotl-fr-national-stub'),
      metadata: { country: 'FR', region: 'EU' },
      lastVerifiedAt: now,
      ttlSeconds: 86_400,
    },
  ];
}

export function ingestAllTrustLists(): TrustAnchor[] {
  if (initialized) {
    return [
      ...ingestAamvaVical(),
      ...ingestAppleIaca(),
      ...ingestEuLotl(),
    ];
  }
  initialized = true;

  const all = [
    ...ingestAamvaVical(),
    ...ingestAppleIaca(),
    ...ingestEuLotl(),
  ];

  const seen = new Set<string>();
  for (const anchor of all) {
    if (seen.has(anchor.id)) continue;
    seen.add(anchor.id);
    registerAnchor(anchor);
    emitAnchorUpdateArtifact(anchor, 'registered');
  }

  return all;
}
