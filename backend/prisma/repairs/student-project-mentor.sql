BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentBuildTaskStatus') THEN
    CREATE TYPE "StudentBuildTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StudentBuildProject" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "teamId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "roadmap" JSONB,
  "architecture" JSONB,
  "techStack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "githubUrl" TEXT,
  "repositoryAnalysis" JSONB,
  "qualityScore" INTEGER,
  "showcaseUrl" TEXT,
  "showcasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentBuildProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudentBuildTask" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "milestone" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "StudentBuildTaskStatus" NOT NULL DEFAULT 'TODO',
  "estimateHours" INTEGER NOT NULL DEFAULT 1,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentBuildTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StudentBuildProject" ADD COLUMN IF NOT EXISTS "showcaseUrl" TEXT;
ALTER TABLE "StudentBuildProject" ADD COLUMN IF NOT EXISTS "architecture" JSONB;
ALTER TABLE "StudentBuildProject" ADD COLUMN IF NOT EXISTS "techStack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "StudentBuildProject_ownerId_createdAt_idx" ON "StudentBuildProject"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudentBuildProject_teamId_updatedAt_idx" ON "StudentBuildProject"("teamId", "updatedAt");
CREATE INDEX IF NOT EXISTS "StudentBuildProject_showcasedAt_updatedAt_idx" ON "StudentBuildProject"("showcasedAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "StudentBuildTask_projectId_status_idx" ON "StudentBuildTask"("projectId", "status");
CREATE INDEX IF NOT EXISTS "StudentBuildTask_assigneeId_status_idx" ON "StudentBuildTask"("assigneeId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentBuildProject_ownerId_fkey') THEN
    ALTER TABLE "StudentBuildProject" ADD CONSTRAINT "StudentBuildProject_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentBuildProject_teamId_fkey') THEN
    ALTER TABLE "StudentBuildProject" ADD CONSTRAINT "StudentBuildProject_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentBuildTask_projectId_fkey') THEN
    ALTER TABLE "StudentBuildTask" ADD CONSTRAINT "StudentBuildTask_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "StudentBuildProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentBuildTask_assigneeId_fkey') THEN
    ALTER TABLE "StudentBuildTask" ADD CONSTRAINT "StudentBuildTask_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
