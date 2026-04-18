import { Router, Request, Response, NextFunction } from "express";
import { SiphoningAlertStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { updateSiphoningAlertStatusSchema } from "../schemas";

const router = Router();
const DEFAULT_TANK_CAPACITY_LITERS = 60;
const SUSPICIOUS_RATIO_THRESHOLD = 0.45;
const MINIMUM_SUSPECTED_LITERS = 8;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

async function detectPotentialSiphoning(reading: {
  vehicleId: string;
  fuelLevel: number | null;
  recordedAt: Date;
}) {
  if (reading.fuelLevel == null) return;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: reading.vehicleId },
    select: {
      id: true,
      plateNumber: true,
      organizationId: true,
      employeeId: true,
    },
  });
  if (!vehicle?.employeeId) return;

  const txWindowStart = new Date(reading.recordedAt.getTime() - 3 * 60 * 60 * 1000);
  const tx = await prisma.transaction.findFirst({
    where: {
      employeeId: vehicle.employeeId,
      transactedAt: { gte: txWindowStart, lte: reading.recordedAt },
    },
    orderBy: { transactedAt: "desc" },
  });
  if (!tx || tx.amountLiters <= 0) return;

  const existing = await prisma.siphoningAlert.findUnique({
    where: { transactionId: tx.id },
    select: { id: true },
  });
  if (existing) return;

  const baseline = await prisma.obd2Reading.findFirst({
    where: {
      vehicleId: reading.vehicleId,
      fuelLevel: { not: null },
      recordedAt: { lt: tx.transactedAt },
    },
    orderBy: { recordedAt: "desc" },
    select: { fuelLevel: true, recordedAt: true },
  });
  if (!baseline?.fuelLevel) return;

  const baselinePct = clampPercent(Number(baseline.fuelLevel));
  const currentPct = clampPercent(Number(reading.fuelLevel));
  const observedDeltaPct = Math.max(0, currentPct - baselinePct);
  const expectedDeltaPct = (tx.amountLiters / DEFAULT_TANK_CAPACITY_LITERS) * 100;
  if (expectedDeltaPct <= 0) return;

  const observedLiters = (observedDeltaPct / 100) * DEFAULT_TANK_CAPACITY_LITERS;
  const suspectedSiphonedLiters = Math.max(0, tx.amountLiters - observedLiters);
  const observedRatio = observedDeltaPct / expectedDeltaPct;

  if (observedRatio > SUSPICIOUS_RATIO_THRESHOLD || suspectedSiphonedLiters < MINIMUM_SUSPECTED_LITERS) {
    return;
  }

  const confidenceScore = Math.min(
    0.99,
    Math.max(0.1, (1 - observedRatio) * 0.7 + Math.min(0.3, suspectedSiphonedLiters / tx.amountLiters))
  );
  const reason = `Dispensed ${tx.amountLiters.toFixed(2)}L but fuel level rose only ${observedDeltaPct.toFixed(
    2
  )}% (expected ${expectedDeltaPct.toFixed(2)}%).`;

  await prisma.siphoningAlert.create({
    data: {
      organizationId: vehicle.organizationId,
      employeeId: vehicle.employeeId,
      vehicleId: vehicle.id,
      transactionId: tx.id,
      reason,
      dispensedLiters: tx.amountLiters,
      estimatedTankCapacityLiters: DEFAULT_TANK_CAPACITY_LITERS,
      expectedFuelLevelDeltaPct: expectedDeltaPct,
      observedFuelLevelDeltaPct: observedDeltaPct,
      baselineFuelLevelPct: baselinePct,
      currentFuelLevelPct: currentPct,
      suspectedSiphonedLiters,
      confidenceScore,
    },
  });
}

async function assertVehicleAccess(req: Request, vehicleId: string, next: NextFunction) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, organizationId: true },
  });
  if (!vehicle) {
    next(new AppError("Vehicle not found", 404));
    return null;
  }
  if (req.user!.role !== "SUPER_ADMIN" && vehicle.organizationId !== req.user!.organizationId) {
    next(new AppError("Insufficient permissions", 403));
    return null;
  }
  return vehicle;
}

// ─── Vehicle CRUD ────────────────────────────────────────

// GET /api/telemetry/vehicles — list vehicles
router.get(
  "/vehicles",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter =
        req.user!.role !== "SUPER_ADMIN"
          ? { organizationId: req.user!.organizationId }
          : req.query.organizationId
            ? { organizationId: String(req.query.organizationId) }
            : {};

      const vehicles = await prisma.vehicle.findMany({
        where: orgFilter,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
            },
          },
          organization: { select: { id: true, name: true } },
          _count: { select: { gpsPositions: true, obd2Readings: true } },
        },
      });

      res.json({ success: true, data: vehicles });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/telemetry/vehicles — create vehicle
router.post(
  "/vehicles",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        plateNumber,
        make,
        model,
        year,
        vin,
        fuelType,
        employeeId,
        obd2DeviceId,
        gpsTrackerId,
      } = req.body;

      if (!plateNumber) return next(new AppError("plateNumber is required", 400));

      const orgId =
        req.user!.role === "SUPER_ADMIN"
          ? req.body.organizationId
          : req.user!.organizationId;

      if (!orgId) return next(new AppError("organizationId is required", 400));

      const vehicle = await prisma.vehicle.create({
        data: {
          organizationId: orgId,
          plateNumber,
          make,
          model,
          year: year ? parseInt(year, 10) : undefined,
          vin,
          fuelType: fuelType || "PMS",
          employeeId: employeeId || undefined,
          obd2DeviceId: obd2DeviceId || undefined,
          gpsTrackerId: gpsTrackerId || undefined,
        },
      });

      res.status(201).json({ success: true, data: vehicle });
    } catch (err: any) {
      if (err.code === "P2002") {
        return next(
          new AppError(
            `Duplicate: ${err.meta?.target?.join(", ")} already exists`,
            409
          )
        );
      }
      next(err);
    }
  }
);

// PUT /api/telemetry/vehicles/:id — update vehicle
router.put(
  "/vehicles/:id",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicle = await assertVehicleAccess(req, req.params.id, next);
      if (!vehicle) return;

      const {
        plateNumber,
        make,
        model,
        year,
        vin,
        fuelType,
        employeeId,
        obd2DeviceId,
        gpsTrackerId,
        isActive,
      } = req.body;

      const updated = await prisma.vehicle.update({
        where: { id: req.params.id },
        data: {
          ...(plateNumber !== undefined && { plateNumber }),
          ...(make !== undefined && { make }),
          ...(model !== undefined && { model }),
          ...(year !== undefined && { year: parseInt(year, 10) }),
          ...(vin !== undefined && { vin }),
          ...(fuelType !== undefined && { fuelType }),
          ...(employeeId !== undefined && { employeeId: employeeId || null }),
          ...(obd2DeviceId !== undefined && {
            obd2DeviceId: obd2DeviceId || null,
          }),
          ...(gpsTrackerId !== undefined && {
            gpsTrackerId: gpsTrackerId || null,
          }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GPS Position Endpoints ──────────────────────────────

// POST /api/telemetry/gps — submit GPS position (from mobile app)
router.post(
  "/gps",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId, latitude, longitude, altitude, speed, heading, accuracy, source, recordedAt } = req.body;

      if (!vehicleId || latitude === undefined || longitude === undefined) {
        return next(new AppError("vehicleId, latitude, and longitude are required", 400));
      }

      // Validate coordinate ranges
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return next(new AppError("Invalid coordinates", 400));
      }

      const vehicle = await assertVehicleAccess(req, vehicleId, next);
      if (!vehicle) return;

      const position = await prisma.gpsPosition.create({
        data: {
          vehicleId,
          latitude,
          longitude,
          altitude: altitude ?? null,
          speed: speed ?? null,
          heading: heading ?? null,
          accuracy: accuracy ?? null,
          source: source || "DEVICE",
          recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        },
      });

      res.status(201).json({ success: true, data: position });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/telemetry/gps/batch — submit multiple GPS positions at once
router.post(
  "/gps/batch",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { positions } = req.body;
      if (!Array.isArray(positions) || positions.length === 0) {
        return next(new AppError("positions array is required", 400));
      }

      if (positions.length > 500) {
        return next(new AppError("Max 500 positions per batch", 400));
      }

      const vehicleIds = Array.from(new Set(positions.map((p: any) => p.vehicleId).filter(Boolean)));
      for (const vehicleId of vehicleIds) {
        const vehicle = await assertVehicleAccess(req, vehicleId, next);
        if (!vehicle) return;
      }

      const data = positions.map((p: any) => ({
        vehicleId: p.vehicleId,
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude ?? null,
        speed: p.speed ?? null,
        heading: p.heading ?? null,
        accuracy: p.accuracy ?? null,
        source: p.source || "DEVICE",
        recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
      }));

      const result = await prisma.gpsPosition.createMany({ data });

      res.status(201).json({ success: true, count: result.count });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/telemetry/gps/:vehicleId — get GPS history for a vehicle
router.get(
  "/gps/:vehicleId",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId } = req.params;
      const vehicle = await assertVehicleAccess(req, vehicleId, next);
      if (!vehicle) return;
      const hours = parseInt(String(req.query.hours || "24"), 10);
      const limit = Math.min(parseInt(String(req.query.limit || "500"), 10), 2000);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const positions = await prisma.gpsPosition.findMany({
        where: { vehicleId, recordedAt: { gte: since } },
        orderBy: { recordedAt: "desc" },
        take: limit,
      });

      res.json({ success: true, data: positions });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/telemetry/gps/latest/all — latest position for all vehicles
router.get(
  "/gps/latest/all",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter =
        req.user!.role !== "SUPER_ADMIN"
          ? { organizationId: req.user!.organizationId }
          : req.query.organizationId
            ? { organizationId: String(req.query.organizationId) }
            : {};

      const vehicles = await prisma.vehicle.findMany({
        where: { ...orgFilter, isActive: true },
        include: {
          employee: {
            select: { id: true, staffId: true, firstName: true, lastName: true },
          },
          gpsPositions: {
            orderBy: { recordedAt: "desc" },
            take: 1,
          },
        },
      });

      const data = vehicles
        .filter((v) => v.gpsPositions.length > 0)
        .map((v) => {
          const pos = v.gpsPositions[0];
          const minutesAgo = Math.floor(
            (Date.now() - new Date(pos.recordedAt).getTime()) / 60000
          );
          return {
            vehicleId: v.id,
            plateNumber: v.plateNumber,
            make: v.make,
            model: v.model,
            employee: v.employee,
            position: {
              latitude: pos.latitude,
              longitude: pos.longitude,
              speed: pos.speed,
              heading: pos.heading,
              accuracy: pos.accuracy,
              recordedAt: pos.recordedAt,
            },
            minutesAgo,
            status:
              minutesAgo <= 5
                ? "MOVING"
                : minutesAgo <= 30
                  ? "IDLE"
                  : minutesAgo <= 60 * 24
                    ? "PARKED"
                    : "OFFLINE",
          };
        });

      res.json({
        success: true,
        data,
        summary: {
          total: vehicles.length,
          tracked: data.length,
          moving: data.filter((d) => d.status === "MOVING").length,
          idle: data.filter((d) => d.status === "IDLE").length,
          parked: data.filter((d) => d.status === "PARKED").length,
          offline: data.filter((d) => d.status === "OFFLINE").length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Siphoning Alerts ───────────────────────────────────

// GET /api/telemetry/alerts/siphoning — list siphoning alerts
router.get(
  "/alerts/siphoning",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"), 10)));
      const skip = (page - 1) * limit;
      const requestedStatus = String(req.query.status || "").trim().toUpperCase();
      const statusFilter = Object.values(SiphoningAlertStatus).includes(requestedStatus as SiphoningAlertStatus)
        ? (requestedStatus as SiphoningAlertStatus)
        : undefined;

      const where = {
        ...(req.user!.role !== "SUPER_ADMIN" ? { organizationId: req.user!.organizationId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      };

      const [alerts, total, summary] = await Promise.all([
        prisma.siphoningAlert.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ createdAt: "desc" }],
          include: {
            employee: {
              select: { id: true, staffId: true, firstName: true, lastName: true, organization: { select: { name: true } } },
            },
            vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
            transaction: {
              select: { id: true, transactedAt: true, fuelType: true, amountLiters: true, amountNaira: true, station: { select: { name: true } } },
            },
            reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
        prisma.siphoningAlert.count({ where }),
        prisma.siphoningAlert.groupBy({
          by: ["status"],
          where: req.user!.role !== "SUPER_ADMIN" ? { organizationId: req.user!.organizationId } : {},
          _count: { _all: true },
        }),
      ]);

      res.json({
        success: true,
        data: alerts,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          statusSummary: summary.reduce<Record<string, number>>((acc, row) => {
            acc[row.status] = row._count._all;
            return acc;
          }, {}),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/telemetry/alerts/siphoning/:id/status — review/update status
router.patch(
  "/alerts/siphoning/:id/status",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(updateSiphoningAlertStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await prisma.siphoningAlert.findUnique({
        where: { id: req.params.id },
        select: { id: true, organizationId: true },
      });
      if (!alert) return next(new AppError("Siphoning alert not found", 404));
      if (req.user!.role !== "SUPER_ADMIN" && alert.organizationId !== req.user!.organizationId) {
        return next(new AppError("Insufficient permissions", 403));
      }

      const { status, reviewNote } = req.body;
      const reviewedStatuses: SiphoningAlertStatus[] = ["UNDER_REVIEW", "RESOLVED", "FALSE_POSITIVE"];
      const updated = await prisma.siphoningAlert.update({
        where: { id: alert.id },
        data: {
          status,
          reviewNote: reviewNote || null,
          reviewedByUserId: req.user!.userId,
          reviewedAt: reviewedStatuses.includes(status) ? new Date() : null,
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── OBD2 Endpoints ─────────────────────────────────────

// POST /api/telemetry/obd2 — submit OBD2 reading (from mobile app)
router.post(
  "/obd2",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        vehicleId,
        rpm,
        speed,
        throttlePosition,
        engineLoad,
        engineCoolantTemp,
        intakeAirTemp,
        fuelLevel,
        fuelPressure,
        fuelRate,
        maf,
        dtcCodes,
        milStatus,
        batteryVoltage,
        odometer,
        runTime,
        recordedAt,
      } = req.body;

      if (!vehicleId) return next(new AppError("vehicleId is required", 400));

      const vehicle = await assertVehicleAccess(req, vehicleId, next);
      if (!vehicle) return;

      const reading = await prisma.obd2Reading.create({
        data: {
          vehicleId,
          rpm: rpm ?? null,
          speed: speed ?? null,
          throttlePosition: throttlePosition ?? null,
          engineLoad: engineLoad ?? null,
          engineCoolantTemp: engineCoolantTemp ?? null,
          intakeAirTemp: intakeAirTemp ?? null,
          fuelLevel: fuelLevel ?? null,
          fuelPressure: fuelPressure ?? null,
          fuelRate: fuelRate ?? null,
          maf: maf ?? null,
          dtcCodes: Array.isArray(dtcCodes) ? dtcCodes : [],
          milStatus: milStatus ?? false,
          batteryVoltage: batteryVoltage ?? null,
          odometer: odometer ?? null,
          runTime: runTime ?? null,
          recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        },
      });

      try {
        await detectPotentialSiphoning({
          vehicleId: reading.vehicleId,
          fuelLevel: reading.fuelLevel,
          recordedAt: reading.recordedAt,
        });
      } catch {
        // Detection should not block telemetry ingestion.
      }

      res.status(201).json({ success: true, data: reading });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/telemetry/obd2/batch — submit multiple OBD2 readings
router.post(
  "/obd2/batch",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { readings } = req.body;
      if (!Array.isArray(readings) || readings.length === 0) {
        return next(new AppError("readings array is required", 400));
      }

      if (readings.length > 200) {
        return next(new AppError("Max 200 readings per batch", 400));
      }

      const vehicleIds = Array.from(new Set(readings.map((r: any) => r.vehicleId).filter(Boolean)));
      for (const vehicleId of vehicleIds) {
        const vehicle = await assertVehicleAccess(req, vehicleId, next);
        if (!vehicle) return;
      }

      const data = readings.map((r: any) => ({
        vehicleId: r.vehicleId,
        rpm: r.rpm ?? null,
        speed: r.speed ?? null,
        throttlePosition: r.throttlePosition ?? null,
        engineLoad: r.engineLoad ?? null,
        engineCoolantTemp: r.engineCoolantTemp ?? null,
        intakeAirTemp: r.intakeAirTemp ?? null,
        fuelLevel: r.fuelLevel ?? null,
        fuelPressure: r.fuelPressure ?? null,
        fuelRate: r.fuelRate ?? null,
        maf: r.maf ?? null,
        dtcCodes: Array.isArray(r.dtcCodes) ? r.dtcCodes : [],
        milStatus: r.milStatus ?? false,
        batteryVoltage: r.batteryVoltage ?? null,
        odometer: r.odometer ?? null,
        runTime: r.runTime ?? null,
        recordedAt: r.recordedAt ? new Date(r.recordedAt) : new Date(),
      }));

      const result = await prisma.obd2Reading.createMany({ data });
      for (const item of data) {
        if (item.fuelLevel == null) continue;
        try {
          await detectPotentialSiphoning({
            vehicleId: item.vehicleId,
            fuelLevel: item.fuelLevel,
            recordedAt: item.recordedAt,
          });
        } catch {
          // Detection should not block telemetry ingestion.
        }
      }
      res.status(201).json({ success: true, count: result.count });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/telemetry/obd2/:vehicleId — OBD2 history for a vehicle
router.get(
  "/obd2/:vehicleId",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehicleId } = req.params;
      const vehicle = await assertVehicleAccess(req, vehicleId, next);
      if (!vehicle) return;
      const hours = parseInt(String(req.query.hours || "24"), 10);
      const limit = Math.min(parseInt(String(req.query.limit || "100"), 10), 1000);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const readings = await prisma.obd2Reading.findMany({
        where: { vehicleId, recordedAt: { gte: since } },
        orderBy: { recordedAt: "desc" },
        take: limit,
      });

      res.json({ success: true, data: readings });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/telemetry/obd2/latest/all — latest OBD2 for all vehicles
router.get(
  "/obd2/latest/all",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter =
        req.user!.role !== "SUPER_ADMIN"
          ? { organizationId: req.user!.organizationId }
          : req.query.organizationId
            ? { organizationId: String(req.query.organizationId) }
            : {};

      const vehicles = await prisma.vehicle.findMany({
        where: { ...orgFilter, isActive: true },
        include: {
          employee: {
            select: { id: true, staffId: true, firstName: true, lastName: true },
          },
          obd2Readings: {
            orderBy: { recordedAt: "desc" },
            take: 1,
          },
        },
      });

      const data = vehicles
        .filter((v) => v.obd2Readings.length > 0)
        .map((v) => {
          const r = v.obd2Readings[0];
          const minutesAgo = Math.floor(
            (Date.now() - new Date(r.recordedAt).getTime()) / 60000
          );
          return {
            vehicleId: v.id,
            plateNumber: v.plateNumber,
            make: v.make,
            model: v.model,
            employee: v.employee,
            obd2DeviceId: v.obd2DeviceId,
            reading: {
              rpm: r.rpm,
              speed: r.speed,
              fuelLevel: r.fuelLevel,
              engineCoolantTemp: r.engineCoolantTemp,
              batteryVoltage: r.batteryVoltage,
              milStatus: r.milStatus,
              dtcCodes: r.dtcCodes,
              odometer: r.odometer,
              engineLoad: r.engineLoad,
              recordedAt: r.recordedAt,
            },
            minutesAgo,
            health: r.milStatus
              ? "WARNING"
              : r.dtcCodes.length > 0
                ? "CHECK"
                : "OK",
          };
        });

      const withDTC = data.filter((d) => d.reading.dtcCodes.length > 0);

      res.json({
        success: true,
        data,
        summary: {
          totalVehicles: vehicles.length,
          reporting: data.length,
          healthy: data.filter((d) => d.health === "OK").length,
          warning: data.filter((d) => d.health === "WARNING").length,
          check: data.filter((d) => d.health === "CHECK").length,
          vehiclesWithDTC: withDTC.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/telemetry/obd2/:vehicleId/dtc — Get DTC history for a vehicle
router.get(
  "/obd2/:vehicleId/dtc",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vehicle = await assertVehicleAccess(req, req.params.vehicleId, next);
      if (!vehicle) return;

      const readings = await prisma.obd2Reading.findMany({
        where: {
          vehicleId: req.params.vehicleId,
          NOT: { dtcCodes: { isEmpty: true } },
        },
        orderBy: { recordedAt: "desc" },
        take: 50,
        select: {
          id: true,
          dtcCodes: true,
          milStatus: true,
          recordedAt: true,
          odometer: true,
        },
      });

      res.json({ success: true, data: readings });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/telemetry/dashboard — Combined fleet telemetry overview
router.get(
  "/dashboard",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter =
        req.user!.role !== "SUPER_ADMIN"
          ? { organizationId: req.user!.organizationId }
          : req.query.organizationId
            ? { organizationId: String(req.query.organizationId) }
            : {};

      const [totalVehicles, activeVehicles, withOBD2, withGPS] =
        await Promise.all([
          prisma.vehicle.count({ where: orgFilter }),
          prisma.vehicle.count({ where: { ...orgFilter, isActive: true } }),
          prisma.vehicle.count({
            where: { ...orgFilter, NOT: { obd2DeviceId: null } },
          }),
          prisma.vehicle.count({
            where: { ...orgFilter, NOT: { gpsTrackerId: null } },
          }),
        ]);

      // Recent GPS activity (last 30 min)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentGps = await prisma.gpsPosition.count({
        where: {
          recordedAt: { gte: thirtyMinAgo },
          vehicle: orgFilter,
        },
      });

      // Recent OBD2 readings with issues
      const recentAlerts = await prisma.obd2Reading.findMany({
        where: {
          recordedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          vehicle: orgFilter,
          OR: [
            { milStatus: true },
            { NOT: { dtcCodes: { isEmpty: true } } },
          ],
        },
        orderBy: { recordedAt: "desc" },
        take: 20,
        include: {
          vehicle: {
            select: { id: true, plateNumber: true, make: true, model: true },
          },
        },
      });

      // Average fuel levels
      const latestFuelReadings = await prisma.$queryRaw<
        Array<{ vehicleId: string; fuelLevel: number }>
      >`
        SELECT DISTINCT ON (vehicle_id) vehicle_id as "vehicleId", fuel_level as "fuelLevel"
        FROM obd2_readings
        WHERE fuel_level IS NOT NULL
        ORDER BY vehicle_id, recorded_at DESC
      `;

      const avgFuelLevel =
        latestFuelReadings.length > 0
          ? latestFuelReadings.reduce((s, r) => s + r.fuelLevel, 0) /
            latestFuelReadings.length
          : null;

      res.json({
        success: true,
        data: {
          fleet: {
            total: totalVehicles,
            active: activeVehicles,
            withOBD2,
            withGPS,
          },
          gps: { recentPositions: recentGps },
          obd2: {
            recentAlerts: recentAlerts.length,
            alerts: recentAlerts.map((a) => ({
              vehicleId: a.vehicleId,
              vehicle: a.vehicle,
              milStatus: a.milStatus,
              dtcCodes: a.dtcCodes,
              recordedAt: a.recordedAt,
            })),
            avgFuelLevel,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
