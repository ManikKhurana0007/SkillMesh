CREATE TYPE "MentorSessionStatus" AS ENUM ('OPEN', 'CANCELLED', 'COMPLETED');
CREATE TYPE "SessionBookingStatus" AS ENUM ('BOOKED', 'CANCELLED');
CREATE TYPE "MentorProjectStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "IdeaSubmissionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'NEEDS_REVISION', 'DECLINED');

CREATE TABLE "MentorshipSession" (
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

CREATE TABLE "SessionBooking" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "SessionBookingStatus" NOT NULL DEFAULT 'BOOKED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MentorProjectOpportunity" (
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

CREATE TABLE "IdeaSubmission" (
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

CREATE UNIQUE INDEX "SessionBooking_sessionId_studentId_key" ON "SessionBooking"("sessionId", "studentId");
CREATE INDEX "SessionBooking_studentId_status_idx" ON "SessionBooking"("studentId", "status");
CREATE INDEX "MentorshipSession_mentorId_startsAt_idx" ON "MentorshipSession"("mentorId", "startsAt");
CREATE INDEX "MentorshipSession_status_startsAt_idx" ON "MentorshipSession"("status", "startsAt");
CREATE INDEX "MentorProjectOpportunity_mentorId_status_createdAt_idx" ON "MentorProjectOpportunity"("mentorId", "status", "createdAt");
CREATE UNIQUE INDEX "IdeaSubmission_opportunityId_studentId_key" ON "IdeaSubmission"("opportunityId", "studentId");
CREATE INDEX "IdeaSubmission_opportunityId_status_createdAt_idx" ON "IdeaSubmission"("opportunityId", "status", "createdAt");

ALTER TABLE "MentorshipSession" ADD CONSTRAINT "MentorshipSession_mentorId_fkey"
  FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "MentorshipSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionBooking" ADD CONSTRAINT "SessionBooking_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorProjectOpportunity" ADD CONSTRAINT "MentorProjectOpportunity_mentorId_fkey"
  FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaSubmission" ADD CONSTRAINT "IdeaSubmission_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "MentorProjectOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdeaSubmission" ADD CONSTRAINT "IdeaSubmission_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
