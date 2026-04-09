-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FLEET_MANAGER', 'FINANCE', 'STATION_ATTENDANT');

-- CreateEnum
CREATE TYPE "QuotaType" AS ENUM ('NAIRA', 'LITERS');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'LOST', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionSyncStatus" AS ENUM ('SYNCED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'SETTLED', 'DISPUTED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "credit_limit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settlement_cycle_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "organization_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "rfid_uid" TEXT,
    "pin" TEXT,
    "quota_type" "QuotaType" NOT NULL DEFAULT 'NAIRA',
    "quota_liters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quota_naira" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_liters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_naira" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "card_status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "pump_price_naira_per_liter" DOUBLE PRECISION NOT NULL DEFAULT 650,
    "api_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_whitelist" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,

    CONSTRAINT "station_whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "amount_liters" DOUBLE PRECISION NOT NULL,
    "amount_naira" DOUBLE PRECISION NOT NULL,
    "pump_price_at_time" DOUBLE PRECISION NOT NULL,
    "quota_type" "QuotaType" NOT NULL,
    "pos_serial" TEXT,
    "hmac_signature" TEXT,
    "sync_status" "TransactionSyncStatus" NOT NULL DEFAULT 'SYNCED',
    "transacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_liters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_naira_deducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "invoice_pdf_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_rfid_uid_key" ON "employees"("rfid_uid");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_staff_id_key" ON "employees"("organization_id", "staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "stations_api_key_key" ON "stations"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "station_whitelist_organization_id_station_id_key" ON "station_whitelist"("organization_id", "station_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "transactions_employee_id_idx" ON "transactions"("employee_id");

-- CreateIndex
CREATE INDEX "transactions_station_id_idx" ON "transactions"("station_id");

-- CreateIndex
CREATE INDEX "transactions_transacted_at_idx" ON "transactions"("transacted_at");

-- CreateIndex
CREATE INDEX "settlements_organization_id_idx" ON "settlements"("organization_id");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_station_id_organization_id_period_start_period__key" ON "settlements"("station_id", "organization_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_whitelist" ADD CONSTRAINT "station_whitelist_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_whitelist" ADD CONSTRAINT "station_whitelist_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
