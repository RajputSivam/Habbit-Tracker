import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;
  const [scheme, token] = authorization?.split(" ") || [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof payload !== "object" || typeof payload.userId !== "string") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = { id: payload.userId };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
