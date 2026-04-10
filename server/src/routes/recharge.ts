import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { toLiters, toMoney } from "../lib/precision";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { rechargeSchema, bulkRechargeSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// POST /api/recharge/bulk - MUST be before /:employeeId
router.post(
  "/bulk",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(bulkRechargeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeIds, quotaType, amountNaira, amountLiters, rechargeType, notes } = req.body;
      const results: Array<{ employeeId: string; status: string; balanceAfter?: number; error?: string }> = [];

      for (const employeeId of employeeIds) {
        try {
          const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
          if (!employee) { results.push({ employeeId, status: "error", error: "Not found" }); continue; }
          if (req.user!.role !== "SUPER_ADMIN" && employee.organizationId !== req.user!.organizationId) {
            results.push({ employeeId, status: "error", error: "Permission denied" }); continue;
          }

          let balanceBefore: number;
          let balanceAfter: number;
          const updateData: any = { quotaType };

          if (quotaType === "NAIRA") {
            const amount = toMoney(amountNaira || 0);
            balanceBefore = toMoney(employee.balanceNaira);
            balanceAfter = rechargeType === "RESET" ? amount : toMoney(employee.balanceNaira + amount);
            updateData.balanceNaira = toMoney(balanceAfter);
          } else {
            const amount = toLiters(amountLiters || 0);
            balanceBefore = toLiters(employee.balanceLiters);
            balanceAfter = rechargeType === "RESET" ? amount : toLiters(employee.balanceLiters + amount);
            updateData.balanceLiters = toLiters(balanceAfter);
          }

          await prisma.$transaction([
            prisma.employee.update({ where: { id: employeeId }, data: updateData }),
            prisma.rechargeLog.create({
              data: {
                employeeId, rechargedBy: req.user!.userId,
                rechargeType: rechargeType || "MONTHLY_ALLOCATION",
                quotaType, amountNaira: toMoney(amountNaira || 0), amountLiters: toLiters(amountLiters || 0),
                balanceBefore, balanceAfter, notes,
              },
            }),
          ]);
          results.push({ employeeId, status: "success", balanceAfter });
        } catch (err: any) {
          results.push({ employeeId, status: "error", error: err.message });
        }
      }

      res.json({
        success: true,
        data: {
          total: results.length,
          successful: results.filter((r) => r.status === "success").length,
          failed: results.filter((r) => r.status === "error").length,
          details: results,
        },
      });
    } catch (err) { next(err); }
  }
);

// GET /api/recharge/history/:employeeId
router.get(
  "/history/:employeeId",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: req.params.employeeId },
        select: { id: true, organizationId: true },
      });
      if (!employee) return next(new AppError("Employee not found", 404));
      if (req.user!.role !== "SUPER_ADMIN" && employee.organizationId !== req.user!.organizationId) {
        return next(new AppError("Insufficient permissions", 403));
      }

      const logs = await prisma.rechargeLog.findMany({
        where: { employeeId: req.params.employeeId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ success: true, data: logs });
    } catch (err) { next(err); }
  }
);

// POST /api/recharge/:employeeId - Single employee recharge
router.post(
  "/:employeeId",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(rechargeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = req.params;
      const { quotaType, amountNaira, amountLiters, rechargeType, notes } = req.body;

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) return next(new AppError("Employee not found", 404));

      if (req.user!.role !== "SUPER_ADMIN" && employee.organizationId !== req.user!.organizationId) {
        return next(new AppError("Insufficient permissions", 403));
      }

      let balanceBefore: number;
      let balanceAfter: number;
      const updateData: any = { quotaType };

      if (quotaType === "NAIRA") {
        const amount = toMoney(amountNaira || 0);
        balanceBefore = toMoney(employee.balanceNaira);
        balanceAfter = rechargeType === "RESET" ? amount : toMoney(employee.balanceNaira + amount);
        updateData.balanceNaira = toMoney(balanceAfter);
        updateData.quotaNaira = toMoney(Math.max(employee.quotaNaira, amount));
      } else {
        const amount = toLiters(amountLiters || 0);
        balanceBefore = toLiters(employee.balanceLiters);
        balanceAfter = rechargeType === "RESET" ? amount : toLiters(employee.balanceLiters + amount);
        updateData.balanceLiters = toLiters(balanceAfter);
        updateData.quotaLiters = toLiters(Math.max(employee.quotaLiters, amount));
      }

      const [updatedEmployee, rechargeLog] = await prisma.$transaction([
        prisma.employee.update({ where: { id: employeeId }, data: updateData }),
        prisma.rechargeLog.create({
          data: {
            employeeId, rechargedBy: req.user!.userId,
            rechargeType: rechargeType || "TOP_UP",
            quotaType, amountNaira: toMoney(amountNaira || 0), amountLiters: toLiters(amountLiters || 0),
            balanceBefore, balanceAfter, notes,
          },
        }),
      ]);

      res.json({ success: true, data: { employee: updatedEmployee, recharge: rechargeLog } });
    } catch (err) { next(err); }
  }
);

export default router;