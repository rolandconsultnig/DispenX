import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config";
import prisma from "../lib/prisma";
import { toLiters, toMoney } from "../lib/precision";
import { validate } from "../middleware/validate";
import {
  mobileLoginSchema,
  mobileSetPinSchema,
  mobileChangePinSchema,
  mobileRefreshSchema,
  mobileLogoutSchema,
  mobileDeviceRegisterSchema,
  generateQrSchema,
  validateQrSchema,
  createDisputeSchema,
  createQuotaRequestSchema,
} from "../schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// ─── Employee JWT helper ─────────────────────
interface EmployeePayload {
  employeeId: string;
  staffId: string;
  organizationId: string;
  type: "employee";
  sessionId?: string;
}

function signEmployeeToken(payload: EmployeePayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "30d" as any });
}

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function buildDeviceMeta(body: any) {
  if (!body?.deviceId || !body?.deviceName) {
    return null;
  }
  return {
    deviceId: String(body.deviceId),
    deviceName: String(body.deviceName),
    platform: body.platform ? String(body.platform) : null,
    appVersion: body.appVersion ? String(body.appVersion) : null,
  };
}

async function createEmployeeSession(employee: { id: string }, deviceMeta: ReturnType<typeof buildDeviceMeta>) {
  if (!deviceMeta) {
    return null;
  }

  return prisma.employeeDeviceSession.upsert({
    where: {
      employeeId_deviceId: {
        employeeId: employee.id,
        deviceId: deviceMeta.deviceId,
      },
    },
    create: {
      employeeId: employee.id,
      deviceId: deviceMeta.deviceId,
      deviceName: deviceMeta.deviceName,
      platform: deviceMeta.platform,
      appVersion: deviceMeta.appVersion,
      isTrusted: true,
      lastSeenAt: new Date(),
      revokedAt: null,
    },
    update: {
      deviceName: deviceMeta.deviceName,
      platform: deviceMeta.platform,
      appVersion: deviceMeta.appVersion,
      lastSeenAt: new Date(),
      revokedAt: null,
    },
  });
}

async function issueEmployeeTokens(
  employee: { id: string; staffId: string; organizationId: string },
  deviceMeta: ReturnType<typeof buildDeviceMeta>
) {
  const session = await createEmployeeSession(employee, deviceMeta);
  const payload: EmployeePayload = {
    employeeId: employee.id,
    staffId: employee.staffId,
    organizationId: employee.organizationId,
    type: "employee",
    sessionId: session?.id,
  };

  const token = signEmployeeToken(payload);
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.employeeRefreshToken.create({
    data: {
      employeeId: employee.id,
      tokenHash: refreshTokenHash,
      deviceSessionId: session?.id,
      expiresAt,
    },
  });

  return {
    token,
    refreshToken,
    session,
  };
}

function authenticateEmployee(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as EmployeePayload;
    if (payload.type !== "employee") {
      return next(new AppError("Invalid token type", 401));
    }
    (req as any).employee = payload;
    next();
  } catch {
    return next(new AppError("Invalid or expired token", 401));
  }
}

// ─── GET /api/mobile/organizations — Public list for login screen ──
router.get(
  "/organizations",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const orgs = await prisma.organization.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: orgs });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/auth/device/register ─────────────────
router.post(
  "/auth/device/register",
  authenticateEmployee,
  validate(mobileDeviceRegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee as EmployeePayload;
      const { deviceId, deviceName, platform, appVersion, trusted } = req.body;

      const session = await prisma.employeeDeviceSession.upsert({
        where: {
          employeeId_deviceId: {
            employeeId,
            deviceId,
          },
        },
        create: {
          employeeId,
          deviceId,
          deviceName,
          platform,
          appVersion,
          isTrusted: trusted ?? true,
          lastSeenAt: new Date(),
          revokedAt: null,
        },
        update: {
          deviceName,
          platform,
          appVersion,
          isTrusted: trusted ?? true,
          lastSeenAt: new Date(),
          revokedAt: null,
        },
      });

      res.json({
        success: true,
        data: {
          id: session.id,
          deviceId: session.deviceId,
          deviceName: session.deviceName,
          platform: session.platform,
          appVersion: session.appVersion,
          isTrusted: session.isTrusted,
          lastSeenAt: session.lastSeenAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/auth/sessions ─────────────────
router.get("/auth/sessions", authenticateEmployee, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = (req as any).employee as EmployeePayload;
    const sessions = await prisma.employeeDeviceSession.findMany({
      where: { employeeId, revokedAt: null },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        platform: true,
        appVersion: true,
        isTrusted: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mobile/auth/sessions/:sessionId/revoke ─────────────────
router.post(
  "/auth/sessions/:sessionId/revoke",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee as EmployeePayload;
      const { sessionId } = req.params;

      const session = await prisma.employeeDeviceSession.findFirst({
        where: { id: sessionId, employeeId },
        select: { id: true, revokedAt: true },
      });

      if (!session) {
        return next(new AppError("Session not found", 404));
      }

      const now = new Date();
      if (!session.revokedAt) {
        await prisma.employeeDeviceSession.update({
          where: { id: session.id },
          data: { revokedAt: now },
        });
      }

      await prisma.employeeRefreshToken.updateMany({
        where: { employeeId, deviceSessionId: session.id, revokedAt: null },
        data: { revokedAt: now },
      });

      res.json({ success: true, message: "Session revoked" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/auth/refresh ─────────────────
router.post("/auth/refresh", validate(mobileRefreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const refreshTokenHash = hashToken(req.body.refreshToken);
    const existing = await prisma.employeeRefreshToken.findUnique({
      where: { tokenHash: refreshTokenHash },
      include: {
        employee: {
          select: {
            id: true,
            staffId: true,
            organizationId: true,
            cardStatus: true,
          },
        },
        deviceSession: true,
      },
    });

    if (!existing || existing.revokedAt || existing.expiresAt <= now) {
      return next(new AppError("Invalid or expired refresh token", 401));
    }

    if (existing.employee.cardStatus !== "ACTIVE") {
      return next(new AppError("Account is not active", 403));
    }

    await prisma.employeeRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now },
    });

    if (existing.deviceSessionId) {
      await prisma.employeeDeviceSession.update({
        where: { id: existing.deviceSessionId },
        data: { lastSeenAt: now },
      });
    }

    const payload: EmployeePayload = {
      employeeId: existing.employee.id,
      staffId: existing.employee.staffId,
      organizationId: existing.employee.organizationId,
      type: "employee",
      sessionId: existing.deviceSessionId ?? undefined,
    };

    const token = signEmployeeToken(payload);
    const refreshToken = crypto.randomBytes(48).toString("hex");

    await prisma.employeeRefreshToken.create({
      data: {
        employeeId: existing.employee.id,
        tokenHash: hashToken(refreshToken),
        deviceSessionId: existing.deviceSessionId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ success: true, data: { token, refreshToken } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mobile/auth/logout ─────────────────
router.post(
  "/auth/logout",
  authenticateEmployee,
  validate(mobileLogoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const employee = (req as any).employee as EmployeePayload;
      const allDevices = req.body?.allDevices === true;

      if (allDevices) {
        await prisma.employeeRefreshToken.updateMany({
          where: { employeeId: employee.employeeId, revokedAt: null },
          data: { revokedAt: now },
        });
        await prisma.employeeDeviceSession.updateMany({
          where: { employeeId: employee.employeeId, revokedAt: null },
          data: { revokedAt: now },
        });
      } else if (employee.sessionId) {
        await prisma.employeeRefreshToken.updateMany({
          where: { employeeId: employee.employeeId, deviceSessionId: employee.sessionId, revokedAt: null },
          data: { revokedAt: now },
        });
        await prisma.employeeDeviceSession.updateMany({
          where: { id: employee.sessionId, employeeId: employee.employeeId, revokedAt: null },
          data: { revokedAt: now },
        });
      } else {
        await prisma.employeeRefreshToken.updateMany({
          where: { employeeId: employee.employeeId, deviceSessionId: null, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      res.json({ success: true, message: "Logged out successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/login ─────────────────
router.post(
  "/login",
  validate(mobileLoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { staffId, pin } = req.body;

      const staffMatches = await prisma.employee.findMany({
        where: { staffId },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: [{ organizationId: "asc" }, { id: "asc" }],
      });

      let employee = staffMatches[0];
      if (staffMatches.length > 1) {
        const requestedOrg = typeof req.body.organizationId === "string" ? String(req.body.organizationId).trim() : "";
        if (requestedOrg) {
          const match = staffMatches.find((e) => e.organizationId === requestedOrg);
          if (!match) {
            return next(new AppError("Staff ID not found for this organization.", 404));
          }
          employee = match;
        } else {
          // No org picker in app: resolve deterministically (first by organizationId, then id).
          employee = staffMatches[0];
        }
      }

      if (!employee) return next(new AppError("Invalid credentials", 401));
      if (employee.cardStatus !== "ACTIVE") return next(new AppError(`Account is ${employee.cardStatus}`, 403));
      if (!employee.pin) return next(new AppError("PIN not set. Contact your administrator.", 401));

      let pinValid = false;
      try {
        pinValid = await bcrypt.compare(pin, employee.pin);
      } catch {
        // Non-bcrypt value in DB (legacy plaintext) — avoid 500, treat as failed login.
        return next(new AppError("Invalid credentials", 401));
      }
      if (!pinValid) return next(new AppError("Invalid credentials", 401));

      const { token, refreshToken, session } = await issueEmployeeTokens(employee, buildDeviceMeta(req.body));

      res.json({
        success: true,
        data: {
          token,
          refreshToken,
          session: session
            ? {
                id: session.id,
                deviceId: session.deviceId,
                deviceName: session.deviceName,
                platform: session.platform,
                appVersion: session.appVersion,
                isTrusted: session.isTrusted,
                lastSeenAt: session.lastSeenAt,
              }
            : null,
          employee: {
            id: employee.id,
            staffId: employee.staffId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            phone: employee.phone,
            email: employee.email,
            quotaType: employee.quotaType,
            quotaNaira: employee.quotaNaira,
            quotaLiters: employee.quotaLiters,
            balanceNaira: employee.balanceNaira,
            balanceLiters: employee.balanceLiters,
            cardStatus: employee.cardStatus,
            rfidUid: employee.rfidUid,
            fuelType: employee.fuelType,
            allotmentCategory: employee.allotmentCategory,
            organization: employee.organization,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/setup-pin — First-time PIN setup ──
router.post(
  "/setup-pin",
  validate(mobileSetPinSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { staffId, phone, newPin, organizationId } = req.body;

      const candidates = await prisma.employee.findMany({
        where: { staffId, phone },
        orderBy: [{ organizationId: "asc" }, { id: "asc" }],
      });
      let employee = candidates[0];
      if (candidates.length > 1 && organizationId) {
        const match = candidates.find((e) => e.organizationId === organizationId);
        if (!match) {
          return next(new AppError("Employee not found for this organization. Verify Staff ID and phone.", 404));
        }
        employee = match;
      }
      if (!employee) return next(new AppError("Employee not found. Verify Staff ID and phone number.", 404));

      const hashedPin = await bcrypt.hash(newPin, 10);
      await prisma.employee.update({
        where: { id: employee.id },
        data: { pin: hashedPin },
      });

      // Return a JWT so the user is logged in immediately after setup
      const token = jwt.sign(
        { type: "employee", employeeId: employee.id, organizationId: employee.organizationId },
        config.jwtSecret,
        { expiresIn: "7d" } as any
      );

      res.json({
        success: true,
        message: "PIN set successfully.",
        data: {
          token,
          employee: {
            id: employee.id, staffId: employee.staffId,
            firstName: employee.firstName, lastName: employee.lastName,
            quotaType: employee.quotaType, balanceNaira: employee.balanceNaira,
            balanceLiters: employee.balanceLiters, cardStatus: employee.cardStatus,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/me — Get current employee profile ──
router.get(
  "/me",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true, staffId: true, firstName: true, lastName: true,
          phone: true, email: true, rfidUid: true,
          quotaType: true, quotaNaira: true, quotaLiters: true,
          balanceNaira: true, balanceLiters: true, cardStatus: true, fuelType: true,
          allotmentCategory: true,
          organization: { select: { id: true, name: true } },
        },
      });
      if (!employee) return next(new AppError("Employee not found", 404));
      res.json({ success: true, data: employee });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/change-pin ────────────
router.post(
  "/change-pin",
  authenticateEmployee,
  validate(mobileChangePinSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const { currentPin, newPin } = req.body;

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee || !employee.pin) return next(new AppError("Employee not found", 404));

      const valid = await bcrypt.compare(currentPin, employee.pin);
      if (!valid) return next(new AppError("Current PIN is incorrect", 403));

      const hashedPin = await bcrypt.hash(newPin, 10);
      await prisma.employee.update({ where: { id: employeeId }, data: { pin: hashedPin } });

      res.json({ success: true, message: "PIN changed successfully" });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/transactions — Employee's transaction history ──
router.get(
  "/transactions",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const page = Math.max(1, parseInt(String(req.query.page || "1")));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"))));
      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { employeeId },
          skip,
          take: limit,
          orderBy: { transactedAt: "desc" },
          select: {
            id: true, amountLiters: true, amountNaira: true,
            pumpPriceAtTime: true, quotaType: true, source: true, fuelType: true,
            transactedAt: true,
            station: { select: { id: true, name: true, location: true } },
          },
        }),
        prisma.transaction.count({ where: { employeeId } }),
      ]);

      res.json({
        success: true,
        data: transactions,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/recharges — Employee's recharge history ──
router.get(
  "/recharges",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;

      const recharges = await prisma.rechargeLog.findMany({
        where: { employeeId },
        take: 50,
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, data: recharges });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/qr/generate — Generate time-limited QR token ──
router.post(
  "/qr/generate",
  authenticateEmployee,
  validate(generateQrSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const { pin, amountNaira, amountLiters, fuelType } = req.body;

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee || !employee.pin) return next(new AppError("Employee not found", 404));
      if (employee.cardStatus !== "ACTIVE") return next(new AppError(`Card is ${employee.cardStatus}`, 403));

      const pinValid = await bcrypt.compare(pin, employee.pin);
      if (!pinValid) return next(new AppError("Invalid PIN", 403));

      const naira = toMoney(Number(amountNaira || 0));
      const liters = toLiters(Number(amountLiters || 0));

      if (employee.quotaType === "NAIRA") {
        if (naira <= 0) return next(new AppError("Enter a valid amount in naira", 400));
        const balance = Number(employee.balanceNaira) || 0;
        if (naira > balance) {
          return next(new AppError(`Insufficient balance. Available: ₦${balance.toLocaleString()}`, 400));
        }
      } else if (employee.quotaType === "LITERS") {
        if (liters <= 0) return next(new AppError("Enter a valid amount in liters", 400));
        const balL = Number(employee.balanceLiters) || 0;
        if (liters > balL) {
          return next(new AppError(`Insufficient balance. Available: ${balL}L`, 400));
        }
      } else {
        return next(new AppError("Unsupported quota type", 400));
      }

      // Generate a secure random token
      const token = crypto.randomBytes(32).toString("hex");
      const hashedPin = employee.pin; // already hashed
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Invalidate any existing unused tokens for this employee
      await prisma.qrToken.updateMany({
        where: { employeeId, used: false },
        data: { used: true },
      });

      const qrToken = await prisma.qrToken.create({
        data: {
          employeeId,
          token,
          pin: hashedPin,
          expiresAt,
          amountNaira: employee.quotaType === "NAIRA" ? naira : null,
          amountLiters: employee.quotaType === "LITERS" ? liters : null,
          fuelType,
        },
      });

      // The QR code payload is a URL pointing to the station portal confirmation page
      const qrPayload = `${config.stationPortalUrl}/confirm?token=${token}`;

      res.json({
        success: true,
        data: {
          qrPayload,
          token,
          amountNaira: qrToken.amountNaira,
          amountLiters: qrToken.amountLiters,
          fuelType,
          expiresAt,
          expiresInSeconds: 300,
          employee: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            staffId: employee.staffId,
            quotaType: employee.quotaType,
            balanceNaira: employee.balanceNaira,
            balanceLiters: employee.balanceLiters,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/qr/validate — POS validates QR (called by station) ──
router.post(
  "/qr/validate",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Station auth via API key
      const apiKey = req.headers["x-station-api-key"] as string;
      if (!apiKey) return next(new AppError("Station API key required", 401));

      const station = await prisma.station.findUnique({ where: { apiKey } });
      if (!station || !station.isActive) return next(new AppError("Invalid station", 401));

      const { token } = req.body;
      if (!token) return next(new AppError("QR token required", 400));

      const qrToken = await prisma.qrToken.findUnique({
        where: { token },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, staffId: true,
              quotaType: true, balanceNaira: true, balanceLiters: true,
              cardStatus: true, organizationId: true,
              organization: { select: { name: true } },
            },
          },
        },
      });

      if (!qrToken) return next(new AppError("Invalid QR code", 404));
      if (qrToken.used) return next(new AppError("QR code already used", 400));
      if (new Date() > qrToken.expiresAt) return next(new AppError("QR code expired", 400));
      if (qrToken.employee.cardStatus !== "ACTIVE") {
        return next(new AppError(`Card is ${qrToken.employee.cardStatus}`, 403));
      }

      // Check station whitelist
      const whitelisted = await prisma.stationWhitelist.findFirst({
        where: { organizationId: qrToken.employee.organizationId, stationId: station.id },
      });
      if (!whitelisted) return next(new AppError("Employee not authorized at this station", 403));

      res.json({
        success: true,
        data: {
          valid: true,
          employee: qrToken.employee,
          amountNaira: qrToken.amountNaira,
          fuelType: qrToken.fuelType,
          expiresAt: qrToken.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/disputes — Create a dispute ──
router.post(
  "/disputes",
  authenticateEmployee,
  validate(createDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const { transactionId, issueType, description } = req.body;

      // Verify transaction belongs to this employee if provided
      if (transactionId) {
        const tx = await prisma.transaction.findFirst({
          where: { id: transactionId, employeeId },
        });
        if (!tx) return next(new AppError("Transaction not found", 404));
      }

      const dispute = await prisma.dispute.create({
        data: { employeeId, transactionId, issueType, description },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          employeeId,
          type: "DISPUTE",
          title: "Dispute Submitted",
          message: `Your dispute #${dispute.id.slice(0, 8)} has been submitted and is under review.`,
        },
      });

      res.status(201).json({ success: true, data: dispute });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/disputes — List my disputes ──
router.get(
  "/disputes",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const disputes = await prisma.dispute.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ success: true, data: disputes });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/card/report-lost — Report lost/stolen card ──
router.post(
  "/card/report-lost",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;

      const employee = await prisma.employee.update({
        where: { id: employeeId },
        data: { cardStatus: "LOST" },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          employeeId,
          type: "SYSTEM",
          title: "Card Reported Lost",
          message: "Your card has been blocked. Contact your administrator for a replacement.",
        },
      });

      res.json({
        success: true,
        message: "Card reported as lost and blocked immediately.",
        data: { cardStatus: employee.cardStatus },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/whitelist/stations — Whitelisted stations for employee's org ──
router.get(
  "/whitelist/stations",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = (req as any).employee;

      const whitelist = await prisma.stationWhitelist.findMany({
        where: { organizationId },
        include: {
          station: {
            select: {
              id: true, name: true, location: true, address: true, phone: true,
              pricePms: true, priceAgo: true, priceCng: true, isActive: true,
            },
          },
        },
      });

      const stations = whitelist
        .filter((w) => w.station.isActive)
        .map((w) => w.station);

      res.json({ success: true, data: stations });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/mobile/quota-requests — Request additional quota ──
router.post(
  "/quota-requests",
  authenticateEmployee,
  validate(createQuotaRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const { amountNaira, amountLiters, reason } = req.body;

      const request = await prisma.quotaRequest.create({
        data: { employeeId, amountNaira: amountNaira || 0, amountLiters: amountLiters || 0, reason },
      });

      await prisma.notification.create({
        data: {
          employeeId,
          type: "QUOTA",
          title: "Quota Request Submitted",
          message: `Your request for additional quota has been submitted and is pending approval.`,
        },
      });

      res.status(201).json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/quota-requests — List my quota requests ──
router.get(
  "/quota-requests",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const requests = await prisma.quotaRequest.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/mobile/notifications — List notifications ──
router.get(
  "/notifications",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      const notifications = await prisma.notification.findMany({
        where: { employeeId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const unreadCount = await prisma.notification.count({
        where: { employeeId, read: false },
      });
      res.json({ success: true, data: notifications, meta: { unreadCount } });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /api/mobile/notifications/read-all — Mark all read ──
router.put(
  "/notifications/read-all",
  authenticateEmployee,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = (req as any).employee;
      await prisma.notification.updateMany({
        where: { employeeId, read: false },
        data: { read: true },
      });
      res.json({ success: true, message: "All notifications marked as read" });
    } catch (err) {
      next(err);
    }
  }
);

export { authenticateEmployee };
export default router;
