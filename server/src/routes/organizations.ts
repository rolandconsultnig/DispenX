import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrgSchema, updateOrgSchema } from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /api/organizations
router.get("/", authenticate, authorize("SUPER_ADMIN", "ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgs = await prisma.organization.findMany({
      include: { _count: { select: { employees: true, settlements: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: orgs });
  } catch (err) {
    next(err);
  }
});

// GET /api/organizations/:id
router.get("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { employees: true, settlements: true } },
        stations: { include: { station: true } },
      },
    });
    if (!org) return next(new AppError("Organization not found", 404));
    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
});

// POST /api/organizations
router.post("/", authenticate, authorize("SUPER_ADMIN"), validate(createOrgSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.create({ data: req.body });
    res.status(201).json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
});

// PUT /api/organizations/:id
router.put("/:id", authenticate, authorize("SUPER_ADMIN", "ADMIN"), validate(updateOrgSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: org });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/organizations/:id
router.delete("/:id", authenticate, authorize("SUPER_ADMIN"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.organization.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Organization deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
