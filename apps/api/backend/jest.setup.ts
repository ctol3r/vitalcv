// The backend test script provisions a real ephemeral Postgres instance and
// exports DATABASE_URL before Jest starts. Avoid injecting a fake local URL.
process.env.NODE_ENV ??= 'test';
process.env.YC_DEMO_MODE = 'false';

import { loadEnv } from './src/config/env';

loadEnv();
