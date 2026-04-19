import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { recordSettlementPaymentSchema } from "../schemas";

const router = Router();

/** Org-scoped filter for employee-linked records */
function employeeOrgFilter(req: Request): { employee: { organizationId: string } } | Record<string, never> {
  if (req.user!.role !== "SUPER_ADMIN") {
    return { employee: { organizationId: req.user!.organizationId } };
  }
  return {};
}

function settlementOrgWhere(req: Request) {
  if (req.user!.role !== "SUPER_ADMIN") {
    return { organizationId: req.user!.organizationId };
  }
  return {};
}

// GET /api/finance/overview — Financial snapshot for the admin portal
router.get(
  "/overview",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const empWhere =
        req.user!.role !== "SUPER_ADMIN" ? { organizationId: req.user!.organizationId } : {};

      const [
        walletAgg,
        settlementByStatus,
        pendingSettlementExposure,
        mtdTransactions,
        mtdRecharges,
        activeEmployees,
        orgs,
        pendingQuotaRequests,
        openDisputes,
      ] = await Promise.all([
        prisma.employee.aggregate({
          where: empWhere,
          _sum: { balanceNaira: true, balanceLiters: true },
        }),
        prisma.settlement.groupBy({
          by: ["status"],
          where: settlementOrgWhere(req),
          _count: true,
          _sum: { totalNairaDeducted: true, totalLiters: true },
        }),
        prisma.settlement.aggregate({
          where: {
            ...settlementOrgWhere(req),
            status: { in: ["PENDING", "PARTIALLY_PAID"] },
          },
          _sum: { totalNairaDeducted: true, totalLiters: true },
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: {
            transactedAt: { gte: monthStart },
            ...employeeOrgFilter(req),
          },
          _sum: { amountNaira: true, amountLiters: true },
          _count: true,
        }),
        prisma.rechargeLog.aggregate({
          where: {
            createdAt: { gte: monthStart },
            ...employeeOrgFilter(req),
          },
          _sum: { amountNaira: true, amountLiters: true },
          _count: true,
        }),
        prisma.employee.count({
          where: { ...empWhere, cardStatus: "ACTIVE" },
        }),
        prisma.organization.findMany({
          where: req.user!.role !== "SUPER_ADMIN" ? { id: req.user!.organizationId } : {},
          select: {
            id: true,
            name: true,
            creditLimit: true,
            settlementCycleDays: true,
          },
          orderBy: { name: "asc" },
          take: req.user!.role !== "SUPER_ADMIN" ? 1 : 50,
        }),
        prisma.quotaRequest.count({
          where: {
            status: "PENDING",
            ...(req.user!.role !== "SUPER_ADMIN"
              ? { employee: { organizationId: req.user!.organizationId } }
              : {}),
          },
        }),
        prisma.dispute.count({
          where: {
            status: { in: ["OPEN", "UNDER_REVIEW"] },
            ...(req.user!.role !== "SUPER_ADMIN"
              ? { employee: { organizationId: req.user!.organizationId } }
              : {}),
          },
        }),
      ]);

      const settlementStatusSummary = settlementByStatus.map((s) => ({
        status: s.status,
        count: s._count,
        totalNaira: s._sum.totalNairaDeducted || 0,
        totalLiters: s._sum.totalLiters || 0,
      }));

      res.json({
        success: true,
        data: {
          scope: req.user!.role === "SUPER_ADMIN" ? "all" : "organization",
          periodLabel: `${monthStart.toISOString().slice(0, 7)} (MTD)`,
          wallet: {
            totalBalanceNaira: walletAgg._sum.balanceNaira || 0,
            totalBalanceLiters: walletAgg._sum.balanceLiters || 0,
            activeCards: activeEmployees,
          },
          settlements: {
            byStatus: settlementStatusSummary,
            outstanding: {
              count: pendingSettlementExposure._count,
              totalNaira: pendingSettlementExposure._sum.totalNairaDeducted || 0,
              totalLiters: pendingSettlementExposure._sum.totalLiters || 0,
            },
          },
          monthToDate: {
            transactions: {
              count: mtdTransactions._count,
              amountNaira: mtdTransactions._sum.amountNaira || 0,
              amountLiters: mtdTransactions._sum.amountLiters || 0,
            },
            recharges: {
              count: mtdRecharges._count,
              amountNaira: mtdRecharges._sum.amountNaira || 0,
              amountLiters: mtdRecharges._sum.amountLiters || 0,
            },
          },
          organizations: orgs,
          pipeline: {
            pendingQuotaRequests,
            openDisputes,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

type LedgerKind = "transactions" | "recharges" | "settlements";

// GET /api/finance/ledger — Accounting-style ledger view across core financial events
router.get(
  "/ledger",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kind = String(req.query.kind || "transactions").trim().toLowerCase() as LedgerKind;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"), 10)));
      const skip = (page - 1) * limit;
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if (to) to.setHours(23, 59, 59, 999);
      const search = String(req.query.search || "").trim();

      if (!["transactions", "recharges", "settlements"].includes(kind)) {
        return res.status(400).json({ success: false, message: "kind must be transactions, recharges, or settlements" });
      }

      if (kind === "transactions") {
        const where: any = {
          ...(from || to ? { transactedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
          ...employeeOrgFilter(req),
          ...(search
            ? {
                OR: [
                  { employee: { staffId: { contains: search, mode: "insensitive" } } },
                  { employee: { firstName: { contains: search, mode: "insensitive" } } },
                  { employee: { lastName: { contains: search, mode: "insensitive" } } },
                  { station: { name: { contains: search, mode: "insensitive" } } },
                ],
              }
            : {}),
        };

        const [rows, total] = await Promise.all([
          prisma.transaction.findMany({
            where,
            orderBy: { transactedAt: "desc" },
            skip,
            take: limit,
            include: {
              employee: { select: { id: true, staffId: true, firstName: true, lastName: true, organization: { select: { id: true, name: true } } } },
              station: { select: { id: true, name: true, location: true } },
            },
          }),
          prisma.transaction.count({ where }),
        ]);

        return res.json({
          success: true,
          data: rows.map((t) => ({
            kind: "TRANSACTION",
            id: t.id,
            occurredAt: t.transactedAt,
            amountNaira: t.amountNaira,
            amountLiters: t.amountLiters,
            fuelType: t.fuelType,
            source: t.source,
            employee: t.employee,
            station: t.station,
            organization: t.employee?.organization || null,
          })),
          meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }

      if (kind === "recharges") {
        const where: any = {
          ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
          ...employeeOrgFilter(req),
          ...(search
            ? {
                OR: [
                  { employee: { staffId: { contains: search, mode: "insensitive" } } },
                  { employee: { firstName: { contains: search, mode: "insensitive" } } },
                  { employee: { lastName: { contains: search, mode: "insensitive" } } },
                  { notes: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        };

        const [rows, total] = await Promise.all([
          prisma.rechargeLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
              employee: { select: { id: true, staffId: true, firstName: true, lastName: true, organization: { select: { id: true, name: true } } } },
            },
          }),
          prisma.rechargeLog.count({ where }),
        ]);

        const userIds = Array.from(new Set(rows.map((r) => r.rechargedBy).filter(Boolean)));
        const users = userIds.length
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, firstName: true, lastName: true, email: true, role: true, organizationId: true },
            })
          : [];
        const userMap = new Map(users.map((u) => [u.id, u]));

        return res.json({
          success: true,
          data: rows.map((r) => ({
            kind: "RECHARGE",
            id: r.id,
            occurredAt: r.createdAt,
            amountNaira: r.amountNaira,
            amountLiters: r.amountLiters,
            quotaType: r.quotaType,
            rechargeType: r.rechargeType,
            balanceBefore: r.balanceBefore,
            balanceAfter: r.balanceAfter,
            notes: r.notes,
            employee: r.employee,
            organization: r.employee?.organization || null,
            performedBy: userMap.get(r.rechargedBy) || null,
          })),
          meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }

      // settlements
      const where: any = {
        ...(from || to ? { periodEnd: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...settlementOrgWhere(req),
        ...(search
          ? {
              OR: [
                { station: { name: { contains: search, mode: "insensitive" } } },
                { organization: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.settlement.findMany({
          where,
          orderBy: { periodEnd: "desc" },
          skip,
          take: limit,
          include: {
            station: { select: { id: true, name: true } },
            organization: { select: { id: true, name: true } },
            payments: {
              orderBy: { paymentDate: "desc" },
              select: {
                id: true,
                amountNaira: true,
                amountLiters: true,
                paymentDate: true,
                paymentReference: true,
                paymentChannel: true,
                statusAfterPayment: true,
              },
            },
          },
        }),
        prisma.settlement.count({ where }),
      ]);

      return res.json({
        success: true,
        data: rows.map((s) => ({
          kind: "SETTLEMENT",
          id: s.id,
          occurredAt: s.periodEnd,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          status: s.status,
          amountNaira: s.totalNairaDeducted,
          amountLiters: s.totalLiters,
          transactionCount: s.transactionCount,
          station: s.station,
          organization: s.organization,
          notes: s.notes,
          paidAt: s.paidAt,
          invoicePdfUrl: s.invoicePdfUrl,
          paymentSummary: {
            paymentCount: s.payments.length,
            totalPaidNaira: s.payments.reduce((sum, p) => sum + (p.amountNaira || 0), 0),
            totalPaidLiters: s.payments.reduce((sum, p) => sum + (p.amountLiters || 0), 0),
            latestPayment: s.payments[0] || null,
          },
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/finance/reconciliation — Accounting reconciliation snapshot
router.get(
  "/reconciliation",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = req.query.to ? new Date(String(req.query.to)) : new Date();
      to.setHours(23, 59, 59, 999);

      const txWhere: any = { transactedAt: { gte: from, lte: to }, ...employeeOrgFilter(req) };
      const rechargeWhere: any = { createdAt: { gte: from, lte: to }, ...employeeOrgFilter(req) };
      const paymentWhere: any = { paymentDate: { gte: from, lte: to }, ...settlementOrgWhere(req) };
      const settlementWhere: any = {
        ...settlementOrgWhere(req),
        AND: [{ periodStart: { lte: to } }, { periodEnd: { gte: from } }],
      };

      const [txAgg, rechargeAgg, paymentAgg, settlementAgg, pendingSettlements] = await Promise.all([
        prisma.transaction.aggregate({
          where: txWhere,
          _sum: { amountNaira: true, amountLiters: true },
          _count: true,
        }),
        prisma.rechargeLog.aggregate({
          where: rechargeWhere,
          _sum: { amountNaira: true, amountLiters: true },
          _count: true,
        }),
        prisma.settlementPayment.aggregate({
          where: paymentWhere,
          _sum: { amountNaira: true, amountLiters: true },
          _count: true,
        }),
        prisma.settlement.groupBy({
          by: ["status"],
          where: settlementWhere,
          _sum: { totalNairaDeducted: true, totalLiters: true },
          _count: true,
        }),
        prisma.settlement.findMany({
          where: {
            ...settlementOrgWhere(req),
            status: { in: ["PENDING", "PARTIALLY_PAID", "DISPUTED"] },
          },
          select: { id: true, status: true, periodEnd: true, totalNairaDeducted: true, totalLiters: true },
        }),
      ]);

      const now = Date.now();
      const aging = {
        current: 0,
        due7: 0,
        due30: 0,
        overdue30: 0,
      };
      for (const s of pendingSettlements) {
        const days = Math.floor((now - new Date(s.periodEnd).getTime()) / 86400000);
        if (days <= 7) aging.current += s.totalNairaDeducted;
        else if (days <= 30) aging.due7 += s.totalNairaDeducted;
        else if (days <= 60) aging.due30 += s.totalNairaDeducted;
        else aging.overdue30 += s.totalNairaDeducted;
      }

      res.json({
        success: true,
        data: {
          period: { from, to },
          transactions: {
            count: txAgg._count,
            amountNaira: txAgg._sum.amountNaira || 0,
            amountLiters: txAgg._sum.amountLiters || 0,
          },
          recharges: {
            count: rechargeAgg._count,
            amountNaira: rechargeAgg._sum.amountNaira || 0,
            amountLiters: rechargeAgg._sum.amountLiters || 0,
          },
          settlementPayments: {
            count: paymentAgg._count,
            amountNaira: paymentAgg._sum.amountNaira || 0,
            amountLiters: paymentAgg._sum.amountLiters || 0,
          },
          settlementsByStatus: settlementAgg.map((s) => ({
            status: s.status,
            count: s._count,
            amountNaira: s._sum.totalNairaDeducted || 0,
            amountLiters: s._sum.totalLiters || 0,
          })),
          pendingExposureAgingNaira: aging,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/finance/settlements/:id/payment — Record settlement payment details
router.post(
  "/settlements/:id/payment",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE"),
  validate(recordSettlementPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        status,
        amountNaira,
        amountLiters,
        paymentReference,
        paymentChannel,
        paymentDate,
        note,
        evidenceUrl,
      } = req.body as {
        status?: "SETTLED" | "PARTIALLY_PAID" | "DISPUTED";
        amountNaira?: number;
        amountLiters?: number;
        paymentReference?: string;
        paymentChannel?: string;
        paymentDate?: string;
        note?: string;
        evidenceUrl?: string;
      };

      if (!status || !["SETTLED", "PARTIALLY_PAID", "DISPUTED"].includes(status)) {
        return next(new AppError("status must be SETTLED, PARTIALLY_PAID, or DISPUTED", 400));
      }

      const settlement = await prisma.settlement.findUnique({
        where: { id },
        select: {
          id: true,
          organizationId: true,
          notes: true,
          status: true,
          totalNairaDeducted: true,
          totalLiters: true,
        },
      });
      if (!settlement) return next(new AppError("Settlement not found", 404));
      if (req.user!.role !== "SUPER_ADMIN" && settlement.organizationId !== req.user!.organizationId) {
        return next(new AppError("Insufficient permissions", 403));
      }

      const paymentAmountNaira =
        typeof amountNaira === "number"
          ? amountNaira
          : status === "SETTLED"
            ? settlement.totalNairaDeducted
            : 0;
      const paymentAmountLiters =
        typeof amountLiters === "number"
          ? amountLiters
          : status === "SETTLED"
            ? settlement.totalLiters
            : 0;

      const tagParts = [
        `[payment:${new Date().toISOString()}]`,
        `status=${status}`,
        `amountNaira=${paymentAmountNaira}`,
        `amountLiters=${paymentAmountLiters}`,
        paymentReference ? `ref=${paymentReference}` : "",
        paymentChannel ? `channel=${paymentChannel}` : "",
        note ? `note=${note.replace(/\s+/g, " ").trim()}` : "",
      ].filter(Boolean);

      const mergedNotes = [settlement.notes, tagParts.join(" | ")].filter(Boolean).join("\n");
      const eventDate = paymentDate ? new Date(paymentDate) : new Date();
      const paidAt = status === "SETTLED" ? eventDate : null;

      let evidenceDocumentId: string | undefined;
      if (evidenceUrl && evidenceUrl.trim()) {
        const nameGuess = evidenceUrl.split("/").pop() || `settlement-${settlement.id}-proof`;
        const doc = await prisma.storedDocument.create({
          data: {
            organizationId: settlement.organizationId,
            uploadedByUserId: req.user!.userId,
            settlementId: settlement.id,
            category: "SETTLEMENT_PAYMENT_PROOF",
            fileName: nameGuess,
            storageUrl: evidenceUrl.trim(),
            mimeType: null,
            sizeBytes: null,
          },
          select: { id: true },
        });
        evidenceDocumentId = doc.id;
      }

      const updated = await prisma.settlement.update({
        where: { id: settlement.id },
        data: {
          status,
          notes: mergedNotes || null,
          ...(status === "SETTLED" ? { paidAt } : {}),
        },
        include: {
          station: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      });

      const payment = await prisma.settlementPayment.create({
        data: {
          settlementId: settlement.id,
          organizationId: settlement.organizationId,
          recordedByUserId: req.user!.userId,
          statusAfterPayment: status,
          amountNaira: paymentAmountNaira,
          amountLiters: paymentAmountLiters,
          paymentReference: paymentReference || null,
          paymentChannel: paymentChannel || null,
          paymentDate: eventDate,
          note: note || null,
          evidenceDocumentId: evidenceDocumentId || null,
        },
      });

      res.json({ success: true, data: { settlement: updated, payment } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
