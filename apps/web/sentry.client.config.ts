import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './lib/observability/sentryScrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only NEXT_PUBLIC_* env reaches the browser bundle, so the client release tag
// uses the public build vars rather than the server-side commit SHA.
const release = process.env.NEXT_PUBLIC_APP_VERSION || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined;

if (dsn) {
  Sentry.init({
    dsn,
    release,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Session Replay records the DOM, which on this product means names, NPIs,
    // and credential detail — `beforeSend` does NOT scrub the replay pipeline.
    // These rates are inert on @sentry/nextjs v10 because no `replayIntegration()`
    // is registered. Do not enable replay without a masking review first
    // (`maskAllText` + `blockAllMedia`) — see docs/ops/observability.md.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
