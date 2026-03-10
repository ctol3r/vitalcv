/**
 * Wave 199 — Issuance Receipts
 * Appends a receipt record to the audit scrapbook (JSONL) on every issuance.
 */

import fs from 'node:fs';
import path from 'node:path';
import { log } from '../../obs/logger';

const RECEIPTS_PATH = path.resolve(
  __dirname,
  '../../audit/scrapbook/issuance-receipts.jsonl',
);

export interface IssuanceReceipt {
  credentialId: string;
  holderDid: string;
  type: string;
  issuedAt: string;
  claims: string[];
  kid: string;
}

export function recordIssuanceReceipt(receipt: IssuanceReceipt): void {
  try {
    const dir = path.dirname(RECEIPTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(RECEIPTS_PATH, JSON.stringify(receipt) + '\n');
  } catch {
    log('warn', 'issuance_receipt_write_failed', { credentialId: receipt.credentialId });
  }
}
