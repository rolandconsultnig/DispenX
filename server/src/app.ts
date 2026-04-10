import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
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

// ─── Global Middleware ────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("short"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Auth-specific stricter rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/pos/login", authLimiter);
app.use("/api/mobile/login", authLimiter);

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
