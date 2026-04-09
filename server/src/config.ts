import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4601", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "fallback-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  posHmacSecret: process.env.POS_HMAC_SECRET || "fallback-hmac",
  defaultPumpPrice: parseFloat(process.env.DEFAULT_PUMP_PRICE || "650"),
  databaseUrl: process.env.DATABASE_URL || "",
};
