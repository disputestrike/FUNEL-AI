/**
 * Multi-factor authentication.
 *
 * Two factor types supported:
 *
 *  - TOTP (RFC-6238) via `otplib`. Standard authenticator-app flow:
 *    enroll â†’ issue base32 secret + otpauth:// URL â†’ user scans QR â†’
 *    confirm with current code â†’ store secret.
 *    On enroll we also mint 10 single-use backup codes (each is a
 *    10-char alnum; we store argon2id hashes only).
 *
 *  - WebAuthn (FIDO2) via `@simplewebauthn/server`. Two ceremonies:
 *    registration (`generateWebauthnRegistrationOptions` â†’ user provides
 *    `attestationResponse` â†’ `verifyWebauthnRegistration` stores credential)
 *    and authentication (`generateWebauthnAuthenticationOptions` â†’ user
 *    provides `assertionResponse` â†’ `verifyWebauthnAuthentication`).
 *
 * Disabling TOTP requires the current password AND a valid current TOTP
 * code (or backup code) â€” this prevents a logged-in but session-stolen
 * attacker from yanking MFA.
 */

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { emit } from "@funnel/events";
import { Errors } from "./errors.js";
import { hashSecret, sha256Hex, verifyPassword, verifySecret } from "./internal/hash.js";
import type { AuthContext, MfaSecretRow } from "./internal/ports.js";

// otplib defaults to 30s window, 6-digit codes. We allow Â±1 step for clock skew.
authenticator.options = { window: 1, step: 30, digits: 6 };

export interface TotpEnrollResult {
  /** base32 secret to display once on the enroll screen. */
  secret: string;
  /** otpauth:// URI (also embedded in the QR PNG). */
  otpauth_uri: string;
  /** data: URL PNG of the QR code. */
  qr_data_url: string;
  /** Plaintext backup codes â€” show ONCE; we only persist hashes. */
  backup_codes: string[];
}

const BACKUP_CODE_COUNT = 10;

function generateBackupCodes(ctx: AuthContext): string[] {
  // 10 alphanumeric codes, e.g. "K3X9-7P2M-Q1RT" (12 chars, no I/O/0/1).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = "";
    for (let j = 0; j < 12; j++) {
      if (j === 4 || j === 8) {
        code += "-";
        continue;
      }
      const random = Buffer.from(ctx.random(8), "base64url");
      const byte = random[0] ?? 0;
      const idx = byte % alphabet.length;
      code += alphabet[idx];
    }
    codes.push(code);
  }
  return codes;
}

export async function totpEnrollBegin(
  ctx: AuthContext,
  userId: string,
  accountLabel: string,
): Promise<TotpEnrollResult> {
  const existing = await ctx.mfa.get(userId, "totp");
  if (existing) throw Errors.mfaAlreadyEnrolled();

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(accountLabel, "GoFunnelAI", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  const codes = generateBackupCodes(ctx);

  const codeHashes = await Promise.all(codes.map((c) => hashSecret(c)));
  // We persist the secret + backup codes ONLY on `totpEnrollConfirm`.
  // For the "begin" step we return the secret to the caller; the SPA must
  // round-trip it back to the server with a valid code to confirm.
  // We hide the implementation here by stashing secrets in a single-use token.
  await ctx.tokens.create({
    id: `tok_mfa_enroll_${userId}`,
    purpose: "email_verify", // overload purpose namespace; safe for short-lived
    user_id: userId,
    workspace_id: null,
    token_hash: sha256Hex(`mfa_enroll:${userId}:${secret}`),
    payload: { secret, backup_codes_hashes: codeHashes },
    created_at: ctx.now().toISOString(),
    expires_at: new Date(ctx.now().getTime() + 10 * 60 * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: null,
  });

  return {
    secret,
    otpauth_uri: otpauth,
    qr_data_url: qrDataUrl,
    backup_codes: codes,
  };
}

export async function totpEnrollConfirm(
  ctx: AuthContext,
  userId: string,
  secret: string,
  code: string,
): Promise<void> {
  if (!authenticator.check(code, secret)) throw Errors.mfaInvalid();
  const stash = await ctx.tokens.findByHash(sha256Hex(`mfa_enroll:${userId}:${secret}`), "email_verify");
  if (!stash || stash.consumed_at) throw Errors.invalidToken();
  const payload = stash.payload as { secret: string; backup_codes_hashes: string[] } | null;
  if (!payload || payload.secret !== secret) throw Errors.invalidToken();

  await ctx.mfa.upsert({
    user_id: userId,
    type: "totp",
    secret,
    label: "Authenticator app",
    backup_codes_hashes: payload.backup_codes_hashes,
    enrolled_at: ctx.now().toISOString(),
    last_used_at: null,
  });
  await ctx.users.update(userId, { mfa_enrolled: true });
  await ctx.tokens.markConsumed(stash.id, ctx.now().toISOString());

  await emit("user_mfa_enrolled", { user_id: userId, factor: "totp" });
}

export async function verifyTotp(ctx: AuthContext, userId: string, code: string): Promise<boolean> {
  const row = await ctx.mfa.get(userId, "totp");
  if (!row) return false;

  // Try TOTP code first.
  if (authenticator.check(code, row.secret)) {
    await ctx.mfa.upsert({ ...row, last_used_at: ctx.now().toISOString() });
    return true;
  }

  // Fall back to backup code.
  // Backup codes are alphanumeric; if the input matches one of the hashes we
  // consume it (a backup code is single-use).
  for (const hash of row.backup_codes_hashes) {
    if (await verifySecret(hash, code.trim())) {
      const ok = await ctx.mfa.consumeBackupCode(userId, hash);
      if (ok) {
        await ctx.mfa.upsert({
          ...row,
          backup_codes_hashes: row.backup_codes_hashes.filter((h) => h !== hash),
          last_used_at: ctx.now().toISOString(),
        });
        return true;
      }
    }
  }
  return false;
}

export async function totpDisable(
  ctx: AuthContext,
  userId: string,
  currentPassword: string,
  currentCode: string,
): Promise<void> {
  const user = await ctx.users.findById(userId);
  if (!user || !user.password_hash) throw Errors.invalidCredentials();
  if (!(await verifyPassword(user.password_hash, currentPassword))) {
    throw Errors.invalidCredentials();
  }
  const ok = await verifyTotp(ctx, userId, currentCode);
  if (!ok) throw Errors.mfaInvalid();

  await ctx.mfa.remove(userId, "totp");
  // Only flip mfa_enrolled off if there's no WebAuthn either.
  const webauthn = await ctx.mfa.get(userId, "webauthn");
  if (!webauthn) await ctx.users.update(userId, { mfa_enrolled: false });

  await emit("user_mfa_disabled", {
    user_id: userId,
    factor: "totp",
    actor: { type: "user", user_id: userId },
  });
}

/* ===== WebAuthn ===== */

export async function webauthnRegistrationBegin(
  ctx: AuthContext,
  userId: string,
  userEmail: string,
) {
  const options = await generateRegistrationOptions({
    rpName: ctx.env.rp_name,
    rpID: ctx.env.rp_id,
    userName: userEmail,
    userID: new TextEncoder().encode(userId),
    timeout: 60_000,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Stash the challenge so we can verify it later.
  await ctx.tokens.create({
    id: `tok_wa_reg_${userId}`,
    purpose: "email_verify",
    user_id: userId,
    workspace_id: null,
    token_hash: sha256Hex(`wa_reg:${userId}:${options.challenge}`),
    payload: { challenge: options.challenge },
    created_at: ctx.now().toISOString(),
    expires_at: new Date(ctx.now().getTime() + 5 * 60 * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: null,
  });
  return options;
}

export async function webauthnRegistrationVerify(
  ctx: AuthContext,
  userId: string,
  challenge: string,
  attestation: Parameters<typeof verifyRegistrationResponse>[0]["response"],
  origin: string,
): Promise<void> {
  const stash = await ctx.tokens.findByHash(sha256Hex(`wa_reg:${userId}:${challenge}`), "email_verify");
  if (!stash) throw Errors.invalidToken();

  const verified = await verifyRegistrationResponse({
    response: attestation,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: ctx.env.rp_id,
  });
  if (!verified.verified || !verified.registrationInfo) throw Errors.mfaInvalid();

  const ri = verified.registrationInfo;
  // simplewebauthn v10 returns either flat fields or under `credential`; cover both.
  const credential = (ri as unknown as { credential?: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] } }).credential;
  const fallbackId = (ri as unknown as { credentialID?: string }).credentialID;
  const fallbackPk = (ri as unknown as { credentialPublicKey?: Uint8Array }).credentialPublicKey;
  const fallbackCounter = (ri as unknown as { counter?: number }).counter;

  const credentialId = credential?.id ?? fallbackId ?? "";
  const publicKey = credential?.publicKey ?? fallbackPk ?? new Uint8Array();
  const counter = credential?.counter ?? fallbackCounter ?? 0;
  const transports = credential?.transports ?? [];

  await ctx.mfa.upsert({
    user_id: userId,
    type: "webauthn",
    secret: credentialId,
    webauthn: {
      credential_public_key: Buffer.from(publicKey).toString("base64url"),
      counter,
      transports,
    },
    label: "Security key",
    backup_codes_hashes: [],
    enrolled_at: ctx.now().toISOString(),
    last_used_at: null,
  });
  await ctx.users.update(userId, { mfa_enrolled: true });
  await ctx.tokens.markConsumed(stash.id, ctx.now().toISOString());
  await emit("user_mfa_enrolled", { user_id: userId, factor: "webauthn" });
}

export async function webauthnAuthenticationBegin(ctx: AuthContext, userId: string) {
  const row = await ctx.mfa.get(userId, "webauthn");
  if (!row) throw Errors.mfaNotEnrolled();
  const options = await generateAuthenticationOptions({
    rpID: ctx.env.rp_id,
    timeout: 60_000,
    userVerification: "preferred",
    allowCredentials: [{ id: row.secret, transports: row.webauthn?.transports as never }],
  });
  await ctx.tokens.create({
    id: `tok_wa_auth_${userId}`,
    purpose: "email_verify",
    user_id: userId,
    workspace_id: null,
    token_hash: sha256Hex(`wa_auth:${userId}:${options.challenge}`),
    payload: { challenge: options.challenge },
    created_at: ctx.now().toISOString(),
    expires_at: new Date(ctx.now().getTime() + 5 * 60 * 1000).toISOString(),
    consumed_at: null,
    requester_ip_hash: null,
  });
  return options;
}

export async function webauthnAuthenticationVerify(
  ctx: AuthContext,
  userId: string,
  challenge: string,
  assertion: Parameters<typeof verifyAuthenticationResponse>[0]["response"],
  origin: string,
): Promise<boolean> {
  const row = await ctx.mfa.get(userId, "webauthn");
  if (!row || !row.webauthn) return false;
  const stash = await ctx.tokens.findByHash(sha256Hex(`wa_auth:${userId}:${challenge}`), "email_verify");
  if (!stash) return false;

  const credential = {
    id: row.secret,
    publicKey: Buffer.from(row.webauthn.credential_public_key, "base64url"),
    counter: row.webauthn.counter,
    transports: row.webauthn.transports as never,
  };
  const verified = await verifyAuthenticationResponse({
    response: assertion,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: ctx.env.rp_id,
    credential,
  });
  if (!verified.verified) return false;
  await ctx.mfa.updateWebauthnCounter(userId, row.secret, verified.authenticationInfo.newCounter);
  await ctx.tokens.markConsumed(stash.id, ctx.now().toISOString());
  return true;
}
