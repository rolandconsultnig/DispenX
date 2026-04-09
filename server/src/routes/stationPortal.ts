import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { deductWithSourceSchema } from "../schemas";
import { Station, QuotaType, FuelType } from "@prisma/client";

const router = Router();

// ─── Station JWT helper ──────────────────────
interface StationPayload {
  stationId: string;
  stationName: string;
  type: "station";
}

function authenticateStationPortal(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as StationPayload;
    if (payload.type !== "station") {
      return next(new AppError("Invalid token type", 401));
    }
    (req as any).stationAuth = payload;
    next();
  } catch {
    return next(new AppError("Invalid or expired token", 401));
  }
}

// POST /api/station-portal/login — Station attendant login via API key
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) return next(new AppError("API key required", 401));

    const station = await prisma.station.findUnique({ where: { apiKey } });
    if (!station || !station.isActive) return next(new AppError("Invalid or inactive station", 401));

    const token = jwt.sign(
      { stationId: station.id, stationName: station.name, type: "station" } as StationPayload,
      config.jwtSecret,
      { expiresIn: "24h" as any }
    );

    res.json({
      success: true,
      data: {
        token,
        station: {
          id: station.id,
          name: station.name,
          location: station.location,
          address: station.address,
          pricePms: station.pricePms,
          priceAgo: station.priceAgo,
          priceCng: station.priceCng,
        },
      },
    });
  } catch (err) { next(err); }
});

// GET /api/station-portal/me — Current station info
router.get("/me", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: {
        id: true, name: true, location: true, address: true, phone: true,
        pricePms: true, priceAgo: true, priceCng: true, pumpPriceNairaPerLiter: true,
        isActive: true, createdAt: true,
      },
    });
    if (!station) return next(new AppError("Station not found", 404));
    res.json({ success: true, data: station });
  } catch (err) { next(err); }
});

// GET /api/station-portal/transactions — Station's transactions
router.get("/transactions", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"))));
    const skip = (page - 1) * limit;

    const where: any = { stationId };
    if (req.query.from || req.query.to) {
      where.transactedAt = {};
      if (req.query.from) where.transactedAt.gte = new Date(String(req.query.from));
      if (req.query.to) where.transactedAt.lte = new Date(String(req.query.to));
    }
    if (req.query.fuelType) where.fuelType = req.query.fuelType;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where, skip, take: limit,
        orderBy: { transactedAt: "desc" },
        include: {
          employee: { select: { firstName: true, lastName: true, staffId: true, organization: { select: { name: true } } } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ success: true, data: transactions, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/station-portal/dashboard — Station dashboard stats
router.get("/dashboard", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayCount, todayVolume,
      monthCount, monthVolume,
      totalCount,
      recentTransactions,
      settlements,
    ] = await Promise.all([
      prisma.transaction.count({ where: { stationId, transactedAt: { gte: todayStart } } }),
      prisma.transaction.aggregate({ where: { stationId, transactedAt: { gte: todayStart } }, _sum: { amountNaira: true, amountLiters: true } }),
      prisma.transaction.count({ where: { stationId, transactedAt: { gte: monthStart } } }),
      prisma.transaction.aggregate({ where: { stationId, transactedAt: { gte: monthStart } }, _sum: { amountNaira: true, amountLiters: true } }),
      prisma.transaction.count({ where: { stationId } }),
      prisma.transaction.findMany({
        where: { stationId }, take: 10, orderBy: { transactedAt: "desc" },
        include: { employee: { select: { firstName: true, lastName: true, staffId: true } } },
      }),
      prisma.settlement.findMany({
        where: { stationId }, take: 5, orderBy: { createdAt: "desc" },
        include: { organization: { select: { name: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        today: { count: todayCount, naira: todayVolume._sum.amountNaira || 0, liters: todayVolume._sum.amountLiters || 0 },
        month: { count: monthCount, naira: monthVolume._sum.amountNaira || 0, liters: monthVolume._sum.amountLiters || 0 },
        totalTransactions: totalCount,
        recentTransactions,
        recentSettlements: settlements,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/station-portal/settlements — Station's settlements
router.get("/settlements", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const settlements = await prisma.settlement.findMany({
      where: { stationId },
      orderBy: { createdAt: "desc" },
      include: { organization: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: settlements });
  } catch (err) { next(err); }
});

// POST /api/station-portal/validate-card — Look up employee card
router.post("/validate-card", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const { rfidUid, staffId } = req.body;
    if (!rfidUid && !staffId) return next(new AppError("Provide rfidUid or staffId", 400));

    const employee = await prisma.employee.findFirst({
      where: rfidUid ? { rfidUid } : { staffId },
      select: {
        id: true, firstName: true, lastName: true, staffId: true,
        quotaType: true, balanceLiters: true, balanceNaira: true,
        cardStatus: true, fuelType: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (!employee) return next(new AppError("Card/Employee not found", 404));

    // Check whitelist
    const whitelisted = await prisma.stationWhitelist.findFirst({
      where: { organizationId: employee.organization!.id, stationId },
    });

    res.json({
      success: true,
      data: { ...employee, whitelisted: !!whitelisted },
    });
  } catch (err) { next(err); }
});

export default router;
