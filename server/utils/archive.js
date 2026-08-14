import unzipper from 'unzipper';
import * as tar from 'tar';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export async function isTarArchive(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(262);
    const { bytesRead } = await handle.read(buf, 0, 262, 0);
    const head = buf.subarray(0, bytesRead);
    if (head[0] === 0x1f && head[1] === 0x8b) return true; // gzip (tar.gz)
    if (head.toString('ascii', 257, 262) === 'ustar') return true; // plain tar
    return false;
  } finally {
    await handle.close();
  }
}

export async function listZipEntries(filePath) {
  if (await isTarArchive(filePath)) {
    const entries = [];
    await tar.t({
      file: filePath,
      onentry: (entry) => {
        if (entry.type === 'File') {
          entries.push({ path: entry.path, size: entry.size || 0, type: entry.type });
        }
      }
    });
    return entries;
  }

  const directory = await unzipper.Open.file(filePath);
  return directory.files
    .filter((f) => f.type === 'File')
    .map((f) => ({ path: f.path, size: f.uncompressedSize || 0, type: f.type }));
}

export async function extractZipEntries(filePath, entries, destPath) {
  if (await isTarArchive(filePath)) {
    const matches = (p) => entries.some((e) => p === e || p.startsWith(e.replace(/\/$/, '') + '/'));
    await fs.mkdir(destPath, { recursive: true });
    let count = 0;
    await tar.x({
      file: filePath,
      cwd: destPath,
      filter: (p) => matches(p),
      onentry: () => { count++; }
    });
    return { filesRestored: count };
  }

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
