import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { allowRoles, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();
const teamChatUploadDirectory = fileURLToPath(new URL("../../uploads/team-chat/", import.meta.url));
const allowedChatFiles = {
  ".pdf": { mimeType: "application/pdf", matches: (buffer) => buffer.subarray(0, 5).toString() === "%PDF-" },
  ".doc": { mimeType: "application/msword", matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) },
  ".docx": { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", matches: (buffer) => buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  ".txt": { mimeType: "text/plain", matches: (buffer) => { try { return !buffer.includes(0) && Boolean(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); } catch { return false; } } },
  ".png": { mimeType: "image/png", matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  ".jpg": { mimeType: "image/jpeg", matches: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  ".jpeg": { mimeType: "image/jpeg", matches: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  ".gif": { mimeType: "image/gif", matches: (buffer) => ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString()) },
  ".webp": { mimeType: "image/webp", matches: (buffer) => buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" },
};
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 2000 },
  fileFilter: (req, file, callback) => {
    const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    const allowed = allowedChatFiles[extension];
    if (!allowed || file.mimetype !== allowed.mimeType) {
      callback(new Error("Attach a PDF, DOC, DOCX, TXT, PNG, JPG, GIF, or WEBP file."));
      return;
    }
    callback(null, true);
  },
});

function parseChatUpload(req, res, next) {
  chatUpload.single("file")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? "CHAT_FILE_TOO_LARGE" : "INVALID_CHAT_FILE",
        message: tooLarge ? "Attachments must be 10 MB or smaller." : error.message,
      },
    });
  });
}

function serializeChatMessage(message) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    sender: message.sender,
    attachments: (message.attachments || []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      downloadUrl: `/challenges/teams/${encodeURIComponent(message.teamId)}/attachments/${encodeURIComponent(attachment.id)}`,
    })),
  };
}

const challengeInclude = {
  organizer: { select: { id: true, name: true } },
  requiredSkills: { select: { skill: { select: { id: true, name: true } } } },
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
    createdAt: challenge.createdAt,
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
        select: { id: true },
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

router.get("/:id/participants", allowRoles("ORGANIZER"), async (req, res) => {
  try {
    const challenge = await prisma.challenge.findFirst({
      where: { id: req.params.id, organizerId: req.user.id },
      select: {
        id: true,
        title: true,
        memberships: {
          orderBy: { joinedAt: "asc" },
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
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
            status: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    if (!challenge) {
      return res.status(404).json({
        error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." },
      });
    }

    const teamByMemberId = new Map();
    challenge.teams.forEach((team) => {
      team.members.forEach(({ userId }) => teamByMemberId.set(userId, team));
    });

    return res.json({
      challenge: { id: challenge.id, title: challenge.title },
      participants: challenge.memberships.map(({ user, joinedAt, constraint }) => ({
        id: user.id,
        name: user.name,
        joinedAt,
        skills: user.profile?.skills.map(({ skill }) => skill) || [],
        team: teamByMemberId.has(user.id)
          ? (({ id, name, status }) => ({ id, name, status }))(teamByMemberId.get(user.id))
          : null,
        available: !teamByMemberId.has(user.id),
        weeklyCapacity: 0,
      })),
    });
  } catch (error) {
    console.error("Challenge participant listing failed:", error.message);
    return res.status(500).json({
      error: {
        code: "PARTICIPANTS_UNAVAILABLE",
        message: "Could not load challenge participants.",
      },
    });
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
        requiredSkills: { select: { skill: { select: { id: true, name: true } } } },
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
          },
        },
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

    const candidates = challenge.memberships.map(({ user, constraint }) => ({
        id: user.id,
        name: user.name,
        headline: user.profile?.headline || "",
        bio: user.profile?.bio || "",
        available: true,
        weeklyCapacity: 0,
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
        requiredSkills: challenge.requiredSkills.map(({ skill }) => skill),
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

const invitationInput = z.object({
  recipientId: z.string().min(1),
  message: z.string().trim().max(1000).optional(),
});

function serializeInvitation(invitation) {
  return {
    id: invitation.id,
    status: invitation.status,
    message: invitation.message,
    createdAt: invitation.createdAt,
    respondedAt: invitation.respondedAt,
    team: {
      id: invitation.team.id,
      name: invitation.team.name,
      status: invitation.team.status,
      challenge: {
        id: invitation.team.challenge.id,
        title: invitation.team.challenge.title,
      },
    },
    sender: invitation.sender,
    recipient: invitation.recipient,
  };
}

const invitationInclude = {
  team: {
    include: {
      challenge: { select: { id: true, title: true } },
    },
  },
  sender: { select: { id: true, name: true } },
  recipient: { select: { id: true, name: true } },
};

router.get("/invitations", allowRoles("STUDENT"), async (req, res) => {
  try {
    const [received, sent] = await Promise.all([
      prisma.teamInvitation.findMany({
        where: { recipientId: req.user.id },
        include: invitationInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.teamInvitation.findMany({
        where: { senderId: req.user.id },
        include: invitationInclude,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return res.json({
      received: received.map(serializeInvitation),
      sent: sent.map(serializeInvitation),
    });
  } catch (error) {
    console.error("Invitation listing failed:", error.message);
    return res.status(500).json({
      error: { code: "INVITATIONS_UNAVAILABLE", message: "Could not load invitations." },
    });
  }
});

router.get("/teams", allowRoles("STUDENT"), async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { members: { some: { userId: req.user.id } } },
      include: {
        challenge: { select: { id: true, title: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        status: team.status,
        leaderId: team.leaderId,
        challenge: team.challenge,
        members: team.members.map(({ user, joinedAt }) => ({ ...user, joinedAt })),
      })),
    });
  } catch (error) {
    console.error("Team listing failed:", error.message);
    return res.status(500).json({
      error: { code: "TEAMS_UNAVAILABLE", message: "Could not load your teams." },
    });
  }
});

router.get("/teams/:teamId/chat", allowRoles("STUDENT"), async (req, res) => {
  try {
    const team = await prisma.team.findFirst({
      where: {
        id: req.params.teamId,
        members: { some: { userId: req.user.id } },
      },
      include: {
        challenge: { select: { id: true, title: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        error: { code: "TEAM_NOT_FOUND", message: "Team not found." },
      });
    }
    if (team.members.length < 2) {
      return res.status(409).json({
        error: { code: "TEAM_CHAT_NOT_READY", message: "Team chat becomes available when an invitation is accepted." },
      });
    }

    const messages = await prisma.teamChatMessage.findMany({
      where: { teamId: team.id },
      include: {
        sender: { select: { id: true, name: true } },
        attachments: { select: { id: true, fileName: true, mimeType: true, size: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json({
      team: {
        id: team.id,
        name: team.name,
        status: team.status,
        leaderId: team.leaderId,
        challenge: team.challenge,
        members: team.members.map(({ user, joinedAt }) => ({ ...user, joinedAt })),
      },
      messages: messages.reverse().map(serializeChatMessage),
    });
  } catch (error) {
    console.error("Team chat loading failed:", error.message);
    return res.status(500).json({
      error: { code: "TEAM_CHAT_UNAVAILABLE", message: "Could not load team chat." },
    });
  }
});

router.post("/teams/:teamId/messages", allowRoles("STUDENT"), parseChatUpload, async (req, res) => {
  const parsed = z.object({ body: z.string().trim().max(2000).optional() }).safeParse(req.body);
  if (!parsed.success || (!parsed.data.body && !req.file)) {
    return res.status(400).json({
      error: {
        code: "INVALID_CHAT_MESSAGE",
        message: "Enter a message or attach a file. Messages can contain up to 2000 characters.",
      },
    });
  }

  let storedPath;
  try {
    const team = await prisma.team.findFirst({
      where: {
        id: req.params.teamId,
        members: { some: { userId: req.user.id } },
      },
      select: {
        id: true,
        members: { select: { userId: true } },
      },
    });
    if (!team) {
      return res.status(404).json({
        error: { code: "TEAM_NOT_FOUND", message: "Team not found." },
      });
    }
    if (team.members.length < 2) {
      return res.status(409).json({
        error: { code: "TEAM_CHAT_NOT_READY", message: "Team chat becomes available when an invitation is accepted." },
      });
    }

    let attachment;
    if (req.file) {
      const extension = req.file.originalname.slice(req.file.originalname.lastIndexOf(".")).toLowerCase();
      const fileType = allowedChatFiles[extension];
      if (!fileType.matches(req.file.buffer)) {
        return res.status(400).json({
          error: { code: "INVALID_CHAT_FILE", message: "The attachment contents do not match its file type." },
        });
      }

      const storageName = randomUUID();
      await mkdir(teamChatUploadDirectory, { recursive: true });
      storedPath = fileURLToPath(new URL(`../../uploads/team-chat/${storageName}`, import.meta.url));
      await writeFile(storedPath, req.file.buffer, { flag: "wx" });
      attachment = {
        fileName: req.file.originalname.replace(/[\r\n\0]/g, "").slice(0, 255),
        mimeType: fileType.mimeType,
        size: req.file.size,
        storageName,
      };
    }

    const message = await prisma.teamChatMessage.create({
      data: {
        teamId: team.id,
        senderId: req.user.id,
        body: parsed.data.body || "",
        ...(attachment ? { attachments: { create: attachment } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true } },
        attachments: { select: { id: true, fileName: true, mimeType: true, size: true } },
      },
    });
    return res.status(201).json({ message: serializeChatMessage(message) });
  } catch (error) {
    if (storedPath) {
      try {
        await unlink(storedPath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.error("Failed to remove orphaned team chat upload:", cleanupError.message);
        }
      }
    }
    console.error("Team chat message creation failed:", error.message);
    return res.status(500).json({
      error: { code: "TEAM_CHAT_SEND_FAILED", message: "Could not send your message." },
    });
  }
});

router.get("/teams/:teamId/attachments/:attachmentId", allowRoles("STUDENT"), async (req, res) => {
  try {
    const attachment = await prisma.teamChatAttachment.findFirst({
      where: {
        id: req.params.attachmentId,
        message: {
          teamId: req.params.teamId,
          team: { members: { some: { userId: req.user.id } } },
        },
      },
    });
    if (!attachment) {
      return res.status(404).json({
        error: { code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found." },
      });
    }

    const filePath = fileURLToPath(new URL(`../../uploads/team-chat/${attachment.storageName}`, import.meta.url));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(attachment.mimeType);
    if (req.query.inline === "1" && attachment.mimeType.startsWith("image/")) {
      res.setHeader("Content-Disposition", `inline; filename="${attachment.fileName.replace(/["\\\r\n]/g, "_")}"`);
      return res.sendFile(filePath);
    }
    return res.download(filePath, attachment.fileName);
  } catch (error) {
    console.error("Team chat attachment download failed:", error.message);
    return res.status(500).json({
      error: { code: "CHAT_ATTACHMENT_UNAVAILABLE", message: "Could not download this attachment." },
    });
  }
});

router.post("/:id/invitations", allowRoles("STUDENT"), async (req, res) => {
  const parsed = invitationInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "INVALID_INVITATION", message: parsed.error.issues[0].message },
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findFirst({
        where: {
          id: req.params.id,
          status: "PUBLISHED",
          deadline: { gt: new Date() },
          memberships: { some: { userId: req.user.id } },
        },
        select: { id: true, title: true, teamSize: true },
      });
      if (!challenge) {
        return {
          status: 403,
          body: {
            error: {
              code: "CHALLENGE_MEMBERSHIP_REQUIRED",
              message: "Join this challenge before sending invitations.",
            },
          },
        };
      }
      if (parsed.data.recipientId === req.user.id) {
        return {
          status: 400,
          body: { error: { code: "SELF_INVITATION", message: "You cannot invite yourself." } },
        };
      }

      const recipientMembership = await tx.challengeMember.findUnique({
        where: {
          challengeId_userId: {
            challengeId: challenge.id,
            userId: parsed.data.recipientId,
          },
        },
        select: { id: true },
      });
      if (!recipientMembership) {
        return {
          status: 400,
          body: {
            error: {
              code: "RECIPIENT_NOT_JOINED",
              message: "You can only invite students who joined this challenge.",
            },
          },
        };
      }

      const recipientTeam = await tx.teamMember.findFirst({
        where: {
          challengeId: challenge.id,
          userId: parsed.data.recipientId,
          team: { status: { in: ["FORMING", "SUBMITTED", "APPROVED"] } },
        },
        select: { id: true },
      });
      if (recipientTeam) {
        return {
          status: 409,
          body: {
            error: {
              code: "RECIPIENT_ALREADY_ASSIGNED",
              message: "This student is already assigned to a team.",
            },
          },
        };
      }

      let team = await tx.team.findFirst({
        where: {
          challengeId: challenge.id,
          leaderId: req.user.id,
          status: { in: ["FORMING", "SUBMITTED"] },
        },
        include: { members: true },
      });
      if (!team) {
        const existingMembership = await tx.teamMember.findFirst({
          where: {
            challengeId: challenge.id,
            userId: req.user.id,
            team: { status: { in: ["FORMING", "SUBMITTED", "APPROVED"] } },
          },
          include: { team: { include: { members: true } } },
        });
        if (existingMembership && existingMembership.team.leaderId !== req.user.id) {
          return {
            status: 403,
            body: {
              error: {
                code: "TEAM_LEADER_REQUIRED",
                message: "Only the team leader can send team invitations.",
              },
            },
          };
        }
        team = existingMembership?.team || null;
      }
      if (!team) {
        team = await tx.team.create({
          data: {
            challengeId: challenge.id,
            name: `${req.user.name}'s team`,
            leaderId: req.user.id,
            status: "FORMING",
            members: {
              create: {
                challengeId: challenge.id,
                userId: req.user.id,
              },
            },
          },
          include: { members: true },
        });
      }
      if (team.members.length >= challenge.teamSize) {
        return {
          status: 409,
          body: { error: { code: "TEAM_FULL", message: "Your team has reached its maximum size." } },
        };
      }

      const existingInvitation = await tx.teamInvitation.findUnique({
        where: {
          teamId_recipientId: {
            teamId: team.id,
            recipientId: parsed.data.recipientId,
          },
        },
        select: { id: true, status: true },
      });
      if (existingInvitation?.status === "PENDING") {
        return {
          status: 409,
          body: { error: { code: "INVITATION_EXISTS", message: "A pending invitation already exists." } },
        };
      }

      const invitation = existingInvitation
        ? await tx.teamInvitation.update({
          where: { id: existingInvitation.id },
          data: { senderId: req.user.id, message: parsed.data.message, status: "PENDING", respondedAt: null },
          include: invitationInclude,
        })
        : await tx.teamInvitation.create({
          data: {
            teamId: team.id,
            senderId: req.user.id,
            recipientId: parsed.data.recipientId,
            message: parsed.data.message,
          },
          include: invitationInclude,
        });
      return { status: 201, body: { invitation: serializeInvitation(invitation) } };
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Invitation creation failed:", error.message);
    return res.status(500).json({
      error: { code: "INVITATION_CREATE_FAILED", message: "Could not send the invitation." },
    });
  }
});

router.patch("/invitations/:invitationId", allowRoles("STUDENT"), async (req, res) => {
  const parsed = z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: "INVALID_INVITATION_STATUS", message: "Invitation status must be ACCEPTED or REJECTED." },
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.findUnique({
        where: { id: req.params.invitationId },
        include: {
          team: { include: { members: true } },
        },
      });
      if (!invitation || invitation.recipientId !== req.user.id) {
        return {
          status: 404,
          body: { error: { code: "INVITATION_NOT_FOUND", message: "Invitation not found." } },
        };
      }
      if (invitation.status !== "PENDING") {
        return {
          status: 409,
          body: { error: { code: "INVITATION_RESOLVED", message: "This invitation has already been resolved." } },
        };
      }
      if (parsed.data.status === "REJECTED") {
        const rejected = await tx.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: "REJECTED", respondedAt: new Date() },
          include: invitationInclude,
        });
        return { status: 200, body: { invitation: serializeInvitation(rejected) } };
      }

      const currentTeam = await tx.teamMember.findFirst({
        where: {
          challengeId: invitation.team.challengeId,
          userId: req.user.id,
          team: { status: { in: ["FORMING", "SUBMITTED", "APPROVED"] } },
        },
        select: { id: true },
      });
      if (currentTeam) {
        return {
          status: 409,
          body: { error: { code: "ALREADY_ASSIGNED", message: "You are already assigned to a team for this challenge." } },
        };
      }
      if (invitation.team.status === "APPROVED" || invitation.team.members.length >= (await tx.challenge.findUnique({ where: { id: invitation.team.challengeId }, select: { teamSize: true } })).teamSize) {
        return {
          status: 409,
          body: { error: { code: "TEAM_FULL", message: "This team cannot accept another member." } },
        };
      }

      await tx.teamMember.create({
        data: {
          teamId: invitation.teamId,
          challengeId: invitation.team.challengeId,
          userId: req.user.id,
        },
      });
      const accepted = await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
        include: invitationInclude,
      });
      return { status: 200, body: { invitation: serializeInvitation(accepted) } };
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Invitation response failed:", error.message);
    return res.status(500).json({
      error: { code: "INVITATION_RESPONSE_FAILED", message: "Could not update the invitation." },
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
