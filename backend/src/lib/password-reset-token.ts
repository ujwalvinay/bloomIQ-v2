import crypto from "crypto";

export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
