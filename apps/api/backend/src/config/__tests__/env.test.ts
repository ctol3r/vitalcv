import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGINAL_ENV = process.env;

function createEnvDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalcv-env-'));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents, 'utf8');
  }
  return dir;
}

describe('loadEnv', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {};
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('fails fast when DATABASE_URL is missing', async () => {
    const envDir = createEnvDir({
      '.env': 'NODE_ENV=development\n',
    });

    const { loadEnv, resetEnvForTests } = await import('../env');
    resetEnvForTests();

    expect(() => loadEnv({ envDir, forceReload: true })).toThrow(/DATABASE_URL/);
  });

  it('loads .env, .env.local, and .env.production deterministically', async () => {
    const envDir = createEnvDir({
      '.env': [
        'NODE_ENV=production',
        'DATABASE_URL=postgresql://base',
        'CORS_ORIGIN=https://base.example.com',
      ].join('\n'),
      '.env.local': [
        'CORS_ORIGIN=https://local.example.com',
        'API_KEYS=local-key',
      ].join('\n'),
      '.env.production': 'DATABASE_URL=postgresql://production\n',
    });

    process.env.NODE_ENV = 'production';

    const { loadEnv, resetEnvForTests } = await import('../env');
    resetEnvForTests();

    const env = loadEnv({ envDir, forceReload: true });

    expect(env.DATABASE_URL).toBe('postgresql://production');
    expect(env.CORS_ORIGIN).toBe('https://local.example.com');
    expect(env.API_KEYS).toEqual(['local-key']);
  });

  it('does not override explicit runtime variables with env files', async () => {
    const envDir = createEnvDir({
      '.env': [
        'NODE_ENV=production',
        'DATABASE_URL=postgresql://from-file',
        'CORS_ORIGIN=https://file.example.com',
        'API_KEYS=file-key',
      ].join('\n'),
    });

    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://explicit';
    process.env.CORS_ORIGIN = 'https://explicit.example.com';
    process.env.API_KEYS = 'explicit-key';

    const { loadEnv, resetEnvForTests } = await import('../env');
    resetEnvForTests();

    const env = loadEnv({ envDir, forceReload: true });

    expect(env.DATABASE_URL).toBe('postgresql://explicit');
    expect(env.CORS_ORIGIN).toBe('https://explicit.example.com');
    expect(env.API_KEYS).toEqual(['explicit-key']);
  });
});
