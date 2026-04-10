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

// GET /api/dashboard/charts — Aggregated chart data
router.get("/charts", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgFilter = req.user!.role !== "SUPER_ADMIN"
      ? { organizationId: req.user!.organizationId }
      : {};
    const employeeFilter = req.user!.role !== "SUPER_ADMIN"
      ? { employee: { organizationId: req.user!.organizationId } }
      : {};

    const now = new Date();
    const days = Math.min(Math.max(parseInt(String(req.query.days || "30"), 10) || 30, 7), 365);
    const thirtyDaysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 1. Daily transaction trends (last 30 days)
    const dailyTrends = await prisma.$queryRawUnsafe<
      Array<{ date: string; total_naira: number; total_liters: number; tx_count: number }>
    >(
      `SELECT DATE(transacted_at) as date,
              COALESCE(SUM(amount_naira), 0)::float as total_naira,
              COALESCE(SUM(amount_liters), 0)::float as total_liters,
              COUNT(*)::int as tx_count
       FROM transactions t
       ${req.user!.role !== "SUPER_ADMIN" ? `JOIN employees e ON t.employee_id = e.id WHERE e.organization_id = $1 AND` : "WHERE"}
       t.transacted_at >= ${req.user!.role !== "SUPER_ADMIN" ? "$2" : "$1"}
       GROUP BY DATE(transacted_at)
       ORDER BY date`,
      ...(req.user!.role !== "SUPER_ADMIN" ? [req.user!.organizationId, thirtyDaysAgo] : [thirtyDaysAgo])
    );

    // 2. Fuel type distribution
    const fuelBreakdown = await prisma.transaction.groupBy({
      by: ["fuelType"],
      where: { ...employeeFilter, transactedAt: { gte: thirtyDaysAgo } },
      _sum: { amountNaira: true, amountLiters: true },
      _count: true,
    });

    // 3. Top stations by transaction value
    const topStations = await prisma.transaction.groupBy({
      by: ["stationId"],
      where: { ...employeeFilter, transactedAt: { gte: thirtyDaysAgo } },
      _sum: { amountNaira: true },
      _count: true,
      orderBy: { _sum: { amountNaira: "desc" } },
      take: 10,
    });
    const stationIds = topStations.map((s) => s.stationId);
    const stations = await prisma.station.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true },
    });
    const stationMap = Object.fromEntries(stations.map((s) => [s.id, s.name]));
    const topStationsData = topStations.map((s) => ({
      name: stationMap[s.stationId] || "Unknown",
      value: s._sum.amountNaira || 0,
      count: s._count,
    }));

    // 4. Card status distribution
    const cardStatuses = await prisma.employee.groupBy({
      by: ["cardStatus"],
      where: orgFilter,
      _count: true,
    });

    // 5. Monthly trend (last 12 months)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyTrends = await prisma.$queryRawUnsafe<
      Array<{ month: string; total_naira: number; total_liters: number; tx_count: number }>
    >(
      `SELECT TO_CHAR(transacted_at, 'YYYY-MM') as month,
              COALESCE(SUM(amount_naira), 0)::float as total_naira,
              COALESCE(SUM(amount_liters), 0)::float as total_liters,
              COUNT(*)::int as tx_count
       FROM transactions t
       ${req.user!.role !== "SUPER_ADMIN" ? `JOIN employees e ON t.employee_id = e.id WHERE e.organization_id = $1 AND` : "WHERE"}
       t.transacted_at >= ${req.user!.role !== "SUPER_ADMIN" ? "$2" : "$1"}
       GROUP BY TO_CHAR(transacted_at, 'YYYY-MM')
       ORDER BY month`,
      ...(req.user!.role !== "SUPER_ADMIN" ? [req.user!.organizationId, twelveMonthsAgo] : [twelveMonthsAgo])
    );

    // 6. Transaction source distribution
    const sourceBreakdown = await prisma.transaction.groupBy({
      by: ["source"],
      where: { ...employeeFilter, transactedAt: { gte: thirtyDaysAgo } },
      _count: true,
      _sum: { amountNaira: true },
    });

    // 7. Top spending employees
    const topEmployees = await prisma.transaction.groupBy({
      by: ["employeeId"],
      where: { ...employeeFilter, transactedAt: { gte: thirtyDaysAgo } },
      _sum: { amountNaira: true, amountLiters: true },
      _count: true,
      orderBy: { _sum: { amountNaira: "desc" } },
      take: 10,
    });
    const empIds = topEmployees.map((e) => e.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, firstName: true, lastName: true, staffId: true },
    });
    const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
    const topEmployeesData = topEmployees.map((e) => ({
      name: empMap[e.employeeId] ? `${empMap[e.employeeId].firstName} ${empMap[e.employeeId].lastName}` : "Unknown",
      staffId: empMap[e.employeeId]?.staffId || "",
      naira: e._sum.amountNaira || 0,
      liters: e._sum.amountLiters || 0,
      count: e._count,
    }));

    res.json({
      success: true,
      data: {
        dailyTrends: dailyTrends.map((d) => ({
          date: d.date,
          naira: d.total_naira,
          liters: d.total_liters,
          count: d.tx_count,
        })),
        monthlyTrends: monthlyTrends.map((m) => ({
          month: m.month,
          naira: m.total_naira,
          liters: m.total_liters,
          count: m.tx_count,
        })),
        fuelBreakdown: fuelBreakdown.map((f) => ({
          fuelType: f.fuelType,
          naira: f._sum.amountNaira || 0,
          liters: f._sum.amountLiters || 0,
          count: f._count,
        })),
        topStations: topStationsData,
        cardStatus: cardStatuses.map((c) => ({
          status: c.cardStatus,
          count: c._count,
        })),
        sourceBreakdown: sourceBreakdown.map((s) => ({
          source: s.source,
          count: s._count,
          naira: s._sum.amountNaira || 0,
        })),
        topEmployees: topEmployeesData,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/reports — Report data with date range filters
router.get("/reports", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, from, to, stationId, organizationId: orgId } = req.query;
    const start = from ? new Date(from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = to ? new Date(to as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const orgFilter = req.user!.role !== "SUPER_ADMIN"
      ? { organizationId: req.user!.organizationId }
      : orgId ? { organizationId: orgId as string } : {};
    const employeeFilter = req.user!.role !== "SUPER_ADMIN"
      ? { employee: { organizationId: req.user!.organizationId } }
      : orgId ? { employee: { organizationId: orgId as string } } : {};

    if (type === "transactions") {
      const where: any = {
        ...employeeFilter,
        transactedAt: { gte: start, lte: end },
      };
      if (stationId) where.stationId = stationId as string;

      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { transactedAt: "desc" },
        include: {
          employee: { select: { firstName: true, lastName: true, staffId: true, organization: { select: { name: true } } } },
          station: { select: { name: true, location: true } },
        },
        take: 500,
      });

      const summary = await prisma.transaction.aggregate({
        where,
        _sum: { amountNaira: true, amountLiters: true },
        _count: true,
      });

      return res.json({ success: true, data: { rows: transactions, summary: { totalNaira: summary._sum.amountNaira || 0, totalLiters: summary._sum.amountLiters || 0, count: summary._count } } });
    }

    if (type === "fuel-consumption") {
      const consumption = await prisma.transaction.groupBy({
        by: ["employeeId", "fuelType"],
        where: { ...employeeFilter, transactedAt: { gte: start, lte: end } },
        _sum: { amountNaira: true, amountLiters: true },
        _count: true,
        orderBy: { _sum: { amountNaira: "desc" } },
      });

      const empIds = consumption.map((c) => c.employeeId);
      const emps = await prisma.employee.findMany({
        where: { id: { in: empIds } },
        select: { id: true, firstName: true, lastName: true, staffId: true, organization: { select: { name: true } } },
      });
      const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));

      return res.json({
        success: true,
        data: {
          rows: consumption.map((c) => ({
            employee: empMap[c.employeeId] ? `${empMap[c.employeeId].firstName} ${empMap[c.employeeId].lastName}` : "Unknown",
            staffId: empMap[c.employeeId]?.staffId || "",
            organization: empMap[c.employeeId]?.organization?.name || "",
            fuelType: c.fuelType,
            naira: c._sum.amountNaira || 0,
            liters: c._sum.amountLiters || 0,
            count: c._count,
          })),
        },
      });
    }

    if (type === "station-performance") {
      const stationPerf = await prisma.transaction.groupBy({
        by: ["stationId"],
        where: { ...employeeFilter, transactedAt: { gte: start, lte: end } },
        _sum: { amountNaira: true, amountLiters: true },
        _count: true,
        orderBy: { _sum: { amountNaira: "desc" } },
      });

      const sIds = stationPerf.map((s) => s.stationId);
      const sts = await prisma.station.findMany({
        where: { id: { in: sIds } },
        select: { id: true, name: true, location: true },
      });
      const sMap = Object.fromEntries(sts.map((s) => [s.id, s]));

      return res.json({
        success: true,
        data: {
          rows: stationPerf.map((s) => ({
            station: sMap[s.stationId]?.name || "Unknown",
            location: sMap[s.stationId]?.location || "",
            naira: s._sum.amountNaira || 0,
            liters: s._sum.amountLiters || 0,
            count: s._count,
          })),
        },
      });
    }

    if (type === "recharges") {
      const empOrgWhere =
        req.user!.role !== "SUPER_ADMIN"
          ? { organizationId: req.user!.organizationId }
          : orgId
            ? { organizationId: orgId as string }
            : {};

      const logs = await prisma.rechargeLog.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          ...(Object.keys(empOrgWhere).length ? { employee: empOrgWhere } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              staffId: true,
              organization: { select: { name: true } },
            },
          },
        },
      });

      const summary = await prisma.rechargeLog.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
          ...(Object.keys(empOrgWhere).length ? { employee: empOrgWhere } : {}),
        },
        _sum: { amountNaira: true, amountLiters: true },
        _count: true,
      });

      return res.json({
        success: true,
        data: {
          rows: logs.map((l) => ({
            id: l.id,
            createdAt: l.createdAt,
            rechargeType: l.rechargeType,
            quotaType: l.quotaType,
            amountNaira: l.amountNaira,
            amountLiters: l.amountLiters,
            balanceBefore: l.balanceBefore,
            balanceAfter: l.balanceAfter,
            notes: l.notes,
            employeeName: l.employee
              ? `${l.employee.firstName} ${l.employee.lastName}`
              : "",
            staffId: l.employee?.staffId || "",
            organization: l.employee?.organization?.name || "",
          })),
          summary: {
            totalNaira: summary._sum.amountNaira || 0,
            totalLiters: summary._sum.amountLiters || 0,
            count: summary._count,
          },
        },
      });
    }

    if (type === "settlements") {
      const settFilter: any = {
        ...(req.user!.role !== "SUPER_ADMIN" ? { organizationId: req.user!.organizationId } : orgId ? { organizationId: orgId as string } : {}),
        AND: [{ periodStart: { lte: end } }, { periodEnd: { gte: start } }],
      };

      const settlements = await prisma.settlement.findMany({
        where: settFilter,
        orderBy: { periodEnd: "desc" },
        include: {
          station: { select: { name: true } },
          organization: { select: { name: true } },
        },
        take: 500,
      });

      const summary = await prisma.settlement.aggregate({
        where: settFilter,
        _sum: { totalNairaDeducted: true, totalLiters: true, transactionCount: true },
        _count: true,
      });

      return res.json({
        success: true,
        data: {
          rows: settlements,
          summary: {
            totalNaira: summary._sum.totalNairaDeducted || 0,
            totalLiters: summary._sum.totalLiters || 0,
            totalTransactions: summary._sum.transactionCount || 0,
            count: summary._count,
          },
        },
      });
    }

    res.status(400).json({
      success: false,
      error:
        "Invalid report type. Use: transactions, fuel-consumption, station-performance, settlements, recharges",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
