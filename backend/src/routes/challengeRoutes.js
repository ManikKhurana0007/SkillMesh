import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { allowRoles, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

const challengeInclude = {
  organizer: { select: { id: true, name: true } },
  requiredSkills: { include: { skill: { select: { id: true, name: true } } } },
  _count: { select: { memberships: true } },
};

function parseChallengeInput(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const deadline = typeof body.deadline === "string" ? new Date(body.deadline) : null;
  const teamSize = Number(body.teamSize);
  const skills = Array.isArray(body.requiredSkills)
    ? [...new Set(body.requiredSkills.filter((skill) => typeof skill === "string").map((skill) => skill.trim()).filter(Boolean))]
    : [];

  if (!title || !description || !deadline || Number.isNaN(deadline.getTime())) {
    return { error: "Title, description, and a valid deadline are required." };
  }
  if (deadline <= new Date()) {
    return { error: "The deadline must be in the future." };
  }
  if (!Number.isInteger(teamSize) || teamSize < 2 || teamSize > 20) {
    return { error: "Team size must be an integer between 2 and 20." };
  }
  if (skills.length === 0) {
    return { error: "At least one required skill is required." };
  }

  return { data: { title, description, deadline, teamSize, skills } };
}

function serializeChallenge(challenge) {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    deadline: challenge.deadline,
    teamSize: challenge.teamSize,
    status: challenge.status,
    organizer: challenge.organizer,
    requiredSkills: challenge.requiredSkills.map(({ skill }) => skill),
    participantCount: challenge._count?.memberships ?? 0,
  };
}

async function replaceRequiredSkills(tx, challengeId, skills) {
  const skillRecords = await Promise.all(
    skills.map((name) =>
      tx.skill.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  await tx.challengeSkill.deleteMany({ where: { challengeId } });
  await tx.challengeSkill.createMany({
    data: skillRecords.map((skill) => ({ challengeId, skillId: skill.id })),
  });
}

router.use(requireAuth);

router.get("/", allowRoles("STUDENT"), async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const skill = typeof req.query.skill === "string" ? req.query.skill.trim() : "";

  try {
    const challenges = await prisma.challenge.findMany({
      where: {
        status: "PUBLISHED",
        deadline: { gt: new Date() },
        ...(search
          ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }
          : {}),
        ...(skill
          ? { requiredSkills: { some: { skill: { name: { contains: skill, mode: "insensitive" } } } } }
          : {}),
      },
      include: {
        ...challengeInclude,
        memberships: { where: { userId: req.user.id }, select: { id: true } },
      },
      orderBy: { deadline: "asc" },
    });

    return res.json({
      challenges: challenges.map((challenge) => ({
        ...serializeChallenge(challenge),
        joined: challenge.memberships.length > 0,
      })),
    });
  } catch (error) {
    console.error("Published challenge listing failed:", error.message);
    return res.status(500).json({ error: { code: "CHALLENGES_UNAVAILABLE", message: "Could not load published challenges." } });
  }
});

router.get("/mine", allowRoles("ORGANIZER"), async (req, res) => {
  try {
    const challenges = await prisma.challenge.findMany({
      where: { organizerId: req.user.id },
      include: challengeInclude,
      orderBy: { createdAt: "desc" },
    });
    return res.json({ challenges: challenges.map(serializeChallenge) });
  } catch (error) {
    console.error("Organizer challenge listing failed:", error.message);
    return res.status(500).json({ error: { code: "CHALLENGES_UNAVAILABLE", message: "Could not load your challenges." } });
  }
});

router.post("/", allowRoles("ORGANIZER"), async (req, res) => {
  const parsed = parseChallengeInput(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: { code: "INVALID_CHALLENGE", message: parsed.error } });
  }

  try {
    const challenge = await prisma.$transaction(async (tx) => {
      const created = await tx.challenge.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          deadline: parsed.data.deadline,
          teamSize: parsed.data.teamSize,
          organizerId: req.user.id,
        },
      });
      await replaceRequiredSkills(tx, created.id, parsed.data.skills);
      return tx.challenge.findUnique({ where: { id: created.id }, include: challengeInclude });
    });
    return res.status(201).json({ challenge: serializeChallenge(challenge) });
  } catch (error) {
    console.error("Challenge creation failed:", error.message);
    return res.status(500).json({ error: { code: "CHALLENGE_CREATE_FAILED", message: "Could not create the challenge." } });
  }
});

router.post("/:id/join", allowRoles("STUDENT"), async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findFirst({
        where: { id: req.params.id, status: "PUBLISHED", deadline: { gt: new Date() } },
        select: { id: true, teamSize: true },
      });
      if (!challenge) {
        return { status: 404, body: { error: { code: "CHALLENGE_NOT_FOUND", message: "Published challenge not found." } } };
      }

      const existing = await tx.challengeMember.findUnique({
        where: { challengeId_userId: { challengeId: challenge.id, userId: req.user.id } },
        select: { id: true },
      });
      if (existing) {
        return { status: 409, body: { error: { code: "ALREADY_JOINED", message: "You have already joined this challenge." } } };
      }

      const memberCount = await tx.challengeMember.count({ where: { challengeId: challenge.id } });
      if (memberCount >= challenge.teamSize) {
        return { status: 409, body: { error: { code: "CHALLENGE_FULL", message: "This challenge has reached its participant limit." } } };
      }

      const member = await tx.challengeMember.create({
        data: { challengeId: challenge.id, userId: req.user.id },
        select: { id: true, joinedAt: true },
      });
      return { status: 201, body: { membership: member } };
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Challenge join failed:", error.message);
    return res.status(500).json({ error: { code: "CHALLENGE_JOIN_FAILED", message: "Could not join the challenge." } });
  }
});

router.get("/:id/teammates", allowRoles("STUDENT"), async (req, res) => {
  try {
    const challenge = await prisma.challenge.findFirst({
      where: {
        id: req.params.id,
        status: "PUBLISHED",
        deadline: { gt: new Date() },
        memberships: { some: { userId: req.user.id } },
      },
      include: {
        requiredSkills: { include: { skill: { select: { id: true, name: true } } } },
        memberships: {
          where: { userId: { not: req.user.id } },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profile: {
                  include: {
                    skills: {
                      include: { skill: { select: { id: true, name: true } } },
                    },
                  },
                },
              },
            },
            constraint: true,
          },
        },
        teamMembers: { select: { userId: true } },
      },
    });

    if (!challenge) {
      return res.status(403).json({
        error: {
          code: "CHALLENGE_MEMBERSHIP_REQUIRED",
          message: "Join this published challenge before finding teammates.",
        },
      });
    }

    const assignedUserIds = new Set(challenge.teamMembers.map(({ userId }) => userId));
    const candidates = challenge.memberships
      .filter(({ user }) => !assignedUserIds.has(user.id))
      .map(({ user, constraint }) => ({
        id: user.id,
        name: user.name,
        headline: user.profile?.headline || "",
        bio: user.profile?.bio || "",
        available: constraint?.available !== false,
        weeklyCapacity: constraint?.weeklyCapacity || 0,
        skills: user.profile?.skills.map(({ skill, proficiency, evidenceUrl }) => ({
          id: skill.id,
          name: skill.name,
          proficiency,
          evidenceUrl,
        })) || [],
      }));

    return res.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        teamSize: challenge.teamSize,
        deadline: challenge.deadline,
        requiredSkills: challenge.requiredSkills.map(({ skill, weight }) => ({ ...skill, weight })),
      },
      candidates,
    });
  } catch (error) {
    console.error("Teammate listing failed:", error.message);
    return res.status(500).json({
      error: {
        code: "TEAMMATES_UNAVAILABLE",
        message: "Could not load teammates for this challenge.",
      },
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const challenge = await prisma.challenge.findFirst({
      where: {
        id: req.params.id,
        OR: [{ status: "PUBLISHED" }, { organizerId: req.user.id }],
      },
      include: challengeInclude,
    });
    if (!challenge) {
      return res.status(404).json({ error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." } });
    }
    return res.json({ challenge: serializeChallenge(challenge) });
  } catch (error) {
    console.error("Challenge lookup failed:", error.message);
    return res.status(500).json({ error: { code: "CHALLENGE_LOOKUP_FAILED", message: "Could not load the challenge." } });
  }
});

router.patch("/:id", allowRoles("ORGANIZER"), async (req, res) => {
  const parsed = parseChallengeInput(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: { code: "INVALID_CHALLENGE", message: parsed.error } });
  }

  try {
    const existing = await prisma.challenge.findFirst({
      where: { id: req.params.id, organizerId: req.user.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return res.status(404).json({ error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." } });
    }
    if (existing.status === "CLOSED") {
      return res.status(409).json({ error: { code: "CHALLENGE_CLOSED", message: "Closed challenges cannot be edited." } });
    }

    const challenge = await prisma.$transaction(async (tx) => {
      await tx.challenge.update({
        where: { id: existing.id },
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          deadline: parsed.data.deadline,
          teamSize: parsed.data.teamSize,
        },
      });
      await replaceRequiredSkills(tx, existing.id, parsed.data.skills);
      return tx.challenge.findUnique({ where: { id: existing.id }, include: challengeInclude });
    });
    return res.json({ challenge: serializeChallenge(challenge) });
  } catch (error) {
    console.error("Challenge update failed:", error.message);
    return res.status(500).json({ error: { code: "CHALLENGE_UPDATE_FAILED", message: "Could not update the challenge." } });
  }
});

router.post("/:id/publish", allowRoles("ORGANIZER"), async (req, res) => {
  try {
    const challenge = await prisma.challenge.findFirst({
      where: { id: req.params.id, organizerId: req.user.id },
      include: { requiredSkills: true },
    });
    if (!challenge) {
      return res.status(404).json({ error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." } });
    }
    if (challenge.deadline <= new Date() || challenge.requiredSkills.length === 0) {
      return res.status(400).json({ error: { code: "CHALLENGE_NOT_READY", message: "A future deadline and at least one required skill are needed before publishing." } });
    }
    const published = await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: "PUBLISHED" },
      include: challengeInclude,
    });
    return res.json({ challenge: serializeChallenge(published) });
  } catch (error) {
    console.error("Challenge publication failed:", error.message);
    return res.status(500).json({ error: { code: "CHALLENGE_PUBLISH_FAILED", message: "Could not publish the challenge." } });
  }
});

router.get("/:id/participants", allowRoles("ORGANIZER"), async (req, res) => {
  try {
    const challenge = await prisma.challenge.findFirst({
      where: { id: req.params.id, organizerId: req.user.id },
      select: { id: true },
    });
    if (!challenge) {
      return res.status(404).json({ error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." } });
    }
    const members = await prisma.challengeMember.findMany({
      where: { challengeId: challenge.id },
      select: {
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            profile: {
              select: {
                headline: true,
                university: true,
                skills: { select: { proficiency: true, skill: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    return res.json({ participants: members });
  } catch (error) {
    console.error("Challenge participants lookup failed:", error.message);
    return res.status(500).json({ error: { code: "PARTICIPANTS_UNAVAILABLE", message: "Could not load participants." } });
  }
});

export default router;
