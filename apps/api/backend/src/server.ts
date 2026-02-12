import * as Sentry from '@sentry/node';
import { loadEnv } from './config/env';
import app from './app';

async function main() {
  const config = loadEnv();

  // Initialize Sentry if DSN is configured
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.NODE_ENV,
      tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    console.log('Sentry initialized');
  }

  app.listen(config.PORT, () => {
    console.log(`Server ready at http://localhost:${config.PORT} [${config.NODE_ENV}]`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
