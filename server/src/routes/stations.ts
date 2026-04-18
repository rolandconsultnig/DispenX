import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createStationSchema,
  updateStationSchema,
  updatePumpPriceSchema,
  whitelistSchema,
  createStationAttendantSchema,
  updateStationAttendantSchema,
} from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /api/stations
router.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [stations, txnCounts] = await Promise.all([
      prisma.station.findMany({ orderBy: { name: "asc" } }),
      prisma.transaction.groupBy({
        by: ["stationId"],
        _count: { _all: true },
      }),
    ]);
    const countByStation = Object.fromEntries(txnCounts.map((c) => [c.stationId, c._count._all]));
    const data = stations.map((s) => ({
      ...s,
      _count: { transactions: countByStation[s.id] ?? 0 },
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/stations/:id
router.get("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const station = await prisma.station.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { transactions: true, settlements: true } },
        whitelist: { include: { organization: { select: { id: true, name: true } } } },
      },
    });
    if (!station) return next(new AppError("Station not found", 404));
    res.json({ success: true, data: station });
  } catch (err) {
    next(err);
  }
});

// POST /api/stations
router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  validate(createStationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = `cfms_${uuidv4().replace(/-/g, "")}`;
      const b = req.body as any;
      const stationCode = String(b.stationCode || "")
        .trim()
        .toUpperCase();
      const station = await prisma.station.create({
        data: {
          name: b.name,
          stationCode,
          location: b.location ?? undefined,
          address: b.address ?? undefined,
          phone: b.phone ?? undefined,
          pumpPriceNairaPerLiter: b.pumpPriceNairaPerLiter,
          pricePms: b.pricePms,
          priceAgo: b.priceAgo,
          priceCng: b.priceCng,
          apiKey,
        },
      });
      res.status(201).json({ success: true, data: station });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return next(new AppError("Station code or API key already exists", 409));
      }
      next(err);
    }
  }
);

// PUT /api/stations/:id
router.put(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  validate(updateStationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...(req.body as Record<string, unknown>) };
      if (typeof body.stationCode === "string") {
        body.stationCode = body.stationCode.trim().toUpperCase();
      }
      const station = await prisma.station.update({
        where: { id: req.params.id },
        data: body as any,
      });
      res.json({ success: true, data: station });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return next(new AppError("Station code already in use", 409));
      }
      next(err);
    }
  }
);

// ─── Station attendants (portal login) ───────────────────
router.get(
  "/:id/attendants",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.stationAttendant.findMany({
        where: { stationId: req.params.id },
        select: {
          id: true,
          username: true,
          displayName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { username: "asc" },
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/attendants",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  validate(createStationAttendantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const station = await prisma.station.findUnique({ where: { id: req.params.id } });
      if (!station) return next(new AppError("Station not found", 404));
      const passwordHash = await bcrypt.hash(req.body.password, 10);
      const row = await prisma.stationAttendant.create({
        data: {
          stationId: req.params.id,
          username: String(req.body.username).trim(),
          passwordHash,
          displayName: req.body.displayName?.trim() || null,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          isActive: true,
          createdAt: true,
        },
      });
      res.status(201).json({ success: true, data: row });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return next(new AppError("Username already exists for this station", 409));
      }
      next(err);
    }
  }
);

router.patch(
  "/:id/attendants/:attendantId",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  validate(updateStationAttendantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.stationAttendant.findFirst({
        where: { id: req.params.attendantId, stationId: req.params.id },
      });
      if (!existing) return next(new AppError("Attendant not found", 404));
      const data: any = {};
      if (req.body.password) data.passwordHash = await bcrypt.hash(req.body.password, 10);
      if (req.body.displayName !== undefined) data.displayName = req.body.displayName?.trim() || null;
      if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
      const row = await prisma.stationAttendant.update({
        where: { id: existing.id },
        data,
        select: { id: true, username: true, displayName: true, isActive: true, updatedAt: true },
      });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id/attendants/:attendantId",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.stationAttendant.findFirst({
        where: { id: req.params.attendantId, stationId: req.params.id },
      });
      if (!existing) return next(new AppError("Attendant not found", 404));
      await prisma.stationAttendant.delete({ where: { id: existing.id } });
      res.json({ success: true, message: "Attendant removed" });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/stations/:id/pump-price
router.patch(
  "/:id/pump-price",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  validate(updatePumpPriceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data: any = {};
      if (req.body.pumpPriceNairaPerLiter !== undefined) data.pumpPriceNairaPerLiter = req.body.pumpPriceNairaPerLiter;
      if (req.body.pricePms !== undefined) data.pricePms = req.body.pricePms;
      if (req.body.priceAgo !== undefined) data.priceAgo = req.body.priceAgo;
      if (req.body.priceCng !== undefined) data.priceCng = req.body.priceCng;

      const station = await prisma.station.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ success: true, data: station });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/stations/:id/regenerate-key
router.post(
  "/:id/regenerate-key",
  authenticate,
  authorize("SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = `cfms_${uuidv4().replace(/-/g, "")}`;
      const station = await prisma.station.update({
        where: { id: req.params.id },
        data: { apiKey },
      });
      res.json({ success: true, data: { id: station.id, apiKey: station.apiKey } });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/stations/:id
router.delete(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.station.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: "Station deleted" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Station Whitelist ───────────────────────
// POST /api/stations/whitelist
router.post(
  "/whitelist",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  validate(whitelistSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await prisma.stationWhitelist.create({ data: req.body });
      res.status(201).json({ success: true, data: entry });
    } catch (err: any) {
      if (err.code === "P2002") {
        return next(new AppError("Station already whitelisted for this organization", 409));
      }
      next(err);
    }
  }
);

// DELETE /api/stations/whitelist/:id
router.delete(
  "/whitelist/:id",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.stationWhitelist.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: "Whitelist entry removed" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
