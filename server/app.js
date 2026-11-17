import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import habitRoutes from "./routes/habitRoutes.js";
import completionRoutes from "./routes/completionRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api", completionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.status ? err.message : "Internal server error",
  });
});

export default app;
