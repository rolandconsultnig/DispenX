import { z } from "zod";
import { QuotaType, CardStatus, SettlementStatus, TransactionSource, RechargeType, FuelType } from "@prisma/client";

// ─── Auth ──────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(["ADMIN", "FLEET_MANAGER", "FINANCE"]).optional(),
  organizationId: z.string().uuid(),
});

// ─── Organization ──────────────────────────
export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  creditLimit: z.number().min(0).optional(),
  settlementCycleDays: z.number().int().min(1).max(90).optional(),
});

export const updateOrgSchema = createOrgSchema.partial();

// ─── Employee ──────────────────────────────
export const createEmployeeSchema = z.object({
  staffId: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  rfidUid: z.string().optional(),
  pin: z.string().min(4).max(6).optional(),
  quotaType: z.nativeEnum(QuotaType).optional(),
  quotaLiters: z.number().min(0).optional(),
  quotaNaira: z.number().min(0).optional(),
  fuelType: z.nativeEnum(FuelType).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const assignQuotaSchema = z.object({
  quotaType: z.nativeEnum(QuotaType),
  quotaLiters: z.number().min(0).optional(),
  quotaNaira: z.number().min(0).optional(),
  addToBalance: z.boolean().default(true),
});

export const blockCardSchema = z.object({
  rfidUid: z.string().min(1),
  status: z.nativeEnum(CardStatus),
  reason: z.string().optional(),
});

// ─── Station ──────────────────────────────
/** Public station identifier: 3 letters (A–Z) + 4 digits, e.g. AAA0000. Stored uppercase. */
export const stationIdSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase().replace(/\s+/g, "") : v),
  z
    .string()
    .length(7)
    .regex(/^[A-Z]{3}\d{4}$/, "Station ID must be 3 letters + 4 digits (e.g. AAA0000)")
);

export const createStationSchema = z.object({
  name: z.string().min(1).max(200),
  stationCode: stationIdSchema,
  location: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  pumpPriceNairaPerLiter: z.number().min(0).optional(),
  pricePms: z.number().min(0).optional(),
  priceAgo: z.number().min(0).optional(),
  priceCng: z.number().min(0).optional(),
});

export const updateStationSchema = createStationSchema.partial();

export const createStationAttendantSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username may contain letters, numbers, . _ -"),
  password: z.string().min(6).max(128),
  displayName: z.string().max(120).optional(),
});

export const updateStationAttendantSchema = z.object({
  password: z.string().min(6).max(128).optional(),
  displayName: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
});

export const stationPortalAttendantLoginSchema = z.object({
  stationCode: stationIdSchema,
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const updatePumpPriceSchema = z.object({
  pumpPriceNairaPerLiter: z.number().min(0).optional(),
  pricePms: z.number().min(0).optional(),
  priceAgo: z.number().min(0).optional(),
  priceCng: z.number().min(0).optional(),
  fuelType: z.nativeEnum(FuelType).optional(), // update specific fuel type price
});

// ─── Transaction (POS) ────────────────────
export const deductSchema = z.object({
  rfidUid: z.string().min(1),
  idempotencyKey: z.string().min(1),
  amountLiters: z.number().min(0).optional(),
  amountNaira: z.number().min(0).optional(),
  fuelType: z.nativeEnum(FuelType).default("PMS"),
  posSerial: z.string().optional(),
  hmacSignature: z.string().optional(),
  transactedAt: z.string().datetime().optional(),
  pin: z.string().min(4).max(6).optional(),
});

export const batchSyncSchema = z.object({
  transactions: z.array(deductSchema).min(1).max(500),
});

// ─── Settlement ───────────────────────────
export const updateSettlementStatusSchema = z.object({
  status: z.nativeEnum(SettlementStatus),
  notes: z.string().optional(),
});

// ─── Station Whitelist ────────────────────
export const whitelistSchema = z.object({
  stationId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

// ─── Mobile Staff Auth ────────────────────
export const mobileLoginSchema = z.object({
  staffId: z.string().trim().min(1),
  pin: z.string().trim().min(4).max(6),
  organizationId: z.string().uuid().optional(),
});

export const mobileSetPinSchema = z.object({
  staffId: z.string().min(1),
  phone: z.string().min(1), // verify identity
  newPin: z.string().min(4).max(6),
  password: z.string().min(6).optional(),
});

export const mobileChangePinSchema = z.object({
  currentPin: z.string().min(4).max(6),
  newPin: z.string().min(4).max(6),
});

// ─── QR Code Generation ──────────────────
export const generateQrSchema = z
  .object({
    pin: z.string().min(4).max(6),
    fuelType: z.enum(["PMS", "AGO", "CNG"]),
    amountNaira: z.number().min(0).optional(),
    amountLiters: z.number().min(0).optional(),
  })
  .refine(
    (d) => (d.amountNaira ?? 0) > 0 || (d.amountLiters ?? 0) > 0,
    { message: "Provide amountNaira or amountLiters" }
  );

export const validateQrSchema = z.object({
  token: z.string().min(1),
  idempotencyKey: z.string().min(1),
  amountLiters: z.number().min(0).optional(),
  amountNaira: z.number().min(0).optional(),
  posSerial: z.string().optional(),
});

// ─── Recharge ────────────────────────────
export const rechargeSchema = z.object({
  quotaType: z.nativeEnum(QuotaType),
  amountNaira: z.number().min(0).optional(),
  amountLiters: z.number().min(0).optional(),
  rechargeType: z.nativeEnum(RechargeType).default("TOP_UP"),
  fuelType: z.nativeEnum(FuelType).optional(),
  notes: z.string().optional(),
});

export const bulkRechargeSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(500),
  quotaType: z.nativeEnum(QuotaType),
  amountNaira: z.number().min(0).optional(),
  amountLiters: z.number().min(0).optional(),
  rechargeType: z.nativeEnum(RechargeType).default("MONTHLY_ALLOCATION"),
  fuelType: z.nativeEnum(FuelType).optional(),
  notes: z.string().optional(),
});

// ─── POS Deduct (updated with source) ────
export const deductWithSourceSchema = z.object({
  employeeId: z.string().uuid().optional(), // used with QR flow
  rfidUid: z.string().optional(),           // used with RFID flow
  idempotencyKey: z.string().min(1),
  amountLiters: z.number().min(0).optional(),
  amountNaira: z.number().min(0).optional(),
  fuelType: z.nativeEnum(FuelType).default("PMS"),
  source: z.nativeEnum(TransactionSource).default("RFID"),
  posSerial: z.string().optional(),
  hmacSignature: z.string().optional(),
  transactedAt: z.string().datetime().optional(),
  pin: z.string().min(4).max(6).optional(),
  qrToken: z.string().optional(), // for QR-based deductions
  qrPin: z.string().min(4).max(6).optional(), // PIN for QR verification
});

// ─── Dispute ─────────────────────────────
export const createDisputeSchema = z.object({
  transactionId: z.string().uuid().optional(),
  issueType: z.enum(["WRONG_AMOUNT", "UNAUTHORIZED", "STATION_ERROR", "OTHER"]),
  description: z.string().min(10).max(1000),
});

// ─── Quota Request ───────────────────────
export const createQuotaRequestSchema = z.object({
  amountNaira: z.number().min(0).optional(),
  amountLiters: z.number().min(0).optional(),
  reason: z.string().min(5).max(500),
});
