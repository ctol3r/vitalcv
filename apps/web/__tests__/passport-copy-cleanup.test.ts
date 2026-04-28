import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(process.cwd(), '../..');
const PASSPORT_PAGE_PATH = 'apps/web/app/passport/page.tsx';

const BANNED_PASSPORT_COPY = [
  'Wallet entry',
  'Real-time visual feedback',
] as const;

describe('passport copy cleanup (TRUTH-CLEANUP-2)', () => {
  it('removes wallet and real-time wording from the passport entry source', () => {
    const source = fs.readFileSync(
      path.resolve(REPO_ROOT, PASSPORT_PAGE_PATH),
      'utf8',
    );

    for (const phrase of BANNED_PASSPORT_COPY) {
      expect(source).not.toContain(phrase);
    }
  });
});
