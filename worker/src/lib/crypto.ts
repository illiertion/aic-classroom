const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 120_000;

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomToken(bytes = 24): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomId(prefix = ""): string {
  return `${prefix}${randomToken(16)}`;
}

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomJoinCode(length = 6): string {
  const values = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const value of values) out += JOIN_ALPHABET[value % JOIN_ALPHABET.length];
  return out;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function derivePasswordBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derivePasswordBits(password, salt);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;
  const salt = fromBase64Url(parts[2]);
  const expected = parts[3];
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return timingSafeEqual(toBase64Url(new Uint8Array(bits)), expected);
}

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const data =
    typeof input === "string"
      ? encoder.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

export interface SignedPayload {
  exp: number;
  [key: string]: unknown;
}

export async function signPayload(
  payload: SignedPayload,
  secret: string,
): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSign(body, secret);
  return `${body}.${signature}`;
}

export async function verifySignedPayload<T extends SignedPayload>(
  token: string | undefined | null,
  secret: string,
): Promise<T | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacSign(body, secret);
  if (!timingSafeEqual(expected, signature)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

