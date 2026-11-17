import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const SALT_ROUNDS = 12;

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES
  );
}

function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80 ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      !isValidPassword(password)
    ) {
      return res.status(400).json({
        message:
          "Provide a name (up to 80 characters), a valid email, and a password of 8 or more characters (maximum 72 UTF-8 bytes).",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      !password.length ||
      Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES
    ) {
      return res.status(400).json({ message: "Provide a valid email and password" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.json({
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentUser(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}
