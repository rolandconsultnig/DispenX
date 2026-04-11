import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import type { Options as RateLimitOptions } from "express-rate-limit";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth";
import orgRoutes from "./routes/organizations";
import employeeRoutes from "./routes/employees";
import stationRoutes from "./routes/stations";
import transactionRoutes from "./routes/transactions";
import settlementRoutes from "./routes/settlements";
import dashboardRoutes from "./routes/dashboard";
import mobileRoutes from "./routes/mobile";
import rechargeRoutes from "./routes/recharge";
import stationPortalRoutes from "./routes/stationPortal";
import fleetRoutes from "./routes/fleet";
import telemetryRoutes from "./routes/telemetry";

const app = express();

// Behind nginx / ALB: set TRUST_PROXY=1 in production so rate limits use real client IPs (X-Forwarded-For).
// Without this, every user appears as the proxy IP and /api/mobile/login hits 20 req / 15 min for everyone.
if (config.trustProxyHops > 0) {
  app.set("trust proxy", config.trustProxyHops);
}

// ─── Global Middleware ────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("short"));

// express-rate-limit v7 throws if X-Forwarded-For is set but trust proxy is false (common behind nginx).
// Disabling this check avoids 500s when TRUST_PROXY is not set yet; set TRUST_PROXY=1 for per-client limits.
const rateLimitBase: Partial<RateLimitOptions> = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
};

// Rate limiting
const limiter = rateLimit({
  ...rateLimitBase,
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
});
app.use("/api/", limiter);

// Auth-specific stricter rate limit (per client IP when trust proxy is set correctly).
const authLimiter = rateLimit({
  ...rateLimitBase,
  windowMs: 15 * 60 * 1000,
  max: 20,
});
// Staff/mobile PIN login: higher ceiling so a misconfigured proxy IP does not block the whole org.
const mobileLoginLimiter = rateLimit({
  ...rateLimitBase,
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/pos/login", authLimiter);
app.use("/api/mobile/login", mobileLoginLimiter);

// ─── Routes ──────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/organizations", orgRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api", transactionRoutes); // mounts /api/card/balance, /api/transaction/*, /api/transactions
app.use("/api/settlements", settlementRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/mobile", mobileRoutes);
app.use("/api/recharge", rechargeRoutes);
app.use("/api/station-portal", stationPortalRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/telemetry", telemetryRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Error Handler ───────────────────────────
app.use(errorHandler);

export default app;
