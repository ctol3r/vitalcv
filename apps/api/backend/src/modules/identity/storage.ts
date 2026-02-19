import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { canonicalizeJson } from '../../utils/canonicalizeJson';

export interface ArtifactStorageProvider {
  storeRawPayload(npi: string, payload: object): Promise<string>;
}

export class LocalStorageProvider implements ArtifactStorageProvider {
  private readonly storageDir: string;

  constructor(storageDir = '/tmp/nppes') {
    this.storageDir = storageDir;
  }

  async storeRawPayload(npi: string, payload: object): Promise<string> {
    const normalizedNpi = npi.trim();
    const filename = `${normalizedNpi}-${Date.now()}.json`;
    const filePath = path.join(this.storageDir, filename);
    await mkdir(this.storageDir, { recursive: true });
    await writeFile(filePath, canonicalizeJson(payload), 'utf-8');
    return filePath;
  }
}
