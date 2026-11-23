BEGIN;
-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "requestHash" TEXT,
ADD COLUMN     "requestKey" UUID,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserSecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSecurityEvent_userId_createdAt_idx" ON "UserSecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Membership_companyId_active_role_idx" ON "Membership"("companyId", "active", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_companyId_requestKey_key" ON "Membership"("companyId", "requestKey");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecurityEvent" ADD CONSTRAINT "UserSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_session_version_valid" CHECK ("sessionVersion" >= 0);
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_request_metadata_valid" CHECK (
  ("requestKey" IS NULL AND "requestHash" IS NULL AND "createdBy" IS NULL)
  OR ("requestKey" IS NOT NULL AND "requestHash" IS NOT NULL AND length("requestHash") = 64 AND "createdBy" IS NOT NULL)
);
ALTER TABLE "UserSecurityEvent" ADD CONSTRAINT "UserSecurityEvent_action_valid" CHECK (action IN ('ACCOUNT_CREATED', 'PASSWORD_CHANGED'));
COMMIT;
