import { NextFunction, Request, Response } from 'express';

const WALLET_BINDING_HEADER = 'x-wallet-binding';
const WALLET_SECRET_HEADER = 'x-wallet-secret';
const WALLET_ID_HEADER = 'x-wallet-id';

export interface DeviceBoundWalletRequest extends Request {
  walletBinding?: {
    walletId: string;
    secret: Buffer;
  };
}

export function requireDeviceBoundWallet(req: Request, res: Response, next: NextFunction) {
  const binding = req.header(WALLET_BINDING_HEADER);
  if (!binding || binding.toLowerCase() !== 'device-bound') {
    return res.status(403).json({
      error: 'device_bound_wallet_required',
      message: 'This route only responds to device-bound wallets.',
    });
  }

  const secretHeader = req.header(WALLET_SECRET_HEADER);
  if (!secretHeader) {
    return res.status(400).json({
      error: 'wallet_secret_required',
      message: `Provide a base64 encoded 32-byte secret via the ${WALLET_SECRET_HEADER} header.`,
    });
  }

  let secret: Buffer;
  try {
    secret = Buffer.from(secretHeader, 'base64');
  } catch {
    return res.status(400).json({
      error: 'wallet_secret_invalid',
      message: 'Wallet secret must be base64 encoded.',
    });
  }

  if (secret.length !== 32) {
    return res.status(400).json({
      error: 'wallet_secret_length_invalid',
      message: 'Wallet secret must decode to 32 bytes (256-bit key).',
    });
  }

  (req as DeviceBoundWalletRequest).walletBinding = {
    walletId: req.header(WALLET_ID_HEADER) || 'device-bound-wallet',
    secret,
  };

  return next();
}

