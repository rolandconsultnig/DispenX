-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PMS', 'AGO', 'CNG');

-- AlterTable
ALTER TABLE "stations" ADD COLUMN     "price_ago" DOUBLE PRECISION NOT NULL DEFAULT 900,
ADD COLUMN     "price_cng" DOUBLE PRECISION NOT NULL DEFAULT 300,
ADD COLUMN     "price_pms" DOUBLE PRECISION NOT NULL DEFAULT 650;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "fuel_type" "FuelType" NOT NULL DEFAULT 'PMS';
