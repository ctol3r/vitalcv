import app from './app';
import { startCredentialLifecycleSweep } from './cron/credentialLifecycle';

async function main() {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}`);
  });

  startCredentialLifecycleSweep();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
