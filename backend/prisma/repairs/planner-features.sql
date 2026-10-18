BEGIN;

CREATE TABLE IF NOT EXISTS "PracticeTask" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "skillName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "generationSource" TEXT NOT NULL DEFAULT 'LOCAL',
  "quiz" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PracticeTask"
  ADD COLUMN IF NOT EXISTS "generationSource" TEXT NOT NULL DEFAULT 'LOCAL';

CREATE TABLE IF NOT EXISTS "QuizAttempt" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "practiceTaskId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "answers" JSONB NOT NULL,
  "feedback" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "practiceTaskId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT FALSE,
  "scheduledFor" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_practiceTaskId_key"
  ON "Notification"("practiceTaskId");
CREATE INDEX IF NOT EXISTS "PracticeTask_profileId_scheduledFor_idx"
  ON "PracticeTask"("profileId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "PracticeTask_profileId_status_scheduledFor_idx"
  ON "PracticeTask"("profileId", "status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "QuizAttempt_profileId_submittedAt_idx"
  ON "QuizAttempt"("profileId", "submittedAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_scheduledFor_idx"
  ON "Notification"("userId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx"
  ON "Notification"("userId", "read");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PracticeTask_profileId_fkey') THEN
    ALTER TABLE "PracticeTask" ADD CONSTRAINT "PracticeTask_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizAttempt_profileId_fkey') THEN
    ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizAttempt_practiceTaskId_fkey') THEN
    ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_practiceTaskId_fkey"
      FOREIGN KEY ("practiceTaskId") REFERENCES "PracticeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_practiceTaskId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_practiceTaskId_fkey"
      FOREIGN KEY ("practiceTaskId") REFERENCES "PracticeTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
