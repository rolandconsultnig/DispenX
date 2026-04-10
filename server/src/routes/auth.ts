import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../lib/prisma";
import { loginSchema, registerSchema } from "../schemas";
import { validate } from "../middleware/validate";
import { authenticate, authorize } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// POST /api/auth/login
router.post("/login", validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return next(new AppError("Invalid credentials", 401));
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return next(new AppError("Invalid credentials", 401));
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, organizationId: user.organizationId },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register (Admin only)
router.post(
  "/register",
  authenticate,
  authorize("SUPER_ADMIN", "ADMIN"),
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, role, organizationId } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return next(new AppError("Email already registered", 409));
      }

      const targetOrganizationId =
        req.user!.role === "SUPER_ADMIN" ? organizationId : req.user!.organizationId;

      if (!targetOrganizationId) {
        return next(new AppError("organizationId is required", 400));
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: role || "ADMIN",
          organizationId: targetOrganizationId,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
      });

      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        organizationId: true, organization: { select: { id: true, name: true } },
      },
    });
    if (!user) return next(new AppError("User not found", 404));
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/pos/login (Station POS login by API key)
router.post("/pos/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers["x-station-api-key"] as string;
    if (!apiKey) return next(new AppError("API key required", 401));

    const station = await prisma.station.findUnique({ where: { apiKey } });
    if (!station || !station.isActive) {
      return next(new AppError("Invalid station credentials", 401));
    }

    const token = jwt.sign(
      { stationId: station.id, stationName: station.name },
      config.jwtSecret,
      { expiresIn: "24h" as any }
    );

    res.json({
      success: true,
      data: { token, station: { id: station.id, name: station.name, pumpPrice: station.pumpPriceNairaPerLiter } },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
