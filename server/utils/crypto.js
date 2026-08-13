import crypto from 'crypto';
import fs from 'fs/promises';

const KEY = process.env.ENCRYPTION_KEY || 'arkvault-dev-encryption-key';
const KEY_BUF = crypto.createHash('sha256').update(KEY).digest(); // 32 bytes

export async function encryptFile(inputPath) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUF, iv);
  const data = await fs.readFile(inputPath);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const outPath = `${inputPath}.enc`;
  await fs.writeFile(outPath, Buffer.concat([iv, authTag, encrypted]));
  await fs.rm(inputPath, { force: true });
  return outPath;
}

export async function decryptFile(inputPath) {
  const buf = await fs.readFile(inputPath);
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUF, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const outPath = `${inputPath}.dec`;
  await fs.writeFile(outPath, decrypted);
  await fs.rm(inputPath, { force: true });
  return outPath;
}

export async function checksumFile(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}
