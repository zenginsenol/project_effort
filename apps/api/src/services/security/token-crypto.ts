import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TOKEN_PREFIX = 'encv1';
const TOKEN_ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer | null {
  const rawKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    return null;
  }

  const trimmed = rawKey.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const asBase64 = Buffer.from(trimmed, 'base64');
  if (asBase64.length === 32) {
    return asBase64;
  }

  return createHash('sha256').update(trimmed).digest();
}

export function isEncryptedToken(value: string | null): boolean {
  return typeof value === 'string' && value.startsWith(`${TOKEN_PREFIX}:`);
}

export function encryptToken(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (isEncryptedToken(value)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(TOKEN_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptToken(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (!isEncryptedToken(value)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('Integration token key is missing');
  }

  const parts = value.split(':');
  if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) {
    throw new Error('Invalid encrypted token payload');
  }

  const ivPart = parts[1];
  const authTagPart = parts[2];
  const ciphertextPart = parts[3];
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error('Invalid encrypted token payload');
  }

  const iv = Buffer.from(ivPart, 'base64url');
  const authTag = Buffer.from(authTagPart, 'base64url');
  const ciphertext = Buffer.from(ciphertextPart, 'base64url');

  const decipher = createDecipheriv(TOKEN_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function describeStoredToken(value: string | null): {
  hasToken: boolean;
  encrypted: boolean;
} {
  return {
    hasToken: Boolean(value),
    encrypted: isEncryptedToken(value),
  };
}
