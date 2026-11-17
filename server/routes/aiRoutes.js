import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  chatAboutHabits,
  getMorningMotivation,
  getStreakRecoveryPlan,
  getWeeklyReport,
  suggestHabitIdeas,
  suggestHabits,
} from "../controllers/aiController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  handler: (_req, res) => {
    res.status(429).json({ message: "AI request limit reached. Try again in 15 minutes." });
  },
});

const suggestionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  handler: (_req, res) => {
    res.status(429).json({
      message: "AI suggestion limit reached. Try again in about 1 hour.",
      retryAfterSeconds: 3600,
    });
  },
});

router.use(authMiddleware, aiRateLimiter);
router.get("/weekly-report", getWeeklyReport);
router.post("/suggestions", suggestHabits);
router.post("/suggest-habits", suggestionRateLimiter, suggestHabitIdeas);
router.post("/streak-recovery", getStreakRecoveryPlan);
router.post("/analysis-chat", chatAboutHabits);
router.post("/morning-motivation", getMorningMotivation);

export default router;
