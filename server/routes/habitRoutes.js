import { Router } from "express";
import {
  toggleHabitArchive,
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  updateHabit,
} from "../controllers/habitController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

router.route("/").get(listHabits).post(createHabit);
router.patch("/:id/archive", toggleHabitArchive);
router.route("/:id").get(getHabit).put(updateHabit).patch(updateHabit).delete(deleteHabit);

export default router;
