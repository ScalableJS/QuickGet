const PBKDF2_ITERATIONS = 600000; // OWASP 2023+ recommendation for PBKDF2-HMAC-SHA256
const SALT_SIZE = 16; // 128 bits
const IV_SIZE = 12; // 96 bits for GCM

export type EncryptedDataBlob = {
  ciphertext: string;
  iv: string;
  salt: string;
};

/**
 * Derive an AES-GCM 256-bit key from the master password and salt using PBKDF2
 */
async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a password using AES-GCM with a key derived from a master password
 */
export async function encryptPassword(plaintext: string, masterPassword: string): Promise<EncryptedDataBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
  const key = await deriveKey(masterPassword, salt);

  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt a password using AES-GCM with a key derived from a master password
 */
export async function decryptPassword(blob: EncryptedDataBlob, masterPassword: string): Promise<string> {
  const salt = base64ToArrayBuffer(blob.salt);
  const iv = base64ToArrayBuffer(blob.iv);
  const ciphertext = base64ToArrayBuffer(blob.ciphertext);

  const key = await deriveKey(masterPassword, new Uint8Array(salt));
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
