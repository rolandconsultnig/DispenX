import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import prisma from "../lib/prisma";

/**
 * Middleware to authenticate POS terminals via API key.
 * Expects header: X-Station-Api-Key
 */
export async function authenticateStation(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers["x-station-api-key"] as string | undefined;
  if (!apiKey) {
    return next(new AppError("Station API key required", 401));
  }

  try {
    const station = await prisma.station.findUnique({ where: { apiKey } });
    if (!station || !station.isActive) {
      return next(new AppError("Invalid or inactive station", 401));
    }
    (req as any).station = station;
    next();
  } catch (err) {
    next(err);
  }
}
