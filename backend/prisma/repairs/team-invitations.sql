BEGIN;

DO $$
BEGIN
  CREATE TYPE "TeamStatus" AS ENUM ('FORMING', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "leaderId" TEXT NOT NULL,
  "status" "TeamStatus" NOT NULL DEFAULT 'FORMING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT,
  "weeklyCapacity" INTEGER,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamInvitation" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "message" TEXT,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamChatMessage" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamChatAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storageName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamChatAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "weeklyCapacity" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Team_challengeId_name_key"
  ON "Team"("challengeId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_challengeId_leaderId_key"
  ON "Team"("challengeId", "leaderId");
CREATE INDEX IF NOT EXISTS "Team_challengeId_status_idx"
  ON "Team"("challengeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_challengeId_userId_key"
  ON "TeamMember"("challengeId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamId_userId_key"
  ON "TeamMember"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx"
  ON "TeamMember"("teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamInvitation_teamId_recipientId_key"
  ON "TeamInvitation"("teamId", "recipientId");
CREATE INDEX IF NOT EXISTS "TeamChatMessage_teamId_createdAt_idx"
  ON "TeamChatMessage"("teamId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamChatAttachment_storageName_key"
  ON "TeamChatAttachment"("storageName");
CREATE INDEX IF NOT EXISTS "TeamChatAttachment_messageId_idx"
  ON "TeamChatAttachment"("messageId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Team_challengeId_fkey') THEN
    ALTER TABLE "Team" ADD CONSTRAINT "Team_challengeId_fkey"
      FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Team_leaderId_fkey') THEN
    ALTER TABLE "Team" ADD CONSTRAINT "Team_leaderId_fkey"
      FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_teamId_fkey') THEN
    ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_challengeId_fkey') THEN
    ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_challengeId_fkey"
      FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_userId_fkey') THEN
    ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamInvitation_teamId_fkey') THEN
    ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamInvitation_senderId_fkey') THEN
    ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamInvitation_recipientId_fkey') THEN
    ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamChatMessage_teamId_fkey') THEN
    ALTER TABLE "TeamChatMessage" ADD CONSTRAINT "TeamChatMessage_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamChatMessage_senderId_fkey') THEN
    ALTER TABLE "TeamChatMessage" ADD CONSTRAINT "TeamChatMessage_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamChatAttachment_messageId_fkey') THEN
    ALTER TABLE "TeamChatAttachment" ADD CONSTRAINT "TeamChatAttachment_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "TeamChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
