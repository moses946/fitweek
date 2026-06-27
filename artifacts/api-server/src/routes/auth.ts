import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, profiles } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { supabaseAdmin } from "../middlewares/requireAuth";

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  redirectTo: z.string().url().optional(),
});

const resetPasswordSchema = z.object({
  /** The access token supplied by Supabase in the reset email deep-link. */
  accessToken: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be under 72 characters."),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 *
 * Triggers a Supabase password-reset email. Routed through the API server so
 * we can rate-limit, audit, and avoid exposing the service-role key on the
 * client. The anon-key path also works, but going through the server lets us
 * add brute-force protection later.
 *
 * Public — no `requireAuth` middleware (user doesn't have a valid token).
 */
router.post("/auth/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request.",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, redirectTo } = parsed.data;

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo ?? process.env.RESET_PASSWORD_REDIRECT_URL,
  });

  if (error) {
    req.log.error({ err: error }, "POST /auth/forgot-password failed");
    // Return a generic success message even on error to prevent email
    // enumeration attacks (attacker cannot tell if an email exists).
  }

  // Always return 200 — the user sees "check your inbox" regardless
  res.json({
    message:
      "If an account with that email exists, a reset link has been sent.",
  });
});

/**
 * POST /api/auth/reset-password
 *
 * Completes a password reset using the short-lived access token from the
 * reset email. The new password is validated server-side before being sent
 * to Supabase, so the client receives a typed error instead of a raw
 * Supabase message.
 *
 * Public — the access token IS the credential here.
 */
router.post("/auth/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request.",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { accessToken, newPassword } = parsed.data;

  // Verify the reset token is valid before attempting the update
  const { data: userData, error: verifyError } =
    await supabaseAdmin.auth.getUser(accessToken);

  if (verifyError || !userData.user) {
    res
      .status(401)
      .json({ error: "Invalid or expired reset link. Please request a new one." });
    return;
  }

  const { error: updateError } =
    await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
      password: newPassword,
    });

  if (updateError) {
    req.log.error({ err: updateError }, "POST /auth/reset-password failed");
    res.status(500).json({ error: "Failed to update password. Please try again." });
    return;
  }

  res.json({ message: "Password updated successfully. You can now sign in." });
});

/**
 * POST /api/auth/sync-profile
 *
 * Called by the mobile client after every successful sign-in to ensure the
 * profiles row is up-to-date with the latest OAuth metadata (display name,
 * avatar URL). This replaces the client-side `syncGoogleProfile()` call that
 * wrote directly to the legacy `public.users` table.
 *
 * Requires: valid Bearer JWT.
 */
router.post("/auth/sync-profile", requireAuth, async (req, res) => {
  try {
    const { data: userData } = await supabaseAdmin.auth.getUser(
      req.headers.authorization!.slice("Bearer ".length),
    );
    const user = userData?.user;
    const meta = user?.user_metadata ?? {};

    await db
      .insert(profiles)
      .values({
        id: req.userId,
        email: user?.email ?? undefined,
        displayName:
          (meta["full_name"] as string) ??
          (meta["name"] as string) ??
          undefined,
        avatarUrl:
          (meta["avatar_url"] as string) ??
          (meta["picture"] as string) ??
          undefined,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: user?.email ?? undefined,
          displayName:
            (meta["full_name"] as string) ??
            (meta["name"] as string) ??
            undefined,
          avatarUrl:
            (meta["avatar_url"] as string) ??
            (meta["picture"] as string) ??
            undefined,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "POST /auth/sync-profile failed");
    res.status(500).json({ error: "Profile sync failed." });
  }
});

/**
 * POST /api/auth/complete-onboarding
 *
 * Sets `onboarding_completed_at` on the profiles row.
 * This is the authoritative onboarding flag — the mobile app no longer uses
 * AsyncStorage for this. If `modelPhotoPath` is provided the storage path is
 * persisted so the API server can generate signed URLs for the VTO pipeline.
 *
 * Requires: valid Bearer JWT.
 */
router.post("/auth/complete-onboarding", requireAuth, async (req, res) => {
  const schema = z.object({
    modelPhotoPath: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request.", details: parsed.error.flatten() });
    return;
  }

  try {
    const [updated] = await db
      .update(profiles)
      .set({
        onboardingCompletedAt: new Date(),
        ...(parsed.data.modelPhotoPath
          ? { modelPhotoUrl: parsed.data.modelPhotoPath }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, req.userId))
      .returning();

    res.json(updated ?? { id: req.userId });
  } catch (err) {
    req.log.error({ err }, "POST /auth/complete-onboarding failed");
    res.status(500).json({ error: "Failed to complete onboarding." });
  }
});

/**
 * POST /api/auth/model-photo-url
 *
 * Returns a short-lived signed URL for the authenticated user's model photo.
 * The storage bucket is private — clients must always request a signed URL
 * from this endpoint rather than constructing the URL themselves.
 *
 * Requires: valid Bearer JWT.
 */
router.get("/auth/model-photo-url", requireAuth, async (req, res) => {
  try {
    const [profile] = await db
      .select({ modelPhotoUrl: profiles.modelPhotoUrl })
      .from(profiles)
      .where(eq(profiles.id, req.userId));

    if (!profile?.modelPhotoUrl) {
      res.json({ signedUrl: null });
      return;
    }

    const { data, error } = await supabaseAdmin.storage
      .from("user-models")
      .createSignedUrl(profile.modelPhotoUrl, 3600); // 1-hour expiry

    if (error || !data?.signedUrl) {
      req.log.error({ err: error }, "Failed to create signed URL");
      res.status(500).json({ error: "Could not generate photo URL." });
      return;
    }

    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    req.log.error({ err }, "GET /auth/model-photo-url failed");
    res.status(500).json({ error: "Internal error." });
  }
});

export default router;
