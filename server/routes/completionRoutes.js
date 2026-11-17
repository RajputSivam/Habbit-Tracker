import { Router } from "express";
import { toggleCheckIn } from "../controllers/completionController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.use(authMiddleware);
router.post("/habits/:habitId/check-in", toggleCheckIn);

export default router;
