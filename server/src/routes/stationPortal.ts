import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { deductWithSourceSchema } from "../schemas";
import { Station, QuotaType, FuelType } from "@prisma/client";

const router = Router();

function getFuelPrice(station: Station, fuelType: FuelType): number {
  switch (fuelType) {
    case "AGO":
      return station.priceAgo;
    case "CNG":
      return station.priceCng;
    case "PMS":
    default:
      return station.pricePms;
  }
}

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

// POST /api/station-portal/scan-qr — attendant scans staff QR token
router.post("/scan-qr", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth as StationPayload;
    const qrInput = String(req.body.qrData || req.body.token || "").trim();
    if (!qrInput) return next(new AppError("QR data is required", 400));

    let token = qrInput;
    let requestedNaira: number | undefined;
    let requestedLiters: number | undefined;
    let requestedFuelType: FuelType | undefined;

    // QR may come as JSON payload from staff app; fallback to raw token.
    try {
      const parsed = JSON.parse(qrInput);
      token = parsed.t || parsed.token || token;
      if (parsed.n !== undefined) requestedNaira = Number(parsed.n) || 0;
      if (parsed.l !== undefined) requestedLiters = Number(parsed.l) || 0;
      if (parsed.f && ["PMS", "AGO", "CNG"].includes(parsed.f)) requestedFuelType = parsed.f as FuelType;
    } catch {
      // keep raw token flow
    }

    const qrToken = await prisma.qrToken.findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, staffId: true,
            quotaType: true, quotaNaira: true, quotaLiters: true,
            balanceNaira: true, balanceLiters: true,
            cardStatus: true, fuelType: true, organizationId: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!qrToken) return next(new AppError("Invalid QR code", 404));
    if (qrToken.used) return next(new AppError("QR code already used", 400));
    if (new Date() > qrToken.expiresAt) return next(new AppError("QR code expired", 400));
    if (qrToken.employee.cardStatus !== "ACTIVE") {
      return next(new AppError(`Card is ${qrToken.employee.cardStatus}`, 403));
    }

    const whitelisted = await prisma.stationWhitelist.findFirst({
      where: { organizationId: qrToken.employee.organizationId, stationId },
    });
    if (!whitelisted) return next(new AppError("Employee not authorized at this station", 403));

    res.json({
      success: true,
      data: {
        token,
        employee: qrToken.employee,
        expiresAt: qrToken.expiresAt,
        recommended: {
          amountNaira: requestedNaira || 0,
          amountLiters: requestedLiters || 0,
          fuelType: requestedFuelType || qrToken.employee.fuelType || "PMS",
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/station-portal/dispense — confirm and complete fuel sale from QR scan
router.post("/dispense", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth as StationPayload;
    const { token, amountNaira, amountLiters, fuelType: reqFuelType, idempotencyKey } = req.body || {};

    if (!token) return next(new AppError("QR token is required", 400));
    if (!idempotencyKey) return next(new AppError("idempotencyKey is required", 400));

    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return res.json({ success: true, message: "Duplicate transaction (idempotent)", data: existing });
    }

    const station = await prisma.station.findUnique({ where: { id: stationId } });
    if (!station || !station.isActive) return next(new AppError("Invalid or inactive station", 401));

    const qrToken = await prisma.qrToken.findUnique({
      where: { token: String(token) },
      include: { employee: true },
    });
    if (!qrToken) return next(new AppError("Invalid QR code", 404));
    if (qrToken.used) return next(new AppError("QR code already used", 400));
    if (new Date() > qrToken.expiresAt) return next(new AppError("QR code expired", 400));

    const employee = qrToken.employee;
    if (employee.cardStatus !== "ACTIVE") return next(new AppError(`Card is ${employee.cardStatus}`, 403));

    const whitelisted = await prisma.stationWhitelist.findFirst({
      where: { organizationId: employee.organizationId, stationId: station.id },
    });
    if (!whitelisted) return next(new AppError("Employee not authorized at this station", 403));

    const fuelType: FuelType = ["PMS", "AGO", "CNG"].includes(reqFuelType) ? reqFuelType : (employee.fuelType as FuelType || "PMS");
    const pumpPrice = getFuelPrice(station, fuelType);

    let finalAmountNaira = Number(amountNaira || 0);
    let finalAmountLiters = Number(amountLiters || 0);

    if (employee.quotaType === QuotaType.LITERS) {
      if (!finalAmountLiters || finalAmountLiters <= 0) {
        return next(new AppError("Enter liters to dispense", 400));
      }
      finalAmountNaira = finalAmountLiters * pumpPrice;
      if (finalAmountLiters > employee.balanceLiters) {
        return next(new AppError(`Insufficient balance. Available: ${employee.balanceLiters}L`, 400));
      }
    } else {
      if (!finalAmountNaira || finalAmountNaira <= 0) {
        return next(new AppError("Enter amount in naira to dispense", 400));
      }
      finalAmountLiters = finalAmountNaira / pumpPrice;
      if (finalAmountNaira > employee.balanceNaira) {
        return next(new AppError(`Insufficient balance. Available: ₦${employee.balanceNaira.toLocaleString()}`, 400));
      }
    }

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          idempotencyKey: String(idempotencyKey),
          employeeId: employee.id,
          stationId: station.id,
          amountLiters: finalAmountLiters,
          amountNaira: finalAmountNaira,
          pumpPriceAtTime: pumpPrice,
          quotaType: employee.quotaType,
          fuelType,
          source: "QR_CODE",
          syncStatus: "SYNCED",
          transactedAt: new Date(),
          syncedAt: new Date(),
        },
      }),
      prisma.employee.update({
        where: { id: employee.id },
        data: {
          balanceLiters: { decrement: employee.quotaType === QuotaType.LITERS ? finalAmountLiters : 0 },
          balanceNaira: { decrement: employee.quotaType === QuotaType.NAIRA ? finalAmountNaira : 0 },
        },
      }),
      prisma.qrToken.update({
        where: { id: qrToken.id },
        data: { used: true, usedAt: new Date() },
      }),
    ]);

    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    next(err);
  }
});

export default router;
