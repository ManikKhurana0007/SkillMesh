import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./lib/prisma.js";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import githubRoutes from "./routes/githubRoutes.js";
import challengeRoutes from "./routes/challengeRoutes.js";
import teamForgeRoutes from "./routes/teamForgeRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import plannerRoutes from "./routes/plannerRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

const app = express();

// Security middleware
app.use(helmet());

// Allow requests from your React frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Parse JSON request bodies
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/teamforge", teamForgeRoutes);

// Basic API route
app.get("/", (req, res) => {
  res.json({
    message: "SkillMesh API is running",
  });
});

// Check backend and database connection
app.get("/api/health", async (req, res) => {
  try {
    const userCount = await prisma.user.count();

    res.status(200).json({
      status: "ok",
      database: "connected",
      userCount,
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

export default app;