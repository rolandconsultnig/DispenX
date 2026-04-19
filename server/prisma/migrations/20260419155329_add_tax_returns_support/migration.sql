-- CreateEnum
CREATE TYPE "TaxReturnStatus" AS ENUM ('DRAFT', 'FILED', 'PAID', 'AMENDED');

-- CreateTable
CREATE TABLE "tax_returns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tax_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "output_tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "input_tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_tax_payable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TaxReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "filed_at" TIMESTAMP(3),
    "filed_by_user_id" TEXT,
    "payment_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_returns_organization_id_tax_type_period_start_period_en_idx" ON "tax_returns"("organization_id", "tax_type", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "tax_returns_status_idx" ON "tax_returns"("status");

-- AddForeignKey
ALTER TABLE "tax_returns" ADD CONSTRAINT "tax_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_returns" ADD CONSTRAINT "tax_returns_filed_by_user_id_fkey" FOREIGN KEY ("filed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
