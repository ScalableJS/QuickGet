import { describe, expect, it } from "vitest";

import { decryptPassword, encryptPassword } from "./credentials.js";

describe("credentials cryptography", () => {
  it("successfully encrypts and decrypts a password", async () => {
    const password = "my-secret-nas-password";
    const masterPassword = "master-password-123";

    const blob = await encryptPassword(password, masterPassword);

    expect(blob.ciphertext).toBeDefined();
    expect(blob.iv).toBeDefined();
    expect(blob.salt).toBeDefined();
    expect(blob.ciphertext).not.toBe(password);

    const decrypted = await decryptPassword(blob, masterPassword);
    expect(decrypted).toBe(password);
  });

  it("fails to decrypt with an incorrect master password", async () => {
    const password = "my-secret-nas-password";
    const masterPassword = "master-password-123";

    const blob = await encryptPassword(password, masterPassword);

    await expect(decryptPassword(blob, "wrong-master-password")).rejects.toThrow();
  });
});
