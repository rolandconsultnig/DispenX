-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuotaRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "issue_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount_naira" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_liters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" "QuotaRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disputes_employee_id_idx" ON "disputes"("employee_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "quota_requests_employee_id_idx" ON "quota_requests"("employee_id");

-- CreateIndex
CREATE INDEX "quota_requests_status_idx" ON "quota_requests"("status");

-- CreateIndex
CREATE INDEX "notifications_employee_id_idx" ON "notifications"("employee_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quota_requests" ADD CONSTRAINT "quota_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
