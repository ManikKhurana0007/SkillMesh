CREATE TYPE "StudentBuildTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

CREATE TABLE "StudentBuildProject" (
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

CREATE TABLE "StudentBuildTask" (
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

CREATE INDEX "StudentBuildProject_ownerId_createdAt_idx" ON "StudentBuildProject"("ownerId", "createdAt");
CREATE INDEX "StudentBuildProject_teamId_updatedAt_idx" ON "StudentBuildProject"("teamId", "updatedAt");
CREATE INDEX "StudentBuildProject_showcasedAt_updatedAt_idx" ON "StudentBuildProject"("showcasedAt", "updatedAt");
CREATE INDEX "StudentBuildTask_projectId_status_idx" ON "StudentBuildTask"("projectId", "status");
CREATE INDEX "StudentBuildTask_assigneeId_status_idx" ON "StudentBuildTask"("assigneeId", "status");

ALTER TABLE "StudentBuildProject" ADD CONSTRAINT "StudentBuildProject_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentBuildProject" ADD CONSTRAINT "StudentBuildProject_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentBuildTask" ADD CONSTRAINT "StudentBuildTask_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "StudentBuildProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentBuildTask" ADD CONSTRAINT "StudentBuildTask_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
