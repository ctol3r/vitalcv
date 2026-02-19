import app from './app';
import { log } from '../obs/logger';

const PORT = parseInt(process.env['ENGINE_PORT'] || process.env['PORT'] || '4000', 10);

function checkRequiredEnv(): void {
  const required = ['PSV_SIGNING_PRIVATE_KEY', 'PSV_SIGNING_PUBLIC_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    log('error', 'Missing required environment variables', {
      event: 'engine_env_check_failed',
      missing,
      hint: 'Generate keys with: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt',
    });
    process.exit(1);
  }
}

checkRequiredEnv();

app.listen(PORT, () => {
  log('info', 'PSV Engine started', {
    event: 'engine_started',
    url: `http://localhost:${PORT}`,
    routes: ['POST /verify', 'GET /.well-known/jwks.json', 'GET /health'],
  });
});
