import app from './app';
import { log } from './obs/logger';
import { seedIssuerEntities } from './services/entity/seedIssuers';

export default app;

export async function startServer() {
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
}

if (require.main === module) {
  startServer();
}
