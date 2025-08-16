// src/lib/crypto.ts
// Simple AES-GCM + PBKDF2 utilities for E2EE backup

// --- Configuration Constants ---
const KDF_ITERATIONS = 120000;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;
const KEY_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const KDF_HASH_ALGORITHM = 'SHA-256';
const KDF_NAME = 'PBKDF2';

/**
 * Defines the structure for the encrypted data payload.
 * This ensures type safety when handling encrypted objects.
 */
export interface EncryptedPayload {
  v: 1;
  alg: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iv: string;   // base64 encoded
  salt: string; // base64 encoded
  data: string; // base64 encoded
}

/**
 * Derives a cryptographic key from a passphrase and salt using PBKDF2.
 * @param passphrase The user-provided secret.
 * @param salt A random salt to prevent rainbow table attacks.
 * @returns A CryptoKey suitable for AES-GCM encryption and decryption.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: KDF_NAME },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: KDF_NAME,
      salt,
      iterations: KDF_ITERATIONS,
      hash: KDF_HASH_ALGORITHM,
    },
    keyMaterial,
    { name: KEY_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encodes an ArrayBuffer into a Base64 string.
 */
export function b64encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Decodes a Base64 string back into a Uint8Array.
 */
export function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Encrypts a JSON-serializable object using AES-GCM.
 * @param obj The object to encrypt. Must be JSON-serializable.
 * @param passphrase The encryption passphrase.
 * @returns An object containing the encrypted data and metadata.
 */
export async function encryptJSON<T>(obj: T, passphrase: string): Promise<EncryptedPayload> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const key = await deriveKey(passphrase, salt);
  const data = enc.encode(JSON.stringify(obj));
  
  const cipher = await crypto.subtle.encrypt({ name: KEY_ALGORITHM, iv }, key, data);
  
  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iv: b64encode(iv),
    salt: b64encode(salt),
    data: b64encode(cipher),
  };
}

/**
 * Decrypts a payload encrypted with `encryptJSON`.
 * @param payload The encrypted payload object.
 * @param passphrase The decryption passphrase.
 * @returns The original decrypted object.
 */
export async function decryptJSON<T>(payload: EncryptedPayload, passphrase: string): Promise<T> {
  const iv = b64decode(payload.iv);
  const salt = b64decode(payload.salt);
  const key = await deriveKey(passphrase, salt);
  const cipher = b64decode(payload.data);
  
  const plain = await crypto.subtle.decrypt({ name: KEY_ALGORITHM, iv }, key, cipher);
  
  const dec = new TextDecoder();
  const jsonString = dec.decode(plain);
  return JSON.parse(jsonString) as T;
}


/**
 * Generates a secure, random passphrase.
 * @param length The desired length of the passphrase.
 * @returns A random string suitable for use as a passphrase.
 */
export function generatePassphrase(length = 32): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return b64encode(arr).slice(0, length);
}
