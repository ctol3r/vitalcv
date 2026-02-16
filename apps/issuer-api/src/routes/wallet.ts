import { NextFunction, Request, Response, Router } from 'express';
import {
  getWalletRecord,
  listCredentials,
  storeCredential,
  verifyStoredCredential,
} from '../services/verifierWalletStore';

type WalletBody = Record<string, unknown>;

const router: Router = Router();
const REQUIRED_ROLE = 'verifier';

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBodyRecord(value: unknown): WalletBody {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as WalletBody;
  }
  return {};
}

function parseRequiredString(value: unknown, field: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function parseOptionalString(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : undefined;
}

function parseVerifierApiKeys(): Set<string> {
  const raw = process.env.VERIFIER_WALLET_API_KEYS ?? process.env.API_KEYS ?? '';
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function parseVerifierRole(req: Request): string | null {
  const roleHeader = normalizeString(req.get('x-user-role') || req.get('x-verifier-role') || req.get('x-role'));
  return roleHeader.length ? roleHeader : null;
}

function requireVerifierRole(req: Request, res: Response, next: NextFunction): void {
  const role = parseVerifierRole(req);
  if (role !== REQUIRED_ROLE) {
    res.status(403).json({
      error: 'forbidden',
      error_description: 'Verifier role required.',
    });
    return;
  }

  const configuredKeys = parseVerifierApiKeys();
  const providedKey = normalizeString(req.get('x-api-key'));

  if (configuredKeys.size === 0) {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    res.status(401).json({
      error: 'api_key_required',
      error_description: 'x-api-key is required in production.',
    });
    return;
  }

  if (!providedKey || !configuredKeys.has(providedKey)) {
    res.status(401).json({
      error: 'invalid_api_key',
      error_description: 'Invalid x-api-key.',
    });
    return;
  }

  next();
}

router.use(requireVerifierRole);

router.post('/store', async (req: Request, res: Response): Promise<void> => {
  const body = parseBodyRecord(req.body);

  try {
    const walletId = parseRequiredString(body.walletId, 'walletId');
    const credential = parseRequiredString(body.credential, 'credential');
    const organizationId = parseOptionalString(body.organizationId);

    const wallet = await storeCredential(walletId, credential, organizationId);
    res.status(201).json(wallet);
  } catch (error) {
    res.status(400).json({
      error: 'wallet_store_error',
      error_description: error instanceof Error ? error.message : 'Unable to store credential.',
    });
  }
});

router.get('/:walletId', async (req: Request, res: Response): Promise<void> => {
  try {
    const walletId = parseRequiredString(req.params.walletId, 'walletId');
    const wallet = getWalletRecord(walletId);

    if (!wallet) {
      res.status(404).json({
        error: 'wallet_not_found',
      });
      return;
    }

    res.status(200).json(wallet);
  } catch (error) {
    res.status(400).json({
      error: 'wallet_lookup_error',
      error_description: error instanceof Error ? error.message : 'Unable to load wallet.',
    });
  }
});

router.get('/:walletId/credentials', async (req: Request, res: Response): Promise<void> => {
  try {
    const walletId = parseRequiredString(req.params.walletId, 'walletId');
    const credentials = listCredentials(walletId);
    res.status(200).json({
      walletId,
      credentials,
    });
  } catch (error) {
    res.status(400).json({
      error: 'wallet_credentials_error',
      error_description: error instanceof Error ? error.message : 'Unable to list credentials.',
    });
  }
});

router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const body = parseBodyRecord(req.body);

  try {
    const walletId = parseRequiredString(body.walletId, 'walletId');
    const vcId = parseRequiredString(body.vcId, 'vcId');

    const valid = await verifyStoredCredential(walletId, vcId);
    res.status(200).json({
      walletId,
      vcId,
      valid,
    });
  } catch (error) {
    res.status(400).json({
      error: 'wallet_verify_error',
      error_description: error instanceof Error ? error.message : 'Unable to verify credential.',
    });
  }
});

export default router;
