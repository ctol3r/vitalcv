import app from './app';
import { log } from './obs/logger';
import { seedIssuerEntities } from './services/entity/seedIssuers';
import { prewarmLeieCache } from './services/identity/leieCache';
import { assertNppesApiVersion } from './services/identity/nppesApiVersion';

export default app;

export async function startServer() {
  // NPPES V1 sunset 2026-03-03 — refuse to boot on a non-v2.1 endpoint constant.
  const nppes = assertNppesApiVersion();
  log('info', 'NPPES API version pinned', {
    event: 'nppes_api_version',
    version: nppes.version,
    endpoints: nppes.endpoints,
  });
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    log('info', 'Server ready', {
      event: 'server_ready',
      url: `http://localhost:${port}`,
    });
  });
  // Seed canonical issuer entities on startup (idempotent)
  seedIssuerEntities().catch(err =>
    log('warn', 'issuer_seed_startup_failed', { error: String(err) }),
  );
  // Pre-warm OIG LEIE cache (downloads CSV async, ~2–5s; ready before first request)
  prewarmLeieCache();
}

if (require.main === module) {
  startServer();
}
