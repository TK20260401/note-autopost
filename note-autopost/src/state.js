import fs from 'fs/promises';
import path from 'path';

const STATE_PATH = path.resolve('state/posted.json');

export async function loadPosted() {
    try {
          const raw = await fs.readFile(STATE_PATH, 'utf8');
          return new Set(JSON.parse(raw));
    } catch {
          return new Set();
    }
}

export async function savePosted(set) {
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    await fs.writeFile(STATE_PATH, JSON.stringify([...set], null, 2) + '\n');
}
