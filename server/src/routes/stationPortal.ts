import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { litersFromNaira, nairaFromLiters, toLiters, toMoney } from "../lib/precision";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { deductWithSourceSchema, stationPortalAttendantLoginSchema } from "../schemas";
import { Station, QuotaType, FuelType } from "@prisma/client";

const router = Router();

function isUniqueConstraintError(err: any): boolean {
  return err?.code === "P2002";
}

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
interface StationPortalPayload {
  stationId: string;
  stationName: string;
  type: "station";
  attendantId?: string;
  attendantUsername?: string;
}

function authenticateStationPortal(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as StationPortalPayload;
    if (payload.type !== "station") {
      return next(new AppError("Invalid token type", 401));
    }
    (req as any).stationAuth = payload;
    next();
  } catch {
    return next(new AppError("Invalid or expired token", 401));
  }
}

// POST /api/station-portal/login — Station ID (AAA0000) + attendant username + password only
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = req.body || {};
    const body = { ...raw };
    if (!body.stationCode && typeof body.stationId === "string") {
      body.stationCode = body.stationId;
    }
    const attendantParsed = stationPortalAttendantLoginSchema.safeParse(body);

    if (!attendantParsed.success) {
      const fe = attendantParsed.error.flatten().fieldErrors;
      const msg =
        fe.stationCode?.[0] || fe.username?.[0] || fe.password?.[0] || "Station ID, username, and password are required";
      return next(new AppError(msg, 400));
    }

    const { stationCode, username, password } = attendantParsed.data;
    const station = await prisma.station.findFirst({
      where: { stationCode, isActive: true },
    });
    if (!station) return next(new AppError("Invalid station ID or station is inactive", 401));

    const attendant = await prisma.stationAttendant.findFirst({
      where: { stationId: station.id, username: username.trim(), isActive: true },
    });
    if (!attendant) return next(new AppError("Invalid username or password", 401));

    const ok = await bcrypt.compare(password, attendant.passwordHash);
    if (!ok) return next(new AppError("Invalid username or password", 401));

    const token = jwt.sign(
      {
        stationId: station.id,
        stationName: station.name,
        type: "station",
        attendantId: attendant.id,
        attendantUsername: attendant.username,
      } as StationPortalPayload,
      config.jwtSecret,
      { expiresIn: "24h" as any }
    );

    return res.json({
      success: true,
      data: {
        token,
        attendant: {
          id: attendant.id,
          username: attendant.username,
          displayName: attendant.displayName,
        },
        station: {
          id: station.id,
          stationCode: station.stationCode,
          name: station.name,
          location: station.location,
          address: station.address,
          pricePms: station.pricePms,
          priceAgo: station.priceAgo,
          priceCng: station.priceCng,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/station-portal/me — Current station info
router.get("/me", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: {
        id: true,
        stationCode: true,
        name: true,
        location: true,
        address: true,
        phone: true,
        pricePms: true,
        priceAgo: true,
        priceCng: true,
        pumpPriceNairaPerLiter: true,
        isActive: true,
        createdAt: true,
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

// GET /api/station-portal/insights/sales-by-fuel — Today & month volume/value by fuel type at this station
router.get("/insights/sales-by-fuel", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayGroups, monthGroups] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["fuelType"],
        where: { stationId, transactedAt: { gte: todayStart } },
        _sum: { amountNaira: true, amountLiters: true },
        _count: { _all: true },
      }),
      prisma.transaction.groupBy({
        by: ["fuelType"],
        where: { stationId, transactedAt: { gte: monthStart } },
        _sum: { amountNaira: true, amountLiters: true },
        _count: { _all: true },
      }),
    ]);

    res.json({ success: true, data: { today: todayGroups, month: monthGroups } });
  } catch (err) {
    next(err);
  }
});

// GET /api/station-portal/insights/organizations — Whitelisted orgs + credit limits + this station sales this month
router.get("/insights/organizations", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const entries = await prisma.stationWhitelist.findMany({
      where: { stationId },
      include: {
        organization: {
          select: { id: true, name: true, creditLimit: true, settlementCycleDays: true, phone: true, email: true },
        },
      },
    });

    const txs = await prisma.transaction.findMany({
      where: { stationId, transactedAt: { gte: monthStart } },
      select: {
        amountNaira: true,
        amountLiters: true,
        employee: { select: { organizationId: true } },
      },
    });

    const perOrg = new Map<string, { naira: number; liters: number; count: number }>();
    for (const t of txs) {
      const oid = t.employee.organizationId;
      const cur = perOrg.get(oid) || { naira: 0, liters: 0, count: 0 };
      cur.naira += t.amountNaira ?? 0;
      cur.liters += t.amountLiters ?? 0;
      cur.count += 1;
      perOrg.set(oid, cur);
    }

    res.json({
      success: true,
      data: entries.map((e) => ({
        organization: e.organization,
        salesThisMonthAtStation: perOrg.get(e.organizationId) || { naira: 0, liters: 0, count: 0 },
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/station-portal/insights/staff-quota — Staff from whitelisted orgs with quota / balance (allotment view)
router.get("/insights/staff-quota", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth;
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "30"))));
    const skip = (page - 1) * limit;

    const orgIds = (
      await prisma.stationWhitelist.findMany({
        where: { stationId },
        select: { organizationId: true },
      })
    ).map((r) => r.organizationId);

    if (orgIds.length === 0) {
      return res.json({ success: true, data: [], meta: { page, limit, total: 0, totalPages: 0 } });
    }

    const where = { organizationId: { in: orgIds } };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ organizationId: "asc" }, { staffId: "asc" }],
        select: {
          id: true,
          staffId: true,
          firstName: true,
          lastName: true,
          quotaType: true,
          quotaLiters: true,
          quotaNaira: true,
          balanceLiters: true,
          balanceNaira: true,
          fuelType: true,
          cardStatus: true,
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({
      success: true,
      data: employees,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
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

// GET /api/station-portal/token-info/:token — Public lookup for QR confirm page
router.get("/token-info/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    if (!token) return next(new AppError("Token is required", 400));

    const qrToken = await prisma.qrToken.findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            firstName: true, lastName: true, staffId: true,
            quotaType: true, fuelType: true,
            organization: { select: { name: true } },
          },
        },
      },
    });

    if (!qrToken) return next(new AppError("Invalid QR code", 404));
    if (qrToken.used) return next(new AppError("QR code already used", 400));
    if (new Date() > qrToken.expiresAt) return next(new AppError("QR code expired", 400));

    res.json({
      success: true,
      data: {
        employee: {
          firstName: qrToken.employee.firstName,
          lastName: qrToken.employee.lastName,
          staffId: qrToken.employee.staffId,
          organization: qrToken.employee.organization?.name,
          quotaType: qrToken.employee.quotaType,
        },
        amountNaira: qrToken.amountNaira,
        amountLiters: qrToken.amountLiters,
        fuelType: qrToken.fuelType || qrToken.employee.fuelType || "PMS",
        expiresAt: qrToken.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/station-portal/scan-qr — attendant scans staff QR token
router.post("/scan-qr", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth as StationPortalPayload;
    const qrInput = String(req.body.qrData || req.body.token || "").trim();
    if (!qrInput) return next(new AppError("QR data is required", 400));

    let token = qrInput;

    // QR may be a URL like .../confirm?token=xxx, JSON payload, or raw token
    try {
      const url = new URL(qrInput);
      const urlToken = url.searchParams.get("token");
      if (urlToken) token = urlToken;
    } catch {
      // not a URL, try JSON
      try {
        const parsed = JSON.parse(qrInput);
        token = parsed.t || parsed.token || token;
      } catch {
        // raw token — keep as-is
      }
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
        amountNaira: qrToken.amountNaira,
        amountLiters: qrToken.amountLiters,
        fuelType: qrToken.fuelType || qrToken.employee.fuelType || "PMS",
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/station-portal/dispense — confirm and complete fuel sale from QR scan
router.post("/dispense", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth as StationPortalPayload;
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

    let finalAmountNaira = toMoney(Number(amountNaira || 0));
    let finalAmountLiters = toLiters(Number(amountLiters || 0));

    if (employee.quotaType === QuotaType.LITERS) {
      if (!finalAmountLiters || finalAmountLiters <= 0) {
        return next(new AppError("Enter liters to dispense", 400));
      }
      finalAmountNaira = nairaFromLiters(finalAmountLiters, pumpPrice);
      if (finalAmountLiters > employee.balanceLiters) {
        return next(new AppError(`Insufficient balance. Available: ${employee.balanceLiters}L`, 400));
      }
    } else {
      if (!finalAmountNaira || finalAmountNaira <= 0) {
        return next(new AppError("Enter amount in naira to dispense", 400));
      }
      finalAmountLiters = litersFromNaira(finalAmountNaira, pumpPrice);
      if (finalAmountNaira > employee.balanceNaira) {
        return next(new AppError(`Insufficient balance. Available: ₦${employee.balanceNaira.toLocaleString()}`, 400));
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const consumed = await tx.qrToken.updateMany({
        where: { id: qrToken.id, used: false },
        data: { used: true, usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new AppError("QR code already used", 400);
      }

      const created = await tx.transaction.create({
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
      });

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          balanceLiters: { decrement: employee.quotaType === QuotaType.LITERS ? finalAmountLiters : 0 },
          balanceNaira: { decrement: employee.quotaType === QuotaType.NAIRA ? finalAmountNaira : 0 },
        },
      });

      return created;
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (err: any) {
    if (isUniqueConstraintError(err)) {
      const duplicate = await prisma.transaction.findUnique({ where: { idempotencyKey: String(req.body?.idempotencyKey || "") } });
      if (duplicate) {
        return res.json({ success: true, message: "Duplicate transaction (idempotent)", data: duplicate });
      }
    }
    next(err);
  }
});

// POST /api/station-portal/confirm-dispense — staff confirms with PIN on attendant device
router.post("/confirm-dispense", authenticateStationPortal, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stationId } = (req as any).stationAuth as StationPortalPayload;
    const { token, pin } = req.body || {};

    if (!token) return next(new AppError("QR token is required", 400));
    if (!pin) return next(new AppError("Staff PIN is required", 400));

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
    if (!employee.pin) return next(new AppError("Employee PIN not set", 400));

    // Verify staff PIN
    const pinValid = await bcrypt.compare(String(pin), employee.pin);
    if (!pinValid) return next(new AppError("Invalid PIN", 403));

    // Whitelist check
    const whitelisted = await prisma.stationWhitelist.findFirst({
      where: { organizationId: employee.organizationId, stationId: station.id },
    });
    if (!whitelisted) return next(new AppError("Employee not authorized at this station", 403));

    // Use amount + fuelType stored in the QR token
    const fuelType: FuelType = (qrToken.fuelType as FuelType) || (employee.fuelType as FuelType) || "PMS";
    const pumpPrice = getFuelPrice(station, fuelType);

    let finalAmountNaira = 0;
    let finalAmountLiters = 0;
    if (employee.quotaType === QuotaType.LITERS) {
      finalAmountLiters = toLiters(Number(qrToken.amountLiters || 0));
      if (finalAmountLiters <= 0) return next(new AppError("No liters amount specified in QR code", 400));
      finalAmountNaira = nairaFromLiters(finalAmountLiters, pumpPrice);
      if (finalAmountLiters > employee.balanceLiters) {
        return next(new AppError(`Insufficient balance. Available: ${employee.balanceLiters}L`, 400));
      }
    } else {
      finalAmountNaira = toMoney(Number(qrToken.amountNaira || 0));
      if (finalAmountNaira <= 0) return next(new AppError("No amount specified in QR code", 400));
      finalAmountLiters = litersFromNaira(finalAmountNaira, pumpPrice);
      if (finalAmountNaira > employee.balanceNaira) {
        return next(new AppError(`Insufficient balance. Available: ₦${employee.balanceNaira.toLocaleString()}`, 400));
      }
    }

    const idempotencyKey = `qr-confirm-${qrToken.id}`;
    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return res.json({ success: true, message: "Already confirmed", data: existing });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const consumed = await tx.qrToken.updateMany({
        where: { id: qrToken.id, used: false },
        data: { used: true, usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new AppError("QR code already used", 400);
      }

      const created = await tx.transaction.create({
        data: {
          idempotencyKey,
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
      });

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          balanceLiters: { decrement: employee.quotaType === QuotaType.LITERS ? finalAmountLiters : 0 },
          balanceNaira: { decrement: employee.quotaType === QuotaType.NAIRA ? finalAmountNaira : 0 },
        },
      });

      return created;
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (err: any) {
    next(err);
  }
});

export default router;
