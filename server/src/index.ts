import app from "./app";
import { config } from "./config";
import prisma from "./lib/prisma";

async function main() {
  // Verify database connection
  await prisma.$connect();
  console.log("Database connected");

  app.listen(config.port, () => {
    console.log(`CFMS API server running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
