import { Request, Response, Router } from 'express';
import { getVerificationReceipt } from '../services/verificationReceipts';

const router = Router();

router.get('/:id', (req: Request, res: Response) => {
  const receipt = getVerificationReceipt(req.params.id);
  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found', receiptId: req.params.id });
  }

  return res.json({
    id: receipt.id,
    payload: receipt.payload,
    jwt: receipt.jwt,
    createdAt: receipt.createdAt,
  });
});

router.get('/:id/qr', async (req: Request, res: Response) => {
  const receipt = getVerificationReceipt(req.params.id);
  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found', receiptId: req.params.id });
  }

  const baseUrl = process.env.RECEIPT_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const receiptUrl = `${baseUrl.replace(/\/$/, '')}/receipts/${receipt.id}`;

  const qrService = process.env.QR_CODE_SERVICE_URL || 'https://api.qrserver.com/v1/create-qr-code/';
  const qrUrl = qrService.includes('{data}')
    ? qrService.replace('{data}', encodeURIComponent(receiptUrl))
    : `${qrService}${qrService.includes('?') ? '&' : '?'}data=${encodeURIComponent(receiptUrl)}&size=256x256&margin=1`;

  try {
    const response = await fetch(qrUrl, { method: 'GET' });
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch QR code from provider' });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    return res.send(buffer);
  } catch (error) {
    console.error('[Receipts] Failed to generate QR:', error);
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

export default router;
