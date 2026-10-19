import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";

const router = Router();
const googleClient = new OAuth2Client();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function createToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from backend/.env");
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.toLowerCase(),
  };
}

async function recordStudentLogin(userId, tx = prisma) {
  const profile = await tx.studentProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
  await tx.learningActivity.create({
    data: { profileId: profile.id, category: "Platform login", minutes: 0 },
  });
}

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "student" } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length < 6
    ) {
      return res.status(400).json({
        message: "Name, valid email, and a password of at least 6 characters are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const roleMap = {
      student: "STUDENT",
      organizer: "ORGANIZER",
      mentor: "MENTOR",
    };

    if (!Object.hasOwn(roleMap, role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: roleMap[role],
        },
      });
      if (createdUser.role === "STUDENT") {
        await recordStudentLogin(createdUser.id, tx);
      }
      return createdUser;
    });

    const token = createToken(user.id);
    res.cookie("token", token, cookieOptions);

    return res.status(201).json({
      message: "Account created successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    return res.status(500).json({
      message: "Could not create account.",
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (user.role === "STUDENT") {
      await recordStudentLogin(user.id);
    }

    const token = createToken(user.id);
    res.cookie("token", token, cookieOptions);

    return res.json({
      message: "Login successful.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      message: "Could not sign in.",
    });
  }
});

router.post("/google", async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== "string" || !credential.trim()) {
    return res.status(400).json({ message: "A Google credential is required." });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ message: "Google sign-in is not configured yet." });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("Google credential verification failed:", error.message);
    return res.status(401).json({ message: "Google sign-in could not be verified." });
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    return res.status(401).json({ message: "Google did not provide a verified email address." });
  }

  try {
    const email = payload.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const name = payload.name?.trim() || email.split("@")[0];
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
      try {
        user = await prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: { name, email, passwordHash, role: "STUDENT" },
          });
          await recordStudentLogin(createdUser.id, tx);
          return createdUser;
        });
      } catch (error) {
        if (error.code !== "P2002") throw error;
        user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw error;
      }
    } else if (user.role === "STUDENT") {
      await recordStudentLogin(user.id);
    }

    const token = createToken(user.id);
    res.cookie("token", token, cookieOptions);
    return res.json({ message: "Google sign-in successful.", user: publicUser(user) });
  } catch (error) {
    console.error("Google account sign-in failed:", error.message);
    return res.status(500).json({ message: "Could not complete Google sign-in." });
  }
});

// Get the currently authenticated user
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    return res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return res.json({ message: "Logged out successfully." });
});

export default router;