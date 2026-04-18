-- CreateEnum
CREATE TYPE "SiphoningAlertStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "siphoning_alerts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "status" "SiphoningAlertStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "dispensed_liters" DOUBLE PRECISION NOT NULL,
    "estimated_tank_capacity_liters" DOUBLE PRECISION NOT NULL,
    "expected_fuel_level_delta_pct" DOUBLE PRECISION NOT NULL,
    "observed_fuel_level_delta_pct" DOUBLE PRECISION NOT NULL,
    "baseline_fuel_level_pct" DOUBLE PRECISION NOT NULL,
    "current_fuel_level_pct" DOUBLE PRECISION NOT NULL,
    "suspected_siphoned_liters" DOUBLE PRECISION NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "siphoning_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "siphoning_alerts_transaction_id_key" ON "siphoning_alerts"("transaction_id");

-- CreateIndex
CREATE INDEX "siphoning_alerts_organization_id_status_idx" ON "siphoning_alerts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "siphoning_alerts_employee_id_created_at_idx" ON "siphoning_alerts"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "siphoning_alerts_vehicle_id_created_at_idx" ON "siphoning_alerts"("vehicle_id", "created_at");

-- CreateIndex
CREATE INDEX "siphoning_alerts_created_at_idx" ON "siphoning_alerts"("created_at");

-- AddForeignKey
ALTER TABLE "siphoning_alerts" ADD CONSTRAINT "siphoning_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siphoning_alerts" ADD CONSTRAINT "siphoning_alerts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siphoning_alerts" ADD CONSTRAINT "siphoning_alerts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siphoning_alerts" ADD CONSTRAINT "siphoning_alerts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siphoning_alerts" ADD CONSTRAINT "siphoning_alerts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
