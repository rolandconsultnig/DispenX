import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  // Must match staff/admin/station Vite proxy (see .env.example PORT=4000).
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  posHmacSecret: requireEnv("POS_HMAC_SECRET"),
  defaultPumpPrice: parseFloat(process.env.DEFAULT_PUMP_PRICE || "650"),
  databaseUrl: requireEnv("DATABASE_URL"),
  stationPortalUrl: process.env.STATION_PORTAL_URL || "http://localhost:4605",
};
