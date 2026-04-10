import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { toLiters, toMoney } from "../lib/precision";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateSettlementStatusSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /api/settlements — List settlements
router.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user!.role !== "SUPER_ADMIN") {
      where.organizationId = req.user!.organizationId;
    }
    if (req.query.stationId) where.stationId = req.query.stationId;
    if (req.query.status) where.status = req.query.status;

    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"))));
    const skip = (page - 1) * limit;

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { periodEnd: "desc" },
        include: {
          station: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.settlement.count({ where }),
    ]);

    res.json({
      success: true,
      data: settlements,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/settlements/monthly/:stationId — Monthly summary for a station
router.get(
  "/monthly/:stationId",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stationId } = req.params;
      const year = parseInt(String(req.query.year || new Date().getFullYear()));
      const month = parseInt(String(req.query.month || new Date().getMonth() + 1));

      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

      // Aggregate transactions
      const aggregation = await prisma.transaction.aggregate({
        where: {
          stationId,
          transactedAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amountLiters: true, amountNaira: true },
        _count: true,
      });

      // Get per-employee breakdown
      const breakdown = await prisma.transaction.groupBy({
        by: ["employeeId"],
        where: {
          stationId,
          transactedAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amountLiters: true, amountNaira: true },
        _count: true,
      });

      res.json({
        success: true,
        data: {
          stationId,
          period: { year, month, start: periodStart, end: periodEnd },
          totals: {
            liters: toLiters(aggregation._sum.amountLiters || 0),
            naira: toMoney(aggregation._sum.amountNaira || 0),
            transactionCount: aggregation._count,
          },
          employeeBreakdown: breakdown,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/settlements/generate — Generate settlement for last month
router.post(
  "/generate",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.role === "SUPER_ADMIN" && req.body.organizationId
        ? req.body.organizationId
        : req.user!.organizationId;

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // Get all stations with transactions in this period for this org
      const stationTransactions = await prisma.transaction.groupBy({
        by: ["stationId"],
        where: {
          employee: { organizationId: orgId },
          transactedAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amountLiters: true, amountNaira: true },
        _count: true,
      });

      const settlements = [];
      for (const st of stationTransactions) {
        // Upsert to avoid duplicates
        const settlement = await prisma.settlement.upsert({
          where: {
            stationId_organizationId_periodStart_periodEnd: {
              stationId: st.stationId,
              organizationId: orgId,
              periodStart,
              periodEnd,
            },
          },
          update: {
            totalLiters: toLiters(st._sum.amountLiters || 0),
            totalNairaDeducted: toMoney(st._sum.amountNaira || 0),
            transactionCount: st._count,
          },
          create: {
            stationId: st.stationId,
            organizationId: orgId,
            periodStart,
            periodEnd,
            totalLiters: toLiters(st._sum.amountLiters || 0),
            totalNairaDeducted: toMoney(st._sum.amountNaira || 0),
            transactionCount: st._count,
            status: "PENDING",
          },
        });
        settlements.push(settlement);
      }

      res.json({
        success: true,
        data: { count: settlements.length, settlements },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/settlements/:id/status — Update settlement status (mark paid, etc.)
router.patch(
  "/:id/status",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE"),
  validate(updateSettlementStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, notes } = req.body;
      const updateData: any = { status, notes };
      if (status === "SETTLED") {
        updateData.paidAt = new Date();
      }
      const settlement = await prisma.settlement.update({
        where: { id: req.params.id },
        data: updateData,
      });
      res.json({ success: true, data: settlement });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/settlements/:id — Get single settlement detail
router.get("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settlement = await prisma.settlement.findUnique({
      where: { id: req.params.id },
      include: {
        station: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (!settlement) return next(new AppError("Settlement not found", 404));

    // Get transaction details for this settlement period
    const transactions = await prisma.transaction.findMany({
      where: {
        stationId: settlement.stationId,
        employee: { organizationId: settlement.organizationId },
        transactedAt: { gte: settlement.periodStart, lte: settlement.periodEnd },
      },
      include: {
        employee: { select: { firstName: true, lastName: true, staffId: true } },
      },
      orderBy: { transactedAt: "asc" },
    });

    res.json({ success: true, data: { ...settlement, transactions } });
  } catch (err) {
    next(err);
  }
});

export default router;
