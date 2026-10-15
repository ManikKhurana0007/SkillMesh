import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Please sign in to continue.",
        },
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing.");
      return res.status(500).json({
        error: {
          code: "SERVER_CONFIG_ERROR",
          message: "Authentication is not configured.",
        },
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string"
    ) {
      return res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid session. Please sign in again.",
        },
      });
    }

    // Read the user's current role from PostgreSQL.
    // Never trust a role sent by the frontend.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "This account no longer exists.",
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        error: {
          code: "INVALID_SESSION",
          message: "Your session is invalid or expired. Please sign in again.",
        },
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      error: {
        code: "AUTHENTICATION_ERROR",
        message: "Could not verify your session.",
      },
    });
  }
}

export function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Please sign in to continue.",
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this resource.",
        },
      });
    }

    next();
  };
}