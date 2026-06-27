import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.",
  );
}

/**
 * Server-side Supabase admin client — used only for JWT verification and
 * signed URL generation. Never exposed to the client.
 * Uses the service role key which bypasses RLS.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

declare global {
  namespace Express {
    interface Request {
      /** Verified Supabase user ID extracted from the Bearer JWT. */
      userId: string;
      /** Full decoded JWT payload — available for role checks. */
      jwtPayload: Record<string, unknown>;
    }
  }
}

/**
 * decodeJwtPayload — lightweight base-64 decode of the JWT claims section.
 *
 * Used for a fast local expiry pre-check BEFORE sending a network request to
 * Supabase's auth endpoint. If the token is obviously expired we fail fast
 * without consuming a Supabase API call or adding latency.
 *
 * This does NOT verify the signature — that is still done by supabaseAdmin.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Pad to a valid base-64 string
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * requireAuth — Express middleware that validates the Supabase Bearer JWT.
 *
 * Flow:
 *  1. Extract `Authorization: Bearer <token>` header.
 *  2. Locally decode the JWT payload to check the `exp` claim — fast fail
 *     for obviously expired tokens without a Supabase round-trip.
 *  3. Verify with supabaseAdmin.auth.getUser() — this validates the signature
 *     and checks server-side revocation.
 *  4. Attach `req.userId` and `req.jwtPayload` for downstream handlers.
 *
 * Responds with 401 if the token is missing, malformed, locally expired,
 * or fails Supabase verification.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  // Fast local expiry pre-check (no network call)
  const payload = decodeJwtPayload(token);
  if (!payload) {
    res.status(401).json({ error: "Malformed token." });
    return;
  }

  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp > 0 && Date.now() / 1000 > exp) {
    res.status(401).json({ error: "Token has expired." });
    return;
  }

  // Full server-side verification via Supabase (validates signature + revocation)
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  req.userId = data.user.id;
  req.jwtPayload = payload;
  next();
}
