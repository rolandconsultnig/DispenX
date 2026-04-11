import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Trust X-Forwarded-* from first N proxies (nginx/ALB). Required for correct client IPs with express-rate-limit. */
function trustProxyHops(): number {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return 0;
  if (raw === "1" || raw.toLowerCase() === "true") return 1;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export const config = {
  // API port 4601 everywhere (local + production); override with PORT if needed.
  port: parseInt(process.env.PORT || "4601", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  trustProxyHops: trustProxyHops(),
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  posHmacSecret: requireEnv("POS_HMAC_SECRET"),
  defaultPumpPrice: parseFloat(process.env.DEFAULT_PUMP_PRICE || "650"),
  databaseUrl: requireEnv("DATABASE_URL"),
  stationPortalUrl: process.env.STATION_PORTAL_URL || "http://localhost:4604",
};
