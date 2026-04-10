import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  station: { findUnique: vi.fn() },
  transaction: { findUnique: vi.fn(), create: vi.fn() },
  employee: { findUnique: vi.fn(), update: vi.fn() },
  stationWhitelist: { findFirst: vi.fn() },
  qrToken: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  default: mockPrisma,
}));

async function makeApp() {
  const { default: transactionsRouter } = await import("./transactions");
  const { errorHandler } = await import("../middleware/errorHandler");
  const app = express();
  app.use(express.json());
  app.use("/api", transactionsRouter);
  app.use(errorHandler);
  return app;
}

describe("transactions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing transaction on duplicate idempotency key", async () => {
    const station = {
      id: "station-1",
      isActive: true,
      pricePms: 650,
      priceAgo: 900,
      priceCng: 300,
    };
    const existing = { id: "txn-dup", idempotencyKey: "idem-1" };

    mockPrisma.station.findUnique.mockResolvedValue(station);
    mockPrisma.transaction.findUnique.mockResolvedValue(existing);

    const app = await makeApp();
    const res = await request(app)
      .post("/api/transaction/deduct")
      .set("x-station-api-key", "station-api-key")
      .send({
        rfidUid: "RFID-001",
        idempotencyKey: "idem-1",
        amountNaira: 1000,
        fuelType: "PMS",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("Duplicate transaction");
    expect(res.body.data.id).toBe("txn-dup");
    expect(mockPrisma.employee.findUnique).not.toHaveBeenCalled();
  });

  it("recovers from unique-conflict race and returns duplicate transaction", async () => {
    const station = {
      id: "station-1",
      isActive: true,
      pricePms: 650,
      priceAgo: 900,
      priceCng: 300,
    };
    const employee = {
      id: "emp-1",
      organizationId: "org-1",
      cardStatus: "ACTIVE",
      quotaType: "NAIRA",
      balanceNaira: 5000,
      balanceLiters: 0,
      pin: null,
    };
    const duplicate = { id: "txn-race", idempotencyKey: "idem-race" };

    mockPrisma.station.findUnique.mockResolvedValue(station);
    mockPrisma.transaction.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(duplicate);
    mockPrisma.employee.findUnique.mockResolvedValue(employee);
    mockPrisma.stationWhitelist.findFirst.mockResolvedValue({ id: "wl-1" });
    mockPrisma.transaction.create.mockReturnValue({ _op: "create-transaction" });
    mockPrisma.employee.update.mockReturnValue({ _op: "update-employee" });
    mockPrisma.$transaction.mockRejectedValue({ code: "P2002" });

    const app = await makeApp();
    const res = await request(app)
      .post("/api/transaction/deduct")
      .set("x-station-api-key", "station-api-key")
      .send({
        rfidUid: "RFID-001",
        idempotencyKey: "idem-race",
        amountNaira: 1000,
        fuelType: "PMS",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("Duplicate transaction");
    expect(res.body.data.id).toBe("txn-race");
  });
});
