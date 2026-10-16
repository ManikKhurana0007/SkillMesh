import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { allowRoles, requireAuth } from "../middleware/authMiddleware.js";
import {
  FORMATION_ALGORITHM,
  RESCUE_ALGORITHM,
  analyzeRecovery,
  generateFormationAlternatives,
  generateRecoveryPlans,
} from "../services/teamForgeEngine.js";

const router = Router();
const skillSchema = z.object({ name: z.string().trim().min(1).max(80), weight: z.number().min(0.01).max(10).default(1) });
const configSchema = z.object({
  minTeamSize: z.number().int().min(1).max(20),
  maxTeamSize: z.number().int().min(1).max(20),
  requiredSkills: z.array(skillSchema).max(50),
  requiredRoles: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  requiredWeeklyCapacity: z.number().int().min(0).max(10000).default(0),
  objectiveWeights: z.object({
    skills: z.number().min(0).max(1).default(0.55),
    roles: z.number().min(0).max(1).default(0.2),
    availability: z.number().min(0).max(1).default(0.25),
  }).default({ skills: 0.55, roles: 0.2, availability: 0.25 }),
}).superRefine((value, context) => {
  if (value.minTeamSize > value.maxTeamSize) context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxTeamSize"], message: "Maximum team size must be at least the minimum." });
});

const disruptionSchema = z.object({
  type: z.enum(["MEMBER_UNAVAILABLE", "BLOCKED_TASK", "OVERDUE_TASK", "MILESTONE_AT_RISK", "OWNER_REPLACEMENT", "CAPACITY_SHORTFALL", "SCOPE_REDUCTION"]),
  taskId: z.string().optional(),
  memberId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});

function invalid(res, parsed) {
  return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.issues.map((issue) => issue.message).join(" ") } });
}

function participantData(memberships) {
  return memberships.map((membership) => ({
    id: membership.user.id,
    eligible: membership.constraint?.available !== false,
    weeklyCapacity: membership.constraint?.weeklyCapacity || 0,
    roles: membership.profile?.headline ? [membership.profile.headline] : [],
    skills: membership.profile?.skills.map((item) => ({ name: item.skill.name, proficiency: item.proficiency })) || [],
  }));
}

async function getOrganizerChallenge(challengeId, userId) {
  return prisma.challenge.findFirst({ where: { id: challengeId, organizerId: userId } });
}

async function getProjectAccess(projectId, user) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { createdById: user.id },
        { team: { leaderId: user.id } },
        { team: { challenge: { organizerId: user.id } } },
        { team: { members: { some: { userId: user.id } } } },
      ],
    },
    include: {
      team: { include: { members: true, challenge: true } },
      tasks: { include: { dependencies: true } },
    },
  });
}

router.use(requireAuth);

router.get("/challenges/:challengeId/formation-config", allowRoles("ORGANIZER"), async (req, res) => {
  const challenge = await getOrganizerChallenge(req.params.challengeId, req.user.id);
  if (!challenge) return res.status(404).json({ error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." } });
  const skills = await prisma.challengeSkill.findMany({ where: { challengeId: challenge.id }, include: { skill: true } });
  return res.json({ config: { minTeamSize: challenge.teamSize, maxTeamSize: challenge.teamSize, requiredSkills: skills.map((item) => ({ name: item.skill.name, weight: item.weight })), requiredRoles: [], requiredWeeklyCapacity: 0, objectiveWeights: { skills: 0.55, roles: 0.2, availability: 0.25 } } });
});

router.patch("/challenges/:challengeId/formation-config", allowRoles("ORGANIZER"), async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  const challenge = await getOrganizerChallenge(req.params.challengeId, req.user.id);
  if (!challenge) return res.status(404).json({ error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." } });
  const config = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.challenge.update({ where: { id: challenge.id }, data: { teamSize: config.maxTeamSize } });
      const records = await Promise.all(config.requiredSkills.map((skill) => tx.skill.upsert({ where: { name: skill.name.toLowerCase() }, update: {}, create: { name: skill.name.toLowerCase() } })));
      await tx.challengeSkill.deleteMany({ where: { challengeId: challenge.id } });
      await tx.challengeSkill.createMany({ data: records.map((skill, index) => ({ challengeId: challenge.id, skillId: skill.id, weight: config.requiredSkills[index].weight })) });
    });
    return res.json({ config });
  } catch (error) {
    console.error("Formation configuration update failed:", error.message);
    return res.status(500).json({ error: { code: "FORMATION_CONFIG_FAILED", message: "Could not update formation configuration." } });
  }
});

router.post("/challenges/:challengeId/formation-runs", allowRoles("ORGANIZER"), async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  const challenge = await getOrganizerChallenge(req.params.challengeId, req.user.id);
  if (!challenge) return res.status(404).json({ error: { code: "CHALLENGE_NOT_FOUND", message: "Challenge not found." } });
  try {
    const memberships = await prisma.challengeMember.findMany({
      where: { challengeId: challenge.id },
      include: { user: { include: { profile: { include: { skills: { include: { skill: true } } } } } }, constraint: true },
    });
    const alternatives = generateFormationAlternatives(parsed.data, participantData(memberships), 10);
    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.formationRun.create({ data: { challengeId: challenge.id, createdById: req.user.id, algorithm: FORMATION_ALGORITHM, config: parsed.data } });
      if (alternatives.length) await tx.formationAlternative.createMany({ data: alternatives.map((alternative) => ({ runId: created.id, rank: alternative.rank, score: alternative.score, feasible: alternative.feasible, memberIds: alternative.memberIds, evaluation: alternative })) });
      await tx.formationAudit.create({ data: { runId: created.id, actorId: req.user.id, action: "GENERATED", snapshot: { participantCount: memberships.length, alternativeCount: alternatives.length } } });
      return tx.formationRun.findUnique({ where: { id: created.id }, include: { alternatives: { orderBy: { rank: "asc" } } } });
    });
    return res.status(201).json({ run });
  } catch (error) {
    console.error("Formation run generation failed:", error.message);
    return res.status(500).json({ error: { code: "FORMATION_RUN_FAILED", message: "Could not generate formation alternatives." } });
  }
});

router.get("/formation-runs/:runId", allowRoles("ORGANIZER"), async (req, res) => {
  const run = await prisma.formationRun.findFirst({ where: { id: req.params.runId, createdById: req.user.id }, include: { alternatives: { orderBy: { rank: "asc" } }, challenge: true } });
  if (!run) return res.status(404).json({ error: { code: "FORMATION_RUN_NOT_FOUND", message: "Formation run not found." } });
  return res.json({ run });
});

router.post("/formation-runs/:runId/approve", allowRoles("ORGANIZER"), async (req, res) => {
  const input = z.object({ alternativeId: z.string(), teamName: z.string().trim().min(2).max(100), reason: z.string().trim().max(500).optional() }).safeParse(req.body);
  if (!input.success) return invalid(res, input);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.formationRun.findFirst({ where: { id: req.params.runId, createdById: req.user.id }, include: { challenge: true } });
      const alternative = await tx.formationAlternative.findFirst({ where: { id: input.data.alternativeId, runId: req.params.runId } });
      if (!run || !alternative) return { status: 404, body: { error: { code: "FORMATION_ALTERNATIVE_NOT_FOUND", message: "Formation alternative not found." } } };
      if (!alternative.feasible) return { status: 409, body: { error: { code: "INFEASIBLE_ALTERNATIVE", message: "Only feasible alternatives can be approved." } } };
      const memberIds = Array.isArray(alternative.memberIds) ? alternative.memberIds : [];
      const existing = await tx.teamMember.findMany({ where: { challengeId: run.challengeId, userId: { in: memberIds } } });
      if (existing.length) return { status: 409, body: { error: { code: "MEMBER_ALREADY_ASSIGNED", message: "One or more participants already belong to a team." } } };
      const team = await tx.team.create({ data: { challengeId: run.challengeId, name: input.data.teamName, leaderId: memberIds[0], status: "APPROVED", members: { create: memberIds.map((userId) => ({ userId, challengeId: run.challengeId })) }, project: { create: { createdById: req.user.id, name: input.data.teamName, description: `Workspace for ${input.data.teamName}.` } } }, include: { project: true } });
      await tx.formationRun.update({ where: { id: run.id }, data: { status: "APPROVED" } });
      await tx.formationAudit.create({ data: { runId: run.id, actorId: req.user.id, action: "APPROVED", reason: input.data.reason, snapshot: { alternativeId: alternative.id, teamId: team.id } } });
      return { status: 201, body: { team } };
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Formation approval failed:", error.message);
    return res.status(500).json({ error: { code: "FORMATION_APPROVAL_FAILED", message: "Could not approve the formation alternative." } });
  }
});

router.post("/projects/:projectId/tasks", async (req, res) => {
  const project = await getProjectAccess(req.params.projectId, req.user);
  if (!project) return res.status(404).json({ error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } });
  const input = z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), ownerId: z.string().optional(), estimateHours: z.number().int().min(0).max(10000), dueAt: z.coerce.date().optional(), dependencyIds: z.array(z.string()).default([]) }).safeParse(req.body);
  if (!input.success) return invalid(res, input);
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({ data: { projectId: project.id, title: input.data.title, description: input.data.description, ownerId: input.data.ownerId, estimateHours: input.data.estimateHours, dueAt: input.data.dueAt } });
    if (input.data.dependencyIds.length) {
      await tx.taskDependency.createMany({ data: input.data.dependencyIds.map((predecessorId) => ({ predecessorId, successorId: created.id })) });
    }
    return tx.task.findUnique({ where: { id: created.id }, include: { dependencies: true } });
  });
  try {
    analyzeRecovery(await prisma.task.findMany({ where: { projectId: project.id }, include: { dependencies: true } }).then((tasks) => tasks.map((task) => ({ ...task, dependencies: task.dependencies.map((dependency) => dependency.predecessorId) }))), {});
  } catch (error) {
    await prisma.task.delete({ where: { id: task.id } });
    return res.status(409).json({ error: { code: "TASK_DEPENDENCY_CYCLE", message: error.message } });
  }
  return res.status(201).json({ task });
});

router.post("/projects/:projectId/disruptions", async (req, res) => {
  const project = await getProjectAccess(req.params.projectId, req.user);
  if (!project) return res.status(404).json({ error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } });
  const parsed = disruptionSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed);
  try {
    const tasks = project.tasks.map((task) => ({ ...task, dependencies: task.dependencies.map((dependency) => dependency.predecessorId) }));
    const members = project.team.members.map((member) => ({ id: member.userId, weeklyCapacity: member.weeklyCapacity || 0, currentWorkloadHours: tasks.filter((task) => task.ownerId === member.userId).reduce((sum, task) => sum + task.estimateHours, 0) }));
    const scenario = await prisma.disruptionScenario.create({ data: { projectId: project.id, createdById: req.user.id, type: parsed.data.type, taskId: parsed.data.taskId, memberId: parsed.data.memberId, details: parsed.data.details } });
    const plans = generateRecoveryPlans(tasks, members, parsed.data);
    await prisma.recoveryPlan.createMany({ data: plans.map((plan) => ({ scenarioId: scenario.id, algorithm: RESCUE_ALGORITHM, rank: plan.rank, feasible: plan.feasible, summary: plan })) });
    return res.status(201).json({ scenario, analysis: analyzeRecovery(tasks, parsed.data), plans });
  } catch (error) {
    return res.status(409).json({ error: { code: "RECOVERY_ANALYSIS_FAILED", message: error.message } });
  }
});

router.get("/disruptions/:scenarioId", async (req, res) => {
  const scenario = await prisma.disruptionScenario.findUnique({
    where: { id: req.params.scenarioId },
    include: { project: { include: { team: true } }, plans: { include: { changes: true }, orderBy: { rank: "asc" } } },
  });
  if (!scenario) return res.status(404).json({ error: { code: "SCENARIO_NOT_FOUND", message: "Disruption scenario not found." } });
  const access = await getProjectAccess(scenario.projectId, req.user);
  if (!access) return res.status(403).json({ error: { code: "FORBIDDEN", message: "You cannot access this recovery scenario." } });
  return res.json({ scenario });
});

router.post("/recovery-plans/:planId/approve", async (req, res) => {
  const input = z.object({ reason: z.string().trim().max(500).optional() }).safeParse(req.body || {});
  if (!input.success) return invalid(res, input);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.recoveryPlan.findUnique({ where: { id: req.params.planId }, include: { scenario: { include: { project: { include: { team: { include: { challenge: true } } } } } } } });
      if (!plan) return { status: 404, body: { error: { code: "RECOVERY_PLAN_NOT_FOUND", message: "Recovery plan not found." } } };
      const isAuthorized = plan.scenario.project.createdById === req.user.id || plan.scenario.project.team.leaderId === req.user.id || plan.scenario.project.team.challenge.organizerId === req.user.id;
      if (!isAuthorized) return { status: 403, body: { error: { code: "FORBIDDEN", message: "You cannot approve this recovery plan." } } };
      if (!plan.feasible) return { status: 409, body: { error: { code: "INFEASIBLE_RECOVERY_PLAN", message: "Only feasible recovery plans can be applied." } } };
      const summary = plan.summary && typeof plan.summary === "object" ? plan.summary : {};
      const changes = Array.isArray(summary.changes) ? summary.changes : [];
      for (const change of changes) {
        await tx.task.update({ where: { id: change.taskId }, data: { ownerId: change.proposedOwnerId } });
        await tx.recoveryTaskChange.create({ data: { planId: plan.id, taskId: change.taskId, previousOwnerId: change.previousOwnerId, proposedOwnerId: change.proposedOwnerId } });
      }
      const applied = await tx.recoveryPlan.update({ where: { id: plan.id }, data: { status: "APPLIED", reviewedById: req.user.id, reason: input.data.reason } });
      return { status: 200, body: { plan: applied, changedTaskCount: changes.length } };
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Recovery plan approval failed:", error.message);
    return res.status(500).json({ error: { code: "RECOVERY_APPROVAL_FAILED", message: "Could not apply the recovery plan." } });
  }
});

router.post("/recovery-plans/:planId/reject", async (req, res) => {
  const input = z.object({ reason: z.string().trim().min(1).max(500) }).safeParse(req.body);
  if (!input.success) return invalid(res, input);
  const plan = await prisma.recoveryPlan.findUnique({ where: { id: req.params.planId }, include: { scenario: true } });
  if (!plan) return res.status(404).json({ error: { code: "RECOVERY_PLAN_NOT_FOUND", message: "Recovery plan not found." } });
  const project = await getProjectAccess(plan.scenario.projectId, req.user);
  if (!project) return res.status(403).json({ error: { code: "FORBIDDEN", message: "You cannot reject this recovery plan." } });
  const rejected = await prisma.recoveryPlan.update({ where: { id: plan.id }, data: { status: "REJECTED", reviewedById: req.user.id, reason: input.data.reason } });
  return res.json({ plan: rejected });
});

export default router;
