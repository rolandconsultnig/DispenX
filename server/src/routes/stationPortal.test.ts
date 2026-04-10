import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  transaction: { findUnique: vi.fn() },
  station: { findUnique: vi.fn() },
  qrToken: { findUnique: vi.fn(), updateMany: vi.fn() },
  employee: { update: vi.fn() },
  stationWhitelist: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(() => ({ stationId: "station-1", stationName: "Test Station", type: "station" })),
    sign: vi.fn(() => "mock-token"),
  },
}));

async function makeApp() {
  const { default: stationPortalRouter } = await import("./stationPortal");
  const { errorHandler } = await import("../middleware/errorHandler");
  const app = express();
  app.use(express.json());
  app.use("/api/station-portal", stationPortalRouter);
  app.use(errorHandler);
  return app;
}

describe("station portal routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails safely when QR token was already consumed during atomic transaction", async () => {
    const station = { id: "station-1", isActive: true, pricePms: 650, priceAgo: 900, priceCng: 300 };
    const employee = {
      id: "emp-1",
      organizationId: "org-1",
      cardStatus: "ACTIVE",
      quotaType: "NAIRA",
      balanceNaira: 7000,
      balanceLiters: 0,
      fuelType: "PMS",
    };
    const qrToken = {
      id: "qr-1",
      used: false,
      expiresAt: new Date(Date.now() + 60_000),
      employee,
    };

    mockPrisma.transaction.findUnique.mockResolvedValue(null);
    mockPrisma.station.findUnique.mockResolvedValue(station);
    mockPrisma.qrToken.findUnique.mockResolvedValue(qrToken);
    mockPrisma.stationWhitelist.findFirst.mockResolvedValue({ id: "wl-1" });
    mockPrisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        qrToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        transaction: { create: vi.fn() },
        employee: { update: vi.fn() },
      })
    );

    const app = await makeApp();
    const res = await request(app)
      .post("/api/station-portal/dispense")
      .set("Authorization", "Bearer valid-token")
      .send({
        token: "qr-token-value",
        idempotencyKey: "idem-sp-1",
        amountNaira: 1000,
        fuelType: "PMS",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("QR code already used");
  });
});
