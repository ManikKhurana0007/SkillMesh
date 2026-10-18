import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();
const availabilityInput = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    slot: z.enum(["AM", "PM", "EVENING"]),
  })).max(21),
});

router.use(requireAuth);

async function ensureProfile(userId, tx = prisma) {
  return tx.studentProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function getProfilePayload(userId) {
  const profile = await ensureProfile(userId);
  const [user, fullProfile, activities, quizAttempts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        skills: { include: { skill: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        availability: { orderBy: [{ dayOfWeek: "asc" }, { slot: "asc" }] },
        evidence: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.learningActivity.findMany({
      where: { profileId: profile.id, loggedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { id: true, category: true, minutes: true, loggedAt: true },
      orderBy: { loggedAt: "desc" },
    }),
    prisma.quizAttempt.findMany({
      where: { profileId: profile.id, submittedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
      select: { score: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  return {
    user,
    profile: {
      education: fullProfile.degree || "",
      careerGoal: fullProfile.careerGoal || "",
      interests: fullProfile.interests,
      preferredRoles: fullProfile.preferredRoles,
      github: fullProfile.githubStats,
      skills: fullProfile.skills.map(({ id, proficiency, evidenceUrl, skill }) => ({
        id,
        name: skill.name,
        level: proficiency[0] + proficiency.slice(1).toLowerCase(),
        evidence: evidenceUrl || "",
        verified: Boolean(evidenceUrl),
      })),
      availability: fullProfile.availability.map(({ dayOfWeek, slot }) => ({ dayOfWeek, slot })),
      evidence: fullProfile.evidence,
      activity: activities,
      stats: {
        recentActivityDays: new Set(activities
          .filter(({ category }) => category !== "Platform login")
          .map(({ loggedAt }) => loggedAt.toISOString().slice(0, 10))).size,
        recentActivityMinutes: activities.reduce((total, activity) => total + activity.minutes, 0),
        quizScore: quizAttempts.length
          ? Math.round(quizAttempts.reduce((total, attempt) => total + attempt.score, 0) / quizAttempts.length)
          : null,
        quizAttempts: quizAttempts.length,
      },
    },
  };
}

router.get("/", async (req, res) => {
  try {
    return res.json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Profile loading failed:", error.message);
    return res.status(500).json({
      error: { code: "PROFILE_UNAVAILABLE", message: "Could not load your profile." },
    });
  }
});

router.patch("/about", async (req, res) => {
  const parsed = z.object({
    education: z.string().trim().max(160),
    careerGoal: z.string().trim().max(500),
    interests: z.array(z.string().trim().min(1).max(80)).max(20),
    preferredRoles: z.array(z.string().trim().min(1).max(80)).max(20),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "INVALID_PROFILE", message: "Check the profile fields and try again." },
    });
  }

  try {
    await prisma.studentProfile.upsert({
      where: { userId: req.user.id },
      update: {
        degree: parsed.data.education,
        careerGoal: parsed.data.careerGoal,
        interests: parsed.data.interests,
        preferredRoles: parsed.data.preferredRoles,
      },
      create: {
        userId: req.user.id,
        degree: parsed.data.education,
        careerGoal: parsed.data.careerGoal,
        interests: parsed.data.interests,
        preferredRoles: parsed.data.preferredRoles,
      },
    });
    return res.json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Profile update failed:", error.message);
    return res.status(500).json({
      error: { code: "PROFILE_UPDATE_FAILED", message: "Could not save your profile." },
    });
  }
});

router.patch("/github", async (req, res) => {
  const parsed = z.object({
    github: z.object({
      username: z.string().min(1).max(39),
      repos: z.number().int().nonnegative(),
      stars: z.number().int().nonnegative(),
      commits: z.number().int().nonnegative(),
      languages: z.number().int().nonnegative(),
      topLanguages: z.array(z.string().max(80)).max(100),
      followers: z.number().int().nonnegative().optional(),
      following: z.number().int().nonnegative().optional(),
      avatarUrl: z.string().max(1000).optional(),
      bio: z.string().max(1000).optional(),
      publicProfileUrl: z.string().url().max(1000),
      verified: z.boolean(),
      lastSynced: z.string().max(100),
      source: z.string().max(100),
    }).nullable(),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "INVALID_GITHUB_STATS", message: "GitHub stats are incomplete or invalid." },
    });
  }

  try {
    await prisma.studentProfile.upsert({
      where: { userId: req.user.id },
      update: { githubStats: parsed.data.github },
      create: { userId: req.user.id, githubStats: parsed.data.github },
    });
    return res.json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("GitHub stats persistence failed:", error.message);
    return res.status(500).json({
      error: { code: "GITHUB_STATS_SAVE_FAILED", message: "Could not save GitHub stats." },
    });
  }
});

router.put("/availability", async (req, res) => {
  const parsed = availabilityInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "INVALID_AVAILABILITY", message: "Availability must contain valid days and time slots." },
    });
  }

  const uniqueSlots = [...new Map(parsed.data.slots.map((slot) => [`${slot.dayOfWeek}:${slot.slot}`, slot])).values()];
  try {
    await prisma.$transaction(async (tx) => {
      const profile = await ensureProfile(req.user.id, tx);
      await tx.weeklyAvailability.deleteMany({ where: { profileId: profile.id } });
      if (uniqueSlots.length) {
        await tx.weeklyAvailability.createMany({
          data: uniqueSlots.map(({ dayOfWeek, slot }) => ({ profileId: profile.id, dayOfWeek, slot })),
        });
      }
    });
    return res.json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Weekly availability save failed:", error.message);
    return res.status(500).json({
      error: { code: "AVAILABILITY_SAVE_FAILED", message: "Could not save weekly availability." },
    });
  }
});

router.post("/skills", async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(1).max(100),
    level: z.enum(["Beginner", "Intermediate", "Advanced"]),
    evidence: z.string().trim().max(2000).optional().default(""),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "INVALID_SKILL", message: "Provide a skill name and valid proficiency." },
    });
  }
  try {
    const profile = await ensureProfile(req.user.id);
    const skill = await prisma.skill.upsert({
      where: { name: parsed.data.name },
      update: {},
      create: { name: parsed.data.name },
    });
    await prisma.userSkill.upsert({
      where: { profileId_skillId: { profileId: profile.id, skillId: skill.id } },
      update: { proficiency: parsed.data.level.toUpperCase(), evidenceUrl: parsed.data.evidence || null },
      create: {
        profileId: profile.id,
        skillId: skill.id,
        proficiency: parsed.data.level.toUpperCase(),
        evidenceUrl: parsed.data.evidence || null,
      },
    });
    return res.status(200).json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Profile skill save failed:", error.message);
    return res.status(500).json({
      error: { code: "SKILL_SAVE_FAILED", message: "Could not save this skill." },
    });
  }
});

router.delete("/skills/:skillId", async (req, res) => {
  try {
    const deleted = await prisma.userSkill.deleteMany({
      where: { id: req.params.skillId, profile: { userId: req.user.id } },
    });
    if (deleted.count === 0) {
      return res.status(404).json({
        error: { code: "SKILL_NOT_FOUND", message: "Skill not found on your profile." },
      });
    }
    return res.json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Profile skill removal failed:", error.message);
    return res.status(500).json({
      error: { code: "SKILL_REMOVE_FAILED", message: "Could not remove this skill." },
    });
  }
});

router.post("/evidence", async (req, res) => {
  const parsed = z.object({
    title: z.string().trim().min(1).max(160),
    url: z.string().trim().url().max(2000),
    kind: z.enum(["PROJECT", "CERTIFICATE", "PORTFOLIO", "OTHER"]).default("PROJECT"),
  }).safeParse(req.body);
  if (!parsed.success || !["http:", "https:"].includes(new URL(parsed.data?.url || "https://invalid").protocol)) {
    return res.status(400).json({
      error: { code: "INVALID_EVIDENCE", message: "Provide a title and a valid http/https evidence link." },
    });
  }
  try {
    const profile = await ensureProfile(req.user.id);
    await prisma.profileEvidence.create({ data: { profileId: profile.id, ...parsed.data } });
    return res.status(201).json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Profile evidence creation failed:", error.message);
    return res.status(500).json({
      error: { code: "EVIDENCE_CREATE_FAILED", message: "Could not save profile evidence." },
    });
  }
});

router.delete("/evidence/:evidenceId", async (req, res) => {
  try {
    const deleted = await prisma.profileEvidence.deleteMany({
      where: { id: req.params.evidenceId, profile: { userId: req.user.id } },
    });
    if (deleted.count === 0) {
      return res.status(404).json({
        error: { code: "EVIDENCE_NOT_FOUND", message: "Evidence not found on your profile." },
      });
    }
    return res.json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Profile evidence removal failed:", error.message);
    return res.status(500).json({
      error: { code: "EVIDENCE_REMOVE_FAILED", message: "Could not remove profile evidence." },
    });
  }
});

router.post("/activities", async (req, res) => {
  const parsed = z.object({
    category: z.string().trim().min(1).max(80),
    minutes: z.number().int().min(1).max(1440),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "INVALID_ACTIVITY", message: "Activity must have a category and 1 to 1440 minutes." },
    });
  }
  try {
    const profile = await ensureProfile(req.user.id);
    await prisma.learningActivity.create({ data: { profileId: profile.id, ...parsed.data } });
    return res.status(201).json(await getProfilePayload(req.user.id));
  } catch (error) {
    console.error("Learning activity log failed:", error.message);
    return res.status(500).json({
      error: { code: "ACTIVITY_LOG_FAILED", message: "Could not log learning activity." },
    });
  }
});

export default router;
