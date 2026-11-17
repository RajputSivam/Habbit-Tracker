import { Router } from "express";
import { getCurrentUser, login, signup } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authMiddleware, getCurrentUser);

export default router;
