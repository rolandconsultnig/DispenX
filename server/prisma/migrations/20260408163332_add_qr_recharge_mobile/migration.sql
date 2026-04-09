-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('RFID', 'QR_CODE', 'NFC');

-- CreateEnum
CREATE TYPE "RechargeType" AS ENUM ('TOP_UP', 'RESET', 'MONTHLY_ALLOCATION');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "password_hash" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'RFID';

-- CreateTable
CREATE TABLE "qr_tokens" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recharge_logs" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "recharged_by" TEXT NOT NULL,
    "recharge_type" "RechargeType" NOT NULL DEFAULT 'TOP_UP',
    "quota_type" "QuotaType" NOT NULL,
    "amount_naira" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_liters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_before" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recharge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qr_tokens_token_key" ON "qr_tokens"("token");

-- CreateIndex
CREATE INDEX "qr_tokens_token_idx" ON "qr_tokens"("token");

-- CreateIndex
CREATE INDEX "qr_tokens_employee_id_idx" ON "qr_tokens"("employee_id");

-- CreateIndex
CREATE INDEX "qr_tokens_expires_at_idx" ON "qr_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "recharge_logs_employee_id_idx" ON "recharge_logs"("employee_id");

-- CreateIndex
CREATE INDEX "recharge_logs_created_at_idx" ON "recharge_logs"("created_at");

-- AddForeignKey
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recharge_logs" ADD CONSTRAINT "recharge_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
