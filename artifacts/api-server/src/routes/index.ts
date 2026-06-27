import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import healthRouter from "./health";
import authRouter from "./auth";
import garmentsClassifyRouter from "./garments";   // Vision classify (stateless)
import garmentsDbRouter from "./garments-db";       // DB-backed CRUD
import weatherRouter from "./weather";
import vtoRouter from "./vto";
import outfitRouter from "./outfit";               // Suggestion engine (stateless)
import outfitSlotsRouter from "./outfit-slots";    // DB-backed slots CRUD
import profilesRouter from "./profiles";

const router: IRouter = Router();

// ── Public routes (no auth required) ─────────────────────────────────────────
// Health check — available without credentials for load balancer probes
router.use(healthRouter);

// Auth routes — forgot-password and reset-password are intentionally public
// (the user has no valid token at that point). sync-profile and
// complete-onboarding inside auth.ts apply requireAuth individually.
router.use(authRouter);

// Stateless compute routes — no user data involved
router.use(weatherRouter);
router.use(garmentsClassifyRouter);
router.use(outfitRouter);

// ── Protected routes — require a valid Supabase JWT ───────────────────────────
// Apply requireAuth once here so no DB-backed route can accidentally be left
// unauthenticated. New routes added to this block are protected by default.
router.use((req: Request, res: Response, next) => {
  // Routes already handled above are exempt; this catches everything below
  requireAuth(req, res, next);
});

router.use(garmentsDbRouter);
router.use(outfitSlotsRouter);
router.use(vtoRouter);
router.use(profilesRouter);

export default router;
