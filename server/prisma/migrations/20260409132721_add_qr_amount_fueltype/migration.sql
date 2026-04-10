-- AlterTable
ALTER TABLE "qr_tokens" ADD COLUMN     "amount_liters" DOUBLE PRECISION,
ADD COLUMN     "amount_naira" DOUBLE PRECISION,
ADD COLUMN     "fuel_type" "FuelType";
