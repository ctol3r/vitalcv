import { Router, Request, Response } from 'express';
import { credentialOfferService } from '../../services/oidc4vci/offer';

const router = Router();

router.get('/:credentialId', (req: Request, res: Response) => {
  const { credentialId } = req.params;
  const ttl = req.query.ttl ? Number.parseInt(String(req.query.ttl), 10) : undefined;

  if (!credentialId) {
    return res.status(400).json({ error: 'missing_credential_id' });
  }
  if (ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
    return res.status(400).json({ error: 'invalid_ttl', error_description: 'ttl must be a positive integer' });
  }

  try {
    const offer = credentialOfferService.createOffer(credentialId, {
      subjectHint: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      ttlSeconds: ttl,
    });

    return res.json({
      offer_id: offer.offerId,
      credential_id: offer.credentialId,
      format: offer.format,
      nonce: offer.nonce,
      pre_authorized_code: offer.preAuthorizedCode,
      credential_offer: offer.credentialOffer,
      credential_offer_uri: offer.credentialOfferUri,
      qr: {
        payload: offer.qrPayload,
        encoding: 'openid-credential-offer',
      },
      issuer_metadata: offer.issuerMetadata,
      expires_at: new Date(offer.expiresAt).toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return res.status(500).json({ error: 'offer_generation_failed', error_description: message });
  }
});

export default router;











