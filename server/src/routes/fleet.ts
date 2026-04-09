import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /api/fleet/overview — Fleet-level analytics
router.get(
  "/overview",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter = req.user!.role !== "SUPER_ADMIN"
        ? { organizationId: req.user!.organizationId }
        : req.query.organizationId ? { organizationId: String(req.query.organizationId) } : {};
      const empFilter = req.user!.role !== "SUPER_ADMIN"
        ? { employee: { organizationId: req.user!.organizationId } }
        : req.query.organizationId ? { employee: { organizationId: String(req.query.organizationId) } } : {};

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [
        totalEmployees, activeCards, blockedCards, lostCards,
        monthlyTxCount, monthlyVolume,
        lastMonthVolume,
        fuelBreakdown,
        topConsumers,
        lowBalanceEmployees,
        quotaRequests,
        openDisputes,
      ] = await Promise.all([
        prisma.employee.count({ where: orgFilter }),
        prisma.employee.count({ where: { ...orgFilter, cardStatus: "ACTIVE" } }),
        prisma.employee.count({ where: { ...orgFilter, cardStatus: "BLOCKED" } }),
        prisma.employee.count({ where: { ...orgFilter, cardStatus: "LOST" } }),
        prisma.transaction.count({ where: { ...empFilter, transactedAt: { gte: monthStart } } }),
        prisma.transaction.aggregate({
          where: { ...empFilter, transactedAt: { gte: monthStart } },
          _sum: { amountNaira: true, amountLiters: true },
        }),
        prisma.transaction.aggregate({
          where: { ...empFilter, transactedAt: { gte: lastMonthStart, lt: monthStart } },
          _sum: { amountNaira: true, amountLiters: true },
        }),
        prisma.transaction.groupBy({
          by: ["fuelType"],
          where: { ...empFilter, transactedAt: { gte: monthStart } },
          _sum: { amountNaira: true, amountLiters: true },
          _count: true,
        }),
        prisma.$queryRaw`
          SELECT e.id, e.staff_id as "staffId", e.first_name as "firstName", e.last_name as "lastName",
                 e.fuel_type as "fuelType",
                 SUM(t.amount_naira) as "totalNaira", SUM(t.amount_liters) as "totalLiters",
                 COUNT(t.id)::int as "txCount"
          FROM employees e
          JOIN transactions t ON t.employee_id = e.id
          WHERE t.transacted_at >= ${monthStart}
          ${req.user!.role !== "SUPER_ADMIN" ? prisma.$queryRaw`AND e.organization_id = ${req.user!.organizationId}` : prisma.$queryRaw``}
          GROUP BY e.id ORDER BY "totalNaira" DESC LIMIT 10
        `,
        prisma.employee.findMany({
          where: {
            ...orgFilter,
            cardStatus: "ACTIVE",
            OR: [
              { quotaType: "NAIRA", balanceNaira: { lte: 5000 } },
              { quotaType: "LITERS", balanceLiters: { lte: 10 } },
            ],
          },
          select: {
            id: true, staffId: true, firstName: true, lastName: true,
            quotaType: true, balanceNaira: true, balanceLiters: true, fuelType: true,
          },
          orderBy: { balanceNaira: "asc" },
          take: 20,
        }),
        prisma.quotaRequest.count({ where: { status: "PENDING", employee: orgFilter } }),
        prisma.dispute.count({ where: { status: "OPEN", employee: orgFilter } }),
      ]);

      res.json({
        success: true,
        data: {
          cards: { total: totalEmployees, active: activeCards, blocked: blockedCards, lost: lostCards },
          thisMonth: {
            transactions: monthlyTxCount,
            naira: monthlyVolume._sum.amountNaira || 0,
            liters: monthlyVolume._sum.amountLiters || 0,
          },
          lastMonth: {
            naira: lastMonthVolume._sum.amountNaira || 0,
            liters: lastMonthVolume._sum.amountLiters || 0,
          },
          fuelBreakdown,
          topConsumers,
          lowBalanceEmployees,
          pendingQuotaRequests: quotaRequests,
          openDisputes,
        },
      });
    } catch (err) { next(err); }
  }
);

// GET /api/fleet/quota-requests — List quota requests
router.get(
  "/quota-requests",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter = req.user!.role !== "SUPER_ADMIN"
        ? { employee: { organizationId: req.user!.organizationId } }
        : {};
      const status = req.query.status ? { status: String(req.query.status) as any } : {};

      const requests = await prisma.quotaRequest.findMany({
        where: { ...orgFilter, ...status },
        orderBy: { createdAt: "desc" },
        include: {
          employee: { select: { id: true, staffId: true, firstName: true, lastName: true, quotaType: true, balanceNaira: true, balanceLiters: true, fuelType: true } },
        },
      });
      res.json({ success: true, data: requests });
    } catch (err) { next(err); }
  }
);

// PUT /api/fleet/quota-requests/:id — Approve/reject quota request
router.put(
  "/quota-requests/:id",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, reviewNote } = req.body;
      if (!["APPROVED", "REJECTED"].includes(status)) {
        return next(new AppError("Status must be APPROVED or REJECTED", 400));
      }

      const qr = await prisma.quotaRequest.findUnique({
        where: { id: req.params.id },
        include: { employee: true },
      });
      if (!qr) return next(new AppError("Quota request not found", 404));
      if (qr.status !== "PENDING") return next(new AppError("Request already reviewed", 400));

      // If approving, add to employee balance
      if (status === "APPROVED") {
        const emp = qr.employee;
        await prisma.employee.update({
          where: { id: emp.id },
          data: {
            balanceNaira: { increment: qr.amountNaira },
            balanceLiters: { increment: qr.amountLiters },
          },
        });

        // Log as recharge
        await prisma.rechargeLog.create({
          data: {
            employeeId: emp.id,
            rechargedBy: req.user!.userId,
            rechargeType: "TOP_UP",
            quotaType: emp.quotaType,
            amountNaira: qr.amountNaira,
            amountLiters: qr.amountLiters,
            balanceBefore: emp.quotaType === "NAIRA" ? emp.balanceNaira : emp.balanceLiters,
            balanceAfter: emp.quotaType === "NAIRA" ? emp.balanceNaira + qr.amountNaira : emp.balanceLiters + qr.amountLiters,
            notes: `Quota request approved: ${qr.reason}`,
          },
        });

        // Notify employee
        await prisma.notification.create({
          data: {
            employeeId: emp.id,
            type: "QUOTA_APPROVED",
            title: "Quota Request Approved",
            message: `Your quota request for ${qr.amountNaira > 0 ? `₦${qr.amountNaira.toLocaleString()}` : `${qr.amountLiters}L`} has been approved.`,
          },
        });
      } else {
        // Notify rejection
        await prisma.notification.create({
          data: {
            employeeId: qr.employeeId,
            type: "QUOTA_REJECTED",
            title: "Quota Request Rejected",
            message: `Your quota request was rejected. ${reviewNote || ""}`.trim(),
          },
        });
      }

      const updated = await prisma.quotaRequest.update({
        where: { id: req.params.id },
        data: { status, reviewedBy: req.user!.userId, reviewNote },
      });

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }
);

// GET /api/fleet/disputes — List disputes
router.get(
  "/disputes",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgFilter = req.user!.role !== "SUPER_ADMIN"
        ? { employee: { organizationId: req.user!.organizationId } }
        : {};
      const status = req.query.status ? { status: String(req.query.status) as any } : {};

      const disputes = await prisma.dispute.findMany({
        where: { ...orgFilter, ...status },
        orderBy: { createdAt: "desc" },
        include: {
          employee: { select: { id: true, staffId: true, firstName: true, lastName: true } },
        },
      });
      res.json({ success: true, data: disputes });
    } catch (err) { next(err); }
  }
);

// PUT /api/fleet/disputes/:id — Update dispute status
router.put(
  "/disputes/:id",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, resolution } = req.body;
      if (!["UNDER_REVIEW", "RESOLVED", "REJECTED"].includes(status)) {
        return next(new AppError("Invalid status", 400));
      }

      const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
      if (!dispute) return next(new AppError("Dispute not found", 404));

      const updated = await prisma.dispute.update({
        where: { id: req.params.id },
        data: { status, resolution },
      });

      // Notify employee
      await prisma.notification.create({
        data: {
          employeeId: dispute.employeeId,
          type: "DISPUTE_UPDATE",
          title: `Dispute ${status.replace("_", " ")}`,
          message: resolution || `Your dispute has been marked as ${status.toLowerCase().replace("_", " ")}.`,
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  }
);

// GET /api/fleet/consumption — Consumption report by employee
router.get(
  "/consumption",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.role !== "SUPER_ADMIN" ? req.user!.organizationId : String(req.query.organizationId || "");
      const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = req.query.to ? new Date(String(req.query.to)) : new Date();

      const where: any = { transactedAt: { gte: from, lte: to } };
      if (orgId) where.employee = { organizationId: orgId };

      const report = await prisma.transaction.groupBy({
        by: ["employeeId"],
        where,
        _sum: { amountNaira: true, amountLiters: true },
        _count: true,
        orderBy: { _sum: { amountNaira: "desc" } },
      });

      // Enrich with employee names
      const employeeIds = report.map(r => r.employeeId);
      const employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, staffId: true, firstName: true, lastName: true, fuelType: true, quotaType: true, quotaNaira: true, quotaLiters: true },
      });
      const empMap = new Map(employees.map(e => [e.id, e]));

      const enriched = report.map(r => ({
        employee: empMap.get(r.employeeId),
        totalNaira: r._sum.amountNaira || 0,
        totalLiters: r._sum.amountLiters || 0,
        transactionCount: r._count,
      }));

      res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
  }
);

// GET /api/fleet/tracking — Latest known fleet movement snapshot
router.get(
  "/tracking",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const txWhere: any = {};
      if (req.user!.role !== "SUPER_ADMIN") {
        txWhere.employee = { organizationId: req.user!.organizationId };
      } else if (req.query.organizationId) {
        txWhere.employee = { organizationId: String(req.query.organizationId) };
      }

      // Pull recent transactions and keep the latest record per employee as "last known location".
      const recent = await prisma.transaction.findMany({
        where: txWhere,
        orderBy: { transactedAt: "desc" },
        take: 1000,
        include: {
          employee: {
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
              fuelType: true,
              cardStatus: true,
              organization: { select: { id: true, name: true } },
            },
          },
          station: { select: { id: true, name: true, location: true, isActive: true } },
        },
      });

      const seen = new Set<string>();
      const tracked = recent
        .filter((tx) => {
          if (seen.has(tx.employeeId)) return false;
          seen.add(tx.employeeId);
          return true;
        })
        .map((tx) => {
          const minutesAgo = Math.floor((Date.now() - new Date(tx.transactedAt).getTime()) / 60000);
          const telemetryStatus =
            minutesAgo <= 120 ? "ONLINE" :
            minutesAgo <= 24 * 60 ? "IDLE" :
            "OFFLINE";

          return {
            employeeId: tx.employeeId,
            staffId: tx.employee.staffId,
            name: `${tx.employee.firstName} ${tx.employee.lastName}`,
            organization: tx.employee.organization,
            cardStatus: tx.employee.cardStatus,
            fuelType: tx.employee.fuelType,
            lastSeenAt: tx.transactedAt,
            minutesAgo,
            telemetryStatus,
            station: tx.station,
            lastTransaction: {
              id: tx.id,
              amountNaira: tx.amountNaira,
              amountLiters: tx.amountLiters,
              source: tx.source,
              fuelType: tx.fuelType,
            },
          };
        });

      const summary = {
        totalTracked: tracked.length,
        online: tracked.filter((t) => t.telemetryStatus === "ONLINE").length,
        idle: tracked.filter((t) => t.telemetryStatus === "IDLE").length,
        offline: tracked.filter((t) => t.telemetryStatus === "OFFLINE").length,
      };

      res.json({ success: true, data: { summary, tracked } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/fleet/iot-health — IoT terminal/device health from station activity
router.get(
  "/iot-health",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stations = await prisma.station.findMany({
        orderBy: { name: "asc" },
        include: {
          whitelist: { select: { id: true } },
          _count: { select: { transactions: true } },
        },
      });

      const txWhere: any = { transactedAt: { gte: weekAgo } };
      if (req.user!.role !== "SUPER_ADMIN") {
        txWhere.employee = { organizationId: req.user!.organizationId };
      } else if (req.query.organizationId) {
        txWhere.employee = { organizationId: String(req.query.organizationId) };
      }

      const recentTx = await prisma.transaction.findMany({
        where: txWhere,
        orderBy: { transactedAt: "desc" },
        select: { stationId: true, transactedAt: true, syncStatus: true, source: true },
      });

      const lastSeenByStation = new Map<string, Date>();
      const tx24hByStation = new Map<string, number>();
      const syncPendingByStation = new Map<string, number>();
      for (const tx of recentTx) {
        if (!lastSeenByStation.has(tx.stationId)) {
          lastSeenByStation.set(tx.stationId, tx.transactedAt);
        }
        if (tx.transactedAt >= dayAgo) {
          tx24hByStation.set(tx.stationId, (tx24hByStation.get(tx.stationId) || 0) + 1);
        }
        if (tx.syncStatus !== "SYNCED") {
          syncPendingByStation.set(tx.stationId, (syncPendingByStation.get(tx.stationId) || 0) + 1);
        }
      }

      const devices = stations.map((station) => {
        const lastSeen = lastSeenByStation.get(station.id) || null;
        const minutesAgo = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 60000) : null;
        const tx24h = tx24hByStation.get(station.id) || 0;
        const pendingSync = syncPendingByStation.get(station.id) || 0;

        const health =
          !station.isActive ? "INACTIVE" :
          !lastSeen ? "OFFLINE" :
          minutesAgo! <= 120 ? "HEALTHY" :
          minutesAgo! <= 24 * 60 ? "DEGRADED" :
          "OFFLINE";

        return {
          stationId: station.id,
          stationName: station.name,
          location: station.location,
          isActive: station.isActive,
          health,
          lastSeenAt: lastSeen,
          minutesAgo,
          tx24h,
          pendingSync,
          whitelistCount: station.whitelist.length,
          prices: { pms: station.pricePms, ago: station.priceAgo, cng: station.priceCng },
        };
      });

      const alerts = devices
        .flatMap((d) => {
          const out: Array<{ level: "INFO" | "WARN" | "CRITICAL"; stationId: string; stationName: string; message: string }> = [];
          if (d.health === "OFFLINE" && d.isActive) {
            out.push({ level: "CRITICAL", stationId: d.stationId, stationName: d.stationName, message: "Station terminal appears offline." });
          }
          if (d.pendingSync > 0) {
            out.push({ level: "WARN", stationId: d.stationId, stationName: d.stationName, message: `${d.pendingSync} transaction(s) pending sync.` });
          }
          if (d.tx24h === 0 && d.isActive) {
            out.push({ level: "INFO", stationId: d.stationId, stationName: d.stationName, message: "No activity in the last 24 hours." });
          }
          return out;
        })
        .slice(0, 100);

      const summary = {
        devices: devices.length,
        healthy: devices.filter((d) => d.health === "HEALTHY").length,
        degraded: devices.filter((d) => d.health === "DEGRADED").length,
        offline: devices.filter((d) => d.health === "OFFLINE").length,
        inactive: devices.filter((d) => d.health === "INACTIVE").length,
        alerts: alerts.length,
      };

      res.json({ success: true, data: { summary, devices, alerts } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
