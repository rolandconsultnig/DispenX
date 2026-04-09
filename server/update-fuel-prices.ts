import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.station.update({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    data: { pricePms: 650, priceAgo: 900, priceCng: 300 },
  });
  await prisma.station.update({
    where: { id: "00000000-0000-0000-0000-000000000011" },
    data: { pricePms: 640, priceAgo: 880, priceCng: 290 },
  });
  console.log("Stations updated with fuel prices");
  await prisma.$disconnect();
}

main();
