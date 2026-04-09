import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

// GET /api/dashboard — Summary stats
router.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgFilter = req.user!.role !== "SUPER_ADMIN"
      ? { organizationId: req.user!.organizationId }
      : {};

    const employeeFilter = req.user!.role !== "SUPER_ADMIN"
      ? { employee: { organizationId: req.user!.organizationId } }
      : {};

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalEmployees,
      activeCards,
      blockedCards,
      totalStations,
      monthlyTransactions,
      monthlyVolume,
      pendingSettlements,
      recentTransactions,
    ] = await Promise.all([
      prisma.employee.count({ where: orgFilter }),
      prisma.employee.count({ where: { ...orgFilter, cardStatus: "ACTIVE" } }),
      prisma.employee.count({ where: { ...orgFilter, cardStatus: "BLOCKED" } }),
      prisma.station.count({ where: { isActive: true } }),
      prisma.transaction.count({
        where: { ...employeeFilter, transactedAt: { gte: monthStart } },
      }),
      prisma.transaction.aggregate({
        where: { ...employeeFilter, transactedAt: { gte: monthStart } },
        _sum: { amountNaira: true, amountLiters: true },
      }),
      prisma.settlement.count({
        where: { ...(req.user!.role !== "SUPER_ADMIN" ? { organizationId: req.user!.organizationId } : {}), status: "PENDING" },
      }),
      prisma.transaction.findMany({
        where: employeeFilter,
        take: 10,
        orderBy: { transactedAt: "desc" },
        include: {
          employee: { select: { firstName: true, lastName: true, staffId: true } },
          station: { select: { name: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeCards,
        blockedCards,
        totalStations,
        monthlyTransactions,
        monthlyVolume: {
          naira: monthlyVolume._sum.amountNaira || 0,
          liters: monthlyVolume._sum.amountLiters || 0,
        },
        pendingSettlements,
        recentTransactions,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
