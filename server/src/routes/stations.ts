import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createStationSchema, updateStationSchema, updatePumpPriceSchema, whitelistSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /api/stations
router.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stations = await prisma.station.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { transactions: true } } },
    });
    res.json({ success: true, data: stations });
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
      const station = await prisma.station.create({
        data: { ...req.body, apiKey },
      });
      res.status(201).json({ success: true, data: station });
    } catch (err) {
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
      const station = await prisma.station.update({
        where: { id: req.params.id },
        data: req.body,
      });
      res.json({ success: true, data: station });
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
