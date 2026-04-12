-- AlterTable
ALTER TABLE "stations" ADD COLUMN "station_code" TEXT;

UPDATE "stations" SET "station_code" = 'ST' || UPPER(SUBSTRING(MD5("id"::text), 1, 8)) WHERE "station_code" IS NULL;

CREATE UNIQUE INDEX "stations_station_code_key" ON "stations"("station_code");

ALTER TABLE "stations" ALTER COLUMN "station_code" SET NOT NULL;

-- CreateTable
CREATE TABLE "station_attendants" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_attendants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "station_attendants_station_id_username_key" ON "station_attendants"("station_id", "username");

ALTER TABLE "station_attendants" ADD CONSTRAINT "station_attendants_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
