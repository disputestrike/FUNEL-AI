/**
 * Tiny helper to mint MFA challenge tokens from non-`login.ts` flows
 * (e.g. magic-link) without creating a circular import.
 */

import { SignJWT } from "jose";
import { newId } from "./ids.js";
import type { AuthContext } from "./ports.js";

const TTL_SEC = 5 * 60;

export default async function mintMfaChallenge(ctx: AuthContext, userId: string): Promise<string> {
  const iat = Math.floor(ctx.now().getTime() / 1000);
  const exp = iat + TTL_SEC;
  return await new SignJWT({ sub: userId, typ: "mfa_challenge" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ctx.env.jwt_issuer)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setJti(newId("tok"))
    .sign(new TextEncoder().encode(ctx.env.jwt_secret));
}
