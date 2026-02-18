import type { Express, Request, Response, NextFunction } from 'express';
import { handleValidateNpi } from './nppes.controller';
import { handleJwks } from './jwks.controller';
export { ArtifactStorageProvider, LocalStorageProvider } from './storage';

export { fetchNpiFromCMS } from './nppes.service';
export { normalizeProvider } from './nppes.validator';
export { generateIdentityArtifact } from './nppes.artifact.generator';
export { signArtifact } from './signer';
export { handleJwks } from './jwks.controller';
export { handleValidateNpi } from './nppes.controller';
export { verifyArtifactSignature } from './verification';

export type {
  RawNppesResponse,
  NormalizedProvider,
  IdentityArtifact,
  IdentityArtifactSigned,
  NppesFetchResult,
  ArtifactGenerationResult,
} from './types';

/**
 * Wrap an async route handler so thrown errors reach the Express error handler.
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Register identity module routes on the Express app.
 *
 * - POST /identity/validate-npi — validate an NPI and return signed artifact
 * - GET  /.well-known/jwks.json — public JWKS endpoint for signature verification
 * - GET  /identity/.well-known/jwks.json — identity-scoped JWKS alias
 */
export function registerIdentityRoutes(app: Express): void {
  app.post('/identity/validate-npi', asyncHandler(handleValidateNpi));
  app.get('/.well-known/jwks.json', asyncHandler(handleJwks));
  app.get('/identity/.well-known/jwks.json', asyncHandler(handleJwks));
}
