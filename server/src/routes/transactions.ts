import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { authenticateStation } from "../middleware/stationAuth";
import { validate } from "../middleware/validate";
import { deductSchema, batchSyncSchema, deductWithSourceSchema, validateQrSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";
import { Station, QuotaType, FuelType } from "@prisma/client";

const router = Router();

/**
 * Get the pump price for a specific fuel type at a station.
 */
function getFuelPrice(station: Station, fuelType: FuelType): number {
  switch (fuelType) {
    case "PMS": return station.pricePms;
    case "AGO": return station.priceAgo;
    case "CNG": return station.priceCng;
    default: return station.pricePms;
  }
}

/**
 * Core deduction logic shared by online and batch sync.
 */
async function processDeduction(
  txData: {
    rfidUid: string;
    idempotencyKey: string;
    amountLiters?: number;
    amountNaira?: number;
    fuelType?: FuelType;
    posSerial?: string;
    hmacSignature?: string;
    transactedAt?: string;
    pin?: string;
  },
  station: Station
) {
  // Idempotency check
  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey: txData.idempotencyKey },
  });
  if (existing) {
    return { skipped: true, transaction: existing };
  }

  // Find employee by RFID
  const employee = await prisma.employee.findUnique({ where: { rfidUid: txData.rfidUid } });
  if (!employee) throw new AppError("Card not found", 404);
  if (employee.cardStatus !== "ACTIVE") throw new AppError(`Card is ${employee.cardStatus}`, 403);

  // Station whitelist check
  const whitelisted = await prisma.stationWhitelist.findFirst({
    where: { organizationId: employee.organizationId, stationId: station.id },
  });
  if (!whitelisted) throw new AppError("Card not authorized at this station", 403);

  // PIN verification for large deductions (>50L or >₦50,000)
  const isLargeDeduction =
    (txData.amountLiters && txData.amountLiters > 50) ||
    (txData.amountNaira && txData.amountNaira > 50000);
  if (isLargeDeduction && employee.pin) {
    if (!txData.pin) throw new AppError("PIN required for large deductions", 403);
    const pinValid = await bcrypt.compare(txData.pin, employee.pin);
    if (!pinValid) throw new AppError("Invalid PIN", 403);
  }

  // Calculate amounts based on quota type
  const fuelType = txData.fuelType || "PMS";
  const pumpPrice = getFuelPrice(station, fuelType as FuelType);
  let amountLiters: number;
  let amountNaira: number;

  if (employee.quotaType === QuotaType.LITERS) {
    amountLiters = txData.amountLiters || 0;
    amountNaira = amountLiters * pumpPrice;
    if (amountLiters > employee.balanceLiters) {
      throw new AppError(`Insufficient balance. Available: ${employee.balanceLiters}L`, 400);
    }
  } else {
    // NAIRA mode
    amountNaira = txData.amountNaira || 0;
    amountLiters = amountNaira / pumpPrice;
    if (amountNaira > employee.balanceNaira) {
      throw new AppError(`Insufficient balance. Available: ₦${employee.balanceNaira.toLocaleString()}`, 400);
    }
  }

  if (amountLiters <= 0 && amountNaira <= 0) {
    throw new AppError("Deduction amount must be positive", 400);
  }

  // Atomically deduct balance and create transaction
  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        idempotencyKey: txData.idempotencyKey,
        employeeId: employee.id,
        stationId: station.id,
        amountLiters,
        amountNaira,
        pumpPriceAtTime: pumpPrice,
        quotaType: employee.quotaType,
        fuelType: fuelType as any,
        posSerial: txData.posSerial,
        hmacSignature: txData.hmacSignature,
        source: (txData as any).source || "RFID",
        syncStatus: txData.transactedAt ? "SYNCED" : "SYNCED",
        transactedAt: txData.transactedAt ? new Date(txData.transactedAt) : new Date(),
        syncedAt: new Date(),
      },
    }),
    prisma.employee.update({
      where: { id: employee.id },
      data: {
        balanceLiters: { decrement: employee.quotaType === QuotaType.LITERS ? amountLiters : 0 },
        balanceNaira: { decrement: employee.quotaType === QuotaType.NAIRA ? amountNaira : 0 },
      },
    }),
  ]);

  return { skipped: false, transaction };
}

// GET /api/card/balance/:rfidUid — POS real-time balance check
router.get(
  "/card/balance/:rfidUid",
  authenticateStation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const employee = await prisma.employee.findUnique({
        where: { rfidUid: req.params.rfidUid },
        select: {
          id: true, firstName: true, lastName: true, staffId: true,
          quotaType: true, balanceLiters: true, balanceNaira: true,
          cardStatus: true, organization: { select: { name: true } },
        },
      });
      if (!employee) return next(new AppError("Card not found", 404));
      res.json({ success: true, data: employee });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transaction/deduct — Single online deduction from POS (RFID)
router.post(
  "/transaction/deduct",
  authenticateStation,
  validate(deductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const station = (req as any).station as Station;
      const result = await processDeduction(req.body, station);

      if (result.skipped) {
        return res.json({ success: true, message: "Duplicate transaction (idempotent)", data: result.transaction });
      }

      res.status(201).json({ success: true, data: result.transaction });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transaction/deduct-qr — Deduction via QR code from staff app
router.post(
  "/transaction/deduct-qr",
  authenticateStation,
  validate(deductWithSourceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const station = (req as any).station as Station;
      const { qrToken, qrPin, amountLiters, amountNaira, idempotencyKey, posSerial, fuelType: reqFuelType } = req.body;
      const fuelType = reqFuelType || "PMS";

      // Validate QR token
      const tokenRecord = await prisma.qrToken.findUnique({ where: { token: qrToken } });
      if (!tokenRecord) return next(new AppError("Invalid QR code", 400));
      if (tokenRecord.used) return next(new AppError("QR code already used", 400));
      if (new Date() > tokenRecord.expiresAt) return next(new AppError("QR code expired", 400));

      // Verify PIN against token
      const pinValid = await bcrypt.compare(qrPin, tokenRecord.pin);
      if (!pinValid) return next(new AppError("Invalid PIN", 403));

      // Mark QR token as used
      await prisma.qrToken.update({ where: { id: tokenRecord.id }, data: { used: true, usedAt: new Date() } });

      // Resolve employee by QR token
      const employee = await prisma.employee.findUnique({ where: { id: tokenRecord.employeeId } });
      if (!employee) return next(new AppError("Employee not found", 404));
      if (employee.cardStatus !== "ACTIVE") return next(new AppError(`Card is ${employee.cardStatus}`, 403));

      // Station whitelist check
      const whitelisted = await prisma.stationWhitelist.findFirst({
        where: { organizationId: employee.organizationId, stationId: station.id },
      });
      if (!whitelisted) return next(new AppError("Card not authorized at this station", 403));

      // Calculate amounts
      const pumpPrice = getFuelPrice(station, fuelType as FuelType);
      let finalLiters: number;
      let finalNaira: number;

      if (employee.quotaType === "LITERS") {
        finalLiters = amountLiters || 0;
        finalNaira = finalLiters * pumpPrice;
        if (finalLiters > employee.balanceLiters) return next(new AppError(`Insufficient balance. Available: ${employee.balanceLiters}L`, 400));
      } else {
        finalNaira = amountNaira || 0;
        finalLiters = finalNaira / pumpPrice;
        if (finalNaira > employee.balanceNaira) return next(new AppError(`Insufficient balance. Available: ₦${employee.balanceNaira}`, 400));
      }

      if (finalLiters <= 0 && finalNaira <= 0) return next(new AppError("Deduction amount must be positive", 400));

      // Idempotency check
      const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
      if (existing) return res.json({ success: true, message: "Duplicate transaction (idempotent)", data: existing });

      // Atomically deduct and create transaction
      const [transaction] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            idempotencyKey,
            employeeId: employee.id,
            stationId: station.id,
            amountLiters: finalLiters,
            amountNaira: finalNaira,
            pumpPriceAtTime: pumpPrice,
            quotaType: employee.quotaType,
            fuelType: fuelType as any,
            source: "QR_CODE",
            posSerial: posSerial || null,
            syncStatus: "SYNCED",
            transactedAt: new Date(),
            syncedAt: new Date(),
          },
        }),
        prisma.employee.update({
          where: { id: employee.id },
          data: {
            balanceLiters: { decrement: employee.quotaType === "LITERS" ? finalLiters : 0 },
            balanceNaira: { decrement: employee.quotaType === "NAIRA" ? finalNaira : 0 },
          },
        }),
      ]);

      res.status(201).json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transaction/sync/batch — Upload offline transactions
router.post(
  "/transaction/sync/batch",
  authenticateStation,
  validate(batchSyncSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const station = (req as any).station as Station;
      const results: Array<{ idempotencyKey: string; status: string; error?: string }> = [];

      for (const txData of req.body.transactions) {
        try {
          const result = await processDeduction(txData, station);
          results.push({
            idempotencyKey: txData.idempotencyKey,
            status: result.skipped ? "skipped_duplicate" : "success",
          });
        } catch (err: any) {
          results.push({
            idempotencyKey: txData.idempotencyKey,
            status: "error",
            error: err.message || "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.status === "success").length;
      const skippedCount = results.filter((r) => r.status === "skipped_duplicate").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      res.json({
        success: true,
        data: { total: results.length, successCount, skippedCount, errorCount, details: results },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/transactions — Admin view transactions
router.get(
  "/transactions",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const where: any = {};
      if (req.query.stationId) where.stationId = req.query.stationId;
      if (req.query.employeeId) where.employeeId = req.query.employeeId;
      if (req.query.from || req.query.to) {
        where.transactedAt = {};
        if (req.query.from) where.transactedAt.gte = new Date(String(req.query.from));
        if (req.query.to) where.transactedAt.lte = new Date(String(req.query.to));
      }

      // Scope to org for non-super-admins
      if (req.user!.role !== "SUPER_ADMIN") {
        where.employee = { organizationId: req.user!.organizationId };
      }

      const page = Math.max(1, parseInt(String(req.query.page || "1")));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"))));
      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { transactedAt: "desc" },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, staffId: true } },
            station: { select: { id: true, name: true } },
          },
        }),
        prisma.transaction.count({ where }),
      ]);

      res.json({
        success: true,
        data: transactions,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
