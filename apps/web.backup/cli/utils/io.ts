import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const resolved = path.resolve(process.cwd(), filePath);
  const contents = await readFile(resolved, 'utf8');
  return JSON.parse(contents) as T;
}
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const resolved = path.resolve(process.cwd(), filePath);
  const contents = await readFile(resolved, 'utf8');
  return JSON.parse(contents) as T;
}

