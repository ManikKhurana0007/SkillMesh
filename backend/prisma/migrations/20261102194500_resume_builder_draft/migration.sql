CREATE TABLE "ResumeBuilderDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "template" TEXT NOT NULL DEFAULT 'modern',
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeBuilderDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumeBuilderDraft_userId_key" ON "ResumeBuilderDraft"("userId");

ALTER TABLE "ResumeBuilderDraft" ADD CONSTRAINT "ResumeBuilderDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
