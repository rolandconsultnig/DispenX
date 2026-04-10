-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "plate_number" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "vin" TEXT,
    "fuel_type" "FuelType" NOT NULL DEFAULT 'PMS',
    "obd2_device_id" TEXT,
    "gps_tracker_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_positions" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'DEVICE',
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obd2_readings" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "rpm" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "throttle_position" DOUBLE PRECISION,
    "engine_load" DOUBLE PRECISION,
    "engine_coolant_temp" DOUBLE PRECISION,
    "intake_air_temp" DOUBLE PRECISION,
    "fuel_level" DOUBLE PRECISION,
    "fuel_pressure" DOUBLE PRECISION,
    "fuel_rate" DOUBLE PRECISION,
    "maf" DOUBLE PRECISION,
    "dtc_codes" TEXT[],
    "mil_status" BOOLEAN NOT NULL DEFAULT false,
    "battery_voltage" DOUBLE PRECISION,
    "odometer" DOUBLE PRECISION,
    "run_time" INTEGER,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obd2_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");

-- CreateIndex
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles"("organization_id");

-- CreateIndex
CREATE INDEX "vehicles_employee_id_idx" ON "vehicles"("employee_id");

-- CreateIndex
CREATE INDEX "gps_positions_vehicle_id_idx" ON "gps_positions"("vehicle_id");

-- CreateIndex
CREATE INDEX "gps_positions_recorded_at_idx" ON "gps_positions"("recorded_at");

-- CreateIndex
CREATE INDEX "gps_positions_vehicle_id_recorded_at_idx" ON "gps_positions"("vehicle_id", "recorded_at");

-- CreateIndex
CREATE INDEX "obd2_readings_vehicle_id_idx" ON "obd2_readings"("vehicle_id");

-- CreateIndex
CREATE INDEX "obd2_readings_recorded_at_idx" ON "obd2_readings"("recorded_at");

-- CreateIndex
CREATE INDEX "obd2_readings_vehicle_id_recorded_at_idx" ON "obd2_readings"("vehicle_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_positions" ADD CONSTRAINT "gps_positions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obd2_readings" ADD CONSTRAINT "obd2_readings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
