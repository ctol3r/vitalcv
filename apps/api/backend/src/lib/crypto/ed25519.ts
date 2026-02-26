import sodium from "libsodium-wrappers";

export type Ed25519KeyPair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

export async function loadEd25519KeyPairFromEnv(): Promise<Ed25519KeyPair> {
  await sodium.ready;

  const privB64 = process.env.VITALCV_ED25519_PRIVATE_KEY_B64?.trim();
  const pubB64  = process.env.VITALCV_ED25519_PUBLIC_KEY_B64?.trim();

  if (!privB64 || !pubB64) {
    const allowEphemeral = process.env.VITALCV_ALLOW_EPHEMERAL_KEYS === "true";
    if (!allowEphemeral) {
      throw new Error(
        "Missing Ed25519 keys. Set VITALCV_ED25519_PRIVATE_KEY_B64 and " +
        "VITALCV_ED25519_PUBLIC_KEY_B64 (or set VITALCV_ALLOW_EPHEMERAL_KEYS=true for dev only)."
      );
    }
    const kp = sodium.crypto_sign_keypair();
    return { publicKey: kp.publicKey, privateKey: kp.privateKey };
  }

  const privateKey = sodium.from_base64(privB64, sodium.base64_variants.ORIGINAL);
  const publicKey  = sodium.from_base64(pubB64,  sodium.base64_variants.ORIGINAL);

  if (privateKey.length !== 64) throw new Error("Ed25519 private key must be 64 bytes (libsodium secretKey).");
  if (publicKey.length  !== 32) throw new Error("Ed25519 public key must be 32 bytes.");

  return { privateKey, publicKey };
}

export async function ed25519SignDetached(messageUtf8: string, privateKey: Uint8Array): Promise<Uint8Array> {
  await sodium.ready;
  const msg = Buffer.from(messageUtf8, "utf8");
  return sodium.crypto_sign_detached(msg, privateKey);
}

export async function ed25519VerifyDetached(
  messageUtf8: string,
  sig: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  await sodium.ready;
  const msg = Buffer.from(messageUtf8, "utf8");
  return sodium.crypto_sign_verify_detached(sig, msg, publicKey);
}

export async function toBase64(sig: Uint8Array): Promise<string> {
  await sodium.ready;
  return sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
}
