import { Router } from "express";
import { z } from "zod";
import { builderScore } from "../../../src/lib/builderScore.js";
import { prisma } from "../lib/prisma.js";
import { allowRoles, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth);

const sessionInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  startsAt: z.string().datetime().refine(value => new Date(value) > new Date(), "Choose a future start time."),
  duration: z.number().int().min(15).max(180),
  capacity: z.number().int().min(1).max(50),
});

const projectInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(4000),
  skills: z.array(z.string().trim().min(1).max(80)).max(20),
});

const ideaInput = z.object({
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(20).max(3000),
  projectUrl: z.union([z.literal(""), z.string().url().max(1000)]).optional(),
});

function validationError(res, error, code) {
  return res.status(400).json({
    error: { code, message: error.issues[0]?.message || "Check the submitted fields and try again." },
  });
}

function sessionWithCounts(session) {
  const { _count, ...record } = session;
  return { ...record, bookedCount: _count?.bookings ?? 0 };
}

async function getMeetingAccess(sessionId, userId) {
  const session = await prisma.mentorshipSession.findUnique({
    where: { id: sessionId },
    include: {
      mentor: { select: { id: true, name: true } },
      bookings: {
        where: { status: "BOOKED" },
        include: { student: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session || session.status === "CANCELLED") return null;
  const isMentor = session.mentorId === userId;
  const booking = session.bookings.find(item => item.studentId === userId);
  if (!isMentor && !booking) return null;
  const startsAt = session.startsAt.getTime();
  const endsAt = startsAt + session.duration * 60 * 1000;
  const now = Date.now();
  return {
    session,
    isMentor,
    canJoin: now >= startsAt - 15 * 60 * 1000 && now <= endsAt + 30 * 60 * 1000,
    attendees: [session.mentor, ...session.bookings.map(item => item.student)],
  };
}

router.get("/sessions/:id/meeting", async (req, res) => {
  try {
    const access = await getMeetingAccess(req.params.id, req.user.id);
    if (!access) return res.status(404).json({ error: { code: "MEETING_NOT_FOUND", message: "This meeting is not available to your account." } });
    const notes = await prisma.meetingNote.findMany({
      where: { sessionId: access.session.id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const { session, ...meeting } = access;
    return res.json({
      meeting: {
        id: session.id,
        title: session.title,
        description: session.description,
        startsAt: session.startsAt,
        duration: session.duration,
        status: session.status,
        canJoin: meeting.canJoin && session.status === "OPEN",
        isMentor: meeting.isMentor,
        attendees: meeting.attendees,
        notes,
      },
    });
  } catch (error) {
    console.error("Mentor meeting loading failed:", error.message);
    return res.status(500).json({ error: { code: "MEETING_UNAVAILABLE", message: "Could not load this meeting." } });
  }
});

router.post("/sessions/:id/meeting/notes", async (req, res) => {
  const parsed = z.object({
    type: z.enum(["NOTE", "KEY_POINT"]),
    content: z.string().trim().min(1).max(2000),
  }).safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_MEETING_NOTE");
  try {
    const access = await getMeetingAccess(req.params.id, req.user.id);
    if (!access) return res.status(404).json({ error: { code: "MEETING_NOT_FOUND", message: "This meeting is not available to your account." } });
    const note = await prisma.meetingNote.create({
      data: { sessionId: access.session.id, authorId: req.user.id, ...parsed.data },
      include: { author: { select: { id: true, name: true } } },
    });
    return res.status(201).json({ note });
  } catch (error) {
    console.error("Meeting note creation failed:", error.message);
    return res.status(500).json({ error: { code: "MEETING_NOTE_CREATE_FAILED", message: "Could not save your meeting note." } });
  }
});

router.delete("/sessions/:sessionId/meeting/notes/:noteId", async (req, res) => {
  try {
    const access = await getMeetingAccess(req.params.sessionId, req.user.id);
    if (!access) return res.status(404).json({ error: { code: "MEETING_NOT_FOUND", message: "This meeting is not available to your account." } });
    const result = await prisma.meetingNote.deleteMany({
      where: {
        id: req.params.noteId,
        sessionId: access.session.id,
        OR: [{ authorId: req.user.id }, { session: { mentorId: req.user.id } }],
      },
    });
    if (!result.count) return res.status(404).json({ error: { code: "MEETING_NOTE_NOT_FOUND", message: "You cannot remove this note." } });
    return res.json({ deleted: true });
  } catch (error) {
    console.error("Meeting note deletion failed:", error.message);
    return res.status(500).json({ error: { code: "MEETING_NOTE_DELETE_FAILED", message: "Could not remove this meeting note." } });
  }
});

router.get("/sessions/mine", allowRoles("MENTOR"), async (req, res) => {
  try {
    const sessions = await prisma.mentorshipSession.findMany({
      where: { mentorId: req.user.id },
      include: {
        _count: { select: { bookings: { where: { status: "BOOKED" } } } },
        bookings: {
          where: { status: "BOOKED" },
          select: {
            id: true,
            createdAt: true,
            student: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { startsAt: "asc" },
    });
    return res.json({ sessions: sessions.map(sessionWithCounts) });
  } catch (error) {
    console.error("Mentor session listing failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_SESSIONS_UNAVAILABLE", message: "Could not load your sessions." } });
  }
});

router.get("/sessions/open", allowRoles("STUDENT"), async (req, res) => {
  try {
    const sessions = await prisma.mentorshipSession.findMany({
      where: { status: "OPEN", startsAt: { gte: new Date(Date.now() - 210 * 60 * 1000) } },
      include: {
        mentor: { select: { id: true, name: true } },
        _count: { select: { bookings: { where: { status: "BOOKED" } } } },
        bookings: {
          where: { studentId: req.user.id },
          select: { status: true },
        },
      },
      orderBy: { startsAt: "asc" },
    });
    return res.json({
      sessions: sessions.map(session => ({
        ...sessionWithCounts(session),
        bookedByMe: session.bookings.some(booking => booking.status === "BOOKED"),
      })),
    });
  } catch (error) {
    console.error("Open mentor session listing failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_SESSIONS_UNAVAILABLE", message: "Could not load available sessions." } });
  }
});

router.get("/sessions/booked", allowRoles("STUDENT"), async (req, res) => {
  try {
    const bookings = await prisma.sessionBooking.findMany({
      where: { studentId: req.user.id, status: "BOOKED", session: { startsAt: { gte: new Date(Date.now() - 210 * 60 * 1000) }, status: "OPEN" } },
      include: {
        session: {
          include: {
            mentor: { select: { id: true, name: true } },
            _count: { select: { bookings: { where: { status: "BOOKED" } } } },
          },
        },
      },
      orderBy: { session: { startsAt: "asc" } },
    });
    return res.json({ sessions: bookings.map(({ session }) => sessionWithCounts(session)) });
  } catch (error) {
    console.error("Booked mentor session listing failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_SESSIONS_UNAVAILABLE", message: "Could not load your booked sessions." } });
  }
});

router.post("/sessions", allowRoles("MENTOR"), async (req, res) => {
  const parsed = sessionInput.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_MENTOR_SESSION");
  try {
    const session = await prisma.mentorshipSession.create({
      data: { ...parsed.data, startsAt: new Date(parsed.data.startsAt), mentorId: req.user.id },
      include: { _count: { select: { bookings: { where: { status: "BOOKED" } } } }, bookings: true },
    });
    return res.status(201).json({ session: sessionWithCounts(session) });
  } catch (error) {
    console.error("Mentor session creation failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_SESSION_CREATE_FAILED", message: "Could not create the session." } });
  }
});

router.patch("/sessions/:id", allowRoles("MENTOR"), async (req, res) => {
  const parsed = z.object({ status: z.enum(["CANCELLED", "COMPLETED"]) }).safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_MENTOR_SESSION_STATUS");
  try {
    const updated = await prisma.mentorshipSession.updateMany({
      where: { id: req.params.id, mentorId: req.user.id },
      data: { status: parsed.data.status },
    });
    if (!updated.count) return res.status(404).json({ error: { code: "MENTOR_SESSION_NOT_FOUND", message: "Session not found." } });
    const session = await prisma.mentorshipSession.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { bookings: { where: { status: "BOOKED" } } } },
        bookings: { where: { status: "BOOKED" }, select: { id: true, createdAt: true, student: { select: { id: true, name: true } } } },
      },
    });
    return res.json({ session: sessionWithCounts(session) });
  } catch (error) {
    console.error("Mentor session update failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_SESSION_UPDATE_FAILED", message: "Could not update the session." } });
  }
});

router.post("/sessions/:id/book", allowRoles("STUDENT"), async (req, res) => {
  try {
    const booking = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "MentorshipSession" WHERE "id" = ${req.params.id} FOR UPDATE`;
      const session = await tx.mentorshipSession.findUnique({ where: { id: req.params.id } });
      if (!session || session.status !== "OPEN" || session.startsAt <= new Date()) {
        return { error: "This session is no longer available." };
      }
      const [existing, count] = await Promise.all([
        tx.sessionBooking.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: req.user.id } } }),
        tx.sessionBooking.count({ where: { sessionId: session.id, status: "BOOKED" } }),
      ]);
      if (existing?.status === "BOOKED") return { error: "You already booked this session." };
      if (count >= session.capacity) return { error: "This session is full." };
      return tx.sessionBooking.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: req.user.id } },
        update: { status: "BOOKED" },
        create: { sessionId: session.id, studentId: req.user.id },
      });
    });
    if (booking.error) return res.status(409).json({ error: { code: "SESSION_UNAVAILABLE", message: booking.error } });
    return res.status(201).json({ booking });
  } catch (error) {
    console.error("Mentor session booking failed:", error.message);
    return res.status(500).json({ error: { code: "SESSION_BOOKING_FAILED", message: "Could not book this session." } });
  }
});

router.delete("/sessions/:id/book", allowRoles("STUDENT"), async (req, res) => {
  try {
    const result = await prisma.sessionBooking.updateMany({
      where: { sessionId: req.params.id, studentId: req.user.id, status: "BOOKED" },
      data: { status: "CANCELLED" },
    });
    if (!result.count) return res.status(404).json({ error: { code: "SESSION_BOOKING_NOT_FOUND", message: "You do not have an active booking for this session." } });
    return res.json({ cancelled: true });
  } catch (error) {
    console.error("Mentor session booking cancellation failed:", error.message);
    return res.status(500).json({ error: { code: "SESSION_BOOKING_CANCEL_FAILED", message: "Could not cancel this booking." } });
  }
});

router.get("/projects/mine", allowRoles("MENTOR"), async (req, res) => {
  try {
    const projects = await prisma.mentorProjectOpportunity.findMany({
      where: { mentorId: req.user.id },
      include: {
        _count: { select: { submissions: true } },
        submissions: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                profile: {
                  select: {
                    degree: true,
                    skills: { include: { skill: { select: { name: true } } } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ projects: projects.map(({ _count, ...project }) => ({ ...project, submissionCount: _count.submissions })) });
  } catch (error) {
    console.error("Mentor project listing failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_PROJECTS_UNAVAILABLE", message: "Could not load your project opportunities." } });
  }
});

router.get("/projects/open", allowRoles("STUDENT"), async (req, res) => {
  try {
    const projects = await prisma.mentorProjectOpportunity.findMany({
      where: { status: "OPEN" },
      include: {
        mentor: { select: { id: true, name: true } },
        submissions: { where: { studentId: req.user.id }, select: { id: true, status: true, mentorFeedback: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({
      projects: projects.map(({ _count, submissions, ...project }) => ({
        ...project,
        submissionCount: _count.submissions,
        mySubmission: submissions[0] || null,
      })),
    });
  } catch (error) {
    console.error("Open mentor project listing failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_PROJECTS_UNAVAILABLE", message: "Could not load project opportunities." } });
  }
});

router.post("/projects", allowRoles("MENTOR"), async (req, res) => {
  const parsed = projectInput.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_MENTOR_PROJECT");
  try {
    const project = await prisma.mentorProjectOpportunity.create({
      data: { ...parsed.data, skills: [...new Set(parsed.data.skills)], mentorId: req.user.id },
      include: { _count: { select: { submissions: true } } },
    });
    return res.status(201).json({ project: { ...project, submissionCount: project._count.submissions } });
  } catch (error) {
    console.error("Mentor project creation failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_PROJECT_CREATE_FAILED", message: "Could not publish the project opportunity." } });
  }
});

router.patch("/projects/:id", allowRoles("MENTOR"), async (req, res) => {
  const parsed = z.object({ status: z.enum(["OPEN", "CLOSED"]) }).safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_MENTOR_PROJECT_STATUS");
  try {
    const updated = await prisma.mentorProjectOpportunity.updateMany({
      where: { id: req.params.id, mentorId: req.user.id },
      data: { status: parsed.data.status },
    });
    if (!updated.count) return res.status(404).json({ error: { code: "MENTOR_PROJECT_NOT_FOUND", message: "Project opportunity not found." } });
    return res.json({ status: parsed.data.status });
  } catch (error) {
    console.error("Mentor project update failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_PROJECT_UPDATE_FAILED", message: "Could not update the project opportunity." } });
  }
});

router.post("/projects/:id/ideas", allowRoles("STUDENT"), async (req, res) => {
  const parsed = ideaInput.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_IDEA_SUBMISSION");
  try {
    const opportunity = await prisma.mentorProjectOpportunity.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!opportunity || opportunity.status !== "OPEN") {
      return res.status(404).json({ error: { code: "PROJECT_OPPORTUNITY_CLOSED", message: "This project is no longer accepting ideas." } });
    }
    const submission = await prisma.ideaSubmission.create({
      data: {
        opportunityId: opportunity.id,
        studentId: req.user.id,
        title: parsed.data.title,
        summary: parsed.data.summary,
        projectUrl: parsed.data.projectUrl || null,
      },
    });
    return res.status(201).json({ submission });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: { code: "IDEA_ALREADY_SUBMITTED", message: "You have already submitted an idea for this project." } });
    console.error("Student idea submission failed:", error.message);
    return res.status(500).json({ error: { code: "IDEA_SUBMISSION_FAILED", message: "Could not submit your idea." } });
  }
});

router.patch("/ideas/:id", allowRoles("MENTOR"), async (req, res) => {
  const parsed = z.object({
    status: z.enum(["ACCEPTED", "NEEDS_REVISION", "DECLINED"]),
    mentorFeedback: z.string().trim().max(2000),
  }).safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_IDEA_REVIEW");
  try {
    const result = await prisma.ideaSubmission.updateMany({
      where: { id: req.params.id, opportunity: { mentorId: req.user.id } },
      data: parsed.data,
    });
    if (!result.count) return res.status(404).json({ error: { code: "IDEA_SUBMISSION_NOT_FOUND", message: "Idea submission not found." } });
    return res.json({ status: parsed.data.status, mentorFeedback: parsed.data.mentorFeedback });
  } catch (error) {
    console.error("Mentor idea review failed:", error.message);
    return res.status(500).json({ error: { code: "IDEA_REVIEW_FAILED", message: "Could not save your review." } });
  }
});

router.patch("/ideas/:id/resubmit", allowRoles("STUDENT"), async (req, res) => {
  const parsed = ideaInput.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error, "INVALID_IDEA_SUBMISSION");
  try {
    const updated = await prisma.ideaSubmission.updateMany({
      where: {
        id: req.params.id,
        studentId: req.user.id,
        status: "NEEDS_REVISION",
        opportunity: { status: "OPEN" },
      },
      data: {
        title: parsed.data.title,
        summary: parsed.data.summary,
        projectUrl: parsed.data.projectUrl || null,
        status: "PENDING",
        mentorFeedback: null,
      },
    });
    if (!updated.count) return res.status(409).json({ error: { code: "IDEA_NOT_REVISION_READY", message: "This idea cannot be revised right now." } });
    const submission = await prisma.ideaSubmission.findUnique({ where: { id: req.params.id } });
    return res.json({ submission });
  } catch (error) {
    console.error("Student idea resubmission failed:", error.message);
    return res.status(500).json({ error: { code: "IDEA_RESUBMISSION_FAILED", message: "Could not resubmit your idea." } });
  }
});

router.get("/leaderboard", allowRoles("MENTOR"), async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: {
        id: true,
        name: true,
        profile: {
          select: {
            degree: true,
            careerGoal: true,
            interests: true,
            preferredRoles: true,
            githubStats: true,
            skills: { select: { proficiency: true, evidenceUrl: true, skill: { select: { name: true } } } },
            availability: { select: { id: true } },
            evidence: { select: { id: true } },
            activities: {
              where: { loggedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
              select: { category: true, loggedAt: true, minutes: true },
            },
            quizAttempts: {
              where: { submittedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
              select: { score: true },
            },
          },
        },
      },
    });
    const leaderboard = students.map(student => {
      const profile = student.profile || {};
      const activities = profile.activities || [];
      const quizzes = profile.quizAttempts || [];
      const score = builderScore({
        education: profile.degree || "",
        careerGoal: profile.careerGoal || "",
        interests: profile.interests || [],
        preferredRoles: profile.preferredRoles || [],
        github: profile.githubStats,
        skills: (profile.skills || []).map(skill => ({
          name: skill.skill.name,
          level: skill.proficiency[0] + skill.proficiency.slice(1).toLowerCase(),
          evidence: skill.evidenceUrl || "",
        })),
        profileEvidenceCount: (profile.evidence || []).length,
        availabilitySlots: (profile.availability || []).length,
        recentActivityDays: new Set(activities
          .filter(activity => activity.category !== "Platform login")
          .map(activity => activity.loggedAt.toISOString().slice(0, 10))).size,
        ...(quizzes.length ? { quizScore: Math.round(quizzes.reduce((sum, attempt) => sum + attempt.score, 0) / quizzes.length) } : {}),
      });
      return {
        id: student.id,
        name: student.name,
        score: score.total,
        tier: score.tier,
        skills: (profile.skills || []).map(skill => skill.skill.name),
        activityMinutes: activities.reduce((sum, activity) => sum + activity.minutes, 0),
        quizAttempts: quizzes.length,
      };
    }).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
    return res.json({ leaderboard });
  } catch (error) {
    console.error("Mentor leaderboard loading failed:", error.message);
    return res.status(500).json({ error: { code: "MENTOR_LEADERBOARD_UNAVAILABLE", message: "Could not load student performance." } });
  }
});

export default router;
