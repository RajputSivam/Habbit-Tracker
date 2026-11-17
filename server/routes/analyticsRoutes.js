import { Router } from "express";
import {
  getHabitPerformance,
  getHeatmap,
  getMonthlyCounts,
  getWeeklyGrid,
  getWeekOverWeek,
} from "../controllers/analyticsController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);
router.get("/heatmap", getHeatmap);
router.get("/weekly-grid", getWeeklyGrid);
router.get("/week-over-week", getWeekOverWeek);
router.get("/monthly", getMonthlyCounts);
router.get("/habit-performance", getHabitPerformance);

export default router;
