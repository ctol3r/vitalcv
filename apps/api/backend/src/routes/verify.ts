import type { Express, Request, Response } from 'express';
import multer from 'multer';
import unzipper from 'unzipper';
import { sha256Hex } from '../lib/crypto/sha256';
import { loadEd25519KeyPairFromEnv, ed25519VerifyDetached } from '../lib/crypto/ed25519';
import { canonicalizeJson } from '../utils/canonicalizeJson';
import { log } from '../obs/logger';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

type VerifyResult = {
  ok: boolean;
  valid_signature: boolean;
  canonical_match: boolean;
  manifest_sha256: string | null;
  evidence_pdf_sha256: string | null;
  errors: string[];
  verified_at_utc: string;
};

async function extractZipToMap(zipBuf: Buffer): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const directory = await unzipper.Open.buffer(zipBuf);

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    const name = entry.path.replace(/\\/g, '/');
    const content = await entry.buffer();
    files.set(name, content);
  }
  return files;
}

function jsonSafeParse(buf: Buffer): { value: Record<string, unknown> | null; error: string | null } {
  try {
    const s = buf.toString('utf8');
    return { value: JSON.parse(s) as Record<string, unknown>, error: null };
  } catch (e) {
    return { value: null, error: `invalid_json: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function registerVerifyRoutes(app: Express): void {
  app.post('/verify', upload.single('bundle'), async (req: Request, res: Response) => {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];

    try {
      const file = req.file;
      if (!file?.buffer) {
        return res.status(400).json({
          error: 'missing_bundle',
          hint: "Upload multipart/form-data with field name 'bundle'.",
        });
      }

      const files = await extractZipToMap(file.buffer);

      const manifestBuf = files.get('manifest.json') ?? null;
      const sigBuf = files.get('manifest.sig') ?? null;
      const canonicalBuf = files.get('manifest.canonical.json') ?? null;
      const evidencePdfBuf = files.get('evidence.pdf') ?? null;

      if (!manifestBuf) errors.push('missing_manifest_json');
      if (!sigBuf) errors.push('missing_manifest_sig');
      if (!canonicalBuf) errors.push('missing_manifest_canonical_json');
      if (!evidencePdfBuf) errors.push('missing_evidence_pdf');

      if (errors.length) {
        const out: VerifyResult = {
          ok: false,
          valid_signature: false,
          canonical_match: false,
          manifest_sha256: null,
          evidence_pdf_sha256: null,
          errors,
          verified_at_utc: startedAt,
        };
        return res.status(400).json(out);
      }

      // Parse and canonicalize manifest
      const parsed = jsonSafeParse(manifestBuf!);
      if (parsed.error || !parsed.value) {
        const out: VerifyResult = {
          ok: false,
          valid_signature: false,
          canonical_match: false,
          manifest_sha256: null,
          evidence_pdf_sha256: null,
          errors: [parsed.error ?? 'invalid_manifest_json'],
          verified_at_utc: startedAt,
        };
        return res.status(400).json(out);
      }

      const canonicalFromManifest = canonicalizeJson(parsed.value);
      const canonicalOnDisk = canonicalBuf!.toString('utf8');

      const canonical_match = canonicalFromManifest === canonicalOnDisk;
      if (!canonical_match) errors.push('canonical_mismatch');

      const manifest_sha256 = sha256Hex(canonicalFromManifest);
      const evidence_pdf_sha256 = sha256Hex(evidencePdfBuf!);

      // Verify Ed25519 signature
      const sigB64 = sigBuf!.toString('utf8').trim();
      if (!sigB64) errors.push('empty_signature');

      let valid_signature = false;
      if (sigB64) {
        try {
          const sigBytes = new Uint8Array(Buffer.from(sigB64, 'base64'));
          const kp = await loadEd25519KeyPairFromEnv();
          valid_signature = await ed25519VerifyDetached(canonicalFromManifest, sigBytes, kp.publicKey);
          if (!valid_signature) errors.push('invalid_signature');
        } catch (e) {
          errors.push('signature_verification_error');
          log('error', 'verify_signature_failed', {
            event: 'verify_signature_failed',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      const ok = valid_signature && canonical_match && errors.length === 0;

      const out: VerifyResult = {
        ok,
        valid_signature,
        canonical_match,
        manifest_sha256,
        evidence_pdf_sha256,
        errors,
        verified_at_utc: startedAt,
      };

      log('info', 'bundle_verified', {
        event: 'bundle_verified',
        ok,
        valid_signature,
        canonical_match,
        manifest_sha256,
      });

      return res.status(ok ? 200 : 422).json(out);
    } catch (e) {
      log('error', 'verify_failed', {
        event: 'verify_failed',
        error: e instanceof Error ? e.message : String(e),
      });
      return res.status(500).json({
        error: 'verify_failed',
        reason: e instanceof Error ? e.message : String(e),
        verified_at_utc: startedAt,
      });
    }
  });
}
