BEGIN;

DO $$
BEGIN
  CREATE TYPE "MentorSessionStatus" AS ENUM ('OPEN', 'CANCELLED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SessionBookingStatus" AS ENUM ('BOOKED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MentorProjectStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "IdeaSubmissionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'NEEDS_REVISION', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MeetingNoteType" AS ENUM ('NOTE', 'KEY_POINT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MentorshipSession" (
  "id" TEXT NOT NULL,
  "mentorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "duration" INTEGER NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" "MentorSessionStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MentorshipSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SessionBooking" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "SessionBookingStatus" NOT NULL DEFAULT 'BOOKED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MentorProjectOpportunity" (
  "id" TEXT NOT NULL,
  "mentorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "MentorProjectStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MentorProjectOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IdeaSubmission" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "projectUrl" TEXT,
  "status" "IdeaSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "mentorFeedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdeaSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MeetingNote" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "type" "MeetingNoteType" NOT NULL DEFAULT 'NOTE',
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SessionBooking_sessionId_studentId_key"
  ON "SessionBooking"("sessionId", "studentId");
CREATE INDEX IF NOT EXISTS "SessionBooking_studentId_status_idx"
  ON "SessionBooking"("studentId", "status");
CREATE INDEX IF NOT EXISTS "MentorshipSession_mentorId_startsAt_idx"
  ON "MentorshipSession"("mentorId", "startsAt");
CREATE INDEX IF NOT EXISTS "MentorshipSession_status_startsAt_idx"
  ON "MentorshipSession"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "MentorProjectOpportunity_mentorId_status_createdAt_idx"
  ON "MentorProjectOpportunity"("mentorId", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "IdeaSubmission_opportunityId_studentId_key"
  ON "IdeaSubmission"("opportunityId", "studentId");
CREATE INDEX IF NOT EXISTS "IdeaSubmission_opportunityId_status_createdAt_idx"
  ON "IdeaSubmission"("opportunityId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MeetingNote_sessionId_createdAt_idx"
  ON "MeetingNote"("sessionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipSession_mentorId_fkey') THEN
    ALTER TABLE "MentorshipSession" ADD CONSTRAINT "MentorshipSession_mentorId_fkey"
      FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionBooking_sessionId_fkey') THEN
    ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "MentorshipSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionBooking_studentId_fkey') THEN
    ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorProjectOpportunity_mentorId_fkey') THEN
    ALTER TABLE "MentorProjectOpportunity" ADD CONSTRAINT "MentorProjectOpportunity_mentorId_fkey"
      FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaSubmission_opportunityId_fkey') THEN
    ALTER TABLE "IdeaSubmission" ADD CONSTRAINT "IdeaSubmission_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "MentorProjectOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdeaSubmission_studentId_fkey') THEN
    ALTER TABLE "IdeaSubmission" ADD CONSTRAINT "IdeaSubmission_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingNote_sessionId_fkey') THEN
    ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "MentorshipSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingNote_authorId_fkey') THEN
    ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
