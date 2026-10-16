-- CreateEnum
CREATE TYPE "FormationRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "DisruptionType" AS ENUM ('MEMBER_UNAVAILABLE', 'BLOCKED_TASK', 'OVERDUE_TASK', 'MILESTONE_AT_RISK', 'OWNER_REPLACEMENT', 'CAPACITY_SHORTFALL', 'SCOPE_REDUCTION');

-- CreateEnum
CREATE TYPE "RecoveryPlanStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'APPLIED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "ChallengeSkill" ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "role" TEXT,
ADD COLUMN     "weeklyCapacity" INTEGER;

-- CreateTable
CREATE TABLE "ParticipantConstraint" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyCapacity" INTEGER NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationRun" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" "FormationRunStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationAlternative" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "feasible" BOOLEAN NOT NULL,
    "memberIds" JSONB NOT NULL,
    "evaluation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormationAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationAudit" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "estimateHours" INTEGER NOT NULL DEFAULT 0,
    "completedHours" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisruptionScenario" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "DisruptionType" NOT NULL,
    "taskId" TEXT,
    "memberId" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisruptionScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryPlan" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "algorithm" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "feasible" BOOLEAN NOT NULL,
    "status" "RecoveryPlanStatus" NOT NULL DEFAULT 'PROPOSED',
    "summary" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryTaskChange" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "previousOwnerId" TEXT,
    "proposedOwnerId" TEXT,
    "previousStatus" "TaskStatus",
    "proposedStatus" "TaskStatus",

    CONSTRAINT "RecoveryTaskChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantConstraint_challengeId_userId_key" ON "ParticipantConstraint"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "FormationRun_challengeId_createdAt_idx" ON "FormationRun"("challengeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormationAlternative_runId_rank_key" ON "FormationAlternative"("runId", "rank");

-- CreateIndex
CREATE INDEX "FormationAudit_runId_createdAt_idx" ON "FormationAudit"("runId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_teamId_key" ON "Project"("teamId");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_predecessorId_successorId_key" ON "TaskDependency"("predecessorId", "successorId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryPlan_scenarioId_rank_key" ON "RecoveryPlan"("scenarioId", "rank");

-- CreateIndex
CREATE INDEX "Team_challengeId_status_idx" ON "Team"("challengeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Team_challengeId_name_key" ON "Team"("challengeId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- AddForeignKey
ALTER TABLE "ParticipantConstraint" ADD CONSTRAINT "ParticipantConstraint_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantConstraint" ADD CONSTRAINT "ParticipantConstraint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantConstraint" ADD CONSTRAINT "ParticipantConstraint_challengeId_userId_fkey" FOREIGN KEY ("challengeId", "userId") REFERENCES "ChallengeMember"("challengeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationRun" ADD CONSTRAINT "FormationRun_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationRun" ADD CONSTRAINT "FormationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationAlternative" ADD CONSTRAINT "FormationAlternative_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FormationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationAudit" ADD CONSTRAINT "FormationAudit_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FormationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationAudit" ADD CONSTRAINT "FormationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisruptionScenario" ADD CONSTRAINT "DisruptionScenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisruptionScenario" ADD CONSTRAINT "DisruptionScenario_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPlan" ADD CONSTRAINT "RecoveryPlan_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DisruptionScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPlan" ADD CONSTRAINT "RecoveryPlan_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryTaskChange" ADD CONSTRAINT "RecoveryTaskChange_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RecoveryPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryTaskChange" ADD CONSTRAINT "RecoveryTaskChange_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
