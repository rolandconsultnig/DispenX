process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.POS_HMAC_SECRET = process.env.POS_HMAC_SECRET || "test-pos-hmac-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/cfms_test?schema=public";
process.env.STATION_PORTAL_URL = process.env.STATION_PORTAL_URL || "http://localhost:4605";
