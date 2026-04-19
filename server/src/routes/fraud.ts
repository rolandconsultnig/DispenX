import { Router, Request, Response, NextFunction } from "express";
import { FraudCaseStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { createFraudCaseSchema, updateFraudCaseStatusSchema } from "../schemas";

const router = Router();

router.get(
  "/cases",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "FINANCE"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"), 10)));
      const skip = (page - 1) * limit;
      const search = String(req.query.search || "").trim();
      const requestedStatus = String(req.query.status || "").trim().toUpperCase();
      const status = Object.values(FraudCaseStatus).includes(requestedStatus as FraudCaseStatus)
        ? (requestedStatus as FraudCaseStatus)
        : undefined;

      const where: any = {
        ...(req.user!.role !== "SUPER_ADMIN" ? { organizationId: req.user!.organizationId } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { category: { contains: search, mode: "insensitive" } },
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { vehicle: { plateNumber: { contains: search, mode: "insensitive" } } },
                {
                  employee: {
                    OR: [
                      { staffId: { contains: search, mode: "insensitive" } },
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              ],
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.fraudCase.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ detectedAt: "desc" }],
          include: {
            employee: { select: { id: true, staffId: true, firstName: true, lastName: true } },
            vehicle: { select: { id: true, plateNumber: true } },
            transaction: { select: { id: true, amountLiters: true, amountNaira: true, transactedAt: true } },
            reportedBy: { select: { id: true, firstName: true, lastName: true } },
            reviewedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.fraudCase.count({ where }),
      ]);

      res.json({
        success: true,
        data: rows,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/cases",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER", "FINANCE"),
  validate(createFraudCaseSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId =
        req.user!.role === "SUPER_ADMIN"
          ? String(req.body.organizationId || req.query.organizationId || "").trim()
          : req.user!.organizationId;
      if (!organizationId) return next(new AppError("organizationId is required", 400));

      const created = await prisma.fraudCase.create({
        data: {
          organizationId,
          employeeId: req.body.employeeId || null,
          vehicleId: req.body.vehicleId || null,
          transactionId: req.body.transactionId || null,
          category: req.body.category,
          title: req.body.title,
          description: req.body.description,
          severity: req.body.severity ?? 3,
          riskScore: req.body.riskScore ?? null,
          metadata: req.body.metadata ?? undefined,
          reportedByUserId: req.user!.userId,
        },
      });
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/cases/:id/status",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(updateFraudCaseStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await prisma.fraudCase.findUnique({
        where: { id: req.params.id },
        select: { id: true, organizationId: true },
      });
      if (!row) return next(new AppError("Fraud case not found", 404));
      if (req.user!.role !== "SUPER_ADMIN" && row.organizationId !== req.user!.organizationId) {
        return next(new AppError("Insufficient permissions", 403));
      }

      const status = req.body.status as FraudCaseStatus;
      const reviewedStatuses: FraudCaseStatus[] = ["UNDER_REVIEW", "CONFIRMED", "DISMISSED"];
      const updated = await prisma.fraudCase.update({
        where: { id: row.id },
        data: {
          status,
          resolutionNote: req.body.resolutionNote || null,
          reviewedByUserId: req.user!.userId,
          reviewedAt: reviewedStatuses.includes(status) ? new Date() : null,
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
