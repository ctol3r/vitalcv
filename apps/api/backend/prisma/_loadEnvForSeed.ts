/**
 * Side-effect import that hydrates process.env from .env.local / .env
 * BEFORE the prisma client is imported by a seed script.
 *
 * Usage (must be the first import):
 *
 *   import './_loadEnvForSeed';
 *   import prisma from '../src/graphql/prisma_client';
 *
 * TypeScript hoists all imports above executable code, so a function-call
 * approach (e.g. `loadDotenv()`) inside the seed file would run AFTER
 * prisma initializes. Putting the dotenv calls in a side-effect import
 * file preserves declaration order — this file runs first, mutating
 * process.env, and the prisma client import then sees DATABASE_URL.
 *
 * Mirrors the runtime loader at src/config/loadDotenv.ts. `override:false`
 * keeps shell/platform env wins.
 */
import path from 'node:path';
import dotenv from 'dotenv';

const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env.local'), override: false, quiet: true });
dotenv.config({ path: path.join(backendRoot, '.env'), override: false, quiet: true });
