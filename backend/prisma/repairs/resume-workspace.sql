BEGIN;

CREATE TABLE IF NOT EXISTS "Resume" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storageName" TEXT NOT NULL,
  "analysis" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResumeMatch" (
  "id" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "jobTitle" TEXT,
  "jobDescription" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "results" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResumeMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResumeBuilderDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "template" TEXT NOT NULL DEFAULT 'modern',
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeBuilderDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Resume_storageName_key" ON "Resume"("storageName");
CREATE INDEX IF NOT EXISTS "Resume_userId_createdAt_idx" ON "Resume"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ResumeMatch_resumeId_createdAt_idx" ON "ResumeMatch"("resumeId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ResumeBuilderDraft_userId_key" ON "ResumeBuilderDraft"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Resume_userId_fkey') THEN
    ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResumeMatch_resumeId_fkey') THEN
    ALTER TABLE "ResumeMatch" ADD CONSTRAINT "ResumeMatch_resumeId_fkey"
      FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResumeBuilderDraft_userId_fkey') THEN
    ALTER TABLE "ResumeBuilderDraft" ADD CONSTRAINT "ResumeBuilderDraft_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
