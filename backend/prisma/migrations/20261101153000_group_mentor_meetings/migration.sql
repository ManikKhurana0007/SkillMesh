CREATE TYPE "MeetingNoteType" AS ENUM ('NOTE', 'KEY_POINT');

CREATE TABLE "MeetingNote" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "type" "MeetingNoteType" NOT NULL DEFAULT 'NOTE',
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MeetingNote_sessionId_createdAt_idx" ON "MeetingNote"("sessionId", "createdAt");
ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "MentorshipSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
