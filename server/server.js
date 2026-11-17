import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const { MONGODB_URI, JWT_SECRET, PORT = 5000 } = process.env;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

try {
  await mongoose.connect(MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
}
