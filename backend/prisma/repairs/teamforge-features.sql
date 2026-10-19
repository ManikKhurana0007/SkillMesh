BEGIN;

DO $$
BEGIN
  CREATE TYPE "FormationRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ParticipantConstraint" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weeklyCapacity" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT TRUE,
  "notes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParticipantConstraint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FormationRun" (
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

CREATE TABLE IF NOT EXISTS "FormationAlternative" (
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

CREATE TABLE IF NOT EXISTS "FormationAudit" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Project" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "ParticipantConstraint_challengeId_userId_key"
  ON "ParticipantConstraint"("challengeId", "userId");
CREATE INDEX IF NOT EXISTS "FormationRun_challengeId_createdAt_idx"
  ON "FormationRun"("challengeId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "FormationAlternative_runId_rank_key"
  ON "FormationAlternative"("runId", "rank");
CREATE INDEX IF NOT EXISTS "FormationAudit_runId_createdAt_idx"
  ON "FormationAudit"("runId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_teamId_key"
  ON "Project"("teamId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParticipantConstraint_challengeId_fkey') THEN
    ALTER TABLE "ParticipantConstraint" ADD CONSTRAINT "ParticipantConstraint_challengeId_fkey"
      FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParticipantConstraint_userId_fkey') THEN
    ALTER TABLE "ParticipantConstraint" ADD CONSTRAINT "ParticipantConstraint_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParticipantConstraint_challengeId_userId_fkey') THEN
    ALTER TABLE "ParticipantConstraint" ADD CONSTRAINT "ParticipantConstraint_challengeId_userId_fkey"
      FOREIGN KEY ("challengeId", "userId") REFERENCES "ChallengeMember"("challengeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormationRun_challengeId_fkey') THEN
    ALTER TABLE "FormationRun" ADD CONSTRAINT "FormationRun_challengeId_fkey"
      FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormationRun_createdById_fkey') THEN
    ALTER TABLE "FormationRun" ADD CONSTRAINT "FormationRun_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormationAlternative_runId_fkey') THEN
    ALTER TABLE "FormationAlternative" ADD CONSTRAINT "FormationAlternative_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "FormationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormationAudit_runId_fkey') THEN
    ALTER TABLE "FormationAudit" ADD CONSTRAINT "FormationAudit_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "FormationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FormationAudit_actorId_fkey') THEN
    ALTER TABLE "FormationAudit" ADD CONSTRAINT "FormationAudit_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_teamId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_createdById_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
