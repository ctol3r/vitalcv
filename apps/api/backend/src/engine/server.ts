import app from './app';

const PORT = parseInt(process.env['ENGINE_PORT'] || process.env['PORT'] || '4000', 10);

function checkRequiredEnv(): void {
  const required = ['PSV_SIGNING_PRIVATE_KEY', 'PSV_SIGNING_PUBLIC_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[engine] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[engine] Generate keys with: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt');
    process.exit(1);
  }
}

checkRequiredEnv();

app.listen(PORT, () => {
  console.log(`[engine] PSV Engine running on http://localhost:${PORT}`);
  console.log(`[engine] POST /verify — verify a provider by NPI`);
  console.log(`[engine] GET /.well-known/jwks.json — public signing key`);
  console.log(`[engine] GET /health — health check`);
});
