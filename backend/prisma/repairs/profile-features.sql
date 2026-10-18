BEGIN;

ALTER TABLE "StudentProfile"
  ADD COLUMN IF NOT EXISTS "careerGoal" TEXT,
  ADD COLUMN IF NOT EXISTS "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "preferredRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "githubStats" JSONB;

CREATE TABLE IF NOT EXISTS "WeeklyAvailability" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "slot" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProfileEvidence" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'PROJECT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LearningActivity" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyAvailability_profileId_dayOfWeek_slot_key"
  ON "WeeklyAvailability"("profileId", "dayOfWeek", "slot");
CREATE INDEX IF NOT EXISTS "WeeklyAvailability_profileId_idx"
  ON "WeeklyAvailability"("profileId");
CREATE INDEX IF NOT EXISTS "ProfileEvidence_profileId_createdAt_idx"
  ON "ProfileEvidence"("profileId", "createdAt");
CREATE INDEX IF NOT EXISTS "LearningActivity_profileId_loggedAt_idx"
  ON "LearningActivity"("profileId", "loggedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyAvailability_profileId_fkey') THEN
    ALTER TABLE "WeeklyAvailability" ADD CONSTRAINT "WeeklyAvailability_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileEvidence_profileId_fkey') THEN
    ALTER TABLE "ProfileEvidence" ADD CONSTRAINT "ProfileEvidence_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LearningActivity_profileId_fkey') THEN
    ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
