import { createHash } from "crypto";
import {
  PrismaClient,
  UserRole,
  QuotaType,
  RechargeType,
  TelemetryDeviceKind,
  SettlementStatus,
  FuelType,
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

async function main() {
  console.log("Seeding database...");

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "EnergyDispenX Corp",
      address: "1 Victoria Island, Lagos",
      phone: "+234-800-000-0001",
      email: "admin@energydispenx.com",
      creditLimit: 5000000,
      settlementCycleDays: 30,
    },
  });

  // Create Super Admin
  const passwordHash = await bcrypt.hash("Admin123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@energydispenx.com" },
    update: {},
    create: {
      email: "admin@energydispenx.com",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id,
    },
  });

  // Create Fleet Manager
  await prisma.user.upsert({
    where: { email: "fleet@energydispenx.com" },
    update: {},
    create: {
      email: "fleet@energydispenx.com",
      passwordHash: await bcrypt.hash("Fleet123!", 12),
      firstName: "Fleet",
      lastName: "Manager",
      role: UserRole.FLEET_MANAGER,
      organizationId: org.id,
    },
  });

  // Create Finance User
  await prisma.user.upsert({
    where: { email: "finance@energydispenx.com" },
    update: {},
    create: {
      email: "finance@energydispenx.com",
      passwordHash: await bcrypt.hash("Finance123!", 12),
      firstName: "Finance",
      lastName: "Officer",
      role: UserRole.FINANCE,
      organizationId: org.id,
    },
  });

  const superAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@energydispenx.com" },
  });
  const fleetUser = await prisma.user.findUniqueOrThrow({
    where: { email: "fleet@energydispenx.com" },
  });

  // Create Stations
  const stationA = await prisma.station.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: { stationCode: "LEK-01" },
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      stationCode: "LEK-01",
      name: "Total Lekki Phase 1",
      location: "Lekki, Lagos",
      address: "123 Lekki-Epe Expressway",
      pumpPriceNairaPerLiter: 650,
      pricePms: 650,
      priceAgo: 900,
      priceCng: 300,
      apiKey: "cfms_station_a_dev_key_001",
      isActive: true,
    },
  });

  const stationB = await prisma.station.upsert({
    where: { id: "00000000-0000-0000-0000-000000000011" },
    update: { stationCode: "IKY-01" },
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      stationCode: "IKY-01",
      name: "NNPC Ikoyi",
      location: "Ikoyi, Lagos",
      address: "45 Alfred Rewane Road",
      pumpPriceNairaPerLiter: 640,
      pricePms: 640,
      priceAgo: 880,
      priceCng: 290,
      apiKey: "cfms_station_b_dev_key_002",
      isActive: true,
    },
  });

  // Whitelist stations for org
  for (const station of [stationA, stationB]) {
    await prisma.stationWhitelist.upsert({
      where: {
        organizationId_stationId: { organizationId: org.id, stationId: station.id },
      },
      update: {},
      create: { organizationId: org.id, stationId: station.id },
    });
  }

  const demoAttendantHash = await bcrypt.hash("attendant1", 10);
  await prisma.stationAttendant.upsert({
    where: { stationId_username: { stationId: stationA.id, username: "attendant1" } },
    update: { passwordHash: demoAttendantHash, displayName: "Demo Attendant", isActive: true },
    create: {
      stationId: stationA.id,
      username: "attendant1",
      passwordHash: demoAttendantHash,
      displayName: "Demo Attendant",
    },
  });

  // Create sample employees with RFID.
  // Default staff PIN for seed users (staff portal / mobile): 1234 — bcrypt-hashed here.
  const seedStaffPinHash = await bcrypt.hash("1234", 10);
  const employees = [
    { staffId: "EMP-001", firstName: "Adebayo", lastName: "Ogundimu", rfidUid: "RFID001AAA", quotaType: QuotaType.NAIRA, quotaNaira: 50000, balanceNaira: 50000 },
    { staffId: "EMP-002", firstName: "Chidinma", lastName: "Okafor", rfidUid: "RFID002BBB", quotaType: QuotaType.LITERS, quotaLiters: 100, balanceLiters: 100 },
    { staffId: "EMP-003", firstName: "Musa", lastName: "Ibrahim", rfidUid: "RFID003CCC", quotaType: QuotaType.NAIRA, quotaNaira: 75000, balanceNaira: 75000 },
    { staffId: "EMP-004", firstName: "Ngozi", lastName: "Eze", rfidUid: "RFID004DDD", quotaType: QuotaType.LITERS, quotaLiters: 150, balanceLiters: 150 },
    { staffId: "EMP-005", firstName: "Tunde", lastName: "Bakare", rfidUid: "RFID005EEE", quotaType: QuotaType.NAIRA, quotaNaira: 30000, balanceNaira: 30000 },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { organizationId_staffId: { organizationId: org.id, staffId: emp.staffId } },
      update: { pin: seedStaffPinHash },
      create: { ...emp, organizationId: org.id, pin: seedStaffPinHash },
    });
  }

  const emp1 = await prisma.employee.findFirst({ where: { staffId: "EMP-001" } });
  const emp2 = await prisma.employee.findFirst({ where: { staffId: "EMP-002" } });

  if (emp1 && emp2) {
    const txDefs = [
      { key: "seed-tx-001", employeeId: emp1.id, stationId: stationA.id, amountLiters: 30, amountNaira: 19500, pumpPriceAtTime: 650, quotaType: QuotaType.NAIRA },
      { key: "seed-tx-002", employeeId: emp1.id, stationId: stationB.id, amountLiters: 20, amountNaira: 12800, pumpPriceAtTime: 640, quotaType: QuotaType.NAIRA },
      { key: "seed-tx-003", employeeId: emp2.id, stationId: stationA.id, amountLiters: 40, amountNaira: 26000, pumpPriceAtTime: 650, quotaType: QuotaType.LITERS },
    ];

    for (const tx of txDefs) {
      await prisma.transaction.upsert({
        where: { idempotencyKey: tx.key },
        update: {},
        create: {
          idempotencyKey: tx.key,
          employeeId: tx.employeeId,
          stationId: tx.stationId,
          amountLiters: tx.amountLiters,
          amountNaira: tx.amountNaira,
          pumpPriceAtTime: tx.pumpPriceAtTime,
          quotaType: tx.quotaType,
          syncStatus: "SYNCED",
          transactedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          syncedAt: new Date(),
        },
      });
    }

    await prisma.employee.update({
      where: { id: emp1.id },
      data: { balanceNaira: 50000 - 19500 - 12800 },
    });
    await prisma.employee.update({
      where: { id: emp2.id },
      data: { balanceLiters: 100 - 40 },
    });
  }

  // ─── Sample settlement + stored document (enterprise) ───
  const periodStart = new Date("2026-01-01T00:00:00.000Z");
  const periodEnd = new Date("2026-01-31T23:59:59.999Z");
  const settlement = await prisma.settlement.upsert({
    where: {
      stationId_organizationId_periodStart_periodEnd: {
        stationId: stationA.id,
        organizationId: org.id,
        periodStart,
        periodEnd,
      },
    },
    update: {},
    create: {
      stationId: stationA.id,
      organizationId: org.id,
      periodStart,
      periodEnd,
      totalLiters: 125.5,
      totalNairaDeducted: 81500,
      transactionCount: 12,
      status: SettlementStatus.PENDING,
    },
  });

  await prisma.storedDocument.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000d1" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000d1",
      organizationId: org.id,
      uploadedByUserId: superAdmin.id,
      settlementId: settlement.id,
      category: "SETTLEMENT_INVOICE",
      fileName: "settlement-jan-2026-sample.pdf",
      storageUrl: "https://storage.example.com/invoices/settlement-jan-2026-sample.pdf",
      mimeType: "application/pdf",
      sizeBytes: 245760,
    },
  });

  await prisma.storedDocument.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000d2" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000d2",
      organizationId: org.id,
      uploadedByUserId: fleetUser.id,
      category: "EXPORT",
      fileName: "fleet-report-template.csv",
      storageUrl: "https://storage.example.com/exports/fleet-report-template.csv",
      mimeType: "text/csv",
      sizeBytes: 4096,
    },
  });

  // ─── Audit logs ───
  await prisma.auditLog.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000e1" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000e1",
      actorUserId: superAdmin.id,
      organizationId: org.id,
      action: "SEED_DATABASE",
      entityType: "Organization",
      entityId: org.id,
      metadata: { version: "1", note: "Initial / idempotent seed" },
      ipAddress: "127.0.0.1",
      userAgent: "EnergyDispenX-seed-script",
    },
  });

  await prisma.auditLog.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000e2" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000e2",
      actorUserId: fleetUser.id,
      organizationId: org.id,
      action: "REPORT_VIEW",
      entityType: "SavedReport",
      metadata: { reportType: "transactions" },
    },
  });

  // ─── Refresh token (dev sample — rotate in production) ───
  const devRefreshSecret = "energydispenx-seed-refresh-token-v1";
  const refreshHash = sha256(devRefreshSecret);
  await prisma.refreshToken.upsert({
    where: { tokenHash: refreshHash },
    update: { expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    create: {
      tokenHash: refreshHash,
      userId: superAdmin.id,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // ─── Saved reports ───
  await prisma.savedReport.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000f1" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000f1",
      organizationId: org.id,
      createdByUserId: fleetUser.id,
      name: "Monthly transactions (default)",
      reportType: "transactions",
      filters: { from: "2026-01-01", to: "2026-01-31", stationId: "" },
      scheduleEnabled: true,
      cronExpression: "0 7 1 * *",
    },
  });

  await prisma.savedReport.upsert({
    where: { id: "00000000-0000-0000-0000-0000000000f2" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-0000000000f2",
      organizationId: org.id,
      createdByUserId: superAdmin.id,
      name: "Station performance Q1",
      reportType: "station-performance",
      filters: { from: "2026-01-01", to: "2026-03-31" },
      scheduleEnabled: false,
    },
  });

  // ─── Vehicle + telemetry registry + sample GPS/OBD2 ───
  if (emp1) {
    const vehicle = await prisma.vehicle.upsert({
      where: { plateNumber: "LAG-890EDX" },
      update: {
        obd2DeviceId: "OBD-SEED-001",
        gpsTrackerId: "GPS-SEED-001",
        employeeId: emp1.id,
      },
      create: {
        organizationId: org.id,
        employeeId: emp1.id,
        plateNumber: "LAG-890EDX",
        make: "Toyota",
        model: "Hilux",
        year: 2022,
        vin: "SEEDVIN890EDX001",
        fuelType: FuelType.PMS,
        obd2DeviceId: "OBD-SEED-001",
        gpsTrackerId: "GPS-SEED-001",
        isActive: true,
      },
    });

    await prisma.telemetryDevice.upsert({
      where: {
        organizationId_deviceKind_externalId: {
          organizationId: org.id,
          deviceKind: TelemetryDeviceKind.GPS_TRACKER,
          externalId: "GPS-SEED-001",
        },
      },
      update: { vehicleId: vehicle.id, lastSeenAt: new Date(), label: "Fleet GPS #1" },
      create: {
        organizationId: org.id,
        vehicleId: vehicle.id,
        deviceKind: TelemetryDeviceKind.GPS_TRACKER,
        externalId: "GPS-SEED-001",
        label: "Fleet GPS #1",
        lastSeenAt: new Date(),
        metadata: { vendor: "SeedTel", model: "GT-100" },
      },
    });

    await prisma.telemetryDevice.upsert({
      where: {
        organizationId_deviceKind_externalId: {
          organizationId: org.id,
          deviceKind: TelemetryDeviceKind.OBD2_ADAPTER,
          externalId: "OBD-SEED-001",
        },
      },
      update: { vehicleId: vehicle.id, lastSeenAt: new Date(), label: "ELM327 bay 1" },
      create: {
        organizationId: org.id,
        vehicleId: vehicle.id,
        deviceKind: TelemetryDeviceKind.OBD2_ADAPTER,
        externalId: "OBD-SEED-001",
        label: "ELM327 bay 1",
        lastSeenAt: new Date(),
        metadata: { protocol: "ISO15765" },
      },
    });

    await prisma.telemetryDevice.upsert({
      where: {
        organizationId_deviceKind_externalId: {
          organizationId: org.id,
          deviceKind: TelemetryDeviceKind.MOBILE_TABLET,
          externalId: "TAB-SEED-001",
        },
      },
      update: { lastSeenAt: new Date(), label: "Unassigned depot tablet" },
      create: {
        organizationId: org.id,
        vehicleId: null,
        deviceKind: TelemetryDeviceKind.MOBILE_TABLET,
        externalId: "TAB-SEED-001",
        label: "Unassigned depot tablet",
        isActive: true,
        metadata: { assignedTo: "warehouse" },
      },
    });

    const gpsCount = await prisma.gpsPosition.count({ where: { vehicleId: vehicle.id } });
    if (gpsCount === 0) {
      await prisma.gpsPosition.create({
        data: {
          vehicleId: vehicle.id,
          latitude: 6.4281,
          longitude: 3.4219,
          altitude: 12,
          speed: 35,
          heading: 180,
          accuracy: 8,
          source: "TRACKER",
          recordedAt: new Date(),
        },
      });
    }

    const obdCount = await prisma.obd2Reading.count({ where: { vehicleId: vehicle.id } });
    if (obdCount === 0) {
      await prisma.obd2Reading.create({
        data: {
          vehicleId: vehicle.id,
          rpm: 1850,
          speed: 34,
          engineCoolantTemp: 88,
          fuelLevel: 62,
          milStatus: false,
          dtcCodes: [],
          batteryVoltage: 12.6,
          recordedAt: new Date(),
        },
      });
    }
  }

  // ─── Sample recharge log ───
  if (emp1) {
    await prisma.rechargeLog.upsert({
      where: { id: "00000000-0000-0000-0000-0000000000c1" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-0000000000c1",
        employeeId: emp1.id,
        rechargedBy: superAdmin.id,
        rechargeType: RechargeType.TOP_UP,
        quotaType: QuotaType.NAIRA,
        amountNaira: 10000,
        amountLiters: 0,
        balanceBefore: 40000,
        balanceAfter: 50000,
        notes: "Seed monthly top-up sample",
      },
    });
  }

  console.log("Seed completed successfully!");
  console.log("\nDefault login credentials:");
  console.log("  Super Admin: admin@energydispenx.com / Admin123!");
  console.log("  Fleet Mgr:   fleet@energydispenx.com / Fleet123!");
  console.log("  Finance:     finance@energydispenx.com / Finance123!");
  console.log("  Staff (portal/mobile): Staff ID EMP-001 … EMP-005, PIN 1234");
  console.log("\nStation API Keys:");
  console.log("  Station A:   cfms_station_a_dev_key_001");
  console.log("  Station B:   cfms_station_b_dev_key_002");
  console.log("\nEnterprise seed:");
  console.log("  Vehicle LAG-890EDX + GPS/OBD2 sample readings + telemetry_devices");
  console.log("  Audit logs, refresh token (hashed), saved reports, stored documents, settlement sample");
  console.log("\nDev refresh token raw secret (hash stored in DB):", "energydispenx-seed-refresh-token-v1");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
