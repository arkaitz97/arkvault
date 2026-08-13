import unzipper from 'unzipper';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export async function listZipEntries(filePath) {
  const directory = await unzipper.Open.file(filePath);
  return directory.files
    .filter((f) => f.type === 'File')
    .map((f) => ({ path: f.path, size: f.uncompressedSize || 0, type: f.type }));
}

export async function extractZipEntries(filePath, entries, destPath) {
  const directory = await unzipper.Open.file(filePath);
  const selected = directory.files.filter(
    (f) => f.type === 'File' && entries.some((e) => f.path === e || f.path.startsWith(e.replace(/\/$/, '') + '/'))
  );
  let count = 0;
  for (const file of selected) {
    const outPath = path.join(destPath, file.path);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await pipeline(file.stream(), createWriteStream(outPath));
    count++;
  }
  return { filesRestored: count };
}
