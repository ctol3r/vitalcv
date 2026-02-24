// Provide required env vars for test runs before loading the env validator.
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/vitalcv_test';
process.env.NODE_ENV ??= 'test';

import { loadEnv } from './src/config/env';

loadEnv();
