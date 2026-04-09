import { PrismaClient, UserRole, QuotaType } from "@prisma/client";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

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

  // Create Stations
  const stationA = await prisma.station.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
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
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000011",
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

  // Create sample employees with RFID
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
      update: {},
      create: { ...emp, organizationId: org.id },
    });
  }

  // Create a few sample transactions
  const emp1 = await prisma.employee.findFirst({ where: { staffId: "EMP-001" } });
  const emp2 = await prisma.employee.findFirst({ where: { staffId: "EMP-002" } });

  if (emp1 && emp2) {
    const txns = [
      { employeeId: emp1.id, stationId: stationA.id, amountLiters: 30, amountNaira: 19500, pumpPriceAtTime: 650, quotaType: QuotaType.NAIRA, idempotencyKey: `seed-${uuidv4()}` },
      { employeeId: emp1.id, stationId: stationB.id, amountLiters: 20, amountNaira: 12800, pumpPriceAtTime: 640, quotaType: QuotaType.NAIRA, idempotencyKey: `seed-${uuidv4()}` },
      { employeeId: emp2.id, stationId: stationA.id, amountLiters: 40, amountNaira: 26000, pumpPriceAtTime: 650, quotaType: QuotaType.LITERS, idempotencyKey: `seed-${uuidv4()}` },
    ];

    for (const tx of txns) {
      await prisma.transaction.create({
        data: {
          ...tx,
          syncStatus: "SYNCED",
          transactedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // random within last week
          syncedAt: new Date(),
        },
      });
    }

    // Update balances after seed transactions
    await prisma.employee.update({ where: { id: emp1.id }, data: { balanceNaira: 50000 - 19500 - 12800 } });
    await prisma.employee.update({ where: { id: emp2.id }, data: { balanceLiters: 100 - 40 } });
  }

  console.log("Seed completed successfully!");
  console.log("\nDefault login credentials:");
  console.log("  Super Admin: admin@energydispenx.com / Admin123!");
  console.log("  Fleet Mgr:   fleet@energydispenx.com / Fleet123!");
  console.log("  Finance:     finance@energydispenx.com / Finance123!");
  console.log("\nStation API Keys:");
  console.log("  Station A:   cfms_station_a_dev_key_001");
  console.log("  Station B:   cfms_station_b_dev_key_002");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
