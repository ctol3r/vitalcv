import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type TsConfigReference = {
  path: string;
};

type RootTsConfig = {
  references?: TsConfigReference[];
};

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const rootTsConfigPath = path.join(repoRoot, 'tsconfig.json');

function readJsonFile<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    throw new Error(`Unable to parse JSON file at ${path.relative(repoRoot, filePath)}: ${(error as Error).message}`);
  }
}

function ensureReferencesExist() {
  const errors: string[] = [];
  const config = readJsonFile<RootTsConfig>(rootTsConfigPath);
  const references = config.references ?? [];

  if (references.length === 0) {
    errors.push('Root tsconfig has no references defined.');
    reportAndExit(errors);
  }

  const referencePaths = references.map((ref, index) => {
    if (!ref?.path || typeof ref.path !== 'string' || !ref.path.trim()) {
      errors.push(`Reference at index ${index} is missing a valid "path" property.`);
      return '';
    }

    return ref.path.trim();
  });

  referencePaths.forEach((refPath, index) => {
    if (!refPath) {
      return;
    }

    const targetPath = path.resolve(repoRoot, refPath);
    if (!existsSync(targetPath)) {
      errors.push(`Reference "${refPath}" does not exist on disk.`);
      return;
    }

    const tsconfigPath = refPath.endsWith('.json')
      ? targetPath
      : path.join(targetPath, 'tsconfig.json');

    if (!existsSync(tsconfigPath)) {
      errors.push(`Reference "${refPath}" is missing a tsconfig.json file.`);
      return;
    }

    try {
      readJsonFile<Record<string, unknown>>(tsconfigPath);
    } catch (error) {
      errors.push(error.message);
    }
  });

  const sortedPaths = [...referencePaths].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const isSorted = referencePaths
    .filter(Boolean)
    .every((value, idx) => value === sortedPaths[idx]);

  if (!isSorted) {
    errors.push('Root tsconfig references are not sorted alphabetically.');
  }

  reportAndExit(errors);
}

function reportAndExit(errors: string[]) {
  if (errors.length > 0) {
    console.error('❌ tsconfig reference validation failed:');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('✅ All tsconfig references exist, include tsconfig.json files, and are sorted.');
}

ensureReferencesExist();

