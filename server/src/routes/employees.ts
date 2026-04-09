import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createEmployeeSchema, updateEmployeeSchema, assignQuotaSchema, blockCardSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /api/employees
router.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    // Non-super-admins can only see their own org
    if (req.user!.role !== "SUPER_ADMIN") {
      where.organizationId = req.user!.organizationId;
    } else if (req.query.organizationId) {
      where.organizationId = req.query.organizationId;
    }
    if (req.query.cardStatus) {
      where.cardStatus = req.query.cardStatus;
    }
    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { staffId: { contains: search, mode: "insensitive" } },
        { rfidUid: { contains: search, mode: "insensitive" } },
      ];
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "25"))));
    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { organization: { select: { id: true, name: true } } },
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

// GET /api/employees/:id
router.get("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        organization: { select: { id: true, name: true } },
        transactions: { take: 20, orderBy: { transactedAt: "desc" }, include: { station: { select: { name: true } } } },
      },
    });
    if (!employee) return next(new AppError("Employee not found", 404));
    if (req.user!.role !== "SUPER_ADMIN" && employee.organizationId !== req.user!.organizationId) {
      return next(new AppError("Insufficient permissions", 403));
    }
    res.json({ success: true, data: employee });
  } catch (err) {
    next(err);
  }
});

// POST /api/employees
router.post(
  "/",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(createEmployeeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = { ...req.body, organizationId: req.user!.organizationId };
      if (data.pin) {
        data.pin = await bcrypt.hash(data.pin, 10);
      }
      // Set initial balance to quota
      if (data.quotaLiters) data.balanceLiters = data.quotaLiters;
      if (data.quotaNaira) data.balanceNaira = data.quotaNaira;

      const employee = await prisma.employee.create({ data });
      res.status(201).json({ success: true, data: employee });
    } catch (err: any) {
      if (err.code === "P2002") {
        return next(new AppError("Duplicate staff ID or RFID UID", 409));
      }
      next(err);
    }
  }
);

// PUT /api/employees/:id
router.put(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(updateEmployeeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = { ...req.body };
      if (data.pin) {
        data.pin = await bcrypt.hash(data.pin, 10);
      }
      const employee = await prisma.employee.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ success: true, data: employee });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/employees/:id/quota — Assign / top-up quota
router.post(
  "/:id/quota",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(assignQuotaSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { quotaType, quotaLiters, quotaNaira, addToBalance } = req.body;
      const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
      if (!employee) return next(new AppError("Employee not found", 404));

      const updateData: any = { quotaType };
      if (quotaType === "LITERS" && quotaLiters !== undefined) {
        updateData.quotaLiters = quotaLiters;
        updateData.balanceLiters = addToBalance ? employee.balanceLiters + quotaLiters : quotaLiters;
      }
      if (quotaType === "NAIRA" && quotaNaira !== undefined) {
        updateData.quotaNaira = quotaNaira;
        updateData.balanceNaira = addToBalance ? employee.balanceNaira + quotaNaira : quotaNaira;
      }

      const updated = await prisma.employee.update({ where: { id: req.params.id }, data: updateData });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/card/block — Block/unblock a card
router.post(
  "/card/block",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN", "FLEET_MANAGER"),
  validate(blockCardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rfidUid, status } = req.body;
      const employee = await prisma.employee.findUnique({ where: { rfidUid } });
      if (!employee) return next(new AppError("Card not found", 404));

      const updated = await prisma.employee.update({
        where: { rfidUid },
        data: { cardStatus: status },
      });
      res.json({ success: true, data: { rfidUid: updated.rfidUid, cardStatus: updated.cardStatus } });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/employees/:id
router.delete(
  "/:id",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.employee.delete({ where: { id: req.params.id } });
      res.json({ success: true, message: "Employee deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
