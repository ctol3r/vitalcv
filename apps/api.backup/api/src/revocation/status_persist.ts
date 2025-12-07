import fs from 'fs';

const FILE = 'statuslist.json';

export function save(json: any) {
  fs.writeFileSync(FILE, JSON.stringify(json));
}

export function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return null;
  }
}

